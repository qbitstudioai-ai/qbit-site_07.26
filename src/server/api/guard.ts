import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { MAX_JSON_BYTES } from "../config";
import { getActiveSessionId } from "../auth/session";

/**
 * Общие правила административного API.
 *
 * Каждый административный роут начинается с `requireSession()`. Проверка идёт по базе, а не по
 * наличию cookie: middleware отсекает лишь очевидно чужие запросы, а настоящее решение принимается
 * здесь. Защита на уровне API обязательна и без middleware — к роуту можно обратиться напрямую.
 */

export interface ApiFailure {
  response: NextResponse;
}

export function jsonError(status: number, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

/** `null` — доступ разрешён; иначе готовый ответ 401, который нужно вернуть из роута. */
export async function requireSession(): Promise<NextResponse | null> {
  const sessionId = await getActiveSessionId();
  if (sessionId) return null;

  return jsonError(401, "Требуется вход в админ-панель");
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Разбирает и проверяет тело запроса.
 *
 * Размер ограничивается ДО разбора: 50-мегабайтный JSON не должен превращаться в объект в памяти
 * только для того, чтобы потом не пройти валидацию. Схема — Zod: неизвестные и неверные поля
 * отсекаются на границе, а не «где-то в репозитории».
 */
export async function readJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParsedBody<T>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_JSON_BYTES) {
    return { ok: false, response: jsonError(413, "Слишком большой запрос") };
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) {
      return { ok: false, response: jsonError(413, "Слишком большой запрос") };
    }
    raw = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "Некорректный JSON в теле запроса") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(
        422,
        "Проверьте заполнение полей",
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Единая обработка неожиданной ошибки роута.
 *
 * Наружу уходит только текст для человека: stack trace в ответе — это карта внутреннего устройства
 * приложения. Технические подробности пишутся в серверный лог, куда посетитель не смотрит.
 */
export function handleUnexpected(error: unknown, action: string): NextResponse {
  console.error(`[admin-api] ${action}:`, error);
  return jsonError(500, "Не удалось выполнить операцию. Попробуйте ещё раз.");
}
