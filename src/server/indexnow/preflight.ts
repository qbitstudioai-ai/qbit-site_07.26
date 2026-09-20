/**
 * Предполётные проверки пакетной отправки IndexNow.
 *
 * Зачем модуль существует. Раньше единственной защитой скрипта было сравнение числа адресов в
 * карте сайта с константой `EXPECTED_CANONICAL_URLS = 23`. Карта сайта динамическая и собирается
 * из базы (`src/app/sitemap.ts`, `force-dynamic`), поэтому число законно меняется при каждой
 * публикации материала в админ-панели: 23 -> 25 -> 34 -> 39. Константу трижды не обновили, и
 * сторож превратился в гарантированный отказ на здоровой карте, не ловя при этом ни одной
 * настоящей поломки. Здесь проверяется СОСТАВ карты, а не её мощность.
 *
 * Модуль намеренно ЧИСТЫЙ и без единого импорта:
 *
 * - он не ходит в сеть и не читает базу — это делает вызывающая сторона;
 * - он не дублирует publication-логику CMS: списки материалов приходят из самой карты сайта, а не
 *   собираются здесь вторым запросом к базе. Второй inventory означал бы второй источник истины,
 *   который неизбежно разойдётся с первым;
 * - таблицы закрытых множеств (адреса отделов, legacy-редиректы) ПЕРЕДАЮТСЯ параметрами, а не
 *   импортируются. Причина техническая: файл читается и обычным Node (через `.mjs`-скрипт), а
 *   импорт одного `.ts` из другого потребовал бы явного расширения `.ts` в спецификаторе, которое
 *   `tsc` отвергает без `allowImportingTsExtensions`. Параметры снимают вопрос целиком.
 *
 * Благодаря этому весь набор проверок покрывается unit-тестами без production-окружения.
 */

/** Максимум адресов в одном POST по официальной документации IndexNow. */
export const INDEXNOW_MAX_BATCH_URLS = 10_000;

/**
 * Верхняя граница вменяемости карты сайта. Не ограничение API, а защита от «убежавшего»
 * генератора: сегодня карта содержит 39 адресов, и тысяча — это запас в двадцать пять раз.
 */
export const MAX_SITEMAP_URLS = 1_000;

/**
 * Адреса, которые объявлены КОДОМ, а не контентом: у каждого есть собственный маршрут в
 * `src/app`. Их исчезновение из карты сайта — всегда поломка, а не решение редактора.
 *
 * Адресов отделов здесь нет намеренно: они приходят параметром из таблицы
 * `SOLUTION_PATH_BY_DEPARTMENT_ID`, которая и есть их источник истины.
 */
export const REQUIRED_CODE_PATHS: readonly string[] = [
  "/",
  "/products",
  "/documents",
  "/how-we-work",
  "/faq",
  "/contacts",
  "/blog",
  "/cases",
];

/**
 * Разделы, у которых в карте обязан быть хотя бы один материал.
 *
 * Это единственная проверка, ловящая самый правдоподобный отказ: один из четырёх источников
 * контента вернул пустой список, карта осталась структурно безупречной, а раздел молча опустел.
 * Ровно это уже происходило на живом домене (17 адресов вместо 23, см. док-комментарий
 * `src/app/sitemap.ts`). Проверка «хотя бы один» не мешает снять с публикации отдельный материал.
 */
export const REQUIRED_SECTION_PREFIXES: readonly string[] = ["/products/", "/blog/", "/cases/"];

/**
 * Точные адреса, которых в карте быть не должно.
 *
 * `/solutions` — раздела-индекса нет, адрес намеренно отвечает 404.
 * `/solutions/executive` — системный идентификатор отдела, а не его публичный адрес
 * (`/solutions/management`). Его появление означало бы рассинхрон таблицы адресов.
 */
export const FORBIDDEN_EXACT_PATHS: readonly string[] = ["/solutions", "/solutions/executive"];

/**
 * Префиксы служебных и несуществующих пространств адресов.
 *
 * `/departments` — параллельное пространство адресов отделов, которого в проекте нет и не должно
 * появиться молча: это был бы второй адрес того же документа.
 */
