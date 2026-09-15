// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_RELATIONS } from "@/features/admin/relationTargets";
import { migrations } from "@/server/db/schema.mjs";
import {
  MAX_RELATIONS_PER_SOURCE,
  exitCodeFor,
  runBackfillLegacyMaterialRelations,
} from "../../../../scripts/backfill-legacy-material-relations.mjs";

/**
 * Импорт product/case из legacy-секции «Материалы по теме» (Amendment 61 / REL-02F.1).
 *
 * Главные свойства: article-ссылки текста не пишутся никогда (D1); существующие связи и таблица
 * `articles` побайтно неизменны; новые связи — после наибольшего `sort_order` по stable ID; любой
 * блокирующий дефект отменяет весь прогон; запись идёт одной транзакцией с перепроверкой.
 *
 * Идентификаторы фикстур намеренно НЕ совпадают с адресами.
 */

type Row = Record<string, unknown>;

const STAMP = "2026-01-01T00:00:00.000Z";
const NOW = "2026-09-15T12:00:00.000Z";
const now = () => NOW;

const SOURCE_ID = "8b0c4f7e-uuid-istochnik";
const SECOND_ID = "31d2a9aa-uuid-vtoraya";
const THIRD_ID = "c55e0b12-uuid-tretya";
const PRODUCT_ID = "product-03";
const SECOND_PRODUCT_ID = "product-07";
const CASE_ID = "case-uuid-zvonki";

const PROJECT_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SCRIPT = path.join(PROJECT_ROOT, "scripts", "backfill-legacy-material-relations.mjs");

function freshDatabase(target = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(target);
  migrations.forEach((migration) => db.exec(migration.sql));
  return db;
}

function legacyBody(hrefs: string[], heading = "**Материалы по теме:**"): string {
  return [
    "**Краткий ответ:** текст статьи.",
    "",
    "**Источники:**",
    "- [Внешний источник](https://example.com/a)",
    "",
    heading,
    ...hrefs.map((href, index) => `- «[Материал ${index + 1}](${href})» — пояснение.`),
  ].join("\n");
}

function addArticle(
  db: DatabaseSync,
  options: {
    id: string;
    slug: string;
    body?: string;
    status?: string;
    sortOrder?: number;
    placement?: string;
  },
): void {
  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, related_slugs, status,
                           sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 'Анонс', ?, ?, '["legacy"]', ?, ?, ?, ?)`,
  ).run(
    options.id,
    options.slug,
    `Статья ${options.slug}`,
    options.body ?? "Текст без секции.",
    options.placement ?? "blog",
    options.status ?? "published",
    options.sortOrder ?? 0,
    STAMP,
    STAMP,
  );
}

function addProduct(db: DatabaseSync, id: string, slug: string, published = true): void {
  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           is_published, created_at, updated_at)
     VALUES (?, ?, 'Меню', 'Полное', '{}', '{}', '{}', 'alt', ?, ?, ?)`,
  ).run(id, slug, published ? 1 : 0, STAMP, STAMP);
}

function addCase(db: DatabaseSync, id: string, slug: string, fileNumber: string): void {
  db.prepare(
    `INSERT INTO cases (id, slug, title, short_title, file_number, created_at, updated_at)
     VALUES (?, ?, 'Кейс', 'Кейс', ?, ?, ?)`,
  ).run(id, slug, fileNumber, STAMP, STAMP);
}

function addRelation(
  db: DatabaseSync,
  options: {
    sourceId: string;
    targetType: string;
    targetId: string;
    role?: string;
    sortOrder: number;
  },
): void {
  db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                    sort_order, created_at, updated_at)
     VALUES ('article', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    options.sourceId,
    options.targetType,
    options.targetId,
    options.role ?? "related",
    options.sortOrder,
    STAMP,
    STAMP,
  );
}

const allRelations = (db: DatabaseSync): Row[] =>
  db
    .prepare(
      `SELECT * FROM content_relations
        ORDER BY source_type, source_id, sort_order, target_type, target_id, relation_role`,
    )
    .all() as Row[];

const articleRelations = (db: DatabaseSync): Row[] =>
  allRelations(db).filter((row) => row.target_type === "article");

const articlesTable = (db: DatabaseSync): Row[] =>
  db.prepare("SELECT * FROM articles ORDER BY id").all() as Row[];

const count = (db: DatabaseSync, table: string): number =>
  Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as Row).total);

