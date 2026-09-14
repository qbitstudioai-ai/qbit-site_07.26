import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/features/blog/posts";

/**
 * Публичный блок «Связанные статьи» читает только `content_relations` (Amendment 60 / REL-02E.2).
 *
 * База НАСТОЯЩАЯ и временная, репозитории не подменяются: проверяется, что увидит посетитель после
 * изменения таблиц, а не список вызовов. Пользовательская `var/content.db` не открывается.
 *
 * Строки связей вставляются прямым SQL, мимо репозитория: публичное чтение обязано вести себя верно и
 * на данных, которые репозиторий записать не дал бы (черновик как цель, чужой раздел, повтор цели с
 * другой ролью). Идентификаторы намеренно НЕ совпадают с адресами.
 */

const PLACEMENT = "blog";
const OTHER_PLACEMENT = "news";
const NOW = "2026-09-01T10:00:00.000Z";
const CASE_ID = "case-sales-call-analysis";

const SOURCE = { id: "uuid-source-0001", slug: "istochnik" };
const TARGET_A = { id: "uuid-target-aaaa", slug: "statya-a" };
const TARGET_B = { id: "uuid-target-bbbb", slug: "statya-b" };
const TARGET_C = { id: "uuid-target-cccc", slug: "statya-c" };
const NO_RELATIONS = { id: "uuid-no-relations", slug: "statya-bez-svyazey" };
const DRAFT = { id: "uuid-target-draft", slug: "statya-chernovik" };
const OTHER = { id: "uuid-target-other", slug: "statya-drugogo-razdela" };
const OTHER_SOURCE = { id: "uuid-source-other", slug: "istochnik-drugogo-razdela" };

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-public-relations-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function addArticle(
  db: DatabaseSync,
  article: { id: string; slug: string },
  options: { status?: string; placement?: string; legacy?: string[]; sortOrder?: number } = {},
): void {
  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, status,
                           related_slugs, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    article.id,
    article.slug,
    `Статья ${article.slug}`,
    "Анонс.",
    "Текст статьи.",
    options.placement ?? PLACEMENT,
    options.status ?? "published",
    JSON.stringify(options.legacy ?? []),
    options.sortOrder ?? 0,
    NOW,
    NOW,
  );
}

function addRelation(
  db: DatabaseSync,
  relation: {
    sourceId: string;
    targetId: string;
    sortOrder: number;
    sourceType?: string;
    targetType?: string;
    role?: string;
  },
): void {
  db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                    sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    relation.sourceType ?? "article",
    relation.sourceId,
    relation.targetType ?? "article",
    relation.targetId,
    relation.role ?? "related",
    relation.sortOrder,
    NOW,
    NOW,
  );
}

/**
 * Раздел `blog`: источник, три цели, статья без связей, черновик. Раздел `news`: цель и источник.
 * Legacy-колонки ЗАВЕДОМО расходятся со структурными связями, которые тесты создают сами.
 */
async function seedFixture(): Promise<DatabaseSync> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();

  addArticle(db, SOURCE, { legacy: [TARGET_B.slug, TARGET_C.slug], sortOrder: 10 });
  addArticle(db, TARGET_A, { sortOrder: 20 });
  addArticle(db, TARGET_B, { sortOrder: 30 });
  addArticle(db, TARGET_C, { sortOrder: 40 });
  addArticle(db, NO_RELATIONS, { legacy: [TARGET_A.slug], sortOrder: 50 });
  addArticle(db, DRAFT, { status: "draft", sortOrder: 60 });
  addArticle(db, OTHER, { placement: OTHER_PLACEMENT, sortOrder: 70 });
  addArticle(db, OTHER_SOURCE, { placement: OTHER_PLACEMENT, sortOrder: 80 });

  return db;
}

async function publicPosts(placement?: string): Promise<BlogPost[]> {
  const { getPublishedArticles } = await import("@/server/content/articles");
  return getPublishedArticles(placement);
}

