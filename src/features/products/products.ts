/**
 * Типы и производные значения продукта.
 *
 * САМИ ПРОДУКТЫ здесь больше не лежат: с появлением админ-панели их источник — база
 * (`src/server/repositories/products.ts`), а исходные тексты переехали в `data/seed/products.json`.
 * Этот модуль остался тем, чем и был по существу: описанием формы данных и правилами, которые
 * выводятся из неё автоматически (пути к фотографиям, SEO-строки). Он не серверный и не клиентский —
 * его импортируют обе стороны, поэтому здесь нет ни доступа к базе, ни React.
 */

import { normalizeSeoTitle } from "@/lib/seo";

export const PRODUCT_IDS = [
  "product-01",
  "product-02",
  "product-03",
  "product-04",
  "product-05",
  "product-06",
  "product-07",
  "product-08",
  "product-09",
  "product-10",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type ProductPanelPosition = "left" | "right";
export type ProductPanelVertical = "top" | "center" | "bottom";

export interface ProductImage {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrc: string;
  width: number;
  height: number;
}

export interface ProductHotspot {
  x: number;
  y: number;
  width: number;
  height: number;
  marker: {
    x: number;
    y: number;
    align: "start" | "center" | "end";
  };
}

export interface ProductPrice {
  label: string;
  value: string;
  amount: number;
}

/** Редактируемая в админ-панели часть продукта. */
export interface ProductContent {
  summary: string;
  applies: string;
  examples: string[];
  prices: ProductPrice[];
  priceNote?: string;
  benefit: string;
}

/** Компоновка панели над фотографией. Правится редко, но остаётся в данных, а не в компоненте. */
export interface ProductLayout {
  objectPosition: string;
  focusPoint: string;
  freeArea: string;
  panelPosition: ProductPanelPosition;
  panelVertical: ProductPanelVertical;
  panelMaxWidth: number;
}

export interface ProductLocation {
  id: ProductId;
  slug: string;
  menuTitle: string;
  fullTitle: string;
  order: number;
  hotspot: ProductHotspot;
  images: {
    overview: ProductImage;
    detail: ProductImage;
    alt: string;
  };
  content: ProductContent;
  layout: ProductLayout;
  /**
   * Заголовок для поисковой выдачи, заданный вручную, или `null`, если владелец сайта его не
   * задавал. Хранится рядом с собранным `seo.title` намеренно: форма админ-панели обязана
   * показывать ПУСТОЕ поле, когда значения нет, а не автоматический заголовок — иначе первое же
   * сохранение превратило бы вычисляемую строку в зафиксированную.
   */
  seoTitleOverride: string | null;
  seo: {
    title: string;
    description: string;
  };
}

/**
 * Пути к фотографиям выводятся из идентификатора, а не хранятся в базе: файлы
 * `public/products/product-XX-*.{avif,webp}` — часть сборки, и «редактируемая» ссылка на них
 * означала бы возможность указать несуществующий файл прямо из админ-панели.
 */
export const productImage = (id: ProductId): ProductImage => ({
  avifSrcSet: `/products/${id}-960.avif 960w, /products/${id}-1448.avif 1448w`,
  webpSrcSet: `/products/${id}-960.webp 960w, /products/${id}-1448.webp 1448w`,
  fallbackSrc: `/products/${id}-1448.webp`,
  width: 1448,
  height: 1086,
});

export const automationLabImage: ProductImage = {
  avifSrcSet:
    "/products/automation-lab-main-960.avif 960w, /products/automation-lab-main-1600.avif 1600w",
  webpSrcSet:
    "/products/automation-lab-main-960.webp 960w, /products/automation-lab-main-1600.webp 1600w",
  fallbackSrc: "/products/automation-lab-main-1600.webp",
  width: 1672,
  height: 941,
};

export interface ProductLocationInput {
  id: ProductId;
  slug: string;
  menuTitle: string;
  fullTitle: string;
  order: number;
  alt: string;
  hotspot: ProductHotspot;
  content: ProductContent;
  layout: ProductLayout;
  /** Ручной SEO-заголовок. Пусто или `null` — заголовок собирается из `fullTitle`. */
  seoTitle?: string | null;
}

/**
 * Верхняя граница длины meta description. 160 — не догма поисковой системы, а практический предел:
 * дальше выдача обрезает строку сама, и обрезает механически — посреди слова.
 */
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 160;

/** Нижняя граница. Короче — описание перестаёт отвечать на вопрос «что это и что оно делает». */
export const PRODUCT_DESCRIPTION_MIN_LENGTH = 120;

/** Разбивает текст на ЦЕЛЫЕ предложения. Нужен, чтобы описание никогда не обрывалось на полуслове. */
function splitIntoSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+/g) ?? [text]).map((sentence) => sentence.trim());
}

/** Нарастающие префиксы из целых предложений: «первое», «первое + второе», … */
function sentencePrefixes(text: string): string[] {
  const result: string[] = [];
  let accumulated = "";

  for (const sentence of splitIntoSentences(text)) {
    accumulated = accumulated ? `${accumulated} ${sentence}` : sentence;
    result.push(accumulated);
  }

  return result;
}

/**
 * Убирает из начала описания повтор названия продукта.
 *
 * Все десять описаний написаны по одному шаблону: «{Название} — это система, которая …».
 * В выдаче название уже стоит строкой выше, в `<title>`, поэтому первые 30–47 символов описания
 * не сообщают ничего нового и вытесняют то, что сообщает. Срезаем их только если описание
 * действительно начинается с названия — иначе текст возвращается нетронутым.
 */