export const FORBIDDEN_PATH_PREFIXES: readonly string[] = [
  "/admin",
  "/api",
  "/login",
  "/departments",
];

export type PreflightReason =
  | "endpoint-not-https"
  | "sitemap-empty"
  | "sitemap-too-large"
  | "url-unparsable"
  | "url-not-https"
  | "url-foreign-host"
  | "url-has-port"
  | "url-has-query"
  | "url-has-fragment"
  | "url-forbidden-path"
  | "missing-required-url"
  | "section-empty"
  | "legacy-in-sitemap"
  | "batch-too-large";

export interface PreflightStats {
  /** Уникальных canonical-адресов после дедупликации. */
  canonicalCount: number;
  /** Сколько повторов убрано. Дубль в карте — не отказ, но факт, который должен быть виден. */
  duplicatesDropped: number;
  /** Адресов legacy-редиректов, добавленных к пакету. */
  legacyCount: number;
  /** Итоговый размер пакета IndexNow. */
  urlCount: number;
}

export interface PreflightOptions {
  /** Содержимое `<loc>` карты сайта, как они прочитаны. */
  locations: readonly string[];
  /** Ожидаемый host, из `INDEXNOW_HOST`. */
  host: string;
  /** Endpoint IndexNow, из `INDEXNOW_ENDPOINT`. */
  endpoint: string;
  /** Адреса отделов из `SOLUTION_PATH_BY_DEPARTMENT_ID` — единственного источника истины. */
  solutionPaths: readonly string[];
  /** Источники legacy-редиректов (`LEGACY_REDIRECTS[].source`). */
  legacySources: readonly string[];
  maxSitemapUrls?: number;
  maxBatchUrls?: number;
}

export interface PreflightResult {
  ok: boolean;
  reason?: PreflightReason;
  /** Человекочитаемые подробности отказа. Ключа здесь нет и быть не может. */
  details: string[];
  /** Итоговый пакет: canonical-адреса плюс источники legacy-редиректов. */
  urls: string[];
  canonicalUrls: string[];
  stats: PreflightStats;
}

const EMPTY_STATS: PreflightStats = {
  canonicalCount: 0,
  duplicatesDropped: 0,
  legacyCount: 0,
  urlCount: 0,
};

function fail(reason: PreflightReason, details: string[], stats = EMPTY_STATS): PreflightResult {
  return { ok: false, reason, details, urls: [], canonicalUrls: [], stats };
}

/**
 * Адреса из карты сайта. Отдельная функция, потому что разбор XML — тоже предмет проверки:
 * HTML-страница ошибки, отданная с кодом 200, даст здесь пустой список, а не «просто другое число».
 */
export function parseSitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    match[1].replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").trim(),
  );
}

/** Карта сайта обязана приходить как XML. Проверяется до разбора, а не после. */
export function isXmlContentType(value: string | null | undefined): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]!.trim().toLowerCase();
  return mediaType === "text/xml" || mediaType === "application/xml" || mediaType.endsWith("+xml");
}

