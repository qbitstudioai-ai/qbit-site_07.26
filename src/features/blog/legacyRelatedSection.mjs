/**
 * Legacy-секция «Материалы по теме» в СЫРОМ тексте статьи (Amendment 61 / REL-02F.1).
 *
 * До перехода на `content_relations` перелинковка статьи на продукты и кейсы жила списком ссылок в
 * конце Markdown. Этот модуль — единственное место, которое эту секцию распознаёт: его используют
 * ручной импорт (`scripts/backfill-legacy-material-relations.mjs`), `scripts/db-seed.mjs` и позже
 * единый публичный блок и уборка секции (REL-02F.2/F.3). Две реализации разбора со временем
 * разошлись бы, и импорт признал бы секцию, которую уборка не нашла бы, или наоборот.
 *
 * ПОЧЕМУ `.mjs`, А НЕ TypeScript. Тот же приём, что у `src/server/db/schema.mjs`: модуль читают и
 * приложение, и скрипты, которые запускаются обычным `node` без сборщика.
 *
 * ПОЧЕМУ НЕ `parseBlogMarkdown()`. Парсер статьи терпим к форме — любая жирная строка у него
 * становится разделом, абзацы склеиваются, концевые пробелы теряются — и точного положения секции в
 * тексте не сообщает. Здесь нужно обратное: распознать секцию только в одной однозначной форме,
 * вернуть её точный диапазон в исходной строке и ОТКАЗАТЬ во всём остальном. Неоднозначную секцию
 * решает человек, а не догадка модуля.
 *
 * Модуль чистый: ни базы, ни файловой системы. Он только описывает текст.
 *
 * @typedef {"article" | "product" | "case"} LegacyTargetType
 *
 * @typedef {object} LegacyTarget
 * @property {LegacyTargetType} type
 * @property {string} slug
 * @property {string} href
 * @property {string} label Текст ссылки — только для отчёта, в связи не попадает.
 * @property {number} line Номер строки в теле, с единицы.
 *
 * @typedef {"ambiguous_heading" | "duplicate_section" | "malformed_section" | "malformed_item"
 *   | "absolute_url" | "query_url" | "hash_url" | "trailing_slash" | "index_url" | "product_id_url"
 *   | "unknown_url" | "duplicate_target"} LegacySectionErrorCode
 *
 * @typedef {object} LegacySectionError
 * @property {LegacySectionErrorCode} code
 * @property {number} line
 * @property {string} detail
 *
 * @typedef {{ state: "no_section" }
 *   | { state: "invalid", errors: LegacySectionError[] }
 *   | { state: "ok", heading: string, range: { start: number, end: number },
 *       lines: { first: number, last: number }, targets: LegacyTarget[] }} LegacySectionExtraction
 */

export const LEGACY_SECTION_TITLE = "Материалы по теме";

/** Единственная допустимая форма заголовка: вся строка жирная, двоеточие необязательно. */
const HEADING_EXACT = /^\*\*Материалы по теме:?\*\*$/u;

/**
 * Строка, ПОХОЖАЯ на заголовок секции: `## Материалы по теме`, фраза без жирного, жирный заголовок
 * с текстом в той же строке. Каждая такая строка — отказ, а не «не секция»: пропустить её значило бы
 * оставить в теле перелинковку, которую импорт не увидел. Между словами допускается ЛЮБОЙ пробельный
 * символ, включая неразрывный пробел типографа: иначе `по теме` молча стало бы «секции нет».
 */
const HEADING_LIKE = /^(?:#{1,6}\s*)?(?:\*\*|__|\*|_)?\s*материалы\s+по\s+теме(?=$|[\s:*_.])/iu;

/** Граница раздела — ровно то условие, по которому `parseBlogMarkdown()` начинает новый раздел. */
const PARSER_HEADING = /^\*\*([^*]+?)(?::)?\*\*/u;

const LIST_ITEM = /^-\s+(.+)$/u;
const LINK = /\[([^\]]*)\]\(([^)]*)\)/gu;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Адрес продукта по системному идентификатору (`/products/product-03`), а не по slug. */
const PRODUCT_ID = /^product-\d+$/u;

const TYPE_BY_SEGMENT = Object.freeze({ blog: "article", products: "product", cases: "case" });

/** Строки тела с их положением в ИСХОДНОЙ строке: диапазон секции обязан указывать в неё, а не в копию. */
function splitLines(markdown) {
  const lines = [];
  const breaks = /\r?\n/gu;
  let start = 0;
  let match;
  while ((match = breaks.exec(markdown))) {
    lines.push({ text: markdown.slice(start, match.index), start, end: match.index });
    start = match.index + match[0].length;
  }
  lines.push({ text: markdown.slice(start), start, end: markdown.length });
  return lines;
}

/**
 * Внутренний адрес → тип и slug, либо код отказа.
 *
 * Допустимы только `/blog/<slug>`, `/products/<slug>`, `/cases/<slug>` дословно. Нормализовать адрес
 * (срезать `/` в конце, строку запроса, якорь) модуль не пытается: ссылка другой формы — это данные,
 * которые человек написал иначе, и молча исправленная она перестала бы совпадать с текстом статьи.
 */
