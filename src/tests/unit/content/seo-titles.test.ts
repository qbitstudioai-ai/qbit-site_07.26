import seedArticles from "../../../../data/seed/articles.json";
import seedProducts from "../../../../data/seed/products.json";
import { describe, expect, it } from "vitest";
import { blogPostStructuredData } from "@/features/blog/blogSeo";
import { buildProductLocation, buildProductSeoTitle } from "@/features/products/products";
import type {
  ProductContent,
  ProductHotspot,
  ProductId,
  ProductLayout,
} from "@/features/products/products";
import { productStructuredData } from "@/features/products/productSeo";
import { normalizeSeoTitle, SITE_NAME } from "@/lib/seo";
import { seedBlogPosts, seedProductLocations } from "@/tests/fixtures/seedContent";

/**
 * Заголовки для поисковой выдачи: продуктовые страницы и статьи.
 *
 * Повод — выгрузка Bing Webmaster Tools «Title too long» и аудит production 2026-07-30: десять
 * продуктовых страниц и шесть статей отдавали `<title>` длиной 76–99 знаков, и выдача обрезала их
 * посреди фразы. Тест закрывает возврат к длинным заголовкам и, отдельно, любое изменение видимых
 * названий — H1 продуктов и статей к SEO-заголовку отношения не имеет и меняться не должен.
 */

/** Верхняя граница из задания. Строже практических 60 знаков — с запасом на пересчёт выдачей. */
const SEO_TITLE_MAX_LENGTH = 55;

const HOME_SEO_TITLE = "ИИ-автоматизация бизнеса и продаж — QBit-Studio-Ai";
const CALL_ANALYSIS_SEO_TITLE = "AI-анализ звонков: стоимость | QBit-Studio-Ai";

/**
 * Видимые названия на момент постановки задачи.
 *
 * Заморожены здесь намеренно: требование «не менять H1» невозможно проверить, не зафиксировав
 * прежние значения. Если название продукта или статьи меняют осознанно, этот список правится
 * вместе с ним — и правка становится видимой в ревью, а не проходит незамеченной.
 */
const PRODUCT_FULL_TITLES: Record<string, string> = {
  "product-01": "AI-ассистент по знаниям компании",
  "product-02": "AI-менеджер для сайта и мессенджеров",
  "product-03": "Единый сбор заявок в CRM",
  "product-04": "AI-помощник менеджера в CRM",
  "product-05": "AI-контроль качества звонков",
  "product-06": "AI-помощник для подбора и адаптации сотрудников",
  "product-07": "AI-аналитика продаж для руководителя",
  "product-08": "AI-обработка и анализ документов",
  "product-09": "AI-протокол совещаний и контроль задач",
  "product-10": "Автоматизация бизнес-процесса на n8n",
};

const ARTICLE_TITLES: Record<string, string> = {
  "kak-avtomatizirovat-obrabotku-zayavok":
    "Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM",
  "ai-assistent-po-baze-znaniy":
    "AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу",
  "analiz-zvonkov-otdela-prodazh":
    "Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить",
  "avtomatizatsiya-dokumentov-s-ai":
    "Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных",
  "sayt-crm-i-messendzhery": "Как связать сайт, CRM и мессенджеры в единый бизнес-процесс",
  "chto-mozhno-avtomatizirovat-na-n8n":
    "Что можно автоматизировать на n8n: практические сценарии для бизнеса",
};

const PRODUCT_SLUGS: Record<string, string> = {
  "product-01": "rag-ai-assistant",
  "product-02": "ai-manager",
  "product-03": "leads-to-crm",
  "product-04": "crm-ai-assistant",
  "product-05": "call-analysis",
  "product-06": "hr-ai-assistant",
  "product-07": "sales-analytics",
  "product-08": "document-analysis",
  "product-09": "meeting-protocol",
  "product-10": "n8n-automation",
};

