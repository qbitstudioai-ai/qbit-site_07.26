// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import seedArticlesJson from "../../../../data/seed/articles.json";
import { migrations } from "@/server/db/schema.mjs";
import { extractLegacyRelatedSection } from "@/features/blog/legacyRelatedSection.mjs";
import { runBackfillArticleRelations } from "../../../../scripts/backfill-article-relations.mjs";
import { runBackfillLegacyMaterialRelations } from "../../../../scripts/backfill-legacy-material-relations.mjs";
import {
  RESET_RELATION_ENTITY_TYPES,
  SEED_RELATION_ROLE,
  seedArticles,
} from "../../../../scripts/db-seed.mjs";

/**
 * Seed создаёт структурные связи статей (Amendment 60 / REL-02E.1).
 *
 * Две группы проверок. Первая запускает НАСТОЯЩИЙ `scripts/db-seed.mjs` дочерним процессом на
 * временном `QBIT_DATA_DIR` и сверяет результат функциями backfill-скрипта: свежая база обязана выйти
 * из seed в состоянии, которое backfill называет `already-applied`. Вторая вызывает `seedArticles()`
 * на базе в памяти с данными, которых нет в `data/seed`: идентификатор, отличный от адреса, и
 * заведомо непереносимые связи.
 *
 * Пользовательская `var/content.db` не открывается: переменные пути базы и хранилища у дочернего
 * процесса перекрыты, и путь базы, который печатает seed, проверяется явно.
 */

type Row = Record<string, unknown>;

