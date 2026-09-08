import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleInput } from "@/server/repositories/articles";
import type { ProductUpdateInput } from "@/server/repositories/products";

/**
 * Адрес опубликованной страницы и его неизменяемость.
 *
 * Правило одно на два раздела: адрес, который уже был виден снаружи, не меняется правкой. Смена
 * адреса обрывает внешние ссылки, обнуляет историю страницы в поиске и оставляет прежний адрес
 * отвечать 404 — операции переезда с редиректом в проекте нет, поэтому и выполнить её случайно
 * нельзя: ни из формы, ни прямым запросом к API присланный адрес не записывается.
 *
 * Различие между разделами — только в том, когда адрес фиксируется:
 *
 * — продукт существует постоянно и всегда опубликован адресом, поэтому его slug неизменен всегда;
 * — статья пишется как черновик, и до ПЕРВОЙ публикации её адрес ещё никому не известен, поэтому
 *   там правка адреса разрешена и уникальность проверяется по-прежнему.
 *
 * Роуты проверяются НАСТОЯЩИЕ и против настоящей (временной) базы — как в `casesAdminApi.test.ts`.
 * Подменены только внешние обстоятельства, которых вне HTTP-запроса не существует: вход в панель,
 * сброс кэша Next.js, отложенное `after()` и отправка в IndexNow. Схема, репозитории и SQL с его
 * ограничением UNIQUE работают так же, как в production.
 */

/** Текущая сессия. `null` — посетитель не вошёл в панель. */
const session = { id: null as string | null };
const revalidateSection = vi.fn();
const revalidateSiteWide = vi.fn();
const submitIndexNow = vi.fn().mockResolvedValue({ ok: true });
const afterCallbacks: (() => Promise<void>)[] = [];

vi.mock("@/server/auth/session", () => ({
  getActiveSessionId: async () => session.id,
}));

vi.mock("@/server/api/revalidate", () => ({
  revalidateSection: (section: string) => revalidateSection(section),
  revalidateSiteWide: () => revalidateSiteWide(),
}));

vi.mock("@/server/indexnow/client", () => ({
  submitIndexNow: (urls: string[]) => submitIndexNow(urls),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    // Вне запроса `after()` выполнять нечему: колбэк складывается и вызывается тестом вручную.
    after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
  };
});

let temporaryDirectory: string;

const PRODUCT_SLUG = "rag-ai-assistant";
const OTHER_PRODUCT_SLUG = "avtomatizatsiya-dokumentov";

/** Тело формы продукта — ровно то, что принимает `productUpdateSchema`. */
const PRODUCT_BODY = {
  slug: PRODUCT_SLUG,
  menuTitle: "AI-ассистент",
  fullTitle: "AI-ассистент по знаниям компании",
  imageAlt: "Фотография рабочего места",
  content: {
    summary: "Описание продукта.",
    applies: "Где применяется.",
    examples: ["Пример"],
    prices: [{ label: "Разработка", value: "от 100 000 ₽", amount: 100000 }],
    benefit: "Выгода.",
  },
  sortOrder: 1,
  isPublished: true,
};

const ARTICLE_SLUG = "kak-avtomatizirovat-obrabotku-zayavok";
const OTHER_ARTICLE_SLUG = "pochemu-teryayutsya-zayavki";

/** Тело формы статьи — ровно то, что принимает `articleSchema`. */
const ARTICLE_BODY = {
  slug: ARTICLE_SLUG,
  title: "Автоматизация обработки заявок",
  excerpt: "Анонс",
  bodyMarkdown: "# Текст",
  placement: "blog",
  status: "draft",
  publishedAt: null as string | null,
};

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-slug-api-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
  session.id = "admin-session";
  revalidateSection.mockReset();
  revalidateSiteWide.mockReset();
  submitIndexNow.mockReset().mockResolvedValue({ ok: true });
  afterCallbacks.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Продукты ──────────────────────────────────────────────────────────────────────────────────

