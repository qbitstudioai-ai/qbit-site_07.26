import { NextResponse } from "next/server";
import { taskRequestSchema } from "@/features/task-request/validation";

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
 * Грубый лимит частоты в памяти процесса. Сознательно простой и сознательно НЕ выдаётся за
 * полноценную защиту: при нескольких инстансах у каждого будет свой счётчик, а перезапуск его
 * обнуляет. Задача — отсечь примитивный флуд с одного адреса, а не выдержать целенаправленную
 * атаку (см. WORKPLAN.md Step 12.7, Out of scope: капча и полноценный антиспам).
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const recentRequests = new Map<string, number[]>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const previous = recentRequests.get(clientKey) ?? [];
  const withinWindow = previous.filter((at) => now - at < RATE_LIMIT_WINDOW_MS);

  if (withinWindow.length >= RATE_LIMIT_MAX_REQUESTS) {
    recentRequests.set(clientKey, withinWindow);
    return true;
  }

  withinWindow.push(now);
  recentRequests.set(clientKey, withinWindow);

  // Карта не должна расти бесконечно на долгоживущем процессе.
  if (recentRequests.size > 1000) {
    for (const [key, timestamps] of recentRequests) {
      if (timestamps.every((at) => now - at >= RATE_LIMIT_WINDOW_MS)) {
        recentRequests.delete(key);
      }
    }
  }

  return false;
}

function clientKeyOf(request: Request): string {
  // За прокси/CDN реальный адрес приходит заголовком. Берём первый адрес цепочки x-forwarded-for.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

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

  if (isRateLimited(clientKeyOf(request))) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
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

  const text = `Заявка с сайта Allqbit — «Ваша задача»\n\n${parsed.data.message}`;

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