/**
 * Базовая фикстура: у источника есть структурная связь на вторую статью (sort_order 5 — не с нуля),
 * а в тексте — продукт, третья статья (drift) и кейс.
 */
function baseFixture(db: DatabaseSync): void {
  addArticle(db, {
    id: SOURCE_ID,
    slug: "istochnik",
    body: legacyBody(["/products/sbor-zayavok", "/blog/tretya", "/cases/zvonki"]),
  });
  addArticle(db, { id: SECOND_ID, slug: "vtoraya" });
  addArticle(db, { id: THIRD_ID, slug: "tretya" });
  addProduct(db, PRODUCT_ID, "sbor-zayavok");
  addCase(db, CASE_ID, "zvonki", "77");
  addRelation(db, {
    sourceId: SOURCE_ID,
    targetType: "article",
    targetId: SECOND_ID,
    sortOrder: 5,
  });
}

describe("импорт: план и dry-run", () => {
  it("строит план по stable ID после max(sort_order), в порядке текста, и ничего не пишет", () => {
    const db = freshDatabase();
    baseFixture(db);
    const relationsBefore = allRelations(db);
    const articlesBefore = articlesTable(db);

    const report = runBackfillLegacyMaterialRelations(db, { now });

    expect(report.state).toBe("ready");
    expect(report.mode).toBe("dry-run");
    expect(report.changed).toBe(0);
    expect(report.plannedProductRelations).toBe(1);
    expect(report.plannedCaseRelations).toBe(1);
    expect(report.details.plan).toEqual([
      {
        sourceId: SOURCE_ID,
        sourceSlug: "istochnik",
        targetType: "product",
        targetId: PRODUCT_ID,
        targetSlug: "sbor-zayavok",
        role: "related",
        sortOrder: 6,
      },
      {
        sourceId: SOURCE_ID,
        sourceSlug: "istochnik",
        targetType: "case",
        targetId: CASE_ID,
        targetSlug: "zvonki",
        role: "related",
        sortOrder: 7,
      },
    ]);
    expect(allRelations(db)).toEqual(relationsBefore);
    expect(articlesTable(db)).toEqual(articlesBefore);
  });

  it("отчёт содержит обязательные поля и счётчики источников", () => {
    const db = freshDatabase();
    baseFixture(db);
    addArticle(db, {
      id: "draft-uuid",
      slug: "chernovik",
      status: "draft",
      body: legacyBody(["/products/net"]),
    });

    const report = runBackfillLegacyMaterialRelations(db, { now });

    for (const field of [
      "mode",
      "state",
      "articles",
      "articlesWithSection",
      "noSection",
      "plannedProductRelations",
      "plannedCaseRelations",
      "alreadyExisting",
      "legacyArticleDrift",
      "ambiguousSections",
      "unknownUrls",
      "missingTargets",
      "unpublishedProducts",
      "unpublishedCases",
      "duplicates",
      "structuralAnomalies",
      "limitViolations",
      "changed",
    ]) {
      expect(report, field).toHaveProperty(field);
    }
    // Черновик с битой секцией не источник: он не считается и не блокирует.
    expect(report.articles).toBe(3);
    expect(report.articlesWithSection).toBe(1);
    expect(report.noSection).toBe(2);
    expect(report.state).toBe("ready");
  });

  it("article-ссылки текста дают drift, но не блокируют и не попадают в план", () => {
    const db = freshDatabase();
    baseFixture(db);

    const report = runBackfillLegacyMaterialRelations(db, { now });

    expect(report.state).toBe("ready");
    expect(
      report.details.plan.every((item: { targetType: string }) => item.targetType !== "article"),
    ).toBe(true);
    expect(report.legacyArticleDrift).toEqual([
      {
        source: "istochnik",
        sourceId: SOURCE_ID,
        markdown: ["tretya"],
        structured: ["vtoraya"],
        missingInStructured: ["tretya"],
        extraInStructured: ["vtoraya"],
        orderDiff: false,
        unresolvedArticle: [],
        unpublishedArticle: [],
        placementMismatch: [],
        selfLink: [],
        duplicateArticle: [],
      },
    ]);
  });

  it("drift по порядку общих статей", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/blog/tretya", "/blog/vtoraya"]),
    });
    addArticle(db, { id: SECOND_ID, slug: "vtoraya" });
    addArticle(db, { id: THIRD_ID, slug: "tretya" });
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "article",
      targetId: SECOND_ID,
      sortOrder: 0,
    });
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "article",
      targetId: THIRD_ID,
      sortOrder: 1,
    });

    const report = runBackfillLegacyMaterialRelations(db, { now });

    expect(report.state).toBe("already-applied");
    expect(report.legacyArticleDrift).toEqual([
      expect.objectContaining({
        missingInStructured: [],
        extraInStructured: [],
        orderDiff: true,
      }),
    ]);
  });

  it("совпадение article-ссылок текста со структурными — drift пуст", () => {
    const db = freshDatabase();
    addArticle(db, { id: SOURCE_ID, slug: "istochnik", body: legacyBody(["/blog/vtoraya"]) });
    addArticle(db, { id: SECOND_ID, slug: "vtoraya" });
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "article",
      targetId: SECOND_ID,
      sortOrder: 0,
    });

    expect(runBackfillLegacyMaterialRelations(db, { now }).legacyArticleDrift).toEqual([]);
  });
});