/** Кладёт продукт в базу настоящим репозиторием: страницы продуктов миграциями не заводятся. */
async function seedProduct(id: string, slug: string) {
  const { insertProductIfMissing } = await import("@/server/repositories/products");
  const input: ProductUpdateInput & { id: string } = {
    id,
    slug,
    menuTitle: PRODUCT_BODY.menuTitle,
    fullTitle: PRODUCT_BODY.fullTitle,
    imageAlt: PRODUCT_BODY.imageAlt,
    content: PRODUCT_BODY.content,
    layout: {
      objectPosition: "50% 50%",
      focusPoint: "",
      freeArea: "",
      panelPosition: "right",
      panelVertical: "center",
      panelMaxWidth: 520,
    },
    hotspot: { x: 10, y: 10, width: 20, height: 20, marker: { x: 50, y: 50, align: "center" } },
    sortOrder: PRODUCT_BODY.sortOrder,
    isPublished: true,
  };
  insertProductIfMissing(input);
}

async function putProduct(id: string, body: unknown) {
  const { PUT } = await import("@/app/api/admin/products/[id]/route");
  return PUT(jsonRequest(`http://localhost/api/admin/products/${id}`, body), {
    params: Promise.resolve({ id }),
  });
}

interface ProductResponse {
  product: { id: string; slug: string; menuTitle: string };
}

describe("правка продукта: адрес неизменен", () => {
  it("ИГНОРИРУЕТ присланный адрес и сохраняет остальные поля", async () => {
    await seedProduct("product-01", PRODUCT_SLUG);

    const response = await putProduct("product-01", {
      ...PRODUCT_BODY,
      slug: "drugoy-adres",
      menuTitle: "Другое название",
    });
    const { product } = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(product.slug).toBe(PRODUCT_SLUG);
    // Остальная правка при этом доехала: игнорируется адрес, а не запрос целиком.
    expect(product.menuTitle).toBe("Другое название");

    const { getProductById, getProductBySlug } = await import("@/server/repositories/products");
    expect(getProductById("product-01")?.slug).toBe(PRODUCT_SLUG);
    expect(getProductBySlug("drugoy-adres")).toBeUndefined();
    expect(getProductBySlug(PRODUCT_SLUG)).toBeDefined();
  });

  it("чужой адрес в теле — не ошибка формы: он всё равно не будет записан", async () => {
    await seedProduct("product-01", PRODUCT_SLUG);
    await seedProduct("product-02", OTHER_PRODUCT_SLUG);

    const response = await putProduct("product-01", {
      ...PRODUCT_BODY,
      slug: OTHER_PRODUCT_SLUG,
      menuTitle: "Другое название",
    });
    const { product } = (await response.json()) as ProductResponse;

    // Раньше здесь было 409 «адрес занят»: проверялась занятость значения, которое не сохраняется.
    expect(response.status).toBe(200);
    expect(product.slug).toBe(PRODUCT_SLUG);

    const { getProductById } = await import("@/server/repositories/products");
    // И соседний продукт своего адреса не лишился.
    expect(getProductById("product-02")?.slug).toBe(OTHER_PRODUCT_SLUG);
  });

  it("сохранение по-прежнему сбрасывает кэш и уведомляет IndexNow ровно об одном адресе", async () => {
    await seedProduct("product-01", PRODUCT_SLUG);

    await putProduct("product-01", { ...PRODUCT_BODY, slug: "drugoy-adres" });

    expect(revalidateSection).toHaveBeenCalledWith("/products");
    expect(revalidateSiteWide).toHaveBeenCalledTimes(1);

    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    // Прежний адрес в очередь не попадает: переезда не было, старой страницы не существует.
    expect(submitIndexNow).toHaveBeenCalledWith([
      `https://allqbit.ru/products/${PRODUCT_SLUG}`,
      "https://allqbit.ru/products",
    ]);
  });
});

// ── Статьи ────────────────────────────────────────────────────────────────────────────────────

