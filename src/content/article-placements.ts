/**
 * ЕДИНЫЙ справочник размещения статей.
 *
 * Используется тремя сторонами сразу: админ-панелью (выпадающий список), API (валидация) и
 * публичным сайтом (отбор статей раздела). Свободный текстовый ввод раздела запрещён именно
 * поэтому: статья, попавшая в несуществующий раздел, нигде не показалась бы и выглядела бы как
 * пропажа данных.
 *
 * `value` — стабильный системный ключ, он хранится в базе и НЕ меняется. `label` — то, что видит
 * администратор. `href` — публичный список, куда попадает статья.
 *
 * Сейчас список статей на сайте один — «Блог» (`/blog`). Новый раздел добавляется строкой здесь и
 * страницей, которая вызывает `getPublishedArticles({ placement })`.
 */
export const ARTICLE_PLACEMENTS = [{ value: "blog", label: "Блог", href: "/blog" }] as const;

export type ArticlePlacement = (typeof ARTICLE_PLACEMENTS)[number]["value"];

export const DEFAULT_ARTICLE_PLACEMENT: ArticlePlacement = "blog";

export function isArticlePlacement(value: unknown): value is ArticlePlacement {
  return ARTICLE_PLACEMENTS.some((placement) => placement.value === value);
}

export function articlePlacementLabel(value: string): string {
  return ARTICLE_PLACEMENTS.find((placement) => placement.value === value)?.label ?? value;
}

export function articlePlacementHref(value: string): string {
  return ARTICLE_PLACEMENTS.find((placement) => placement.value === value)?.href ?? "/blog";
}

/**
 * Рубрики статей — второй, независимый от раздела признак: он выводится в карточке статьи и в
 * шапке материала. Тоже управляемый список, а не свободный ввод: иначе в ленте появились бы
 * «Продажи», «продажи» и «Продажи ». Ключ совпадает с отображаемым названием, потому что рубрика
 * нигде не участвует в маршрутизации — менять её текст безопасно.
 */
export const ARTICLE_CATEGORIES = [
  "Процессы",
  "AI-ассистенты",
  "Продажи",
  "Документы",
  "Интеграции",
  "n8n",
] as const;

export const ARTICLE_STATUSES = ["draft", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
