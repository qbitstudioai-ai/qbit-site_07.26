import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost, PublicRelatedMaterial } from "@/features/blog/posts";

/**
 * Публичный блок «Материалы по теме» читает только `content_relations` (Amendment 61 / REL-02F.2;
 * прежде — «Связанные статьи», Amendment 60 / REL-02E.2).
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
/** Кейс, который миграция `0003` переносит в базу сама. */
const MIGRATED_CASE = { id: "case-sales-call-analysis", slug: "analiz-zvonkov-otdela-prodazh" };

const SOURCE = { id: "uuid-source-0001", slug: "istochnik" };
const TARGET_A = { id: "uuid-target-aaaa", slug: "statya-a" };
const TARGET_B = { id: "uuid-target-bbbb", slug: "statya-b" };
const TARGET_C = { id: "uuid-target-cccc", slug: "statya-c" };
const NO_RELATIONS = { id: "uuid-no-relations", slug: "statya-bez-svyazey" };
const DRAFT = { id: "uuid-target-draft", slug: "statya-chernovik" };
const OTHER = { id: "uuid-target-other", slug: "statya-drugogo-razdela" };
const OTHER_SOURCE = { id: "uuid-source-other", slug: "istochnik-drugogo-razdela" };

const PRODUCT = { id: "uuid-product-0001", slug: "sbor-zayavok" };
const HIDDEN_PRODUCT = { id: "uuid-product-hidden", slug: "skrytyj-produkt" };
const CASE = { id: "uuid-case-0001", slug: "kejs-zayavki" };
const DRAFT_CASE = { id: "uuid-case-draft", slug: "kejs-chernovik" };

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
  options: {
    status?: string;
    placement?: string;
    legacy?: string[];
    sortOrder?: number;
    body?: string;
  } = {},
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
    options.body ?? "Текст статьи.",
    options.placement ?? PLACEMENT,
    options.status ?? "published",
    JSON.stringify(options.legacy ?? []),
    options.sortOrder ?? 0,
    NOW,
    NOW,
  );
}

function addProduct(
  db: DatabaseSync,
  product: { id: string; slug: string },
  isPublished = true,
): void {
  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', 'wide', 'sales', 'Иллюстрация', ?, ?, ?)`,
  ).run(
    product.id,
    product.slug,
    `Меню ${product.slug}`,
    `Продукт ${product.slug}`,
    isPublished ? 1 : 0,
    NOW,
    NOW,
  );
}