async function relatedOf(slug: string, placement?: string): Promise<string[] | undefined> {
  return (await publicPosts(placement)).find((post) => post.slug === slug)?.relatedSlugs;
}

async function relatedMap(placement = PLACEMENT): Promise<Map<string, string[]>> {
  const { listPublishedArticleRelatedSlugs } =
    await import("@/server/repositories/contentRelations");
  return listPublishedArticleRelatedSlugs(placement);
}

describe("публичные связанные статьи: источник — только content_relations", () => {
  it("LEGACY SQL MUTATION: правка related_slugs прямым SQL не меняет публичный вывод", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_C.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_C.slug, TARGET_A.slug]);

    db.prepare("UPDATE articles SET related_slugs = ? WHERE id = ?").run(
      JSON.stringify([TARGET_B.slug]),
      SOURCE.id,
    );
    db.prepare("UPDATE articles SET related_slugs = ? WHERE id = ?").run(
      JSON.stringify([TARGET_B.slug, TARGET_C.slug]),
      TARGET_A.id,
    );

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_C.slug, TARGET_A.slug]);
    expect(await relatedOf(TARGET_A.slug)).toEqual([]);
  });

  it("пустые структурные связи дают [] при непустой legacy-колонке — без запасного варианта", async () => {
    await seedFixture();

    const posts = await publicPosts();
    expect(posts.map((post) => post.slug)).toEqual([
      SOURCE.slug,
      TARGET_A.slug,
      TARGET_B.slug,
      TARGET_C.slug,
      NO_RELATIONS.slug,
    ]);
    expect(posts.every((post) => post.relatedSlugs.length === 0)).toBe(true);
  });

  it("цель-черновик не выводится, а после публикации — появляется", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: DRAFT.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_A.slug]);

    db.prepare("UPDATE articles SET status = 'published' WHERE id = ?").run(DRAFT.id);
    expect(await relatedOf(SOURCE.slug)).toEqual([DRAFT.slug, TARGET_A.slug]);
  });

  it("источник-черновик не получает связей в карте раздела", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: DRAFT.id, targetId: TARGET_A.id, sortOrder: 0 });

    expect((await relatedMap()).has(DRAFT.id)).toBe(false);

    db.prepare("UPDATE articles SET status = 'published' WHERE id = ?").run(DRAFT.id);
    expect((await relatedMap()).get(DRAFT.id)).toEqual([TARGET_A.slug]);
  });

  it("цель другого раздела не выводится, а после переноса в раздел — появляется", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: OTHER.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_A.slug]);

    db.prepare("UPDATE articles SET placement = ? WHERE id = ?").run(PLACEMENT, OTHER.id);
    expect(await relatedOf(SOURCE.slug)).toEqual([OTHER.slug, TARGET_A.slug]);
  });

  it("источник другого раздела не попадает в карту раздела и не получает целей чужого раздела", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: OTHER_SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, { sourceId: OTHER_SOURCE.id, targetId: OTHER.id, sortOrder: 1 });

    expect((await relatedMap(PLACEMENT)).has(OTHER_SOURCE.id)).toBe(false);
    expect(await relatedOf(OTHER_SOURCE.slug, OTHER_PLACEMENT)).toEqual([OTHER.slug]);
  });

  it("связи на продукт, кейс и отдел не выводятся, даже при совпадении идентификатора", async () => {
    const db = await seedFixture();
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: "product-01",
      sortOrder: 0,
    });
    // Идентификатор цели кейса и отдела совпадает с идентификатором статьи: без отбора по типу
    // соединение с `articles` превратило бы их в «связанные статьи».
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "case",
      targetId: TARGET_C.id,
      sortOrder: 1,
    });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "department",
      targetId: TARGET_B.id,
      sortOrder: 2,
    });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 3 });
    // Источник-продукт с идентификатором статьи: без отбора по типу источника его цель досталась бы
    // статье.
    addRelation(db, {
      sourceType: "product",
      sourceId: SOURCE.id,
      targetId: TARGET_B.id,
      sortOrder: 0,
    });
    addRelation(db, { sourceId: SOURCE.id, targetType: "case", targetId: CASE_ID, sortOrder: 4 });

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_A.slug]);
  });

  it("ссылку на себя запрещает CHECK схемы — строка не записывается даже прямым SQL", async () => {
    const db = await seedFixture();
    expect(() =>
      addRelation(db, { sourceId: SOURCE.id, targetId: SOURCE.id, sortOrder: 0 }),
    ).toThrow();
    expect(await relatedOf(SOURCE.slug)).toEqual([]);
  });

  it("повтор цели с другой ролью схлопывается до первого вхождения", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_B.id, sortOrder: 1 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 2, role: "primary" });

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_A.slug, TARGET_B.slug]);
  });

  it("порядок — sort_order, при равенстве — идентификатор цели, а не порядок вставки", async () => {
    const db = await seedFixture();
    // Вставка намеренно в обратном порядке: B раньше A при одинаковом sort_order.
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_B.id, sortOrder: 1 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_C.id, sortOrder: 0 });

    expect(await relatedOf(SOURCE.slug)).toEqual([TARGET_C.slug, TARGET_A.slug, TARGET_B.slug]);
  });

  it("slug цели берётся по stable ID: смена адреса цели видна без правки связи", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    const relationsBefore = db.prepare("SELECT * FROM content_relations").all();

    db.prepare("UPDATE articles SET slug = ? WHERE id = ?").run(
      "statya-a-novyj-adres",
      TARGET_A.id,
    );

    expect(await relatedOf(SOURCE.slug)).toEqual(["statya-a-novyj-adres"]);
    expect(db.prepare("SELECT * FROM content_relations").all()).toEqual(relationsBefore);
  });

  it("актуальные связи получает КАЖДАЯ статья списка, и getArticleBySlug совпадает со списком", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_B.id, sortOrder: 1 });
    addRelation(db, { sourceId: TARGET_A.id, targetId: TARGET_C.id, sortOrder: 0 });
    addRelation(db, { sourceId: TARGET_B.id, targetId: SOURCE.id, sortOrder: 0 });

    const expected: Record<string, string[]> = {
      [SOURCE.slug]: [TARGET_A.slug, TARGET_B.slug],
      [TARGET_A.slug]: [TARGET_C.slug],
      [TARGET_B.slug]: [SOURCE.slug],
      [TARGET_C.slug]: [],
      [NO_RELATIONS.slug]: [],
    };

    const posts = await publicPosts();
    expect(Object.fromEntries(posts.map((post) => [post.slug, post.relatedSlugs]))).toEqual(
      expected,
    );

    const { getArticleBySlug } = await import("@/server/content/articles");
    for (const [slug, related] of Object.entries(expected)) {
      expect(getArticleBySlug(slug)?.relatedSlugs, slug).toEqual(related);
    }
  });

  it("без N+1: один запрос к content_relations на раздел при любом числе статей", async () => {
    const db = await seedFixture();
    for (let index = 0; index < 12; index += 1) {
      const article = { id: `uuid-extra-${index}`, slug: `statya-extra-${index}` };
      addArticle(db, article, { sortOrder: 100 + index });
      addRelation(db, { sourceId: article.id, targetId: TARGET_A.id, sortOrder: 0 });
    }

    const prepare = vi.spyOn(db, "prepare");
    const posts = await publicPosts();

    const relationQueries = prepare.mock.calls.filter(([sql]) =>
      String(sql).includes("content_relations"),
    );
    expect(posts).toHaveLength(17);
    expect(relationQueries).toHaveLength(1);
    expect(
      posts
        .filter((post) => post.slug.startsWith("statya-extra-"))
        .map((post) => post.relatedSlugs),
    ).toEqual(Array.from({ length: 12 }, () => [TARGET_A.slug]));
  });
});
