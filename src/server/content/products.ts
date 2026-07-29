import { cache } from "react";
import seedProducts from "../../../data/seed/products.json";
import seedPageContent from "../../../data/seed/page-content.json";
import {
  buildProductLocation,
  findProductBySlug as findBySlug,
  type ProductContent,
  type ProductHotspot,
  type ProductId,
  type ProductLayout,
  type ProductLocation,
  type ProductsPageCopy,
} from "@/features/products/products";
import { getProducts as readProducts, listAllProducts } from "../repositories/products";
import { getPageContent } from "../repositories/pageContent";
import { safePageCopy } from "./pageContentSchemas";

/**
 * Публичный доступ к продуктам и общим текстам страницы «Продукт и стоимость».
 *
 * Как и у отделов: данные из базы, а при пустой базе — исходный набор из `data/seed/products.json`,
 * чтобы страница продуктов не оказалась пустой на свежей установке.
 */

const fallbackProducts: ProductLocation[] = seedProducts.map((product) =>
  buildProductLocation({
    id: product.id as ProductId,
    slug: product.slug,
    menuTitle: product.menuTitle,
    fullTitle: product.fullTitle,
    order: product.order,
    alt: product.imageAlt,
    hotspot: product.hotspot as ProductHotspot,
    content: product.content as ProductContent,
    layout: product.layout as ProductLayout,
  }),
);

export const getProducts = cache((): ProductLocation[] => {
  const stored = readProducts();
  if (stored.length > 0) return stored;

  // Пустая таблица — база не заполнена, показываем исходный каталог. Строки есть, но все скрыты —
  // это решение владельца, и подставлять demo-каталог нельзя (найдено code review 2026-07-27).
  return listAllProducts().length === 0 ? fallbackProducts : [];
});

export function getProductBySlug(slug: string | undefined): ProductLocation | undefined {
  return findBySlug(getProducts(), slug);
}

/** Общие тексты страницы продуктов: заголовки, подписи вкладок, форматы внедрения. */
export const getProductsPageCopy = cache((): ProductsPageCopy => {
  const fallback = seedPageContent.products as ProductsPageCopy;
  const stored = getPageContent<Partial<ProductsPageCopy>>("products", fallback);

  // Поверхностное слияние с seed: запись, сохранённая старой версией формы, не должна оставлять
  // страницу без заголовка — недостающие подписи берутся из исходных текстов.
  const merged = {
    ...fallback,
    ...stored,
    sectionHeadings: { ...fallback.sectionHeadings, ...stored.sectionHeadings },
    tabs: { ...fallback.tabs, ...stored.tabs },
    implementationFormats: { ...fallback.implementationFormats, ...stored.implementationFormats },
  };

  // Слияние восполняет пропуски, но не спасает от неверного ТИПА: `{"headline": {"a": 1}}` пережил
  // бы его и упал уже в рендере. Итог проверяется схемой (SEC-09).
  return safePageCopy("products", merged, fallback);
});
