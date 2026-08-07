/**
 * Рекламная атрибуция заявки: откуда пришёл человек, который в итоге заполнил форму.
 *
 * Задача узкая: запомнить последний рекламный переход и приложить его к заявке в n8n. Ни счётчиков,
 * ни профилирования, ни идентификатора пользователя здесь нет и быть не должно.
 *
 * Модуль намеренно не тянет ни React, ни Next: он исполняется в middleware (Edge runtime, где нет
 * Node API), в route handler и в unit-тестах. Только URLSearchParams, JSON и строки.
 *
 * Главное правило: ВСЁ, что сюда приходит, — недоверенный ввод. Метки берутся из адресной строки,
 * то есть их задаёт тот, кто прислал ссылку; cookie редактируется в DevTools за пять секунд.
 * Поэтому санитайз выполняется дважды: при записи (`buildAttribution`) и при чтении
 * (`parseAttributionCookie`). Второй раз — не перестраховка: между записью и чтением значение
 * побывало на стороне клиента.
 */

/** Имя cookie. HttpOnly — клиентскому JS она не нужна, а лишний доступ создаёт лишнюю поверхность. */
export const ATTRIBUTION_COOKIE_NAME = "qbit_attr";

/**
 * Срок жизни — 90 дней. Порядок цикла сделки в автоматизации: человек может прийти по объявлению,
 * подумать несколько недель и вернуться напрямую. Более длинный срок уже приписывает заявку рекламе,
 * к которой она отношения не имеет.
 */
export const ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** Потолок длины одного рекламного значения. Осмысленные utm-метки в него укладываются с запасом. */
export const ATTRIBUTION_VALUE_MAX_LENGTH = 200;

/**
 * Потолок размера самой cookie. Браузеры гарантируют около 4096 байт на cookie, и превышение
 * означает не ошибку, а молчаливый отказ её сохранить.
 *
 * Запас нужен именно здесь: значение уходит через `encodeURIComponent`, где один символ кириллицы
 * превращается в шесть (`%D0%9F`). Шесть меток по 200 символов кириллицы — это ~7 КБ, то есть
 * потерянная cookie. Отсюда ступенчатое сжатие в `serializeAttributionCookie`.
 */
export const ATTRIBUTION_COOKIE_MAX_BYTES = 3800;

/** Параметры, которые сохраняются. Всё остальное из адресной строки игнорируется молча. */
export const AD_PARAM_KEYS = [
  "yclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type AdParamKey = (typeof AD_PARAM_KEYS)[number];

export interface Attribution {
  yclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Внутренний путь, на который человек попал по рекламной ссылке. Только pathname, без query. */
  landing_path: string;
  /** Когда зафиксирован переход, ISO-8601 UTC. */
  captured_at: string;
}

/**
 * Управляющие и невидимые символы: C0/C1 (`\n`, `\r`, `\t` и прочие) плюс форматирующие —
 * zero-width и метки смены направления письма. Первые ломают формат cookie и читаемость заявки,
 * вторые позволяют нарисовать в тексте одно, а сохранить другое.
 */
const CONTROL_AND_FORMAT = /[\p{Cc}\p{Cf}]/gu;

/**
 * Нормализация одного рекламного значения: убрать управляющие символы, обрезать по краям, обрезать
 * до лимита. Пустое значение — это отсутствие значения, а не пустая строка.
 */
export function sanitizeAdValue(
  raw: string | null | undefined,
  maxLength = ATTRIBUTION_VALUE_MAX_LENGTH,
): string | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(CONTROL_AND_FORMAT, "").trim();
  if (!cleaned) return null;

  // Второй trim — после обрезки: срез посреди пробелов оставил бы хвост из пробелов.
  const capped = cleaned.slice(0, maxLength).trim();
  return capped || null;
}