/** Кладёт статью в базу настоящим репозиторием. */
async function seedArticle(
  id: string,
  overrides: Partial<ArticleInput> & Pick<ArticleInput, "slug">,
) {
  const { createArticle } = await import("@/server/repositories/articles");
  createArticle(id, {
    title: ARTICLE_BODY.title,
    excerpt: ARTICLE_BODY.excerpt,
    description: "",
    bodyMarkdown: ARTICLE_BODY.bodyMarkdown,
    coverUrl: "",
    coverAlt: "",
    placement: "blog",
    category: "",
    tags: [],
    relatedSlugs: [],
    author: "",
    seoDescription: "",
    status: "draft",
    isFeatured: false,
    sortOrder: 0,
    publishedAt: null,
    ...overrides,
  });
}

async function putArticle(id: string, body: unknown) {
  const { PUT } = await import("@/app/api/admin/articles/[id]/route");
  return PUT(jsonRequest(`http://localhost/api/admin/articles/${id}`, body), {
    params: Promise.resolve({ id }),
  });
}

interface ArticleResponse {
  article: { id: string; slug: string; title: string; status: string; publishedAt: string | null };
}

describe("правка статьи: адрес до первой публикации", () => {
  it("черновик, который никогда не публиковался, МЕНЯЕТ адрес", async () => {
    await seedArticle("article-01", { slug: ARTICLE_SLUG, status: "draft", publishedAt: null });

    const response = await putArticle("article-01", { ...ARTICLE_BODY, slug: "novyy-adres" });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    expect(article.slug).toBe("novyy-adres");

    const { getArticleById, getArticleBySlug } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.slug).toBe("novyy-adres");
    expect(getArticleBySlug(ARTICLE_SLUG)).toBeUndefined();
  });

  it("у черновика проверка занятости адреса продолжает работать", async () => {
    await seedArticle("article-01", { slug: ARTICLE_SLUG, status: "draft", publishedAt: null });
    await seedArticle("article-02", { slug: OTHER_ARTICLE_SLUG, status: "draft" });

    const response = await putArticle("article-01", { ...ARTICLE_BODY, slug: OTHER_ARTICLE_SLUG });

    // Адрес ещё можно менять — значит занятое значение обязано давать понятную ошибку формы, а не
    // нарушение UNIQUE в глубине репозитория.
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toContain(OTHER_ARTICLE_SLUG);

    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.slug).toBe(ARTICLE_SLUG);
  });
});

describe("правка статьи: адрес после публикации", () => {
  it("опубликованная статья НЕ меняет адрес, но принимает остальную правку", async () => {
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      slug: "novyy-adres",
      title: "Новое название",
      status: "published",
      publishedAt: "2026-08-01",
    });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    expect(article.slug).toBe(ARTICLE_SLUG);
    expect(article.title).toBe("Новое название");

    const { getArticleById, getArticleBySlug } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.slug).toBe(ARTICLE_SLUG);
    expect(getArticleBySlug("novyy-adres")).toBeUndefined();
  });

  it("снятая с публикации статья с сохранившейся датой тоже НЕ меняет адрес", async () => {
    // Статус вернули в `draft`, но `published_at` остался: страница была видна снаружи, на её
    // адрес могли сослаться, и он такой же чужой, как у опубликованной.
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "draft",
      publishedAt: "2026-08-01",
    });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      slug: "novyy-adres",
      publishedAt: "2026-08-01",
    });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    expect(article.slug).toBe(ARTICLE_SLUG);
    expect(article.status).toBe("draft");

    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.slug).toBe(ARTICLE_SLUG);
  });

  it("чужой адрес в теле опубликованной статьи — не ошибка формы", async () => {
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });
    await seedArticle("article-02", { slug: OTHER_ARTICLE_SLUG, status: "draft" });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      slug: OTHER_ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });
    const { article } = (await response.json()) as ArticleResponse;

    // Занятость не проверяется: присланный адрес заведомо не будет записан.
    expect(response.status).toBe(200);
    expect(article.slug).toBe(ARTICLE_SLUG);

    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-02")?.slug).toBe(OTHER_ARTICLE_SLUG);
  });

  it("сохранение опубликованной статьи уведомляет IndexNow только о её адресе", async () => {
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });

    await putArticle("article-01", {
      ...ARTICLE_BODY,
      slug: "novyy-adres",
      status: "published",
      publishedAt: "2026-08-01",
    });

    expect(revalidateSection).toHaveBeenCalledWith("/blog");
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();

    expect(submitIndexNow).toHaveBeenCalledWith([
      `https://allqbit.ru/blog/${ARTICLE_SLUG}`,
      "https://allqbit.ru/blog",
    ]);
  });
});