describe("импорт: дефекты article-ссылок — только диагностика (Amendment 61.1)", () => {
  function sourceWithProductAnd(articleHrefs: string[]) {
    const db = freshDatabase();
    addProduct(db, PRODUCT_ID, "sbor-zayavok");
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/sbor-zayavok", ...articleHrefs]),
    });
    return db;
  }

  it.each([
    [
      "несуществующая статья",
      ["/blog/net-takoy"],
      "unresolvedArticle",
      ["net-takoy"],
      () => undefined,
    ],
    [
      "статья-черновик",
      ["/blog/chernovik"],
      "unpublishedArticle",
      ["chernovik"],
      (db: DatabaseSync) =>
        addArticle(db, { id: "draft-uuid", slug: "chernovik", status: "draft" }),
    ],
    [
      "статья другого раздела",
      ["/blog/drugoy-razdel"],
      "placementMismatch",
      ["drugoy-razdel"],
      (db: DatabaseSync) =>
        addArticle(db, { id: "other-uuid", slug: "drugoy-razdel", placement: "about" }),
    ],
    ["ссылка статьи на себя", ["/blog/istochnik"], "selfLink", ["istochnik"], () => undefined],
    [
      "повтор одной article-ссылки",
      ["/blog/vtoraya", "/blog/vtoraya"],
      "duplicateArticle",
      ["vtoraya"],
      (db: DatabaseSync) => addArticle(db, { id: SECOND_ID, slug: "vtoraya" }),
    ],
    [
      "canonical URL несуществующей статьи",
      ["https://allqbit.ru/blog/old-slug"],
      "unresolvedArticle",
      ["old-slug"],
      () => undefined,
    ],
    [
      "повтор canonical URL статьи",
      ["https://allqbit.ru/blog/vtoraya", "https://allqbit.ru/blog/vtoraya"],
      "duplicateArticle",
      ["vtoraya"],
      (db: DatabaseSync) => addArticle(db, { id: SECOND_ID, slug: "vtoraya" }),
    ],
  ])(
    "%s не блокирует импорт продукта и попадает в drift",
    (_label, hrefs, field, slugs, prepare) => {
      const db = sourceWithProductAnd(hrefs);
      prepare(db);
      const articlesBefore = articlesTable(db);

      const dryRun = runBackfillLegacyMaterialRelations(db, { now });
      expect(dryRun.state).toBe("ready");
      expect(dryRun.plannedProductRelations).toBe(1);
      expect(dryRun.legacyArticleDrift).toEqual([
        expect.objectContaining({ source: "istochnik", [field]: slugs }),
      ]);

      const applied = runBackfillLegacyMaterialRelations(db, { apply: true, now });
      expect(applied.state).toBe("applied");
      expect(applied.changed).toBe(1);
      expect(allRelations(db).map((row) => `${row.target_type}:${row.target_id}`)).toEqual([
        `product:${PRODUCT_ID}`,
      ]);
      expect(articlesTable(db)).toEqual(articlesBefore);
    },
  );

  it("canonical URL существующей статьи — только drift, продукт планируется (Amendment 61.2)", () => {
    const db = sourceWithProductAnd(["https://allqbit.ru/blog/test-article"]);
    addArticle(db, { id: "test-article-uuid", slug: "test-article" });

    const report = runBackfillLegacyMaterialRelations(db, { now });

    expect(report.state).toBe("ready");
    expect(report.unknownUrls).toBe(0);
    expect(report.plannedProductRelations).toBe(1);
    expect(report.details.plan.map((item: { targetType: string }) => item.targetType)).toEqual([
      "product",
    ]);
    expect(report.legacyArticleDrift).toEqual([
      expect.objectContaining({
        source: "istochnik",
        markdown: ["test-article"],
        missingInStructured: ["test-article"],
      }),
    ]);
  });

  it.each([
    "http://allqbit.ru/blog/test",
    "https://www.allqbit.ru/blog/test",
    "https://example.com/blog/test",
    "//allqbit.ru/blog/test",
    "https://allqbit.ru/blog/test?x=1",
    "https://allqbit.ru/blog/test#x",
    "https://allqbit.ru/blog/test/",
    "https://allqbit.ru/blog",
    "https://allqbit.ru/products/test",
    "https://allqbit.ru/cases/test",
  ])("%s по-прежнему BLOCKED", (href) => {
    const db = sourceWithProductAnd([href]);

    const report = runBackfillLegacyMaterialRelations(db, { apply: true, now });

    expect(report.state).toBe("blocked");
    expect(report.unknownUrls).toBe(1);
    expect(report.changed).toBe(0);
    expect(allRelations(db)).toEqual([]);
  });
});

