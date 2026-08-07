import { NextResponse } from "next/server";
import { readAttributionCookie } from "@/features/attribution/attribution";
import { buildContactMessage } from "@/features/contacts/contactMessage";
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_MAX_BODY_BYTES,
  CONTACT_MIN_FILL_MS,
  contactSubmissionSchema,
  normalizeContactPage,
} from "@/features/contacts/contactSchema";
import { createRateLimiter } from "@/server/net/publicRateLimit";

/**
 * Приём заявки со страницы `/contacts` и доставка её в n8n.
 *
 * Почему серверный роут, а не запрос из браузера прямо на webhook n8n:
 *   • URL webhook не должен попадать в клиентский бандл — иначе его может дёргать кто угодно;
 *   • секрет тем более не должен быть виден пользователю;
 *   • данные обязаны валидироваться повторно на стороне, которую нельзя подменить из DevTools;
 *   • формат payload контролирует сервер, а не форма;
 *   • нет зависимости от CORS-настроек n8n.
 *
 * Переменные окружения (см. `.env.example` и README):
 *   N8N_CONTACT_WEBHOOK_URL    — адрес production-webhook сценария n8n;
 *   N8N_CONTACT_WEBHOOK_SECRET — общий секрет, уходит заголовком X-QBit-Webhook-Secret.
 * Обе читаются ТОЛЬКО здесь и наружу не отдаются ни в одном ответе, включая тексты ошибок.
 *
 * Рекламный источник заявки (`attribution`) роут берёт из cookie `qbit_attr`, которую ставит
 * middleware при переходе с меткой (`yclid`, `utm_*`). Форма его не передаёт и знать о нём не
 * должна — см. `src/features/attribution/attribution.ts`.
 *
 * Принимающий сценарий — «Qbit_sait/Webhook → Telegram notification»: узел Telegram берёт текст из
 * `body.message`, а получателя — из `body.chat_id` с фолбэком на адрес владельца. `chat_id` отсюда
 * НЕ отправляется намеренно: получатель — настройка n8n, и сайт не должен уметь её переопределять.
 */

// Кэшировать нечего: каждый POST — новое действие.
export const dynamic = "force-dynamic";

/** Сколько ждём ответа n8n. Дольше — посетитель уже считает форму зависшей. */
const WEBHOOK_TIMEOUT_MS = 9000;

/**
 * Ограничение частоты. До аудита 2026-07-27 его здесь не было вовсе: honeypot и `elapsedMs` —
 * единственные барьеры, причём `elapsedMs` приходит от клиента и подделывается одним числом.
 * Скрипт мог гнать неограниченный поток заявок в n8n, забивая мусором все подключённые каналы и
 * удерживая до 9 с исходящего запроса на каждую.
 *
 * Порог выше, чем у `/api/task`: страница контактов допускает исправление и повторную отправку.
 */
const isRateLimited = createRateLimiter({
  windowMs: 60_000,
  maxPerAddress: 5,
  maxShared: 40,
});

/** Ответ «как при успехе» для отброшенных ботов: подтверждать распознавание — значит помогать. */
const silentOk = () => NextResponse.json({ ok: true }, { status: 200 });

