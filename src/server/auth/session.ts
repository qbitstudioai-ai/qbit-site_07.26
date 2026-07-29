import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase, nowIso } from "../db/client";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "./constants";

/**
 * Серверные сессии администратора.
 *
 * Cookie хранит `<id>.<подпись>`, а НЕ факт авторизации: сам признак «вошёл» живёт строкой в
 * таблице `admin_sessions`. Поэтому «Выйти» действительно закрывает доступ (строка удаляется), а
 * подделать cookie нельзя даже зная формат — подпись считается по `SESSION_SECRET`.
 *
 * `localStorage`, `sessionStorage` и React state в этой схеме не участвуют вовсе: они управляются
 * из браузера и к серверной проверке отношения не имеют.
 */

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET не задан или короче 16 символов — вход в админ-панель невозможен",
    );
  }
  return secret;
}

export function signSessionId(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("base64url");
}

/** Разбирает значение cookie и проверяет подпись. Идентификатор без валидной подписи отбрасывается. */
export function parseSessionCookie(value: string | undefined, secret: string): string | null {
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const sessionId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = signSessionId(sessionId, secret);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return sessionId;
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

/** Создаёт сессию в базе и возвращает параметры cookie для ответа. */
export function createSession(): SessionCookieOptions {
  const secret = sessionSecret();
  const sessionId = randomBytes(32).toString("base64url");
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_TTL_MS);

  const db = getDatabase();
  db.prepare(
    "INSERT INTO admin_sessions (id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?)",
  ).run(sessionId, created.toISOString(), expires.toISOString(), created.toISOString());

  // Заодно чистим просроченные: отдельного планировщика в проекте нет, а таблица не должна расти.
  db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(created.toISOString());

  return {
    name: SESSION_COOKIE,
    value: `${sessionId}.${signSessionId(sessionId, secret)}`,
    httpOnly: true,
    // Secure только в production: на http://localhost браузер не примет secure-cookie, и вход в
    // dev-режиме просто перестал бы работать.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function destroySession(sessionId: string): void {
  getDatabase().prepare("DELETE FROM admin_sessions WHERE id = ?").run(sessionId);
}

/** Проверка сессии по базе: истёкшая запись удаляется и считается отсутствующей. */
export function isSessionValid(sessionId: string): boolean {
  const db = getDatabase();
  const row = db.prepare("SELECT expires_at FROM admin_sessions WHERE id = ?").get(sessionId) as
    { expires_at?: string } | undefined;

  if (!row?.expires_at) return false;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM admin_sessions WHERE id = ?").run(sessionId);
    return false;
  }

  db.prepare("UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), sessionId);
  return true;
}

/**
 * Идентификатор действующей сессии текущего запроса или `null`.
 *
 * ЕДИНСТВЕННАЯ точка, где серверный код узнаёт, что запрос авторизован. Middleware проверяет только
 * подпись cookie (на Edge базы нет) — окончательное слово всегда за этой функцией.
 */
export async function getActiveSessionId(): Promise<string | null> {
  let secret: string;
  try {
    secret = sessionSecret();
  } catch {
    return null;
  }

  const store = await cookies();
  const sessionId = parseSessionCookie(store.get(SESSION_COOKIE)?.value, secret);
  if (!sessionId) return null;

  return isSessionValid(sessionId) ? sessionId : null;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getActiveSessionId()) !== null;
}

/** Параметры cookie для выхода: пустое значение с нулевым временем жизни. */
export function clearedSessionCookie(): SessionCookieOptions {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
