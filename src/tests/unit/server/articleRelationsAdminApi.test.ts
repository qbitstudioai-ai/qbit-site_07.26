import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Административный API статьи и связи между материалами.
 *
 * Проверяется граница HTTP, а не репозиторий: отказ по связям обязан приходить как исправимая
 * ошибка ЗАПОЛНЕНИЯ с различимым кодом, а не как 500 «что-то сломалось». Разница практическая:
 * на 500 форма показывает «попробуйте ещё раз», хотя повтор того же запроса даст тот же отказ.
 *
 * Роут проверяется НАСТОЯЩИЙ и против настоящей (временной) базы — как в
 * `slugLifecycleAdminApi.test.ts`. Подменены только внешние обстоятельства, которых вне
 * HTTP-запроса не существует: вход в панель, сброс кэша Next.js, отложенное `after()` и отправка
 * в IndexNow.
 */

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

const ARTICLE_ID = "article-a";
const ARTICLE_SLUG = "kak-avtomatizirovat-zayavki";
const ORIGINAL_TITLE = "Как автоматизировать заявки";

/** Тело формы статьи — ровно то, что принимает `articleUpdateSchema`. */
const ARTICLE_BODY = {
  slug: ARTICLE_SLUG,
  title: ORIGINAL_TITLE,
  excerpt: "Краткое описание.",
  bodyMarkdown: "Текст статьи.",
  placement: "blog",
  status: "draft",
  publishedAt: null as string | null,
};

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-relations-api-"));
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

/** Статья, два продукта и отдел — прямым INSERT: проверяется роут, а не чужие репозитории. */
async function seedEntities(): Promise<void> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();
  const now = "2026-09-01T10:00:00.000Z";

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, created_at,
                           updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ARTICLE_ID,
    ARTICLE_SLUG,
    ORIGINAL_TITLE,
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    now,
    now,
  );

  const insertProduct = db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertProduct.run(
    "product-a",
    "ai-menedzher-dlya-sayta",
    "AI-менеджер",
    "AI-менеджер для сайта",
    "{}",
    "wide",
    "sales",
    "Иллюстрация продукта",
    now,
    now,
  );

  db.prepare(
    `INSERT INTO departments (id, display_name, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("sales", "Отдел продаж", "{}", now, now);
}

/** Исходные связи статьи — отдельной операцией, до проверяемого запроса. */
async function seedRelations(): Promise<void> {
  const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
  replaceRelationsFrom("article", ARTICLE_ID, [
    { targetType: "product", targetId: "product-a" },
    { targetType: "department", targetId: "sales" },
  ]);
}

async function putArticle(body: unknown): Promise<Response> {
  const { PUT } = await import("@/app/api/admin/articles/[id]/route");
  return PUT(
    new Request(`http://localhost/api/admin/articles/${ARTICLE_ID}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ARTICLE_ID }) },
  );
}

async function currentRelations(): Promise<string[]> {
  const { listRelationsFrom } = await import("@/server/repositories/contentRelations");
  return listRelationsFrom("article", ARTICLE_ID).map(
    (relation) => `${relation.targetType}:${relation.targetId}`,
  );
}

async function currentTitle(): Promise<string | undefined> {
  const { getArticleById } = await import("@/server/repositories/articles");
  return getArticleById(ARTICLE_ID)?.title;
}

interface RelationFailure {
  error: string;
  code: string;
}

describe("PUT статьи: тело без поля relations", () => {
  it("сохраняет статью и НЕ трогает существующие связи", async () => {
    /**
     * Сегодняшняя норма: форма перелинковки появится отдельным шагом, и до тех пор админ-панель
     * шлёт тело вообще без `relations`. Если бы схема подставляла сюда пустой список, каждое
     * сохранение текста стирало бы всю перелинковку статьи.
     */
    await seedEntities();
    await seedRelations();

    const response = await putArticle({ ...ARTICLE_BODY, title: "Новое название" });

    expect(response.status).toBe(200);
    expect(await currentTitle()).toBe("Новое название");
    expect(await currentRelations()).toEqual(["product:product-a", "department:sales"]);
  });

  it("пустой список — это явная очистка, и она доходит до базы", async () => {
    await seedEntities();
    await seedRelations();

    const response = await putArticle({ ...ARTICLE_BODY, relations: [] });

    expect(response.status).toBe(200);
    expect(await currentRelations()).toEqual([]);
  });
});

