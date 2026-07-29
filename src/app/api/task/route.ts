import { NextResponse } from "next/server";
import { taskRequestSchema } from "@/features/task-request/validation";
import { createRateLimiter } from "@/server/net/publicRateLimit";

/**
 * Приём заявки «Ваша задача» и доставка её в Telegram (Step 12.7).
 *
 * Почему серверный роут, а не запрос в Telegram прямо из браузера: токен бота — секрет. Уйдя в
 * клиентский бандл, он даёт кому угодно право писать от имени бота. Здесь он читается только из
 * process.env и наружу не отдаётся ни в одном ответе, включая тексты ошибок.
 *
 * Переменные окружения заводит владелец проекта (см. README, раздел «Форма „Ваша задача“»):
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather;
 *   TELEGRAM_CHAT_ID   — куда слать (личный chat_id или id группы).
 */

// Кэшировать нечего: каждый POST — новое действие.
export const dynamic = "force-dynamic";

/**
 * Грубый лимит частоты в памяти процесса — см. `createRateLimiter`. Сознательно НЕ выдаётся за
 * полноценную защиту (WORKPLAN.md Step 12.7, Out of scope: капча и полноценный антиспам).
 *
 * Собственная копия разбора `x-forwarded-for` отсюда убрана: она читала заголовок безусловно, и
 * лимит обходился сменой значения на каждый запрос (аудит 2026-07-27).
 */
const isRateLimited = createRateLimiter({
  windowMs: 60_000,
  maxPerAddress: 3,
  maxShared: 30,
});

/** Потолок тела запроса. Заявка — это текст, 64 КБ хватает с большим запасом. */
const MAX_TASK_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Честная 503 вместо тихого «успеха»: если бот не настроен, посетитель ДОЛЖЕН узнать, что его
  // сообщение никуда не ушло (WORKPLAN.md Step 12.7, AC5). Молчаливый успех здесь — худший из
  // возможных вариантов: человек ждёт ответа, которого никто не получил.
  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, reason: "not-configured" },
      { status: 503, statusText: "Telegram delivery is not configured" },
    );
  }

  if (isRateLimited(request.headers)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  // Ограничение размера тела — как в `/api/contact` и `readJsonBody`. Здесь его не было: лимит
  // частоты смягчал последствия, но 30 стомегабайтных тел в минуту процесс переваривает плохо
  // (найдено code review 2026-07-27).
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TASK_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "payload-too-large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_TASK_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: "payload-too-large" }, { status: 413 });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid-json" }, { status: 400 });
  }

  const parsed = taskRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid-payload" }, { status: 400 });
  }

  // Honeypot заполнен — это бот. Отвечаем как при успехе и никуда не отправляем: сообщать боту, что
  // он распознан, значит помочь его автору обойти проверку в следующий раз.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const text = `Заявка с сайта QBit-Studio-Ai — «Ваша задача»\n\n${parsed.data.message}`;

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });

    if (!telegramResponse.ok) {
      // Тело ответа Telegram наружу не отдаём: оно может содержать фрагменты токена/служебные детали.
      console.error("Telegram sendMessage failed with status", telegramResponse.status);
      return NextResponse.json({ ok: false, reason: "delivery-failed" }, { status: 502 });
    }
  } catch (error) {
    console.error("Telegram sendMessage threw", error);
    return NextResponse.json({ ok: false, reason: "delivery-failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
