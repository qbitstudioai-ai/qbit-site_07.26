import { NextResponse } from "next/server";
import { clearedSessionCookie, destroySession, getActiveSessionId } from "@/server/auth/session";

/**
 * Выход из админ-панели.
 *
 * Сессия удаляется ИЗ БАЗЫ, а не только гасится cookie: cookie можно вернуть из копии, строку в
 * базе — нет. После этого запрос с тем же значением cookie не пройдёт серверную проверку.
 */

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const sessionId = await getActiveSessionId();
  if (sessionId) destroySession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedSessionCookie());
  return response;
}
