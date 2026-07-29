/**
 * Типы и производные значения продукта.
 *
 * САМИ ПРОДУКТЫ здесь больше не лежат: с появлением админ-панели их источник — база
 * (`src/server/repositories/products.ts`), а исходные тексты переехали в `data/seed/products.json`.
 * Этот модуль остался тем, чем и был по существу: описанием формы данных и правилами, которые
 * выводятся из неё автоматически (пути к фотографиям, SEO-строки). Он не серверный и не клиентский —
 * его импортируют обе стороны, поэтому здесь нет ни доступа к базе, ни React.
 */

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
}

/**
 * Собирает продукт из редактируемых полей: подставляет фотографии и SEO-строки.
 *
 * SEO собирается, а не редактируется отдельно, намеренно: title и description обязаны совпадать с
 * названием и описанием продукта, а два независимых поля разъезжаются при первой же правке текста.
 */
export function buildProductLocation(input: ProductLocationInput): ProductLocation {
  const firstPrice = input.content.prices[0]?.value;

  return {
    id: input.id,
    slug: input.slug,
    menuTitle: input.menuTitle,
    fullTitle: input.fullTitle,
    order: input.order,
    hotspot: input.hotspot,
    content: input.content,
    layout: input.layout,
    images: {
      overview: automationLabImage,
      detail: productImage(input.id),
      alt: input.alt,
    },
    seo: {
      title: `${input.fullTitle} — стоимость разработки и внедрения | QBit-Studio-Ai`,
      description: firstPrice
        ? `${input.content.summary} Стоимость — ${firstPrice}.`
        : input.content.summary,
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