describe("импорт: apply", () => {
  it("вставляет только product/case; существующие связи и articles побайтно неизменны", () => {
    const db = freshDatabase();
    baseFixture(db);
    const articlesBefore = articlesTable(db);
    const articleRelationsBefore = articleRelations(db);
    const revisionsBefore = count(db, "content_revisions");
    const activityBefore = count(db, "activity_log");

    const report = runBackfillLegacyMaterialRelations(db, { apply: true, now });

    expect(report.state).toBe("applied");
    expect(report.changed).toBe(2);
    expect(allRelations(db)).toEqual([
      ...articleRelationsBefore,
      {
        source_type: "article",
        source_id: SOURCE_ID,
        target_type: "product",
        target_id: PRODUCT_ID,
        relation_role: "related",
        sort_order: 6,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        source_type: "article",
        source_id: SOURCE_ID,
        target_type: "case",
        target_id: CASE_ID,
        relation_role: "related",
        sort_order: 7,
        created_at: NOW,
        updated_at: NOW,
      },
    ]);
    // Article-ссылка текста на третью статью не записана (D1).
    expect(articleRelations(db)).toEqual(articleRelationsBefore);
    expect(articlesTable(db)).toEqual(articlesBefore);
    expect(count(db, "content_revisions")).toBe(revisionsBefore);
    expect(count(db, "activity_log")).toBe(activityBefore);
  });

  it("относительный порядок существующих связей разных типов сохраняется", () => {
    const db = freshDatabase();
    baseFixture(db);
    addProduct(db, SECOND_PRODUCT_ID, "analitika");
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "product",
      targetId: SECOND_PRODUCT_ID,
      sortOrder: 2,
    });
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "department",
      targetId: "sales",
      sortOrder: 9,
    });
    const before = allRelations(db);

    runBackfillLegacyMaterialRelations(db, { apply: true, now });

    const after = allRelations(db);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length).map((row) => [row.target_id, row.sort_order])).toEqual([
      [PRODUCT_ID, 10],
      [CASE_ID, 11],
    ]);
  });

  it("повторный apply — already-applied, changed = 0, база не меняется", () => {
    const db = freshDatabase();
    baseFixture(db);
    runBackfillLegacyMaterialRelations(db, { apply: true, now });
    const relations = allRelations(db);

    const repeat = runBackfillLegacyMaterialRelations(db, {
      apply: true,
      now: () => "2099-01-01T00:00:00.000Z",
    });

    expect(repeat.state).toBe("already-applied");
    expect(repeat.changed).toBe(0);
    expect(repeat.alreadyExisting).toBe(2);
    expect(allRelations(db)).toEqual(relations);
  });

  it("существующая связь на продукт (в том числе с ролью primary) — noop", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/sbor-zayavok"]),
    });
    addProduct(db, PRODUCT_ID, "sbor-zayavok");
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "product",
      targetId: PRODUCT_ID,
      role: "primary",
      sortOrder: 0,
    });
    const before = allRelations(db);

    const report = runBackfillLegacyMaterialRelations(db, { apply: true, now });

    expect(report.state).toBe("already-applied");
    expect(report.alreadyExisting).toBe(1);
    expect(allRelations(db)).toEqual(before);
  });

  it("ошибка вставки откатывает весь прогон", () => {
    const db = freshDatabase();
    baseFixture(db);
    db.exec(
      `CREATE TRIGGER fail_case_insert BEFORE INSERT ON content_relations
         WHEN NEW.target_type = 'case'
       BEGIN SELECT RAISE(ABORT, 'сбой вставки кейса'); END;`,
    );
    const before = allRelations(db);

    expect(() => runBackfillLegacyMaterialRelations(db, { apply: true, now })).toThrow(
      /сбой вставки/,
    );
    // Продукт вставлялся первым — после отката его нет.
    expect(allRelations(db)).toEqual(before);
  });

  function racingDatabase(db: DatabaseSync, change: string): DatabaseSync {
    return {
      prepare: (sql: string) => db.prepare(sql),
      exec: (sql: string) => {
        db.exec(sql);
        if (sql === "BEGIN") db.exec(change);
      },
    } as unknown as DatabaseSync;
  }

  it.each([
    [
      "продукт скрыт после плана",
      `UPDATE products SET is_published = 0 WHERE id = '${PRODUCT_ID}'`,
    ],
    [
      "связь добавлена после плана",
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                      sort_order, created_at, updated_at)
       VALUES ('article', '${SOURCE_ID}', 'department', 'sales', 'related', 40, '${STAMP}', '${STAMP}')`,
    ],
  ])("перепроверка внутри транзакции: %s → blocked с отчётом и откат", (_label, change) => {
    const db = freshDatabase();
    baseFixture(db);
    const before = allRelations(db);

    const report = runBackfillLegacyMaterialRelations(racingDatabase(db, change), {
      apply: true,
      now,
    });

    expect(report.state).toBe("blocked");
    expect(report.concurrentChange).toBe(true);
    expect(report.changed).toBe(0);
    expect(exitCodeFor(report.state)).toBe(1);
    // Откат снял и саму «конкурентную» правку: она шла внутри той же транзакции.
    expect(allRelations(db)).toEqual(before);
  });

  it("обычный прогон сообщает concurrentChange = false", () => {
    const db = freshDatabase();
    baseFixture(db);
    expect(runBackfillLegacyMaterialRelations(db, { apply: true, now }).concurrentChange).toBe(
      false,
    );
  });
});

describe("импорт: блокирующие дефекты", () => {
  function expectBlocked(db: DatabaseSync, field: string): void {
    const relationsBefore = allRelations(db);
    const articlesBefore = articlesTable(db);

    const report = runBackfillLegacyMaterialRelations(db, { apply: true, now }) as unknown as Row;

    expect(report.state).toBe("blocked");
    expect(report[field]).toBeGreaterThan(0);
    expect(report.changed).toBe(0);
    expect(exitCodeFor("blocked")).toBe(1);
    expect(allRelations(db)).toEqual(relationsBefore);
    expect(articlesTable(db)).toEqual(articlesBefore);
  }

  it("скрытый продукт блокирует ВЕСЬ прогон, включая исправные статьи", () => {
    const db = freshDatabase();
    baseFixture(db);
    addArticle(db, {
      id: "hidden-uuid",
      slug: "so-skrytym",
      body: legacyBody(["/products/skryt"]),
    });
    addProduct(db, "product-09", "skryt", false);
    expectBlocked(db, "unpublishedProducts");
  });

  it("кейс со status ≠ published (прямой SQL) блокирует", () => {
    const db = freshDatabase();
    baseFixture(db);
    db.prepare("UPDATE cases SET status = 'draft' WHERE id = ?").run(CASE_ID);
    expectBlocked(db, "unpublishedCases");
  });

  it("несуществующий продукт по-прежнему блокирует", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/net-takogo"]),
    });
    expectBlocked(db, "missingTargets");
  });

  it("несуществующий кейс по-прежнему блокирует", () => {
    const db = freshDatabase();
    addProduct(db, PRODUCT_ID, "sbor-zayavok");
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/sbor-zayavok", "/cases/net-takogo"]),
    });
    expectBlocked(db, "missingTargets");
  });

  it("ссылка на продукт по id (адрес не slug) блокирует как unknown URL", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/prod-alpha"]),
    });
    addProduct(db, "prod-alpha", "sbor-zayavok");
    expectBlocked(db, "unknownUrls");
  });

  it("query URL блокирует", () => {
    const db = freshDatabase();
    baseFixture(db);
    db.prepare("UPDATE articles SET body_markdown = ? WHERE id = ?").run(
      legacyBody(["/products/sbor-zayavok?utm=1"]),
      SOURCE_ID,
    );
    expectBlocked(db, "unknownUrls");
  });

  it("неоднозначная секция (## заголовок) блокирует", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/sbor-zayavok"], "## Материалы по теме"),
    });
    addProduct(db, PRODUCT_ID, "sbor-zayavok");
    expectBlocked(db, "ambiguousSections");
  });

  it("дубль цели в тексте блокирует", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/sbor-zayavok", "/products/sbor-zayavok"]),
    });
    addProduct(db, PRODUCT_ID, "sbor-zayavok");
    expectBlocked(db, "duplicates");
  });

  it("одна цель двумя ролями в структурных связях — аномалия, BLOCKED, второй цели не создаётся", () => {
    const db = freshDatabase();
    addArticle(db, {
      id: SOURCE_ID,
      slug: "istochnik",
      body: legacyBody(["/products/sbor-zayavok"]),
    });
    addProduct(db, PRODUCT_ID, "sbor-zayavok");
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "product",
      targetId: PRODUCT_ID,
      role: "primary",
      sortOrder: 0,
    });
    addRelation(db, {
      sourceId: SOURCE_ID,
      targetType: "product",
      targetId: PRODUCT_ID,
      sortOrder: 1,
    });
    expectBlocked(db, "structuralAnomalies");
  });

  it("лимит связей: ровно предел — можно, сверх предела — BLOCKED", () => {
    const withExisting = (existing: number) => {
      const db = freshDatabase();
      addArticle(db, {
        id: SOURCE_ID,
        slug: "istochnik",
        body: legacyBody(["/products/sbor-zayavok", "/cases/zvonki"]),
      });
      addProduct(db, PRODUCT_ID, "sbor-zayavok");
      addCase(db, CASE_ID, "zvonki", "77");
      for (let index = 0; index < existing; index += 1) {
        addRelation(db, {
          sourceId: SOURCE_ID,
          targetType: "department",
          targetId: `dep-${index}`,
          sortOrder: index,
        });
      }
      return db;
    };

    expect(MAX_RELATIONS_PER_SOURCE).toBe(MAX_RELATIONS);
    expect(
      runBackfillLegacyMaterialRelations(withExisting(MAX_RELATIONS_PER_SOURCE - 2), { now }).state,
    ).toBe("ready");
    expectBlocked(withExisting(MAX_RELATIONS_PER_SOURCE - 1), "limitViolations");
  });

  it("код возврата ненулевой только у blocked", () => {
    expect(exitCodeFor("ready")).toBe(0);
    expect(exitCodeFor("applied")).toBe(0);
    expect(exitCodeFor("already-applied")).toBe(0);
    expect(exitCodeFor("blocked")).toBe(1);
  });
});

describe("импорт: CLI", () => {
  it("без --apply работает на базе только для чтения и ничего не пишет; --apply пишет", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-legacy-materials-"));
    const dbPath = path.join(dir, "content.db");
    try {
      const setup = freshDatabase(dbPath);
      baseFixture(setup);
      const before = allRelations(setup);
      setup.close();

      const env: NodeJS.ProcessEnv = { ...process.env, QBIT_DB_PATH: dbPath };
      const run = (...args: string[]) =>
        spawnSync(process.execPath, [SCRIPT, ...args], {
          cwd: PROJECT_ROOT,
          env,
          encoding: "utf8",
        });

      const dryRun = run();
      expect(dryRun.status, dryRun.stderr).toBe(0);
      expect(JSON.parse(dryRun.stdout)).toMatchObject({
        mode: "dry-run",
        state: "ready",
        changed: 0,
      });

      const readBack = new DatabaseSync(dbPath, { readOnly: true });
      expect(allRelations(readBack)).toEqual(before);
      readBack.close();

      const applied = run("--apply");
      expect(applied.status, applied.stderr).toBe(0);
      expect(JSON.parse(applied.stdout)).toMatchObject({
        mode: "apply",
        state: "applied",
        changed: 2,
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
