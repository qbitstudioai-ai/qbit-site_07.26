import { describe, expect, it } from "vitest";
import {
  automationLabImage,
  findAdjacentProducts,
  findProductBySlug,
  PRODUCT_IDS,
} from "@/features/products/products";
import { seedProductLocations as products } from "@/tests/fixtures/seedContent";

describe("product location configuration", () => {
  it("uses the approved self-contained summaries in product order", () => {
    expect(products.map((product) => product.content.summary)).toEqual([
      "AI-ассистент по знаниям компании — это система, которая находит ответы в регламентах, инструкциях, договорах, базе товаров, FAQ и обучающих материалах. Она отвечает по утверждённым источникам и может указывать нужный документ.",
      "AI-менеджер для сайта и мессенджеров — это система, которая принимает обращения, отвечает на частые вопросы, уточняет потребность клиента и передаёт подготовленную заявку менеджеру или в CRM.",
      "Единый сбор заявок в CRM — это система, которая собирает обращения из разных каналов и автоматически создаёт контакты, сделки и задачи в CRM.",
      "AI-помощник менеджера в CRM — это система, которая анализирует карточки сделок и коммуникации, готовит резюме, предлагает следующий шаг и напоминает о клиентах без активности.",
      "AI-контроль качества звонков — это система, которая расшифровывает звонки, формирует резюме и проверяет разговоры по заданному чек-листу: выявление потребности, презентация, работа с возражениями и следующий шаг.",
      "AI-помощник для подбора и адаптации сотрудников — это система, которая анализирует резюме по заданным критериям, формирует предварительный рейтинг кандидатов, готовит вопросы для интервью и помогает с онбордингом.",
      "AI-аналитика продаж для руководителя — это система, которая объединяет данные из CRM, таблиц, отчётов, звонков и переписок и показывает изменения в воронке, активности менеджеров и выполнении плана.",
      "AI-обработка и анализ документов — это система, которая распознаёт, классифицирует и сравнивает документы, а также извлекает реквизиты, суммы, сроки, условия и позиции.",
      "AI-протокол совещаний и контроль задач — это система, которая расшифровывает встречу, формирует краткий протокол и выделяет принятые решения, задачи, ответственных и сроки.",
      "Автоматизация бизнес-процесса на n8n — это система, которая связывает CRM, мессенджеры, таблицы, почту, телефонию, 1С, базы данных и AI-модели в единый автоматизированный процесс.",
    ]);
  });

  it("keeps exactly ten ordered products with stable direct URLs", () => {
    expect(products).toHaveLength(10);
    expect(products.map((product) => product.id)).toEqual(PRODUCT_IDS);
    expect(products.map((product) => product.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(products.map((product) => product.slug)).size).toBe(10);

    for (const product of products) {
      expect(findProductBySlug(products, product.slug)).toBe(product);
      expect(product.menuTitle.length).toBeGreaterThan(0);
      expect(product.fullTitle.length).toBeGreaterThan(0);
      expect(product.slug).not.toMatch(/^product-/);
    }
  });

  it("keeps every product concern in the same configuration object", () => {
    for (const product of products) {
      expect(product.content.examples).toHaveLength(4);
      expect(product.content.prices.length).toBeGreaterThanOrEqual(1);
      expect(product.content.prices.length).toBeLessThanOrEqual(3);
      expect(product.layout.panelMaxWidth).toBeGreaterThanOrEqual(400);
      expect(["left", "right"]).toContain(product.layout.panelPosition);
      expect(product.seo.title).toContain(product.fullTitle);
      expect(product.seo.description).toContain(product.content.summary);
    }
  });

  it("stores every hotspot as an in-frame relative rectangle", () => {
    for (const { hotspot } of products) {
      expect(hotspot.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.width).toBeGreaterThan(0);
      expect(hotspot.height).toBeGreaterThan(0);
      expect(hotspot.x + hotspot.width).toBeLessThanOrEqual(100);
      expect(hotspot.y + hotspot.height).toBeLessThanOrEqual(100);
      expect(hotspot.marker.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.marker.x).toBeLessThanOrEqual(100);
      expect(hotspot.marker.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.marker.y).toBeLessThanOrEqual(100);
      expect(["start", "center", "end"]).toContain(hotspot.marker.align);
    }
  });

  it("uses responsive AVIF and WebP sources without preloading the product set in config", () => {
    expect(automationLabImage.avifSrcSet).toContain("automation-lab-main-960.avif");

    for (const product of products) {
      expect(product.images.overview).toBe(automationLabImage);
      expect(product.images.detail.avifSrcSet).toContain(`${product.id}-960.avif`);
      expect(product.images.detail.avifSrcSet).toContain(`${product.id}-1448.avif`);
      expect(product.images.detail.webpSrcSet).toContain(`${product.id}-960.webp`);
      expect(product.images.detail.fallbackSrc).toBe(`/products/${product.id}-1448.webp`);
    }
  });

  it("uses one offer only for n8n and three offers for the other products", () => {
    expect(products.slice(0, 9).every((product) => product.content.prices.length === 3)).toBe(true);
    expect(products[9].content.prices).toHaveLength(1);
    expect(products[9].content.prices[0].value).toBe("от 69 000 ₽");
  });

  it("preloads only the immediate neighbours of an active product", () => {
    expect(findAdjacentProducts(products, "product-01").map((product) => product.id)).toEqual([
      "product-02",
    ]);
    expect(findAdjacentProducts(products, "product-05").map((product) => product.id)).toEqual([
      "product-04",
      "product-06",
    ]);
    expect(findAdjacentProducts(products, "product-10").map((product) => product.id)).toEqual([
      "product-09",
    ]);
  });
});