function addCase(
  db: DatabaseSync,
  study: { id: string; slug: string },
  fileNumber: string,
  status = "published",
): void {
  db.prepare(
    `INSERT INTO cases (id, slug, title, short_title, file_number, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    study.id,
    study.slug,
    `Длинное название кейса ${study.slug}`,
    `Кейс ${study.slug}`,
    fileNumber,
    status,
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
 * Продукты — опубликованный и скрытый; кейсы — опубликованный и черновик. Legacy-колонки ЗАВЕДОМО
 * расходятся со структурными связями, которые тесты создают сами.
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

  addProduct(db, PRODUCT);
  addProduct(db, HIDDEN_PRODUCT, false);
  addCase(db, CASE, "91");
  addCase(db, DRAFT_CASE, "92", "draft");

  return db;
}

async function publicPosts(placement?: string): Promise<BlogPost[]> {
  const { getPublishedArticles } = await import("@/server/content/articles");
  return getPublishedArticles(placement);
}

async function materialsOf(
  slug: string,
  placement?: string,
): Promise<PublicRelatedMaterial[] | undefined> {
  return (await publicPosts(placement)).find((post) => post.slug === slug)?.relatedMaterials;
}

/** Адреса материалов статьи — самый частый предмет проверки. */
async function hrefsOf(slug: string, placement?: string): Promise<string[] | undefined> {
  return (await materialsOf(slug, placement))?.map((material) => material.href);
}

const blog = (slug: string) => `/blog/${slug}`;
const products = (slug: string) => `/products/${slug}`;
const cases = (slug: string) => `/cases/${slug}`;

async function materialsMap(placement = PLACEMENT): Promise<Map<string, PublicRelatedMaterial[]>> {
  const { listPublishedArticleRelatedMaterials } =
    await import("@/server/repositories/contentRelations");
  return listPublishedArticleRelatedMaterials(placement);
}

describe("публичные материалы по теме: источник — только content_relations", () => {
  it("LEGACY SQL MUTATION: правка related_slugs прямым SQL не меняет публичный вывод", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_C.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(TARGET_C.slug), blog(TARGET_A.slug)]);

    db.prepare("UPDATE articles SET related_slugs = ? WHERE id = ?").run(
      JSON.stringify([TARGET_B.slug]),
      SOURCE.id,
    );
    db.prepare("UPDATE articles SET related_slugs = ? WHERE id = ?").run(
      JSON.stringify([TARGET_B.slug, TARGET_C.slug]),
      TARGET_A.id,
    );

    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(TARGET_C.slug), blog(TARGET_A.slug)]);
    expect(await hrefsOf(TARGET_A.slug)).toEqual([]);
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
    expect(posts.every((post) => post.relatedMaterials.length === 0)).toBe(true);
    expect(posts.every((post) => !("relatedSlugs" in post))).toBe(true);
  });

  it("статья и продукт в ОБЩЕМ порядке sort_order; поля материала — из строки цели", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_B.id, sortOrder: 2 });

    expect(await materialsOf(SOURCE.slug)).toEqual([
      {
        type: "article",
        id: TARGET_A.id,
        slug: TARGET_A.slug,
        title: `Статья ${TARGET_A.slug}`,
        href: blog(TARGET_A.slug),
      },
      {
        type: "product",
        id: PRODUCT.id,
        slug: PRODUCT.slug,
        // D4: `products.full_title`, а не `menu_title`.
        title: `Продукт ${PRODUCT.slug}`,
        href: products(PRODUCT.slug),
      },
      {
        type: "article",
        id: TARGET_B.id,
        slug: TARGET_B.slug,
        title: `Статья ${TARGET_B.slug}`,
        href: blog(TARGET_B.slug),
      },
    ]);
  });

  it("статья и кейс; название кейса — short_title", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetType: "case", targetId: CASE.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await materialsOf(SOURCE.slug)).toEqual([
      {
        type: "case",
        id: CASE.id,
        slug: CASE.slug,
        title: `Кейс ${CASE.slug}`,
        href: cases(CASE.slug),
      },
      {
        type: "article",
        id: TARGET_A.id,
        slug: TARGET_A.slug,
        title: `Статья ${TARGET_A.slug}`,
        href: blog(TARGET_A.slug),
      },
    ]);
  });

  it("скрытый продукт не выводится, а после публикации — появляется", async () => {
    const db = await seedFixture();
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: HIDDEN_PRODUCT.id,
      sortOrder: 0,
    });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });

    expect(await hrefsOf(SOURCE.slug)).toEqual([products(PRODUCT.slug)]);

    db.prepare("UPDATE products SET is_published = 1 WHERE id = ?").run(HIDDEN_PRODUCT.id);
    expect(await hrefsOf(SOURCE.slug)).toEqual([
      products(HIDDEN_PRODUCT.slug),
      products(PRODUCT.slug),
    ]);
  });

  it("кейс со статусом, отличным от published, не выводится, а после публикации — появляется", async () => {
    const db = await seedFixture();
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "case",
      targetId: DRAFT_CASE.id,
      sortOrder: 0,
    });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "case",
      targetId: MIGRATED_CASE.id,
      sortOrder: 1,
    });

    expect(await hrefsOf(SOURCE.slug)).toEqual([cases(MIGRATED_CASE.slug)]);

    db.prepare("UPDATE cases SET status = 'archived' WHERE id = ?").run(DRAFT_CASE.id);
    expect(await hrefsOf(SOURCE.slug)).toEqual([cases(MIGRATED_CASE.slug)]);

    db.prepare("UPDATE cases SET status = 'published' WHERE id = ?").run(DRAFT_CASE.id);
    expect(await hrefsOf(SOURCE.slug)).toEqual([cases(DRAFT_CASE.slug), cases(MIGRATED_CASE.slug)]);
  });

  it("несуществующая цель любого типа не выводится", async () => {
    const db = await seedFixture();
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: "net-produkta",
      sortOrder: 0,
    });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "case",
      targetId: "net-kejsa",
      sortOrder: 1,
    });
    addRelation(db, { sourceId: SOURCE.id, targetId: "net-stati", sortOrder: 2 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 3 });

    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(TARGET_A.slug)]);
  });

  it("цель-черновик не выводится, а после публикации — появляется", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: DRAFT.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(TARGET_A.slug)]);

    db.prepare("UPDATE articles SET status = 'published' WHERE id = ?").run(DRAFT.id);
    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(DRAFT.slug), blog(TARGET_A.slug)]);
  });

  it("источник-черновик не получает материалов в карте раздела", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: DRAFT.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, {
      sourceId: DRAFT.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });

    expect((await materialsMap()).has(DRAFT.id)).toBe(false);

    db.prepare("UPDATE articles SET status = 'published' WHERE id = ?").run(DRAFT.id);
    expect((await materialsMap()).get(DRAFT.id)?.map((material) => material.href)).toEqual([
      blog(TARGET_A.slug),
      products(PRODUCT.slug),
    ]);
  });

  it("цель другого раздела не выводится, а после переноса в раздел — появляется", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: OTHER.id, sortOrder: 0 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });

    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(TARGET_A.slug)]);

    db.prepare("UPDATE articles SET placement = ? WHERE id = ?").run(PLACEMENT, OTHER.id);
    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(OTHER.slug), blog(TARGET_A.slug)]);
  });

  it("источник другого раздела не попадает в карту раздела и не получает целей чужого раздела", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: OTHER_SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, { sourceId: OTHER_SOURCE.id, targetId: OTHER.id, sortOrder: 1 });
    addRelation(db, {
      sourceId: OTHER_SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 2,
    });

    expect((await materialsMap(PLACEMENT)).has(OTHER_SOURCE.id)).toBe(false);
    // Продукт и кейс к разделу не привязаны: их отбирает только публикация.
    expect(await hrefsOf(OTHER_SOURCE.slug, OTHER_PLACEMENT)).toEqual([
      blog(OTHER.slug),
      products(PRODUCT.slug),
    ]);
  });

  it("связь на отдел не выводится никогда, даже при совпадении идентификатора со статьёй", async () => {
    const db = await seedFixture();
    const { getDatabase } = await import("@/server/db/client");
    getDatabase()
      .prepare(
        `INSERT INTO departments (id, display_name, content, created_at, updated_at)
         VALUES (?, 'Отдел', '{}', ?, ?)`,
      )
      .run(TARGET_B.id, NOW, NOW);

    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "department",
      targetId: TARGET_B.id,
      sortOrder: 0,
    });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });
    // Источник-продукт с идентификатором статьи: без отбора по типу источника его цель досталась бы
    // статье.
    addRelation(db, {
      sourceType: "product",
      sourceId: SOURCE.id,
      targetId: TARGET_C.id,
      sortOrder: 0,
    });
    // Источник-отдел с идентификатором статьи — тоже не статья.
    addRelation(db, {
      sourceType: "department",
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 0,
    });

    expect(await hrefsOf(SOURCE.slug)).toEqual([blog(TARGET_A.slug)]);
  });

  it("один идентификатор у статьи, продукта и кейса — три разных материала", async () => {
    const db = await seedFixture();
    const sharedId = TARGET_A.id;
    addProduct(db, { id: sharedId, slug: "produkt-s-obshchim-id" });
    addCase(db, { id: sharedId, slug: "kejs-s-obshchim-id" }, "93");

    addRelation(db, { sourceId: SOURCE.id, targetId: sharedId, sortOrder: 0 });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: sharedId,
      sortOrder: 1,
    });
    addRelation(db, { sourceId: SOURCE.id, targetType: "case", targetId: sharedId, sortOrder: 2 });

    expect(
      (await materialsOf(SOURCE.slug))?.map(
        (material) => `${material.type}:${material.id}:${material.href}`,
      ),
    ).toEqual([
      `article:${sharedId}:${blog(TARGET_A.slug)}`,
      `product:${sharedId}:${products("produkt-s-obshchim-id")}`,
      `case:${sharedId}:${cases("kejs-s-obshchim-id")}`,
    ]);
  });

  it("ссылку на себя запрещает CHECK схемы — строка не записывается даже прямым SQL", async () => {
    const db = await seedFixture();
    expect(() =>
      addRelation(db, { sourceId: SOURCE.id, targetId: SOURCE.id, sortOrder: 0 }),
    ).toThrow();
    expect(await hrefsOf(SOURCE.slug)).toEqual([]);
  });

  it("повтор цели с другой ролью схлопывается до первого вхождения — у статьи и у продукта", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_B.id, sortOrder: 2 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 3, role: "primary" });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 4,
      role: "primary",
    });

    expect(await hrefsOf(SOURCE.slug)).toEqual([
      blog(TARGET_A.slug),
      products(PRODUCT.slug),
      blog(TARGET_B.slug),
    ]);
  });

  it("порядок — sort_order, при равенстве — тип, затем идентификатор цели, а не порядок вставки", async () => {
    const db = await seedFixture();
    // Вставка намеренно в обратном порядке.
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });
    addRelation(db, { sourceId: SOURCE.id, targetType: "case", targetId: CASE.id, sortOrder: 1 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_B.id, sortOrder: 1 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 1 });
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_C.id, sortOrder: 0 });

    expect(await hrefsOf(SOURCE.slug)).toEqual([
      blog(TARGET_C.slug),
      blog(TARGET_A.slug),
      blog(TARGET_B.slug),
      cases(CASE.slug),
      products(PRODUCT.slug),
    ]);
  });

  it("адрес и название берутся по stable ID: переименование цели любого типа видно без правки связи", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });
    addRelation(db, { sourceId: SOURCE.id, targetType: "case", targetId: CASE.id, sortOrder: 2 });
    const relationsBefore = db.prepare("SELECT * FROM content_relations").all();

    db.prepare(
      "UPDATE articles SET slug = 'statya-a-novyj-adres', title = 'Новое А' WHERE id = ?",
    ).run(TARGET_A.id);
    db.prepare(
      "UPDATE products SET slug = 'produkt-novyj-adres', full_title = 'Новый продукт' WHERE id = ?",
    ).run(PRODUCT.id);
    db.prepare(
      "UPDATE cases SET slug = 'kejs-novyj-adres', short_title = 'Новый кейс' WHERE id = ?",
    ).run(CASE.id);

    expect(
      (await materialsOf(SOURCE.slug))?.map((material) => [
        material.slug,
        material.title,
        material.href,
      ]),
    ).toEqual([
      ["statya-a-novyj-adres", "Новое А", blog("statya-a-novyj-adres")],
      ["produkt-novyj-adres", "Новый продукт", products("produkt-novyj-adres")],
      ["kejs-novyj-adres", "Новый кейс", cases("kejs-novyj-adres")],
    ]);
    expect(db.prepare("SELECT * FROM content_relations").all()).toEqual(relationsBefore);
  });

  it("актуальные материалы получает КАЖДАЯ статья списка, и getArticleBySlug совпадает со списком", async () => {
    const db = await seedFixture();
    addRelation(db, { sourceId: SOURCE.id, targetId: TARGET_A.id, sortOrder: 0 });
    addRelation(db, {
      sourceId: SOURCE.id,
      targetType: "product",
      targetId: PRODUCT.id,
      sortOrder: 1,
    });
    addRelation(db, { sourceId: TARGET_A.id, targetId: TARGET_C.id, sortOrder: 0 });
    addRelation(db, { sourceId: TARGET_B.id, targetType: "case", targetId: CASE.id, sortOrder: 0 });

    const expected: Record<string, string[]> = {
      [SOURCE.slug]: [blog(TARGET_A.slug), products(PRODUCT.slug)],
      [TARGET_A.slug]: [blog(TARGET_C.slug)],
      [TARGET_B.slug]: [cases(CASE.slug)],
      [TARGET_C.slug]: [],
      [NO_RELATIONS.slug]: [],
    };

    const posts = await publicPosts();
    expect(
      Object.fromEntries(
        posts.map((post) => [post.slug, post.relatedMaterials.map((material) => material.href)]),
      ),
    ).toEqual(expected);

    const { getArticleBySlug } = await import("@/server/content/articles");
    for (const [slug, hrefs] of Object.entries(expected)) {
      expect(
        getArticleBySlug(slug)?.relatedMaterials.map((material) => material.href),
        slug,
      ).toEqual(hrefs);
    }
  });

  it("без N+1: один запрос к content_relations на раздел при любом числе статей", async () => {
    const db = await seedFixture();
    for (let index = 0; index < 12; index += 1) {
      const article = { id: `uuid-extra-${index}`, slug: `statya-extra-${index}` };
      addArticle(db, article, { sortOrder: 100 + index });
      addRelation(db, { sourceId: article.id, targetId: TARGET_A.id, sortOrder: 0 });
      addRelation(db, {
        sourceId: article.id,
        targetType: "product",
        targetId: PRODUCT.id,
        sortOrder: 1,
      });
    }

    const prepare = vi.spyOn(db, "prepare");
    const posts = await publicPosts();

    const relationQueries = prepare.mock.calls.filter(([sql]) =>
      String(sql).includes("content_relations"),
    );
    const targetQueries = prepare.mock.calls.filter(([sql]) =>
      /FROM\s+(products|cases)\b/u.test(String(sql)),
    );
    expect(posts).toHaveLength(17);
    expect(relationQueries).toHaveLength(1);
    expect(targetQueries).toHaveLength(0);
    expect(
      posts
        .filter((post) => post.slug.startsWith("statya-extra-"))
        .map((post) => post.relatedMaterials.map((material) => material.href)),
    ).toEqual(Array.from({ length: 12 }, () => [blog(TARGET_A.slug), products(PRODUCT.slug)]));
  });
});

// ── Публичное тело статьи: legacy-секция скрыта, слова считаются без неё ─────────────────────────

const LEGACY_WORDS = Array.from({ length: 400 }, (_, index) => `слово${index}`).join(" ");

/** Тело: короткий раздел, затем legacy-секция с длинными подписями пунктов (400 слов). */
const BODY_WITH_SECTION = [
  "**Краткий ответ:** Короткий текст статьи.",
  "",
  "**Материалы по теме:**",
  `- «[Сбор заявок](/products/${PRODUCT.slug})» — ${LEGACY_WORDS}.`,
  `- «[Статья А](/blog/${TARGET_A.slug})» — пояснение.`,
].join("\n");

/** Та же секция, но заголовком `##` — extractor её не признаёт (D5: оставить видимой). */
const BODY_WITH_INVALID_SECTION = [
  "**Краткий ответ:** Короткий текст статьи.",
  "",
  "## Материалы по теме",
  `- «[Сбор заявок](/products/${PRODUCT.slug})» — ${LEGACY_WORDS}.`,
].join("\n");

describe("публичное тело: скрытая legacy-секция, разделы, TOC и число слов", () => {
  it("секция не попадает в разделы и TOC; wordCount, readingTime и JSON-LD — по очищенному телу", async () => {
    const db = await seedFixture();
    db.prepare("UPDATE articles SET body_markdown = ? WHERE id = ?").run(
      BODY_WITH_SECTION,
      SOURCE.id,
    );
    const { blogPostStructuredData } = await import("@/features/blog/blogSeo");
    const { countWords, readingTimeLabel } = await import("@/features/blog/posts");

    const post = (await publicPosts()).find((candidate) => candidate.slug === SOURCE.slug)!;

    expect(post.sections.map((section) => section.heading)).toEqual(["Краткий ответ"]);
    expect(JSON.stringify(post.sections)).not.toContain(`/products/${PRODUCT.slug}`);
    expect(JSON.stringify(post.sections)).not.toContain("Материалы по теме");

    const cleanedWords = countWords("**Краткий ответ:** Короткий текст статьи.");
    expect(post.wordCount).toBe(cleanedWords);
    expect(post.wordCount).toBeLessThan(countWords(BODY_WITH_SECTION));
    expect(post.readingTime).toBe(readingTimeLabel(cleanedWords));
    expect(post.readingTime).toBe("1 мин");
    expect(readingTimeLabel(countWords(BODY_WITH_SECTION))).not.toBe("1 мин");

    const article = blogPostStructuredData(post).find(
      (node) => (node as { "@type"?: string })["@type"] === "BlogPosting",
    ) as { wordCount: number };
    expect(article.wordCount).toBe(cleanedWords);

    // В базе текст не изменился.
    expect(
      (
        db.prepare("SELECT body_markdown FROM articles WHERE id = ?").get(SOURCE.id) as {
          body_markdown: string;
        }
      ).body_markdown,
    ).toBe(BODY_WITH_SECTION);
  });

  it("нераспознанная секция остаётся видимой, слова считаются по исходному телу, сервер предупреждает", async () => {
    const db = await seedFixture();
    db.prepare("UPDATE articles SET body_markdown = ? WHERE id = ?").run(
      BODY_WITH_INVALID_SECTION,
      SOURCE.id,
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { countWords } = await import("@/features/blog/posts");

    const post = (await publicPosts()).find((candidate) => candidate.slug === SOURCE.slug)!;

    expect(JSON.stringify(post.sections)).toContain(`/products/${PRODUCT.slug}`);
    expect(post.wordCount).toBe(countWords(BODY_WITH_INVALID_SECTION));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(SOURCE.id));
    expect(warn.mock.calls.flat().join(" ")).toContain("не распознана");
  });

  it("статья без секции рендерится как прежде и без предупреждения", async () => {
    await seedFixture();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const post = (await publicPosts()).find((candidate) => candidate.slug === SOURCE.slug)!;

    expect(post.sections).toEqual([
      {
        id: "section-1",
        heading: "Материал",
        blocks: [{ type: "paragraph", markdown: "Текст статьи." }],
      },
    ]);
    expect(post.wordCount).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });
});