/**
 * Дата публикации — ключ замка адреса, поэтому у неё своя защита.
 *
 * Пока обычное сохранение могло записать в `published_at` пустое значение, замок открывался прямо
 * из формы: снять статью с публикации, очистить поле даты, сохранить — и адрес, который уже был
 * виден снаружи, снова свободен. Проверки ниже закрывают именно эту последовательность.
 */
describe("правка статьи: дата публикации не стирается", () => {
  it("снятие с публикации с пустой датой НЕ обнуляет её — и адрес остаётся закрытым", async () => {
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });

    // Шаг 1: статью снимают с публикации, форма присылает пустую дату.
    const unpublished = await putArticle("article-01", {
      ...ARTICLE_BODY,
      status: "draft",
      publishedAt: null,
    });
    const first = (await unpublished.json()) as ArticleResponse;

    expect(unpublished.status).toBe(200);
    expect(first.article.status).toBe("draft");
    expect(first.article.publishedAt).toBe("2026-08-01");

    // Дата уцелела именно В БАЗЕ, а не только в теле ответа.
    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.publishedAt).toBe("2026-08-01");

    // Шаг 2: следом пробуют сменить адрес — замок никуда не делся.
    const renamed = await putArticle("article-01", {
      ...ARTICLE_BODY,
      slug: "novyy-adres",
      status: "draft",
      publishedAt: null,
    });
    const second = (await renamed.json()) as ArticleResponse;

    expect(renamed.status).toBe(200);
    expect(second.article.slug).toBe(ARTICLE_SLUG);
    expect(getArticleById("article-01")?.slug).toBe(ARTICLE_SLUG);
    expect(getArticleById("article-01")?.publishedAt).toBe("2026-08-01");
  });

  it("опубликованная статья с пустой датой в запросе не получает СЕГОДНЯШНЮЮ вместо прежней", async () => {
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      status: "published",
      publishedAt: null,
    });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    // Дата ПЕРВОГО выхода материала: повторное сохранение не выдаёт статью за сегодняшнюю.
    expect(article.publishedAt).toBe("2026-08-01");
    expect(article.publishedAt).not.toBe(new Date().toISOString().slice(0, 10));

    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.publishedAt).toBe("2026-08-01");
  });

  it("непустую дату по-прежнему можно исправить", async () => {
    await seedArticle("article-01", {
      slug: ARTICLE_SLUG,
      status: "published",
      publishedAt: "2026-08-01",
    });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      status: "published",
      publishedAt: "2026-08-15",
    });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    expect(article.publishedAt).toBe("2026-08-15");

    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.publishedAt).toBe("2026-08-15");
  });

  it("первая публикация без даты получает сегодняшнюю", async () => {
    await seedArticle("article-01", { slug: ARTICLE_SLUG, status: "draft", publishedAt: null });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      status: "published",
      publishedAt: null,
    });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    expect(article.publishedAt).toBe(new Date().toISOString().slice(0, 10));
  });

  it("черновик, у которого даты никогда не было, её и не получает — адрес остаётся свободным", async () => {
    await seedArticle("article-01", { slug: ARTICLE_SLUG, status: "draft", publishedAt: null });

    const response = await putArticle("article-01", {
      ...ARTICLE_BODY,
      slug: "novyy-adres",
      status: "draft",
      publishedAt: null,
    });
    const { article } = (await response.json()) as ArticleResponse;

    expect(response.status).toBe(200);
    // Защита даты не должна была превратить пустое значение в дату: иначе первое же сохранение
    // черновика молча закрывало бы ему адрес.
    expect(article.publishedAt).toBeNull();
    expect(article.slug).toBe("novyy-adres");

    const { getArticleById } = await import("@/server/repositories/articles");
    expect(getArticleById("article-01")?.publishedAt).toBeNull();
  });
});