function classifyHref(href) {
  if (href === "" || /\s/u.test(href)) return { code: "unknown_url" };
  if (/^[a-z][a-z0-9+.-]*:/iu.test(href) || href.startsWith("//")) return { code: "absolute_url" };
  if (href.includes("?")) return { code: "query_url" };
  if (href.includes("#")) return { code: "hash_url" };
  if (href.length > 1 && href.endsWith("/")) return { code: "trailing_slash" };
  if (/^\/(?:blog|products|cases)$/u.test(href)) return { code: "index_url" };

  const match = href.match(/^\/(blog|products|cases)\/([^/]+)$/u);
  if (!match || !SLUG.test(match[2])) return { code: "unknown_url" };
  if (match[1] === "products" && PRODUCT_ID.test(match[2])) return { code: "product_id_url" };

  return { type: TYPE_BY_SEGMENT[match[1]], slug: match[2] };
}

/**
 * Разбор секции.
 *
 * Отсутствие секции — `no_section`, не ошибка: у статьи может просто не быть перелинковки. Любое
 * отклонение от единственной формы — `invalid` со ВСЕМИ найденными причинами сразу, чтобы человек
 * исправлял текст за один проход, а не по одной ошибке на запуск.
 *
 * Секция длится до следующей строки, которую парсер статьи считает заголовком раздела, или до конца
 * тела. Внутри допускаются только пункты маркированного списка и пустые строки. Строки внутри блока
 * кода заголовком секции не считаются — парсер статьи показывает их как код.
 *
 * `range.end` — конец последнего пункта без перевода строки после него.
 *
 * @param {string} markdown
 * @returns {LegacySectionExtraction}
 */
export function extractLegacyRelatedSection(markdown) {
  if (typeof markdown !== "string") {
    return {
      state: "invalid",
      errors: [{ code: "malformed_section", line: 0, detail: "тело статьи не является строкой" }],
    };
  }

  const lines = splitLines(markdown);
  const headings = [];
  const headingErrors = [];
  let inFence = false;

  lines.forEach((line, index) => {
    const trimmed = line.text.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    if (HEADING_EXACT.test(trimmed)) {
      headings.push(index);
    } else if (HEADING_LIKE.test(trimmed)) {
      headingErrors.push({ code: "ambiguous_heading", line: index + 1, detail: trimmed });
    }
  });

  if (headings.length === 0 && headingErrors.length === 0) return { state: "no_section" };

  headings.slice(1).forEach((index) => {
    headingErrors.push({
      code: "duplicate_section",
      line: index + 1,
      detail: lines[index].text.trim(),
    });
  });
  if (headingErrors.length > 0 || headings.length !== 1) {
    return { state: "invalid", errors: headingErrors };
  }

  const headingIndex = headings[0];
  const errors = [];
  const targets = [];
  const seen = new Set();
  let lastIndex = headingIndex;
  let items = 0;

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].text.trim();
    if (!trimmed) continue;
    if (PARSER_HEADING.test(trimmed)) break;

    const lineNumber = index + 1;
    lastIndex = index;

    const item = trimmed.match(LIST_ITEM);
    if (!item) {
      errors.push({ code: "malformed_section", line: lineNumber, detail: trimmed });
      continue;
    }
    items += 1;

    const links = [...item[1].matchAll(LINK)];
    // `![подпись](адрес)` — картинка, а не ссылка: регулярное выражение ссылки её тоже находит.
    const isImage = links.some((link) => link.index > 0 && item[1][link.index - 1] === "!");
    if (links.length !== 1 || isImage) {
      errors.push({ code: "malformed_item", line: lineNumber, detail: trimmed });
      continue;
    }

    const [, label, href] = links[0];
    const url = classifyHref(href);
    if (url.code) {
      errors.push({ code: url.code, line: lineNumber, detail: href });
      continue;
    }

    // Повтор продукта или кейса — отказ. Повтор article-ссылки — нет: article-ссылки текста только
    // диагностика (D1), и повтор называет отчёт импорта, а не останавливает его.
    if (url.type !== "article") {
      const key = `${url.type}:${url.slug}`;
      if (seen.has(key)) {
        errors.push({ code: "duplicate_target", line: lineNumber, detail: href });
        continue;
      }
      seen.add(key);
    }

    targets.push({ type: url.type, slug: url.slug, href, label, line: lineNumber });
  }

  if (items === 0 && errors.length === 0) {
    errors.push({
      code: "malformed_section",
      line: headingIndex + 1,
      detail: "в секции нет ни одного пункта списка",
    });
  }

  if (errors.length > 0) return { state: "invalid", errors };

  return {
    state: "ok",
    heading: lines[headingIndex].text.trim(),
    range: { start: lines[headingIndex].start, end: lines[lastIndex].end },
    lines: { first: headingIndex + 1, last: lastIndex + 1 },
    targets,
  };
}
