import { extractLegacyRelatedSection } from "./legacyRelatedSection.mjs";

/**
 * Публичное тело статьи (Amendment 61 / REL-02F.2).
 *
 * Перелинковку статьи показывает единый блок «Материалы по теме» из `content_relations`. Прежняя
 * Markdown-секция с тем же названием физически остаётся в `body_markdown` до REL-02F.3, но в
 * публичный текст не попадает: иначе на странице было бы два блока ссылок, и один из них — второй
 * раздел оглавления.
 *
 * Секция вырезается из СЫРОГО текста по точному диапазону extractor, ДО `parseBlogMarkdown()`. Не
 * фильтром разделов после разбора: парсер терпим к форме и склеивает всё жирное в разделы, поэтому
 * отбор по заголовку спрятал бы и то, что extractor секцией не признал.
 *
 * Модуль чистый и не серверный: тот же helper использует предпросмотр админ-панели, чтобы он
 * показывал ровно тот текст, что увидит посетитель.
 */

export type LegacySectionState = "ok" | "no_section" | "invalid";

export interface PublicArticleBody {
  /** Текст, который разбирается в разделы и по которому считаются слова. */
  body: string;
  /**
   * `ok` — секция найдена и вырезана; `no_section` — секции нет; `invalid` — секция не распознана
   * однозначно и ОСТАВЛЕНА в тексте (D5): прятать то, что extractor не признал, значило бы угадывать.
   */
  legacySection: LegacySectionState;
}

export function publicArticleBody(markdown: string): PublicArticleBody {
  const extraction = extractLegacyRelatedSection(markdown);
  if (extraction.state !== "ok") {
    return { body: markdown, legacySection: extraction.state };
  }

  const { start, end } = extraction.range;
  return { body: markdown.slice(0, start) + markdown.slice(end), legacySection: "ok" };
}

/**
 * Тело без legacy-секции. Вырезается ровно диапазон extractor: соседние переводы строк остаются, а
 * за концом диапазона extractor всегда стоит граница раздела парсера или конец текста, поэтому
 * соседние разделы не склеиваются.
 */
export function stripLegacyRelatedSection(markdown: string): string {
  return publicArticleBody(markdown).body;
}