describe("PUT статьи: отказ по связям — управляемая ошибка, а не 500", () => {
  it("несуществующая цель → 400 с кодом missing_entity", async () => {
    await seedEntities();
    await seedRelations();

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      relations: [{ targetType: "product", targetId: "product-net-takogo" }],
    });
    const body = (await response.json()) as RelationFailure;

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
    expect(body.code).toBe("missing_entity");

    // И правка статьи откатилась вместе со связями: ответ об ошибке не оставляет половины записи.
    expect(await currentTitle()).toBe(ORIGINAL_TITLE);
    expect(await currentRelations()).toEqual(["product:product-a", "department:sales"]);
  });

  it("ссылка на себя → 400 с отдельным кодом self_link", async () => {
    await seedEntities();

    const response = await putArticle({
      ...ARTICLE_BODY,
      relations: [{ targetType: "article", targetId: ARTICLE_ID }],
    });
    const body = (await response.json()) as RelationFailure;

    expect(response.status).toBe(400);
    expect(body.code).toBe("self_link");
  });

  it("повтор одной цели → 409 с отдельным кодом duplicate_relation", async () => {
    await seedEntities();

    const response = await putArticle({
      ...ARTICLE_BODY,
      relations: [
        { targetType: "product", targetId: "product-a" },
        { targetType: "product", targetId: "product-a", role: "primary" },
      ],
    });
    const body = (await response.json()) as RelationFailure;

    expect(response.status).toBe(409);
    expect(body.code).toBe("duplicate_relation");
  });

  it("три отказа различимы по коду, а не только по тексту", async () => {
    await seedEntities();

    const codes = new Set<string>();
    for (const relations of [
      [{ targetType: "product", targetId: "product-net-takogo" }],
      [{ targetType: "article", targetId: ARTICLE_ID }],
      [
        { targetType: "product", targetId: "product-a" },
        { targetType: "product", targetId: "product-a" },
      ],
    ]) {
      const response = await putArticle({ ...ARTICLE_BODY, relations });
      codes.add(((await response.json()) as RelationFailure).code);
    }

    expect(codes).toEqual(new Set(["missing_entity", "self_link", "duplicate_relation"]));
  });

  it("чужой тип материала отсекается схемой на границе — до репозитория", async () => {
    await seedEntities();

    const response = await putArticle({
      ...ARTICLE_BODY,
      relations: [{ targetType: "document", targetId: "doc-1" }],
    });

    // 422 — отказ схемы: перечень типов один и тот же у схемы и у репозитория.
    expect(response.status).toBe(422);
  });
});

describe("PUT статьи: внешние эффекты только после успешной записи", () => {
  it("при отказе по связям кэш не сбрасывается и IndexNow не запускается", async () => {
    /**
     * `revalidateSection()` и IndexNow транзакцией не откатываются. Сбросить кэш раздела и
     * сообщить поисковику об изменении страницы, которая на самом деле НЕ изменилась, — значит
     * объявить наружу несуществующую правку.
     */
    await seedEntities();
    await seedRelations();

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      relations: [{ targetType: "product", targetId: "product-net-takogo" }],
    });

    expect(response.status).toBe(400);
    expect(revalidateSection).not.toHaveBeenCalled();
    // Колбэк `after()` даже не поставлен в очередь — значит, отправлять нечего.
    expect(afterCallbacks).toHaveLength(0);
    expect(submitIndexNow).not.toHaveBeenCalled();
  });

  it("при успехе кэш сбрасывается и адрес уходит в IndexNow", async () => {
    await seedEntities();
    await seedRelations();

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      relations: [{ targetType: "department", targetId: "sales" }],
    });

    expect(response.status).toBe(200);
    expect(revalidateSection).toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);

    await afterCallbacks[0]();
    expect(submitIndexNow).toHaveBeenCalledTimes(1);
  });
});
