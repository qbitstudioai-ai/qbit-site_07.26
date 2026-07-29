import type { Metadata } from "next";

/**
 * Единый источник технических SEO-констант и сборщиков метаданных.
 *
 * Зачем отдельный модуль. Раньше `SITE_URL` и `ORGANIZATION_ID` жили в
 * `src/features/products/productSeo.ts` — то есть общесайтовые константы лежали внутри одного
 * раздела, и каждый новый раздел импортировал «продукты» ради адреса сайта. Здесь они получают
 * нейтральный дом; `productSeo.ts` их реэкспортирует, поэтому существующие импорты не ломаются.
 *
 * ВАЖНО про слияние метаданных в Next.js. Объекты `metadata` из layout и page сливаются
 * ПОВЕРХНОСТНО: если страница объявляет свой `openGraph`, объект родителя заменяется целиком, а не
 * дополняется (документация Next.js, раздел «Merging»). Поэтому `og:site_name` и `og:locale`
 * нельзя задать один раз в корневом layout — они обязаны попадать в КАЖДЫЙ страничный `openGraph`.
 * Ровно для этого существует `buildOpenGraph()`: он подставляет общие поля, а страница передаёт
 * только своё. Не собирайте `openGraph` вручную мимо этого helper'а — потеряете site_name/locale.
 */

/**
 * Основной домен. Значение по умолчанию — будущий production-адрес; переменная окружения нужна
 * для стенда, где адрес другой. Завершающий слэш срезается, чтобы `${SITE_URL}/products` не
 * превращалось в двойной слэш.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://allqbit.ru").replace(
  /\/$/,
  "",
);

/** Название бренда ровно в том виде, в каком оно написано в шапке сайта. */
export const SITE_NAME = "QBit-Studio-Ai";

/** Локаль в формате Open Graph (подчёркивание, не дефис). */
export const OG_LOCALE = "ru_RU";

/** Язык страниц в формате schema.org / BCP 47. */
export const CONTENT_LANGUAGE = "ru-RU";

/**
 * Стабильные `@id` узлов графа schema.org.
 *
 * Одна и та же организация упоминается на многих страницах. Общий `@id` сообщает поисковой
 * системе, что это ОДНА сущность, а не десяток разных компаний с одинаковым названием.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Правила индексирования для ПУБЛИЧНЫХ страниц.
 *
 * Ставится постранично, а НЕ в корневом layout. Проверено на собранном сайте: значение из
 * корневого layout достаётся и странице 404, к которой Next.js добавляет собственный `noindex`, —
 * в `<head>` оказывались два взаимоисключающих указания сразу.
 *
 * `max-image-preview: large` и `max-snippet: -1` снимают ограничение на размер картинки и длину
 * текстового фрагмента в выдаче: значения по умолчанию урезают сниппет, а урезанный сниппет хуже
 * отвечает на запрос пользователя.
 */
export const INDEXABLE_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
} as const satisfies Metadata["robots"];

/**
 * Заголовок с названием бренда — но БЕЗ повтора, если оно уже внутри.
 *
 * Безусловная приписка `${headline} — QBit-Studio-Ai` давала на разделе блога заголовок
 * «Блог QBit-Studio-Ai — QBit-Studio-Ai»: видимый заголовок раздела уже содержит бренд. То же
 * произойдёт с любым названием статьи или продукта, где владелец сайта упомянул компанию.
 */
export function withBrand(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
}

/** Абсолютный адрес из внутреннего пути. Абсолютный адрес возвращается как есть. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Техническая обложка для соцсетей и мессенджеров.
 *
 * Файл собран скриптом `scripts/generate-og-image.mjs` из УЖЕ существующего логотипа на уже
 * существующем фирменном фоне. Нового текста, слогана и обещаний на нём нет — это требование
 * задания на аудит, а не эстетический выбор.
 */
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og/qbit-og-1200x630.png`,
  width: 1200,
  height: 630,
  alt: `Логотип ${SITE_NAME}`,
} as const;

interface OpenGraphInput {
  title: string;
  description: string;
  /** Канонический адрес страницы. Абсолютный — того же вида, что и в `alternates.canonical`. */
  url: string;
  type?: "website" | "article";
  images?: { url: string; alt?: string }[];
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: readonly string[];
}

type OpenGraphMetadata = NonNullable<Metadata["openGraph"]>;
type TwitterMetadata = NonNullable<Metadata["twitter"]>;

/** Open Graph с общесайтовыми полями. Читайте примечание о поверхностном слиянии выше. */
export function buildOpenGraph(input: OpenGraphInput): OpenGraphMetadata {
  const images = input.images?.length ? input.images : [DEFAULT_OG_IMAGE];

  const base = {
    title: input.title,
    description: input.description,
    url: input.url,
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    images,
  };

  if (input.type === "article") {
    return {
      ...base,
      type: "article",
      publishedTime: input.publishedTime,
      modifiedTime: input.modifiedTime,
      authors: input.authors,
      tags: input.tags ? [...input.tags] : undefined,
    };
  }

  return { ...base, type: "website" };
}

/**
 * Twitter Card. Разметка используется не только X: её читают Telegram, Slack и другие клиенты,
 * поэтому она проставляется на всех публичных страницах, а не только «ради твиттера».
 */
export function buildTwitter(input: {
  title: string;
  description: string;
  images?: string[];
}): TwitterMetadata {
  return {
    card: "summary_large_image",
    title: input.title,
    description: input.description,
    images: input.images?.length ? input.images : [DEFAULT_OG_IMAGE.url],
  };
}

/**
 * Узел Organization.
 *
 * Поля строго по факту: название, адрес сайта, логотип. `sameAs` и `contactPoint` передаются
 * ТОЛЬКО оттуда, где соответствующие контакты реально показаны пользователю (страница
 * «Контакты»), — выдуманные профили и телефоны в разметке запрещены.
 */
export function organizationNode(options?: {
  sameAs?: readonly string[];
  contactPoint?: readonly Record<string, unknown>[];
}) {
  return {
    "@context": "https://schema.org",
    // `as const` на всех `@type` не косметика: благодаря литеральному типу массив узлов становится
    // размеченным объединением, и потребитель (тест, страница) может сузить нужный узел по типу.
    "@type": "Organization" as const,
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.svg`,
    },
    ...(options?.sameAs?.length ? { sameAs: [...options.sameAs] } : {}),
    ...(options?.contactPoint?.length ? { contactPoint: [...options.contactPoint] } : {}),
  };
}

/**
 * Узел WebSite.
 *
 * `potentialAction`/`SearchAction` НЕ добавляется намеренно: на сайте нет собственного поиска, а
 * разметка поиска без поиска — заявление о несуществующей возможности.
 */
export function webSiteNode() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite" as const,
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: CONTENT_LANGUAGE,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Узел WebPage, связанный с сайтом и организацией общими `@id`. */
export function webPageNode(input: {
  url: string;
  name: string;
  description: string;
  type?: "WebPage" | "CollectionPage" | "ContactPage" | "AboutPage" | "FAQPage";
}) {
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? ("WebPage" as const),
    "@id": `${input.url}#webpage`,
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: CONTENT_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/**
 * BreadcrumbList из уже существующей иерархии адресов.
 *
 * Видимых «хлебных крошек» на страницу этот узел НЕ добавляет — он описывает ту вложенность,
 * которая уже выражена структурой URL.
 */
export function breadcrumbNode(items: readonly { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList" as const,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
