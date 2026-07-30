import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrations } from "@/server/db/schema.mjs";

/**
 * Обратная совместимость поля `seoTitle` со СТАРЫМ клиентом.
 *
 * Сценарий, ради которого этот файл существует. После деплоя у администратора остаётся открытая
 * вкладка админ-панели со старым JavaScript-бандлом. Её форма не знает про поле SEO title и шлёт
 * `PUT` без него. Если трактовать отсутствие поля как «очистить», первое же сохранение из такой
 * вкладки сотрёт заголовок, и на странице вернётся длинный автоматический — то самое, что чинил
 * шаг SEO-06, причём молча.
 *
 * Проверяется НАСТОЯЩИЙ SQL репозитория против настоящей SQLite в памяти, а не мок: суть решения в
 * том, что колонка `seo_title` не попадает в `UPDATE`, и подменённый репозиторий этого не покажет.
 */

const database = new DatabaseSync(":memory:");

vi.mock("@/server/db/client", async () => {
  const actual = await vi.importActual<typeof import("@/server/db/client")>("@/server/db/client");
  return {
    ...actual,
    getDatabase: () => database,
    transaction: <T>(run: () => T): T => {
      database.exec("BEGIN");
      try {
        const result = run();
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
});

// Схема применяется ОДИН раз: `ALTER TABLE` из миграции 0002 повторного выполнения не переживёт.
for (const migration of migrations) database.exec(migration.sql);

const { getProductById, insertProductIfMissing, updateProduct } =
  await import("@/server/repositories/products");
const { createArticle, getArticleById, updateArticle } =
  await import("@/server/repositories/articles");

const PRODUCT_SEO_TITLE = "AI-ассистент по знаниям: стоимость | QBit-Studio-Ai";
const ARTICLE_SEO_TITLE = "Как автоматизировать обработку заявок — QBit-Studio-Ai";

const PRODUCT_CONTENT = {
  summary: "Описание продукта.",
  applies: "Где применяется.",
  examples: ["Пример"],
  prices: [{ label: "Разработка", value: "от 100 000 ₽", amount: 100000 }],
  benefit: "Выгода.",
};
const PRODUCT_LAYOUT = {
  objectPosition: "50% 50%",
  focusPoint: "",
  freeArea: "",
  panelPosition: "right" as const,
  panelVertical: "center" as const,
  panelMaxWidth: 520,
};
const PRODUCT_HOTSPOT = {
  x: 10,
  y: 10,
  width: 20,
  height: 20,
  marker: { x: 50, y: 50, align: "center" as const },
};

/** Тело `PUT`, каким его шлёт НОВАЯ форма продукта, — без поля `seoTitle`. */
const productPayload = {
  slug: "rag-ai-assistant",
  menuTitle: "AI-ассистент",
  fullTitle: "AI-ассистент по знаниям компании",
  imageAlt: "Фотография рабочего места",
  content: PRODUCT_CONTENT,
  layout: PRODUCT_LAYOUT,
  hotspot: PRODUCT_HOTSPOT,
  sortOrder: 1,
  isPublished: true,
};

const articlePayload = {
  slug: "kak-avtomatizirovat-obrabotku-zayavok",
  title: "Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM",
  excerpt: "Анонс",
  description: "Описание",
  bodyMarkdown: "# Текст",
  coverUrl: "/blog/cover.webp",
  coverAlt: "Обложка",
  placement: "blog",
  category: "Автоматизация",
  tags: ["crm"],
  relatedSlugs: [],
  author: "QBit-Studio-Ai",
  seoDescription: "SEO-описание",
  status: "published" as const,
  isFeatured: false,
  sortOrder: 10,
  publishedAt: "2026-07-25",
};

/** Строка колонки в обход репозитория — репозиторий приводит `''` к `null` и скрыл бы разницу. */
const rawProductSeoTitle = () =>
  (
    database.prepare("SELECT seo_title FROM products WHERE id = 'product-01'").get() as {
      seo_title: string | null;
    }
  ).seo_title;

const rawArticleSeoTitle = () =>
  (
    database.prepare("SELECT seo_title FROM articles WHERE id = 'article-01'").get() as {
      seo_title: string | null;
    }
  ).seo_title;

describe("совместимость со старым клиентом", () => {
  beforeEach(() => {
    database.exec("DELETE FROM products; DELETE FROM articles; DELETE FROM content_revisions;");

    database
      .prepare(
        `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot,
                               image_alt, seo_title, sort_order, is_published, created_at, updated_at)
         VALUES ('product-01', 'rag-ai-assistant', 'AI-ассистент', 'AI-ассистент по знаниям компании',
                 ?, ?, ?, 'Фотография рабочего места', ?, 1, 1,
                 '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(
        JSON.stringify(PRODUCT_CONTENT),
        JSON.stringify(PRODUCT_LAYOUT),
        JSON.stringify(PRODUCT_HOTSPOT),
        PRODUCT_SEO_TITLE,
      );

    database
      .prepare(
        `INSERT INTO articles (id, slug, title, excerpt, description, body_markdown, cover_url,
                               cover_alt, placement, category, tags, related_slugs, author,
                               seo_title, seo_description, status, is_featured, sort_order,
                               published_at, created_at, updated_at)
         VALUES ('article-01', ?, ?, 'Анонс', 'Описание', '# Текст', '/blog/cover.webp', 'Обложка',
                 'blog', 'Автоматизация', '["crm"]', '[]', 'QBit-Studio-Ai', ?, 'SEO-описание',
                 'published', 0, 10, '2026-07-25',
                 '2026-07-25T00:00:00.000Z', '2026-07-25T00:00:00.000Z')`,
      )
      .run(articlePayload.slug, articlePayload.title, ARTICLE_SEO_TITLE);
  });

  // ── 1. Продукт: старый клиент без поля ──────────────────────────────────────────────────────
  it("продукт: PUT без seoTitle сохраняет прежнее значение в БД", () => {
    updateProduct("product-01", productPayload);

    expect(rawProductSeoTitle()).toBe(PRODUCT_SEO_TITLE);
    expect(getProductById("product-01")?.seoTitleOverride).toBe(PRODUCT_SEO_TITLE);
    expect(getProductById("product-01")?.seo.title).toBe(PRODUCT_SEO_TITLE);
  });

  // ── 2. Статья: старый клиент без поля ───────────────────────────────────────────────────────
  it("статья: PUT без seoTitle сохраняет прежнее значение в БД", () => {
    updateArticle("article-01", articlePayload);

    expect(rawArticleSeoTitle()).toBe(ARTICLE_SEO_TITLE);
    expect(getArticleById("article-01")?.seoTitle).toBe(ARTICLE_SEO_TITLE);
  });

  // ── 3–5. Новый клиент: явная очистка ────────────────────────────────────────────────────────
  it.each([
    ["пустая строка", ""],
    ["строка из пробелов", "   "],
    ["null", null],
  ])("продукт: seoTitle = %s очищает заголовок", (_label, value) => {
    updateProduct("product-01", { ...productPayload, seoTitle: value });

    // У продукта пусто хранится как NULL — колонка nullable.
    expect(rawProductSeoTitle()).toBeNull();
    expect(getProductById("product-01")?.seoTitleOverride).toBeNull();
    // Очистка возвращает прежнюю автоматическую сборку, а не пустой заголовок.
    expect(getProductById("product-01")?.seo.title).toBe(
      "AI-ассистент по знаниям компании — стоимость разработки и внедрения | QBit-Studio-Ai",
    );
  });

  it.each([
    ["пустая строка", ""],
    ["строка из пробелов", "   "],
    ["null", null],
  ])("статья: seoTitle = %s очищает заголовок", (_label, value) => {
    updateArticle("article-01", { ...articlePayload, seoTitle: value });

    // У статьи колонка `NOT NULL DEFAULT ''` — внутри пустая строка, наружу всё равно null.
    expect(rawArticleSeoTitle()).toBe("");
    expect(getArticleById("article-01")?.seoTitle).toBeNull();
  });

  // ── 6. Новый клиент: новое значение ─────────────────────────────────────────────────────────
  it("новое непустое значение сохраняется и читается обратно", () => {
    updateProduct("product-01", { ...productPayload, seoTitle: "  Новый заголовок  " });
    updateArticle("article-01", { ...articlePayload, seoTitle: "  Другой заголовок  " });

    expect(rawProductSeoTitle()).toBe("Новый заголовок");
    expect(getProductById("product-01")?.seo.title).toBe("Новый заголовок");
    expect(rawArticleSeoTitle()).toBe("Другой заголовок");
    expect(getArticleById("article-01")?.seoTitle).toBe("Другой заголовок");
  });

  // ── 7. Остальные поля продолжают обновляться ────────────────────────────────────────────────
  it("при отсутствии seoTitle остальные поля обновляются как обычно", () => {
    updateProduct("product-01", {
      ...productPayload,
      menuTitle: "Новое короткое название",
      fullTitle: "Новое полное название",
      imageAlt: "Новое описание фотографии",
      sortOrder: 7,
      isPublished: false,
      content: { ...PRODUCT_CONTENT, summary: "Новое описание продукта." },
    });

    const product = getProductById("product-01");
    expect(product?.menuTitle).toBe("Новое короткое название");
    expect(product?.fullTitle).toBe("Новое полное название");
    expect(product?.images.alt).toBe("Новое описание фотографии");
    expect(product?.order).toBe(7);
    expect(product?.isPublished).toBe(false);
    expect(product?.content.summary).toBe("Новое описание продукта.");
    expect(rawProductSeoTitle()).toBe(PRODUCT_SEO_TITLE);

    updateArticle("article-01", {
      ...articlePayload,
      title: "Новое название статьи",
      excerpt: "Новый анонс",
      seoDescription: "Новое SEO-описание",
      sortOrder: 40,
    });

    const article = getArticleById("article-01");
    expect(article?.title).toBe("Новое название статьи");
    expect(article?.excerpt).toBe("Новый анонс");
    expect(article?.seoDescription).toBe("Новое SEO-описание");
    expect(article?.sortOrder).toBe(40);
    expect(rawArticleSeoTitle()).toBe(ARTICLE_SEO_TITLE);
  });

  it("отсутствие поля не подменяет заголовок и при ПОВТОРНЫХ сохранениях", () => {
    // Старый клиент сохраняет не один раз: значение обязано пережить каждое сохранение.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      updateProduct("product-01", productPayload);
      updateArticle("article-01", articlePayload);
    }

    expect(rawProductSeoTitle()).toBe(PRODUCT_SEO_TITLE);
    expect(rawArticleSeoTitle()).toBe(ARTICLE_SEO_TITLE);
  });

  it("очистка после отсутствия работает — состояния не «залипают»", () => {
    updateProduct("product-01", productPayload);
    expect(rawProductSeoTitle()).toBe(PRODUCT_SEO_TITLE);

    updateProduct("product-01", { ...productPayload, seoTitle: null });
    expect(rawProductSeoTitle()).toBeNull();

    updateProduct("product-01", { ...productPayload, seoTitle: "Снова заголовок" });
    expect(rawProductSeoTitle()).toBe("Снова заголовок");

    updateProduct("product-01", productPayload);
    expect(rawProductSeoTitle()).toBe("Снова заголовок");
  });
});

/**
 * Создание записей.
 *
 * Отдельный блок, потому что `INSERT` тоже переехал на динамический список колонок: список у
 * создания и обновления общий, и следующая правка перечня способна сломать «создать статью» в
 * админ-панели. У новой записи прежнего значения нет, поэтому отсутствие поля здесь означает не
 * «сохранить прежнее», а «не задан».
 */
describe("создание записи", () => {
  beforeEach(() => {
    database.exec("DELETE FROM products; DELETE FROM articles;");
  });

  const newArticle = { ...articlePayload, slug: "novaya-statya", title: "Новая статья" };
  const newProduct = { ...productPayload, id: "product-02", slug: "novyy-produkt" };

  it("статья без seoTitle создаётся, колонка получает DEFAULT '', наружу отдаётся null", () => {
    const created = createArticle("new-01", newArticle);

    expect(created.seoTitle).toBeNull();
    expect(created.title).toBe("Новая статья");
    expect(created.slug).toBe("novaya-statya");
    expect(created.bodyMarkdown).toBe(newArticle.bodyMarkdown);
    expect(created.seoDescription).toBe(newArticle.seoDescription);
    expect(
      (
        database.prepare("SELECT seo_title FROM articles WHERE id = 'new-01'").get() as {
          seo_title: string | null;
        }
      ).seo_title,
    ).toBe("");
  });

  it("статья с заданным seoTitle создаётся с ним, пробелы по краям срезаются", () => {
    const created = createArticle("new-02", { ...newArticle, seoTitle: "  Заголовок  " });
    expect(created.seoTitle).toBe("Заголовок");
  });

  it("продукт без seoTitle создаётся с NULL и собирает заголовок из fullTitle", () => {
    expect(insertProductIfMissing(newProduct)).toBe(true);

    const created = getProductById("product-02");
    expect(created?.seoTitleOverride).toBeNull();
    expect(created?.slug).toBe("novyy-produkt");
    expect(created?.menuTitle).toBe(newProduct.menuTitle);
    expect(created?.seo.title).toBe(
      "AI-ассистент по знаниям компании — стоимость разработки и внедрения | QBit-Studio-Ai",
    );

    // Идемпотентность: повторная вставка ничего не делает и не падает.
    expect(insertProductIfMissing(newProduct)).toBe(false);
  });

  it("продукт с заданным seoTitle создаётся с ним", () => {
    insertProductIfMissing({ ...newProduct, id: "product-03", seoTitle: "  Свой заголовок  " });

    expect(getProductById("product-03")?.seoTitleOverride).toBe("Свой заголовок");
  });
});