function withoutTitlePrefix(summary: string, fullTitle: string): string {
  const titlePrefix = summary.startsWith(fullTitle) ? fullTitle : "";

  if (!titlePrefix) {
    const systemPhrase = summary.match(/\s+[—–-]\s+(это\s+система,\s+которая\s+.+)$/iu)?.[1];
    if (!systemPhrase) return summary;
    return systemPhrase.charAt(0).toUpperCase() + systemPhrase.slice(1);
  }

  const rest = summary
    .slice(titlePrefix.length)
    .replace(/^\s*[—–-]\s*/, "")
    .replace(/^это\s+система,\s+которая\s+/i, "");

  if (!rest) return summary;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * Собирает meta description продукта длиной не больше {@link PRODUCT_DESCRIPTION_MAX_LENGTH}.
 *
 * Как выбирается вариант. Составляется набор кандидатов — из полного описания и из описания без
 * повтора названия, каждый в виде нарастающих префиксов по целым предложениям, с ценой и без неё.
 * Берётся САМЫЙ ДЛИННЫЙ кандидат, который укладывается в предел: длина здесь прямо означает
 * количество полезных сведений, а верхняя граница уже гарантирует, что строка не будет обрезана
 * выдачей.
 *
 * Что это даёт по требованиям задания:
 *
 * - строка никогда не рвётся посреди фразы — кандидаты состоят только из целых предложений;
 * - текст дословно совпадает с видимым описанием продукта, ничего не сочиняется;
 * - цена попадает в описание, только если помещается целиком, а не «сколько влезло».
 *
 * Видимый текст продукта эта функция не трогает — она собирает исключительно значение `<meta>`.
 */
export function buildProductDescription(input: {
  fullTitle: string;
  summary: string;
  firstPrice?: string;
}): string {
  const summary = input.summary.trim();
  const priceTail = input.firstPrice ? ` Стоимость — ${input.firstPrice}.` : "";

  const candidates: string[] = [];
  for (const base of [
    ...sentencePrefixes(summary),
    ...sentencePrefixes(withoutTitlePrefix(summary, input.fullTitle)),
  ]) {
    if (priceTail) candidates.push(base + priceTail);
    candidates.push(base);
  }

  const fitting = candidates
    .filter((candidate) => candidate.length <= PRODUCT_DESCRIPTION_MAX_LENGTH)
    .sort((a, b) => b.length - a.length);

  // Запасной вариант — первое предложение как есть. Срабатывает только если ОДНО предложение
  // длиннее предела: обрезать его молча нельзя, а пустое описание хуже длинного.
  return fitting[0] ?? splitIntoSentences(summary)[0] ?? summary;
}

/**
 * Заголовок продукта для выдачи по умолчанию — полное название плюс коммерческий хвост и бренд.
 *
 * Используется, только когда SEO-заголовок не задан вручную. Хвост одинаков у всех десяти
 * продуктов, и именно из-за него автоматические заголовки выходили на 76–99 знаков: 34 знака из
 * них дублировались между страницами и попадали в обрезаемую часть строки (аудит 2026-07-30).
 */
export function buildProductSeoTitle(fullTitle: string): string {
  return `${fullTitle} — стоимость разработки и внедрения | QBit-Studio-Ai`;
}

/**
 * Собирает продукт из редактируемых полей: подставляет фотографии и SEO-строки.
 *
 * `description` собирается из описания продукта и отдельным полем НЕ является — два независимых
 * текста разъезжаются при первой же правке. С `title` иначе: длина заголовка в выдаче ограничена
 * жёстко (Bing обрезает после ~60 знаков), а полное название продукта вместе с брендом в этот
 * предел не помещается. Поэтому заголовок можно переопределить вручную — при пустом поле работает
 * прежняя сборка {@link buildProductSeoTitle}.
 */
export function buildProductLocation(input: ProductLocationInput): ProductLocation {
  const firstPrice = input.content.prices[0]?.value;
  const seoTitleOverride = normalizeSeoTitle(input.seoTitle);

  return {
    id: input.id,
    slug: input.slug,
    menuTitle: input.menuTitle,
    fullTitle: input.fullTitle,
    order: input.order,
    hotspot: input.hotspot,
    content: input.content,
    layout: input.layout,
    seoTitleOverride,
    images: {
      overview: automationLabImage,
      detail: productImage(input.id),
      alt: input.alt,
    },
    seo: {
      title: seoTitleOverride ?? buildProductSeoTitle(input.fullTitle),
      description: buildProductDescription({
        fullTitle: input.fullTitle,
        summary: input.content.summary,
        firstPrice,
      }),
    },
  };
}

export function findProductBySlug(
  list: readonly ProductLocation[],
  slug: string | undefined,
): ProductLocation | undefined {
  return slug ? list.find((item) => item.slug === slug) : undefined;
}

export function findProductById(
  list: readonly ProductLocation[],
  id: string | undefined,
): ProductLocation | undefined {
  return id ? list.find((item) => item.id === id) : undefined;
}

export function findAdjacentProducts(
  list: readonly ProductLocation[],
  productId: ProductId,
): ProductLocation[] {
  const index = list.findIndex((item) => item.id === productId);
  if (index < 0) return [];

  return [list[index - 1], list[index + 1]].filter((item): item is ProductLocation =>
    Boolean(item),
  );
}

/** Тексты страницы «Продукт и стоимость», редактируемые в админ-панели. */
export interface ProductsPageCopy {
  eyebrow: string;
  headline: string;
  seoTitle: string;
  seoDescription: string;
  priceColumnLabel: string;
  moreLabel: string;
  sectionHeadings: {
    applies: string;
    examples: string;
    prices: string;
    benefit: string;
  };
  tabs: {
    overview: string;
    examples: string;
    prices: string;
    benefit: string;
  };
  implementationFormats: {
    title: string;
    items: string[];
    note: string;
  };
}
