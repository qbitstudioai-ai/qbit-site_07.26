import { z } from "zod";

/**
 * Правила заявки со страницы контактов — ОДИН источник для браузера и для сервера.
 *
 * Клиент проверяет форму ради удобства, сервер (`src/app/api/contact/route.ts`) — как источник
 * истины: запрос может прийти вообще без участия страницы. Оба импортируют этот модуль, поэтому
 * правила физически не могут разъехаться. Модуль намеренно не тянет React и Next: он должен
 * одинаково работать в route handler, в клиентском компоненте и в unit-тестах.
 */

/** Максимальные длины полей. Сервер применяет их же — «ограничение размера полей» на его стороне. */
export const CONTACT_LIMITS = {
  name: 80,
  phone: 32,
  telegram: 40,
  process: 2000,
} as const;

export const CONTACT_NAME_MIN_LENGTH = 2;
export const CONTACT_PROCESS_MIN_LENGTH = 15;

/**
 * Минимум и максимум ЗНАЧАЩИХ цифр номера. Верхняя граница — E.164 (15 цифр), нижняя взята с
 * запасом вниз от коротких национальных планов. Российский формат специально не навязывается:
 * заявка может прийти из любой страны.
 */
const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 15;

/** Символы, допустимые в человеческой записи номера: цифры, плюс, пробелы, скобки, дефисы, точки. */
const PHONE_ALLOWED_CHARS = /^[+\d\s().-]+$/;

/** Username Telegram: латиница, цифры и подчёркивание. Длина — по правилам Telegram, с запасом. */
const TELEGRAM_USERNAME = /^[A-Za-z0-9_]{4,32}$/;

/** Тексты ошибок. Показываются пользователю дословно — и на клиенте, и (в тестах) на сервере. */
export const CONTACT_ERRORS = {
  name: "Укажите ваше имя.",
  contact: "Укажите телефон или Telegram.",
  phone: "Проверьте формат телефона.",
  telegram: "Укажите Telegram в формате @username.",
  process: "Коротко опишите процесс или задачу.",
} as const;

export type ContactFieldKey = keyof typeof CONTACT_ERRORS;

/**
 * Порядок обхода полей. Определяет, на какое поле уводится фокус после неудачной отправки: на
 * первое ошибочное в порядке чтения формы. `contact` — не поле ввода, а правило пары «телефон или
 * Telegram»; фокус по нему уходит на телефон (см. `CONTACT_ERROR_FOCUS`).
 */
export const CONTACT_FIELD_ORDER: readonly ContactFieldKey[] = [
  "name",
  "contact",
  "phone",
  "telegram",
  "process",
] as const;

/** Куда ставить фокус по каждой ошибке. */
export const CONTACT_ERROR_FOCUS: Record<
  ContactFieldKey,
  "name" | "phone" | "telegram" | "process"
> = {
  name: "name",
  contact: "phone",
  phone: "phone",
  telegram: "telegram",
  process: "process",
};

export interface ContactFormValues {
  name: string;
  phone: string;
  telegram: string;
  process: string;
}

/** Куда форма отправляет заявку. Прямой вызов n8n из браузера исключён — только этот роут. */
export const CONTACT_ENDPOINT = "/api/contact";

/**
 * Страницы, с которых форма реально отправляется. Их ровно две: сама страница контактов и раздел
 * «Ваша задача» на главной — `ContactForm` больше нигде не рендерится.
 *
 * Значение приходит от клиента (`ContactForm` получает его пропом от той страницы, которая его
 * показывает) и потому проверяется на сервере по этому списку. Никакой другой строки в поле `page`
 * заявки оказаться не может — включая подставленную вручную в обход формы.
 */
export const CONTACT_PAGES = ["/", "/contacts"] as const;

export type ContactPage = (typeof CONTACT_PAGES)[number];

/**
 * Значение по умолчанию — страница контактов. Так вело себя поле `page` до появления выбора
 * (оно было захардкожено), и в это же значение попадают запросы от бандла, закэшированного
 * браузером до выката. Заявка с неизвестным `page` не отбрасывается: страница отправки — сведение
 * для отчёта, а не часть заявки, и терять из-за него обращение нельзя.
 */
export const DEFAULT_CONTACT_PAGE: ContactPage = "/contacts";

export function normalizeContactPage(raw: unknown): ContactPage {
  return CONTACT_PAGES.find((page) => page === raw) ?? DEFAULT_CONTACT_PAGE;
}

