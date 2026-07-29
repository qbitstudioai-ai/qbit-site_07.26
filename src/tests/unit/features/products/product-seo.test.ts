import { describe, expect, it } from "vitest";
import { productStructuredData } from "@/features/products/productSeo";
import { seedProductLocations as products } from "@/tests/fixtures/seedContent";

type ProductSchema = ReturnType<typeof productStructuredData>[number];

/**
 * Поиск узла по `@type` с сужением типа.
 *
 * Обычный `.find()` возвращает всё объединение узлов, и обращение к `offers` не проходит проверку
 * типов. Предикат сужает результат до нужного узла — проверки ниже остаются те же, но опираются на
 * настоящую форму данных, а не на `any`.
 */
function findSchema<Type extends ProductSchema["@type"]>(
  schemas: readonly ProductSchema[],
  type: Type,
): Extract<ProductSchema, { "@type": Type }> | undefined {
  return schemas.find(
    (schema): schema is Extract<ProductSchema, { "@type": Type }> => schema["@type"] === type,
  );
}

describe("product structured data", () => {
  it("describes starting prices without presenting them as fixed prices", () => {
    for (const product of products) {
      const schemas = productStructuredData(product);
      const service = findSchema(schemas, "Service");

      expect(service).toBeDefined();
      expect(service?.description).toBe(product.content.summary);
      expect(service?.offers).toHaveLength(product.id === "product-10" ? 1 : 3);

      service?.offers?.forEach((offer, index) => {
        expect(offer).not.toHaveProperty("price");
        expect(offer.priceCurrency).toBe("RUB");
        expect(offer.priceSpecification).toEqual({
          "@type": "PriceSpecification",
          minPrice: product.content.prices[index].amount,
          priceCurrency: "RUB",
        });
        expect(offer.description).toBeTruthy();
      });
    }
  });

  it("uses the approved brand spelling for the organization and hosted offer", () => {
    const firstSchemas = productStructuredData(products[0]);
    const firstOrganization = findSchema(firstSchemas, "Organization");
    const firstService = findSchema(firstSchemas, "Service");
    const hostedOffer = firstService?.offers?.[2];

    expect(firstOrganization?.name).toBe("QBit-Studio-Ai");
    expect(hostedOffer?.description).toContain("инфраструктуре QBit-Studio-Ai");
    expect(hostedOffer?.description).toContain("поддержка оплачивается отдельно");
  });
});