const PROJECT_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SEED_SCRIPT = path.join(PROJECT_ROOT, "scripts", "db-seed.mjs");
const SEED_TIMEOUT = 120_000;
const MIGRATED_CASE_ID = "case-sales-call-analysis";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-seed-relations-"));
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function runSeed(...args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, QBIT_DATA_DIR: dataDir };
  delete env.QBIT_DB_PATH;
  delete env.QBIT_UPLOADS_DIR;

  const result = spawnSync(process.execPath, [SEED_SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    env,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain(`База: ${path.join(dataDir, "content.db")}`);
  return result;
}

function withDatabase<T>(work: (db: DatabaseSync) => T, readOnly = true): T {
  const db = new DatabaseSync(path.join(dataDir, "content.db"), { readOnly });
  try {
    return work(db);
  } finally {
    db.close();
  }
}

function articleRelations(db: DatabaseSync): Row[] {
  return db
    .prepare(
      `SELECT source_id, target_id, relation_role, sort_order
         FROM content_relations
        WHERE source_type = 'article' AND target_type = 'article'
        ORDER BY source_id ASC, sort_order ASC`,
    )
    .all() as Row[];
}

function allRelations(db: DatabaseSync): Row[] {
  return db
    .prepare(
      `SELECT source_type, source_id, target_type, target_id, relation_role, sort_order,
              created_at, updated_at
         FROM content_relations
        ORDER BY source_type, source_id, target_type, target_id, relation_role`,
    )
    .all() as Row[];
}

/** Ожидаемые связи seed-статей: адреса из JSON, идентификаторы — из таблицы той же базы. */
function expectedSeedRelations(db: DatabaseSync): Row[] {
  const idBySlug = (slug: string) =>
    String((db.prepare("SELECT id FROM articles WHERE slug = ?").get(slug) as Row).id);

  return seedArticlesJson
    .flatMap((article) =>
      article.relatedSlugs.map((slug, index) => ({
        source_id: article.id,
        target_id: idBySlug(slug),
        relation_role: "related",
        sort_order: index,
      })),
    )
    .sort(
      (left, right) =>
        left.source_id.localeCompare(right.source_id) || left.sort_order - right.sort_order,
    );
}

const TOTAL_SEED_RELATIONS = seedArticlesJson.reduce(
  (total, article) => total + article.relatedSlugs.length,
  0,
);

function expectParityWithBackfill(db: DatabaseSync): void {
  const report = runBackfillArticleRelations(db);
  expect(report.state).toBe("already-applied");
  expect(report.conflicts).toBe(0);
  expect(report.changed).toBe(0);
  expect(report.plannedRelations).toBe(TOTAL_SEED_RELATIONS);
  expect(report.existingArticleRelations).toBe(TOTAL_SEED_RELATIONS);
}

describe("db-seed: реальный скрипт на временной базе", { timeout: SEED_TIMEOUT }, () => {
  it("seed-данные содержат перелинковку — иначе проверки ниже были бы вакуумными", () => {
    expect(TOTAL_SEED_RELATIONS).toBeGreaterThan(0);
  });

  it("свежая база сразу имеет связи статей в parity с relatedSlugs и related_slugs", () => {
    runSeed();

    withDatabase((db) => {
      const relations = articleRelations(db);
      expect(relations).toHaveLength(TOTAL_SEED_RELATIONS);
      expect(relations).toEqual(expectedSeedRelations(db));
      expect(relations.every((row) => row.relation_role === SEED_RELATION_ROLE)).toBe(true);

      // Прежняя колонка пишется как раньше: dual-write ещё переходный.
      for (const article of seedArticlesJson) {
        const row = db
          .prepare("SELECT related_slugs FROM articles WHERE id = ?")
          .get(article.id) as Row;
        expect(JSON.parse(String(row.related_slugs)), article.slug).toEqual(article.relatedSlugs);
      }

      expectParityWithBackfill(db);
    });
  });

  /**
   * Связи seed-статей на продукты и кейсы: ровно цели Markdown-секции, по stable ID, после
   * article-связей. Возвращает их общее число.
   */
  function expectMaterialRelations(db: DatabaseSync): number {
    let totalMaterials = 0;
    for (const article of seedArticlesJson) {
      const extraction = extractLegacyRelatedSection(article.bodyMarkdown);
      expect(extraction.state, article.slug).toBe("ok");
      if (extraction.state !== "ok") continue;

      const materials = extraction.targets.filter((target) => target.type !== "article");
      totalMaterials += materials.length;
      const expected = materials.map((target, index) => ({
        target_type: target.type,
        target_id: String(
          (
            db
              .prepare(
                `SELECT id FROM ${target.type === "product" ? "products" : "cases"} WHERE slug = ?`,
              )
              .get(target.slug) as Row
          ).id,
        ),
        relation_role: "related",
        sort_order: article.relatedSlugs.length + index,
      }));

      const actual = db
        .prepare(
          `SELECT target_type, target_id, relation_role, sort_order FROM content_relations
            WHERE source_type = 'article' AND source_id = ? AND target_type <> 'article'
            ORDER BY sort_order`,
        )
        .all(article.id) as Row[];
      expect(actual, article.slug).toEqual(expected);
      // Идентификатор, а не адрес: у seed-продуктов они различаются.
      expect(actual.some((row) => materials.some((target) => target.slug === row.target_id))).toBe(
        false,
      );
    }
    expect(totalMaterials).toBeGreaterThan(0);
    return totalMaterials;
  }

  it("свежая база: product/case из Markdown-секции идут после article-связей по stable ID", () => {
    runSeed();

    withDatabase((db) => {
      const totalMaterials = expectMaterialRelations(db);

      // Article-связи по-прежнему ровно relatedSlugs — ссылки на статьи из текста не записаны.
      expect(articleRelations(db)).toEqual(expectedSeedRelations(db));
      expectParityWithBackfill(db);

      const legacy = runBackfillLegacyMaterialRelations(db);
      expect(legacy.state).toBe("already-applied");
      expect(legacy.changed).toBe(0);
      expect(legacy.plannedProductRelations + legacy.plannedCaseRelations).toBe(0);
      expect(legacy.alreadyExisting).toBe(totalMaterials);
    });
  });

  it("повторный seed не меняет ни одной связи, включая правку владельца", () => {
    runSeed();

    // Правка владельца: у первой статьи со связями удалена одна связь.
    const edited = seedArticlesJson.find((article) => article.relatedSlugs.length > 0)!;
    withDatabase((db) => {
      db.prepare(
        `DELETE FROM content_relations
          WHERE source_type = 'article' AND source_id = ? AND sort_order = 0`,
      ).run(edited.id);
    }, false);
    const before = withDatabase(allRelations);

    runSeed();

    expect(withDatabase(allRelations)).toEqual(before);
  });

  it("--reset снимает связи статей, продуктов и отделов и сохраняет связи между кейсами", () => {
    expect([...RESET_RELATION_ENTITY_TYPES]).toEqual(["article", "product", "department"]);
    runSeed();

    const articleId = seedArticlesJson[0].id;
    const stamp = "2026-01-01T00:00:00.000Z";
    withDatabase((db) => {
      const insert = db.prepare(
        `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                        relation_role, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'related', 0, ?, ?)`,
      );
      insert.run("case", MIGRATED_CASE_ID, "case", "case-second", stamp, stamp);
      insert.run("case", MIGRATED_CASE_ID, "article", articleId, stamp, stamp);
      insert.run("product", "product-01", "case", MIGRATED_CASE_ID, stamp, stamp);
      insert.run("department", "sales", "case", MIGRATED_CASE_ID, stamp, stamp);
      // Правка владельца, которую сброс обязан отменить вместе со статьями.
      db.prepare(
        "DELETE FROM content_relations WHERE source_type = 'article' AND target_type = 'article'",
      ).run();
    }, false);

    runSeed("--reset");

    withDatabase((db) => {
      // Связи статей seed создаёт заново (article и product из Markdown), поэтому сверяются только
      // связи с источником не-статьёй: из них после сброса обязана остаться лишь связь кейс → кейс.
      const nonArticle = db
        .prepare(
          `SELECT source_type, source_id, target_type, target_id FROM content_relations
            WHERE source_type <> 'article'`,
        )
        .all();
      expect(nonArticle).toEqual([
        {
          source_type: "case",
          source_id: MIGRATED_CASE_ID,
          target_type: "case",
          target_id: "case-second",
        },
      ]);

      expect(articleRelations(db)).toEqual(expectedSeedRelations(db));
      // Product/case-связи статей после сброса созданы заново ровно из Markdown-секций.
      expectMaterialRelations(db);
      expectParityWithBackfill(db);
    });
  });
});

describe("seedArticles: транзакция, идентификаторы и существующие статьи", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    migrations.forEach((migration) => db.exec(migration.sql));
  });

  afterEach(() => {
    db.close();
  });

  function seedArticle(
    id: string,
    slug: string,
    relatedSlugs: unknown[] = [],
    status = "published",
  ) {
    return {
      id,
      slug,
      title: `Статья ${slug}`,
      excerpt: "Анонс",
      description: "Описание",
      bodyMarkdown: "Текст",
      coverUrl: "",
      coverAlt: "",
      placement: "blog",
      category: "Процессы",
      tags: [],
      relatedSlugs,
      author: "Автор",
      seoTitle: "",
      seoDescription: "",
      status,
      isFeatured: false,
      sortOrder: 0,
      publishedAt: "2026-01-01",
      modifiedAt: "2026-01-01",
    };
  }

  const count = (table: string) =>
    Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as Row).total);

  it("пишет идентификаторы, а не адреса, в порядке relatedSlugs, с ролью related", () => {
    const inserted = seedArticles(db, [
      seedArticle("id-a", "a", ["c", "b"]),
      seedArticle("id-b", "b"),
      seedArticle("id-c", "c", ["a"]),
    ]);

    expect(inserted).toBe(3);
    expect(articleRelations(db)).toEqual([
      { source_id: "id-a", target_id: "id-c", relation_role: "related", sort_order: 0 },
      { source_id: "id-a", target_id: "id-b", relation_role: "related", sort_order: 1 },
      { source_id: "id-c", target_id: "id-a", relation_role: "related", sort_order: 0 },
    ]);
  });

  it.each([
    ["неразрешимый адрес", [seedArticle("id-a", "a", ["net-takoy"]), seedArticle("id-b", "b")]],
    ["ссылка на себя", [seedArticle("id-a", "a", ["a"]), seedArticle("id-b", "b")]],
    ["повтор цели", [seedArticle("id-a", "a", ["b", "b"]), seedArticle("id-b", "b")]],
    ["цель-черновик", [seedArticle("id-a", "a", ["b"]), seedArticle("id-b", "b", [], "draft")]],
    ["пустой адрес", [seedArticle("id-a", "a", [""]), seedArticle("id-b", "b")]],
  ])("%s откатывает весь блок статей", (_label, articles) => {
    expect(() => seedArticles(db, articles)).toThrow();
    expect(count("articles")).toBe(0);
    expect(count("content_relations")).toBe(0);
  });

  const MATERIAL_BODY = [
    "**Материалы по теме:**",
    "- «[Продукт](/products/sbor-zayavok)» — пояснение.",
    "- «[Статья c](/blog/c)» — пояснение.",
    "- «[Кейс](/cases/analiz-zvonkov-otdela-prodazh)» — пояснение.",
  ].join("\n");

  function addProduct(id: string, slug: string, published = true) {
    db.prepare(
      `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                             is_published, created_at, updated_at)
       VALUES (?, ?, 'Меню', 'Полное', '{}', '{}', '{}', 'alt', ?, '2026-01-01', '2026-01-01')`,
    ).run(id, slug, published ? 1 : 0);
  }

  const allArticleSourceRelations = () =>
    db
      .prepare(
        `SELECT source_id, target_type, target_id, relation_role, sort_order FROM content_relations
          WHERE source_type = 'article' ORDER BY source_id, sort_order`,
      )
      .all();

  it("product/case из Markdown — после article-связей; article-ссылки текста не пишутся", () => {
    addProduct("product-uuid-x", "sbor-zayavok");

    seedArticles(db, [
      { ...seedArticle("id-a", "a", ["b"]), bodyMarkdown: MATERIAL_BODY },
      seedArticle("id-b", "b"),
      seedArticle("id-c", "c"),
    ]);

    expect(allArticleSourceRelations()).toEqual([
      {
        source_id: "id-a",
        target_type: "article",
        target_id: "id-b",
        relation_role: "related",
        sort_order: 0,
      },
      {
        source_id: "id-a",
        target_type: "product",
        target_id: "product-uuid-x",
        relation_role: "related",
        sort_order: 1,
      },
      {
        source_id: "id-a",
        target_type: "case",
        target_id: MIGRATED_CASE_ID,
        relation_role: "related",
        sort_order: 2,
      },
    ]);
  });

  it.each([
    ["скрытый продукт", () => addProduct("product-uuid-x", "sbor-zayavok", false), MATERIAL_BODY],
    ["несуществующий продукт", () => undefined, MATERIAL_BODY],
    [
      "нераспознанная секция",
      () => addProduct("product-uuid-x", "sbor-zayavok"),
      "**Материалы по теме:**\n- [a](/products/sbor-zayavok?x=1)",
    ],
  ])("%s в Markdown откатывает весь блок статей", (_label, prepare, markdown) => {
    prepare();
    expect(() =>
      seedArticles(db, [
        { ...seedArticle("id-a", "a"), bodyMarkdown: markdown },
        seedArticle("id-c", "c"),
      ]),
    ).toThrow();
    expect(count("articles")).toBe(0);
    expect(count("content_relations")).toBe(0);
  });

  it("дефектные article-ссылки Markdown не мешают seed и не пишутся", () => {
    addProduct("product-uuid-x", "sbor-zayavok");
    const markdown = [
      "**Материалы по теме:**",
      "- [Нет такой](/blog/net)",
      "- [Сама на себя](/blog/a)",
      "- [Продукт](/products/sbor-zayavok)",
      "- [Повтор](/blog/net)",
    ].join("\n");

    seedArticles(db, [
      { ...seedArticle("id-a", "a", ["c"]), bodyMarkdown: markdown },
      seedArticle("id-c", "c"),
    ]);

    expect(allArticleSourceRelations()).toEqual([
      {
        source_id: "id-a",
        target_type: "article",
        target_id: "id-c",
        relation_role: "related",
        sort_order: 0,
      },
      {
        source_id: "id-a",
        target_type: "product",
        target_id: "product-uuid-x",
        relation_role: "related",
        sort_order: 1,
      },
    ]);
  });

  it("canonical URL статьи не мешает seed и не создаёт article-связь из Markdown", () => {
    addProduct("product-uuid-x", "sbor-zayavok");
    const markdown = [
      "**Материалы по теме:**",
      "- [Статья](https://allqbit.ru/blog/c)",
      "- [Продукт](/products/sbor-zayavok)",
    ].join("\n");

    seedArticles(db, [
      { ...seedArticle("id-a", "a"), bodyMarkdown: markdown },
      seedArticle("id-c", "c"),
    ]);

    expect(allArticleSourceRelations()).toEqual([
      {
        source_id: "id-a",
        target_type: "product",
        target_id: "product-uuid-x",
        relation_role: "related",
        sort_order: 0,
      },
    ]);
  });

  it("не пишет product-связи для статьи, которая уже была в базе", () => {
    addProduct("product-uuid-x", "sbor-zayavok");
    seedArticles(db, [seedArticle("id-a", "a"), seedArticle("id-c", "c")]);

    seedArticles(db, [
      { ...seedArticle("id-a", "a"), bodyMarkdown: MATERIAL_BODY },
      seedArticle("id-c", "c"),
    ]);

    expect(count("content_relations")).toBe(0);
  });

  it("не пишет связи для статьи, которая уже была в базе", () => {
    seedArticles(db, [seedArticle("id-a", "a"), seedArticle("id-b", "b")]);

    const inserted = seedArticles(db, [
      seedArticle("id-a", "a", ["b"]),
      seedArticle("id-b", "b"),
      seedArticle("id-c", "c", ["b"]),
    ]);

    expect(inserted).toBe(1);
    expect(articleRelations(db)).toEqual([
      { source_id: "id-c", target_id: "id-b", relation_role: "related", sort_order: 0 },
    ]);
  });
});
