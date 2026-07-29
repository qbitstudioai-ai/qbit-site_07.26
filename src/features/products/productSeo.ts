import {
  breadcrumbNode,
  CONTENT_LANGUAGE,
  ORGANIZATION_ID,
  organizationNode,
  SITE_URL,
} from "@/lib/seo";
import type { ProductLocation } from "./products";

/**
 * Реэкспорт ради совместимости: общесайтовые константы переехали в `src/lib/seo.ts` (там им и
 * место — адрес сайта не принадлежит разделу «Продукты»), но десяток файлов уже импортирует их
 * отсюда. Новый код берёт их напрямую из `@/lib/seo`.
 */
export { ORGANIZATION_ID, SITE_URL } from "@/lib/seo";

const implementationOfferDescriptions = [
  "Минимальная стоимость разработки. Клиент получает готовый рабочий код продукта.",
  "Минимальная стоимость разработки и размещения продукта на инфраструктуре клиента с передачей кода и прав согласно договору.",
  "Минимальная стоимость разработки и запуска продукта на инфраструктуре QBit-Studio-Ai. Ежемесячная поддержка оплачивается отдельно и рассчитывается индивидуально.",
] as const;

const n8nOfferDescription =
  "Минимальная стоимость автоматизации одного бизнес-процесса. Итоговая стоимость зависит от количества интеграций, веток сценария, правил обработки и требований к надёжности.";

export function productUrl(product: ProductLocation) {
  return `${SITE_URL}/products/${product.slug}`;
}

export function productStructuredData(product: ProductLocation) {
  const url = productUrl(product);

  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Продукты и стоимость", url: `${SITE_URL}/products` },
      { name: product.fullTitle, url },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Service" as const,
      "@id": `${url}#service`,
      name: product.fullTitle,
      description: product.content.summary,
      url,
      inLanguage: CONTENT_LANGUAGE,
      image: `${SITE_URL}${product.images.detail.fallbackSrc}`,
      provider: {
        "@id": ORGANIZATION_ID,
      },
      offers: product.content.prices.map((price, index) => ({
        "@type": "Offer",
        name: price.label,
        priceCurrency: "RUB",
        priceSpecification: {
          "@type": "PriceSpecification",
          minPrice: price.amount,
          priceCurrency: "RUB",
        },
        description:
          product.id === "product-10"
            ? n8nOfferDescription
            : implementationOfferDescriptions[index],
        url,
      })),
    },
    organizationNode(),
  ];
}
