import { NextResponse } from "next/server";
import { jsonError, readJsonBody } from "@/server/api/guard";
import { loginSchema } from "@/server/api/schemas";
import { safeCompare, verifyPassword } from "@/server/auth/password";
import {
  clearFailedLogins,
  clientKeyFromHeaders,
  isLoginBlocked,
  recordFailedLogin,
} from "@/server/auth/rateLimit";
import { createSession } from "@/server/auth/session";

/**
 * Вход администратора.
 *
 * Три правила, которые здесь важнее удобства:
 *
 * 1. Ответ при неверном логине и при неверном пароле ОДИНАКОВЫЙ. Разные тексты («такого логина
 *    нет» / «пароль не подходит») подсказывали бы подбирающему, что логин угадан.
 * 2. Введённый пароль не попадает ни в лог, ни в ответ, ни в текст ошибки.
 * 3. Пароль проверяется всегда, даже если логин заведомо не совпал — иначе по времени ответа
 *    можно отличить существующий логин от несуществующего.
 */

export const runtime = "nodejs";

const GENERIC_ERROR = "Неверный логин или пароль";

export async function POST(request: Request): Promise<NextResponse> {
  const clientKey = clientKeyFromHeaders(request.headers);

  const adminLogin = process.env.ADMIN_LOGIN;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminLogin || !passwordHash || !process.env.SESSION_SECRET) {
    console.error(
      "[admin-api] login: не заданы ADMIN_LOGIN, ADMIN_PASSWORD_HASH или SESSION_SECRET",
    );
    return jsonError(503, "Вход не настроен. Обратитесь к администратору сервера.");
  }

  if (isLoginBlocked(clientKey)) {
    return jsonError(429, "Слишком много попыток входа. Повторите через 15 минут.");
  }

  const body = await readJsonBody(request, loginSchema);
  if (!body.ok) return body.response;

  const loginMatches = safeCompare(body.data.login, adminLogin);
  const passwordMatches = await verifyPassword(body.data.password, passwordHash);

  if (!loginMatches || !passwordMatches) {
    recordFailedLogin(clientKey);
    return jsonError(401, GENERIC_ERROR);
  }

  clearFailedLogins(clientKey);

  const cookie = createSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie);
  return response;
}