/** Endpoint IndexNow обязан быть https. Проверяется ДО того, как пакет вообще собран. */
export function isHttpsEndpoint(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** `/blog/` и `/blog` — один и тот же документ. Сравнение адресов идёт по этой форме. */
function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function isForbiddenPath(path: string): boolean {
  if (FORBIDDEN_EXACT_PATHS.includes(path)) return true;
  return FORBIDDEN_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Полная предполётная проверка состава карты сайта и итогового пакета.
 *
 * Возвращает первую причину отказа, но собирает ВСЕ подробности по структурным проверкам: при
 * разборе аварии важно видеть все плохие адреса сразу, а не по одному за запуск.
 */
export function preflightIndexNow(options: PreflightOptions): PreflightResult {
  const maxSitemapUrls = options.maxSitemapUrls ?? MAX_SITEMAP_URLS;
  const maxBatchUrls = options.maxBatchUrls ?? INDEXNOW_MAX_BATCH_URLS;
  const host = options.host.trim().toLowerCase();

  if (!isHttpsEndpoint(options.endpoint)) {
    return fail("endpoint-not-https", ["INDEXNOW_ENDPOINT должен быть абсолютным https-адресом"]);
  }

  if (options.locations.length === 0) {
    return fail("sitemap-empty", ["в карте сайта нет ни одного <loc>"]);
  }

  if (options.locations.length > maxSitemapUrls) {
    return fail("sitemap-too-large", [
      `адресов в карте: ${options.locations.length}, допустимый максимум: ${maxSitemapUrls}`,
    ]);
  }

  // Структурная проверка каждого адреса. Порядок причин фиксирован, чтобы отказ был
  // воспроизводим независимо от порядка строк в карте.
  const structural: { reason: PreflightReason; detail: string }[] = [];
  const seen = new Set<string>();
  const canonicalUrls: string[] = [];
  const paths = new Set<string>();
  let duplicatesDropped = 0;

  for (const value of options.locations) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      structural.push({ reason: "url-unparsable", detail: `не разбирается как адрес: ${value}` });
      continue;
    }

    if (url.protocol !== "https:") {
      structural.push({ reason: "url-not-https", detail: `не https: ${value}` });
      continue;
    }
    if (url.hostname.toLowerCase() !== host) {
      structural.push({ reason: "url-foreign-host", detail: `чужой host: ${value}` });
      continue;
    }
    if (url.port) {
      structural.push({ reason: "url-has-port", detail: `явный порт: ${value}` });
      continue;
    }
    if (url.search) {
      structural.push({ reason: "url-has-query", detail: `параметры запроса: ${value}` });
      continue;
    }
    if (url.hash) {
      structural.push({ reason: "url-has-fragment", detail: `фрагмент: ${value}` });
      continue;
    }

    const path = normalizePath(url.pathname);
    if (isForbiddenPath(path)) {
      structural.push({ reason: "url-forbidden-path", detail: `запрещённый адрес: ${value}` });
      continue;
    }

    if (seen.has(url.href)) {
      duplicatesDropped += 1;
      continue;
    }
    seen.add(url.href);
    canonicalUrls.push(url.href);
    paths.add(path);
  }

  if (structural.length > 0) {
    return fail(
      structural[0]!.reason,
      structural.map((item) => item.detail),
    );
  }

  const requiredPaths = [
    ...REQUIRED_CODE_PATHS,
    ...options.solutionPaths.map((path) => normalizePath(path)),
  ];
  const missing = requiredPaths.filter((path) => !paths.has(path));
  if (missing.length > 0) {
    return fail(
      "missing-required-url",
      missing.map((path) => `обязательный адрес отсутствует в карте: ${path}`),
    );
  }

  const knownPaths = [...paths];
  const emptySections = REQUIRED_SECTION_PREFIXES.filter(
    (prefix) => !knownPaths.some((path) => path.startsWith(prefix)),
  );
  if (emptySections.length > 0) {
    return fail(
      "section-empty",
      emptySections.map((prefix) => `в карте нет ни одного материала раздела ${prefix}`),
    );
  }

  // Источник постоянного редиректа не может быть одновременно canonical-адресом: это означало бы,
  // что карта сайта и таблица переадресаций противоречат друг другу.
  const legacyInSitemap = options.legacySources
    .map((source) => normalizePath(source))
    .filter((path) => paths.has(path));
  if (legacyInSitemap.length > 0) {
    return fail(
      "legacy-in-sitemap",
      legacyInSitemap.map((path) => `источник legacy-редиректа найден в карте сайта: ${path}`),
    );
  }

  const origin = `https://${host}`;
  const legacyUrls = options.legacySources.map((source) => `${origin}${source}`);
  const urls = [...new Set([...canonicalUrls, ...legacyUrls])];

  const stats: PreflightStats = {
    canonicalCount: canonicalUrls.length,
    duplicatesDropped,
    legacyCount: legacyUrls.length,
    urlCount: urls.length,
  };

  if (urls.length > maxBatchUrls) {
    return fail(
      "batch-too-large",
      [`адресов в пакете: ${urls.length}, допустимый максимум IndexNow: ${maxBatchUrls}`],
      stats,
    );
  }

  return { ok: true, details: [], urls, canonicalUrls, stats };
}