export async function POST(request: Request) {
  // Проверка Content-Type: обычная форма всегда шлёт JSON. Всё остальное — не наша форма.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ ok: false, reason: "unsupported-media-type" }, { status: 415 });
  }

  if (isRateLimited(request.headers)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  // Ограничение размера тела: сначала по заявленной длине, затем по фактически прочитанному тексту
  // (заголовку верить нельзя, он может отсутствовать или лгать).
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > CONTACT_MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "payload-too-large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > CONTACT_MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "payload-too-large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid-json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, reason: "invalid-payload" }, { status: 400 });
  }

  const envelope = body as Record<string, unknown>;

  // Honeypot заполнен — это бот. Отвечаем как при успехе и ничего не отправляем.
  const honeypot = envelope[CONTACT_HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return silentOk();
  }

  // Отправка быстрее человеческого минимума. Значение приходит от клиента и потому не является
  // строгой защитой — это отсев примитивных скриптов, а не антибот-система (см. отчёт: полноценный
  // rate limit ставится на reverse proxy, хостинге или внутри n8n).
  const elapsedMs = envelope.elapsedMs;
  if (
    typeof elapsedMs === "number" &&
    Number.isFinite(elapsedMs) &&
    elapsedMs < CONTACT_MIN_FILL_MS
  ) {
    return silentOk();
  }

  const parsed = contactSubmissionSchema.safeParse(envelope);
  if (!parsed.success) {
    // Наружу уходит только факт «данные не приняты»: перечень полей серверной валидации нужен
    // форме, а форма проверила их теми же правилами до отправки.
    return NextResponse.json({ ok: false, reason: "invalid-payload" }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_CONTACT_WEBHOOK_SECRET;

  // Честная 503 вместо тихого «успеха»: если webhook не настроен, посетитель ДОЛЖЕН узнать, что
  // заявка никуда не ушла. Значение конфигурации при этом не раскрывается.
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const submissionId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  // Страница отправки. Приходит от формы и проверяется по списку `CONTACT_PAGES`: `/contacts` или
  // `/` (раздел «Ваша задача» на главной). Раньше здесь стояла строковая константа `/contacts`,
  // из-за чего заявки с главной приходили с чужой пометкой — и в поле, и в тексте для Telegram.
  const page = normalizeContactPage(envelope.page);

  const payload = {
    submissionId,
    source: "qbit-studio-ai-contacts",
    page,
    // Готовый текст для Telegram. Сценарий n8n подставляет `body.message` без обработки, поэтому
    // формулировка — ответственность сайта (см. `contactMessage.ts`).
    message: buildContactMessage(parsed.data, { submissionId, submittedAt, page }),
    // Те же данные по полям: нужны сценарию, если заявку захотят класть не только в Telegram
    // (таблица, CRM, фильтрация) — разбирать текст сообщения для этого не придётся.
    name: parsed.data.name,
    phone: parsed.data.phone,
    telegram: parsed.data.telegram,
    process: parsed.data.process,
    submittedAt,
    // Рекламный источник из cookie `qbit_attr` (её ставит middleware). Берётся из ЗАПРОСА, а не из
    // тела формы: cookie тоже правится в браузере, но её содержимое уже прошло санитайз при записи
    // и проходит повторно при чтении, тогда как поле формы пришлось бы принимать как есть.
    // `null` — обычный случай: человек пришёл не по рекламе.
    // В текст `message` атрибуция намеренно НЕ добавляется: сообщение в Telegram читает человек,
    // и служебные метки в нём мешают. Разбор источника — задача сценария n8n по этому полю.
    attribution: readAttributionCookie(request.headers.get("cookie")),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(webhookSecret ? { "X-QBit-Webhook-Secret": webhookSecret } : {}),
      },
      body: JSON.stringify(payload),
      // Повторов нет намеренно: n8n мог принять заявку и не успеть ответить, и повтор создал бы
      // дубль. Лучше показать человеку честную ошибку, чем завести вторую заявку втихую.
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Тело ответа n8n наружу не отдаём и не логируем: там могут быть служебные детали сценария.
      // В лог уходит только статус и идентификатор заявки — персональных данных в нём нет.
      console.error("n8n contact webhook failed", {
        status: response.status,
        submissionId: payload.submissionId,
      });
      return NextResponse.json({ ok: false, reason: "delivery-failed" }, { status: 502 });
    }
  } catch (error) {
    console.error("n8n contact webhook threw", {
      submissionId: payload.submissionId,
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ ok: false, reason: "delivery-failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, submissionId: payload.submissionId }, { status: 200 });
}