/**
 * Нормализация пути приземления. Наружу уходит ТОЛЬКО внутренний путь: ни абсолютного адреса, ни
 * протокол-относительного `//чужой.сайт`, ни строки запроса.
 *
 * Строка запроса отбрасывается сознательно — в ней и живут рекламные метки, а дублировать их
 * внутри `landing_path` значит второй раз положить в заявку тот же недоверенный текст.
 */
export function sanitizeLandingPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";

  let value = raw.replace(CONTROL_AND_FORMAT, "").trim();
  // Обратный слэш часть браузеров трактует как разделитель пути; приводим к одному виду.
  value = value.replace(/\\/g, "/");

  const cut = value.search(/[?#]/);
  if (cut !== -1) value = value.slice(0, cut);

  if (!value.startsWith("/")) return "/";
  // `//host` — протокол-относительный адрес. Схлопываем ведущие слэши до одного.
  value = value.replace(/^\/+/, "/");

  return value.slice(0, ATTRIBUTION_VALUE_MAX_LENGTH) || "/";
}

/** Метки из адресной строки после санитайза. Ключи присутствуют всегда, значения могут быть null. */
function readAdParams(
  searchParams: URLSearchParams,
  maxLength = ATTRIBUTION_VALUE_MAX_LENGTH,
): Record<AdParamKey, string | null> {
  const values = {} as Record<AdParamKey, string | null>;
  for (const key of AD_PARAM_KEYS) {
    values[key] = sanitizeAdValue(searchParams.get(key), maxLength);
  }
  return values;
}

/**
 * Сборка записи об источнике из текущего запроса. Возвращает null, если рекламных меток нет, —
 * вызывающая сторона по этому признаку понимает, что cookie трогать не нужно. Отдельной функции
 * «есть ли метки» нет намеренно: два способа ответить на один вопрос неизбежно разъезжаются.
 */
export function buildAttribution(
  searchParams: URLSearchParams,
  pathname: string,
  capturedAt: Date = new Date(),
): Attribution | null {
  const values = readAdParams(searchParams);
  if (!AD_PARAM_KEYS.some((key) => values[key] !== null)) return null;

  return {
    yclid: values.yclid,
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    utm_content: values.utm_content,
    utm_term: values.utm_term,
    landing_path: sanitizeLandingPath(pathname),
    captured_at: capturedAt.toISOString(),
  };
}

/** Копия записи с более жёстким лимитом на значения. Используется ступенчатым сжатием. */
function withValueCap(attribution: Attribution, maxLength: number): Attribution {
  return {
    yclid: sanitizeAdValue(attribution.yclid, maxLength),
    utm_source: sanitizeAdValue(attribution.utm_source, maxLength),
    utm_medium: sanitizeAdValue(attribution.utm_medium, maxLength),
    utm_campaign: sanitizeAdValue(attribution.utm_campaign, maxLength),
    utm_content: sanitizeAdValue(attribution.utm_content, maxLength),
    utm_term: sanitizeAdValue(attribution.utm_term, maxLength),
    landing_path: attribution.landing_path,
    captured_at: attribution.captured_at,
  };
}

/**
 * Ступени сжатия. Реальные метки короткие и укладываются в первую же; ступени существуют ради
 * искусственно раздутого адреса, который иначе выбил бы cookie за лимит браузера целиком.
 */
const VALUE_CAP_STEPS = [ATTRIBUTION_VALUE_MAX_LENGTH, 120, 60, 30] as const;

/**
 * Значение cookie — JSON БЕЗ процентного кодирования.
 *
 * Кодирует тот, кто cookie записывает: `NextResponse.cookies.set()` прогоняет значение через
 * `encodeURIComponent` сам. Закодировать здесь ещё раз — значит получить двойное кодирование, при
 * котором обратная сторона (`parseAttributionCookie`) после одного декодирования видит не JSON, а
 * снова процентную строку, и атрибуция молча теряется на всех заявках. Ровно это и происходило до
 * правки — поймано e2e против production-сборки, unit-тесты его не видели, потому что складывали
 * заголовок `Cookie` сами и кодировали ровно один раз.
 *
 * Бюджет размера при этом считается по ЗАКОДИРОВАННОЙ длине: в браузер и обратно едет именно она.
 */
export function serializeAttributionCookie(attribution: Attribution): string {
  for (const cap of VALUE_CAP_STEPS) {
    const json = JSON.stringify(withValueCap(attribution, cap));
    if (encodeURIComponent(json).length <= ATTRIBUTION_COOKIE_MAX_BYTES) return json;
  }

  // Пол: самая жёсткая ступень. В бюджет она укладывается при любых входных данных (шесть значений
  // по 30 символов кириллицы плюс путь — около 2,4 КБ из 3,8 КБ), поэтому цикл выше возвращает
  // результат всегда; эта строка существует ради полноты функции, а не как отдельная стратегия.
  return JSON.stringify(withValueCap(attribution, VALUE_CAP_STEPS[VALUE_CAP_STEPS.length - 1]));
}

/** Признак ISO-8601 UTC ровно того вида, который выдаёт `Date.prototype.toISOString`. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Разбор значения cookie. Возвращает null на всём, что не является нашей записью.
 *
 * На вход ожидается значение ровно в том виде, в каком оно приходит в заголовке `Cookie`, то есть
 * процентно закодированное браузером. Декодирование терпимое: если значение не кодировали (так его
 * отдаёт `NextResponse.cookies.get()`, который декодирует сам) или в нём стоит одинокий `%`,
 * строка берётся как есть — решение принимает не декодер, а `JSON.parse` следом.
 *
 * Строгость дальше — не педантизм: cookie правится в браузере вручную, и без повторной проверки в
 * заявку уехало бы что угодно, вплоть до многострочного текста, подделывающего хвост сообщения.
 * Отсюда три условия: разбирается JSON-объект, `captured_at` — настоящая метка времени нашего
 * формата, и хотя бы одно рекламное значение пережило санитайз. Запись из одних null не имеет
 * смысла — это не «источник неизвестен», а «источника нет», и такой случай выражается как null.
 */
export function parseAttributionCookie(rawValue: string | null | undefined): Attribution | null {
  if (typeof rawValue !== "string" || !rawValue) return null;

  let decoded = rawValue;
  try {
    decoded = decodeURIComponent(rawValue);
  } catch {
    // Битая процентная последовательность: значение либо не кодировали, либо испортили. Разбираем
    // исходную строку — настоящий фильтр стоит ниже, на `JSON.parse` и проверке полей.
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;

  const capturedAt = typeof record.captured_at === "string" ? record.captured_at : "";
  if (!ISO_UTC.test(capturedAt) || Number.isNaN(Date.parse(capturedAt))) return null;

  const values = {} as Record<AdParamKey, string | null>;
  for (const key of AD_PARAM_KEYS) {
    values[key] = sanitizeAdValue(typeof record[key] === "string" ? (record[key] as string) : null);
  }
  if (!AD_PARAM_KEYS.some((key) => values[key] !== null)) return null;

  return {
    yclid: values.yclid,
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    utm_content: values.utm_content,
    utm_term: values.utm_term,
    landing_path: sanitizeLandingPath(
      typeof record.landing_path === "string" ? record.landing_path : "/",
    ),
    captured_at: capturedAt,
  };
}

/**
 * Достать запись об источнике из заголовка `Cookie`.
 *
 * Разбор заголовка вручную, а не через `next/headers`: роут принимает обычный `Request`, и эта
 * функция должна одинаково работать и там, и в тестах, где никакого контекста Next нет.
 */
export function readAttributionCookie(cookieHeader: string | null | undefined): Attribution | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    if (part.slice(0, separator).trim() !== ATTRIBUTION_COOKIE_NAME) continue;
    return parseAttributionCookie(part.slice(separator + 1).trim());
  }

  return null;
}