describe("SEO-заголовки продуктов и статей", () => {
  it("главная и анализ звонков используют утверждённые SEO title", async () => {
    const { generateMetadata } = await import("@/app/page");
    const homeMetadata = generateMetadata();
    const callAnalysis = seedProductLocations.find((product) => product.slug === "call-analysis");

    expect(homeMetadata.title).toBe(HOME_SEO_TITLE);
    expect(String(homeMetadata.title)).toHaveLength(50);
    expect(homeMetadata.alternates?.canonical).toBe("https://allqbit.ru");

    expect(callAnalysis?.seo.title).toBe(CALL_ANALYSIS_SEO_TITLE);
    expect(callAnalysis?.seo.title).toHaveLength(45);
    expect(callAnalysis?.fullTitle).toBe(PRODUCT_FULL_TITLES["product-05"]);
  });

  it("каждая из шестнадцати страниц задаёт собственный заголовок", () => {
    for (const product of seedProductLocations) {
      expect(product.seoTitleOverride, `продукт ${product.id}`).not.toBeNull();
    }
    for (const post of seedBlogPosts) {
      expect(post.seoTitle, `статья ${post.slug}`).not.toBeNull();
    }
    expect(seedProductLocations).toHaveLength(10);
    expect(seedBlogPosts).toHaveLength(6);
  });

  it("ни один заголовок не длиннее предела, из-за которого выдача обрезает строку", () => {
    for (const product of seedProductLocations) {
      expect(
        product.seo.title.length,
        `продукт ${product.id}: «${product.seo.title}»`,
      ).toBeLessThanOrEqual(SEO_TITLE_MAX_LENGTH);
    }
    for (const post of seedBlogPosts) {
      expect(
        String(post.seoTitle).length,
        `статья ${post.slug}: «${post.seoTitle}»`,
      ).toBeLessThanOrEqual(SEO_TITLE_MAX_LENGTH);
    }
  });

  it("бренд сохранён в каждом заголовке", () => {
    for (const product of seedProductLocations) {
      expect(product.seo.title, `продукт ${product.id}`).toContain(SITE_NAME);
    }
    for (const post of seedBlogPosts) {
      expect(String(post.seoTitle), `статья ${post.slug}`).toContain(SITE_NAME);
    }
  });

  it("две страницы не могут получить одинаковый заголовок", () => {
    const titles = [
      ...seedProductLocations.map((product) => product.seo.title),
      ...seedBlogPosts.map((post) => String(post.seoTitle)),
    ];

    expect(titles).toHaveLength(16);
    expect(new Set(titles).size).toBe(16);
  });

  it("видимые названия продуктов и их адреса не изменились", () => {
    for (const product of seedProductLocations) {
      expect(product.fullTitle, `H1 продукта ${product.id}`).toBe(PRODUCT_FULL_TITLES[product.id]);
      expect(product.slug, `адрес продукта ${product.id}`).toBe(PRODUCT_SLUGS[product.id]);
      // Смысл всей затеи: заголовок для выдачи и заголовок на странице — разные строки.
      expect(product.seo.title).not.toBe(product.fullTitle);
    }
  });

  it("видимые названия статей и их адреса не изменились", () => {
    for (const post of seedBlogPosts) {
      expect(post.title, `H1 статьи ${post.slug}`).toBe(ARTICLE_TITLES[post.slug]);
      expect(post.seoTitle).not.toBe(post.title);
    }
    expect(Object.keys(ARTICLE_TITLES).sort()).toEqual(seedBlogPosts.map((p) => p.slug).sort());
  });

  it("исходные данные несут ровно то же, что и собранные объекты", () => {
    // Защита от расхождения `data/seed/*.json` и публичного слоя: значение обязано доезжать
    // до страницы без потери и без подмены.
    for (const raw of seedProducts) {
      const built = seedProductLocations.find((product) => product.id === raw.id);
      expect(built?.seo.title).toBe(raw.seoTitle);
    }
    for (const raw of seedArticles) {
      const built = seedBlogPosts.find((post) => post.slug === raw.slug);
      expect(built?.seoTitle).toBe(raw.seoTitle);
    }
  });
});

describe("сборка заголовка продукта", () => {
  const base = seedProducts[0];
  const input = {
    id: base.id as ProductId,
    slug: base.slug,
    menuTitle: base.menuTitle,
    fullTitle: base.fullTitle,
    order: base.order,
    alt: base.imageAlt,
    hotspot: base.hotspot as ProductHotspot,
    content: base.content as ProductContent,
    layout: base.layout as ProductLayout,
  };

  it("заданный заголовок используется дословно, без приписки бренда", () => {
    const product = buildProductLocation({ ...input, seoTitle: "Свой заголовок" });

    expect(product.seo.title).toBe("Свой заголовок");
    expect(product.seoTitleOverride).toBe("Свой заголовок");
  });

  it("пустое значение возвращает прежнюю автоматическую сборку", () => {
    const expected = buildProductSeoTitle(base.fullTitle);

    for (const empty of [undefined, null, "", "   "]) {
      const product = buildProductLocation({ ...input, seoTitle: empty });
      expect(product.seo.title, `значение ${JSON.stringify(empty)}`).toBe(expected);
      expect(product.seoTitleOverride).toBeNull();
    }

    expect(expected).toBe(
      "AI-ассистент по знаниям компании — стоимость разработки и внедрения | QBit-Studio-Ai",
    );
  });

  it("заголовок не влияет на видимые названия и описание продукта", () => {
    const withTitle = buildProductLocation({ ...input, seoTitle: "Совсем другой заголовок" });
    const withoutTitle = buildProductLocation({ ...input, seoTitle: null });

    expect(withTitle.fullTitle).toBe(withoutTitle.fullTitle);
    expect(withTitle.menuTitle).toBe(withoutTitle.menuTitle);
    expect(withTitle.slug).toBe(withoutTitle.slug);
    expect(withTitle.content).toEqual(withoutTitle.content);
    expect(withTitle.seo.description).toBe(withoutTitle.seo.description);
  });
});

describe("разметка не подхватывает SEO-заголовок", () => {
  it("JSON-LD продукта называет продукт видимым названием", () => {
    for (const product of seedProductLocations) {
      const service = productStructuredData(product).find((node) => node["@type"] === "Service") as
        { name?: string } | undefined;

      expect(service?.name).toBe(product.fullTitle);
      expect(service?.name).not.toBe(product.seo.title);
    }
  });

  it("JSON-LD статьи называет статью видимым названием", () => {
    for (const post of seedBlogPosts) {
      const article = blogPostStructuredData(post).find(
        (node) => node["@type"] === "BlogPosting",
      ) as { headline?: string } | undefined;

      expect(article?.headline).toBe(post.title);
      expect(article?.headline).not.toBe(post.seoTitle);
    }
  });
});

describe("normalizeSeoTitle", () => {
  it("приводит все виды «не задано» к null", () => {
    expect(normalizeSeoTitle(undefined)).toBeNull();
    expect(normalizeSeoTitle(null)).toBeNull();
    expect(normalizeSeoTitle("")).toBeNull();
    expect(normalizeSeoTitle("   ")).toBeNull();
    expect(normalizeSeoTitle("\n\t ")).toBeNull();
  });

  it("сохраняет заданное значение и срезает окружающие пробелы", () => {
    expect(normalizeSeoTitle("  Заголовок  ")).toBe("Заголовок");
    expect(normalizeSeoTitle("Заголовок — QBit-Studio-Ai")).toBe("Заголовок — QBit-Studio-Ai");
  });
});
