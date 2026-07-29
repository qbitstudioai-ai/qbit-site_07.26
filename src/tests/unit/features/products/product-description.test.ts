import { describe, expect, it } from "vitest";
import {
  buildProductDescription,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MIN_LENGTH,
} from "@/features/products/products";
import { seedProductLocations as products } from "@/tests/fixtures/seedContent";

/**
 * Длина и происхождение meta description продуктов.
 *
 * Зачем этот тест существует. До правки 2026-07-29 описание собиралось как «полное описание
 * продукта + цена» и доходило до 251 символа — выдача обрезала его механически, посреди слова.
 * Тест закрывает возврат к этому: он падает и когда описание слишком длинное, и когда оно
 * усохло до бессодержательного огрызка.
 */

describe("product meta description", () => {
  it("укладывается в 120–160 символов у всех продуктов", () => {
    expect(products.length).toBeGreaterThan(0);

    for (const product of products) {
      const { description } = product.seo;

      expect(
        description.length,
        `${product.slug}: ${description.length} символов — «${description}»`,
      ).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX_LENGTH);

      expect(
        description.length,
        `${product.slug}: ${description.length} символов — «${description}»`,
      ).toBeGreaterThanOrEqual(PRODUCT_DESCRIPTION_MIN_LENGTH);
    }
  });

  it("не обрывается посреди фразы", () => {
    for (const product of products) {
      // Описание всегда заканчивается знаком конца предложения: кандидаты составляются из целых
      // предложений, а не подрезаются по длине.
      expect(product.seo.description, product.slug).toMatch(/[.!?]$/);
      expect(product.seo.description, product.slug).not.toMatch(/\s(и|в|на|с|для|по|или)[.]$/);
    }
  });

  it("состоит из текста, который посетитель видит на странице продукта", () => {
    for (const product of products) {
      const description = product.seo.description;
      const priceTail = product.content.prices[0]
        ? ` Стоимость — ${product.content.prices[0].value}.`
        : "";

      const withoutPrice =
        description.endsWith(priceTail) && priceTail
          ? description.slice(0, -priceTail.length)
          : description;

      // Каждое слово описания взято из видимого `summary`: помимо возможного среза повтора
      // названия и заглавной буквы, ничего не сочиняется.
      const normalized = withoutPrice.charAt(0).toLowerCase() + withoutPrice.slice(1);
      const summary = product.content.summary;

      expect(
        summary.includes(withoutPrice) || summary.includes(normalized),
        `${product.slug}: описание «${withoutPrice}» не найдено в видимом тексте продукта`,
      ).toBe(true);
    }
  });

  it("добавляет цену только когда она помещается целиком", () => {
    for (const product of products) {
      const description = product.seo.description;
      if (!description.includes("Стоимость —")) continue;

      expect(description, product.slug).toContain(
        `Стоимость — ${product.content.prices[0].value}.`,
      );
      expect(description.length, product.slug).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX_LENGTH);
    }
  });

  it("не обрезает единственное длинное предложение молча", () => {
    // Граничный случай: одно предложение длиннее предела. Сокращать его нечем, поэтому оно
    // возвращается целиком — пустое описание было бы хуже длинного.
    const long = `${"Очень длинное предложение без единой точки внутри".repeat(5)}.`;
    const result = buildProductDescription({ fullTitle: "Продукт", summary: long });

    expect(result).toBe(long);
  });

  it("срезает повтор названия, только если описание с него начинается", () => {
    const summary = "Совершенно другое начало, не совпадающее с названием продукта.";
    const result = buildProductDescription({ fullTitle: "Название продукта", summary });

    expect(result).toBe(summary);
  });
});