/**
 * Имя honeypot-поля. Спрятано от людей, но выглядит для бота обычным полем компании. В payload для
 * n8n не попадает никогда — сервер использует его только как признак автоматической отправки.
 */
export const CONTACT_HONEYPOT_FIELD = "company";

/**
 * Нижняя граница времени заполнения. Человек физически не успевает ввести имя, контакт и осмысленное
 * описание процесса (минимум 15 символов) за три секунды; мгновенная отправка — признак скрипта.
 */
export const CONTACT_MIN_FILL_MS = 3000;

/** Верхняя граница размера тела запроса. Всё, что больше, отбрасывается до разбора JSON. */
export const CONTACT_MAX_BODY_BYTES = 16_384;

/**
 * Нормализация телефона. Отображаемый ввод человека не меняется — нормализуется только значение,
 * которое уходит в n8n: единый формат делает заявки сравнимыми между собой.
 *
 * Российское «8» в начале 11-значного номера трактуется как «+7» — это не догадка, а
 * общепринятая запись; во всех остальных случаях цифры сохраняются как есть под знаком «+».
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!trimmed.startsWith("+") && digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  return `+${digits}`;
}

export function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!PHONE_ALLOWED_CHARS.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

/**
 * Нормализация Telegram: принимается запись и с «@», и без него, наружу уходит всегда «@username».
 *
 * Полная ссылка (`https://t.me/name`) НЕ разбирается намеренно: молчаливое превращение ссылки в
 * username — это догадка о вводе, и при опечатке она отправит заявку не тому человеку. Такой ввод
 * не проходит проверку, и человек видит понятное требование формата.
 */
export function normalizeTelegram(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const username = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!TELEGRAM_USERNAME.test(username)) return null;

  return `@${username}`;
}

/**
 * Схема заявки. На выходе — уже нормализованные значения ровно того вида, в котором они уходят
 * в n8n: пустой телефон и пустой Telegram становятся `null`, имя и описание приходят после trim().
 */
export const contactSubmissionSchema = z
  .object({
    name: z.string(),
    phone: z.string().optional(),
    telegram: z.string().optional(),
    process: z.string(),
  })
  .superRefine((values, ctx) => {
    const name = values.name.trim();
    if (name.length < CONTACT_NAME_MIN_LENGTH || name.length > CONTACT_LIMITS.name) {
      ctx.addIssue({ code: "custom", path: ["name"], message: CONTACT_ERRORS.name });
    }

    const phone = (values.phone ?? "").trim();
    const telegram = (values.telegram ?? "").trim();

    // Ключевое правило страницы: способ связи должен остаться хотя бы один. Каждое из двух полей
    // по отдельности необязательно, пустыми одновременно они быть не могут.
    if (!phone && !telegram) {
      ctx.addIssue({ code: "custom", path: ["contact"], message: CONTACT_ERRORS.contact });
    }

    if (phone && (phone.length > CONTACT_LIMITS.phone || !isValidPhone(phone))) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: CONTACT_ERRORS.phone });
    }

    if (telegram && (telegram.length > CONTACT_LIMITS.telegram || !normalizeTelegram(telegram))) {
      ctx.addIssue({ code: "custom", path: ["telegram"], message: CONTACT_ERRORS.telegram });
    }

    const process = values.process.trim();
    if (process.length < CONTACT_PROCESS_MIN_LENGTH || process.length > CONTACT_LIMITS.process) {
      ctx.addIssue({ code: "custom", path: ["process"], message: CONTACT_ERRORS.process });
    }
  })
  .transform((values) => ({
    name: values.name.trim(),
    phone: normalizePhone(values.phone ?? ""),
    telegram: normalizeTelegram(values.telegram ?? ""),
    process: values.process.trim(),
  }));

export type ContactSubmission = z.output<typeof contactSubmissionSchema>;

/**
 * Ошибки формы в виде «поле → сообщение». Тот же вызов схемы, что и на сервере, поэтому форма не
 * может пропустить то, что сервер отвергнет, и наоборот.
 */
export function collectContactErrors(
  values: ContactFormValues,
): Partial<Record<ContactFieldKey, string>> {
  const parsed = contactSubmissionSchema.safeParse(values);
  if (parsed.success) return {};

  const errors: Partial<Record<ContactFieldKey, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key in CONTACT_ERRORS) {
      errors[key as ContactFieldKey] ??= issue.message;
    }
  }
  return errors;
}
