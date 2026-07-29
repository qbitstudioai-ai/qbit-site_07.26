import { ProductsEditor } from "@/features/admin/ProductsEditor";
import type { ProductsPageCopy } from "@/features/products/products";
import seedPageContent from "../../../../data/seed/page-content.json";
import { getPageContent } from "@/server/repositories/pageContent";
import { listAllProducts } from "@/server/repositories/products";

/**
 * Раздел «Продукты и стоимость»: общие тексты страницы и десять продуктов.
 *
 * Общие тексты берутся из `page_content`, продукты — из таблицы `products`. Оба набора читаются на
 * сервере и передаются редактору готовыми.
 */
export default function AdminProductsPage() {
  const fallback = seedPageContent.products as ProductsPageCopy;
  const stored = getPageContent<Partial<ProductsPageCopy>>("products", fallback);

  const pageCopy: ProductsPageCopy = {
    ...fallback,
    ...stored,
    sectionHeadings: { ...fallback.sectionHeadings, ...stored.sectionHeadings },
    tabs: { ...fallback.tabs, ...stored.tabs },
    implementationFormats: { ...fallback.implementationFormats, ...stored.implementationFormats },
  };

  return <ProductsEditor products={listAllProducts()} pageCopy={pageCopy} />;
}
