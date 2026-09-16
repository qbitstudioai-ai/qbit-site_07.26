// @vitest-environment node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicArticleBody, stripLegacyRelatedSection } from "@/features/blog/articleBody";
import { parseBlogMarkdown } from "@/features/blog/markdown";
import type { BlogPost } from "@/features/blog/posts";
import { countWords, readingTimeLabel } from "@/features/blog/posts";
import { migrations } from "@/server/db/schema.mjs";
import {
  applyCleanupPlan,
  buildCleanupPlan,
  exitCodeFor,
  parseCliArgs,
  runRemoveLegacyMaterialSections,
} from "../../../../scripts/remove-legacy-material-sections.mjs";

/**
 * Физическое удаление legacy-секции «Материалы по теме» (Amendment 61 / REL-02F.3b).
 *
 * Главные свойства: удаляется ровно диапазон extractor (D9); проверяются все статьи, включая черновики
 * (D10); apply без manifest запрещён, manifest хранит вырезанный текст (D12); меняется только
 * `body_markdown` — даты, статус, связи, ревизии и журнал побайтно те же; запись одной транзакцией с
 * перепроверкой; публичная проекция статьи не меняется.
 *
 * Ожидаемые тела считаются из частей фикстуры, а не extractor'ом: иначе тест подтверждал бы сам себя.
 */

type Row = Record<string, unknown>;
type Extract = (markdown: string) => unknown;

const extractorOverride = vi.hoisted(() => ({
  current: undefined as undefined | ((markdown: string, actual: Extract) => unknown),
}));

vi.mock("@/features/blog/legacyRelatedSection.mjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/blog/legacyRelatedSection.mjs")>();
  return {
    ...actual,
    extractLegacyRelatedSection: (markdown: string) =>
      extractorOverride.current
        ? extractorOverride.current(markdown, actual.extractLegacyRelatedSection as Extract)
        : actual.extractLegacyRelatedSection(markdown),
  };
});

const PROJECT_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SCRIPT = path.join(PROJECT_ROOT, "scripts", "remove-legacy-material-sections.mjs");
const CREATED = "2026-01-01T00:00:00.000Z";
const NOW = "2026-09-15T12:00:00.000Z";
const now = () => NOW;

const SECTION = [
  "**Материалы по теме:**",
  "- «[Сбор заявок](/products/sbor-zayavok)» — продуктовая страница.  ",
  "- «[Статья B](/blog/statya-b)» — о передаче заявок.",
].join("\n");
const PREFIX =
  "**Краткий ответ:** текст статьи.\n\n**Как это работает:**\nАбзац  с пробелами.  \n\n";
const SUFFIX = "\n\n**Источники:**\n- [Внешний источник](https://example.com/a)\n";
const crlf = (text: string) => text.replace(/\n/gu, "\r\n");

const END_BODY = PREFIX + SECTION;
const MIDDLE_BODY = PREFIX + SECTION + SUFFIX;
const CRLF_BODY = crlf(PREFIX) + crlf(SECTION) + crlf(SUFFIX);
const NO_SECTION_BODY = "**Краткий ответ:** статья без секции.\n\n**Раздел:**\nТекст раздела.\n";
const INVALID_BODY = `${PREFIX}## Материалы по теме\n- [Статья B](/blog/statya-b)\n`;

interface ArticleSeed {
  id: string;
  slug: string;
  body: string;
  status?: string;
  sortOrder?: number;
  updatedAt?: string;
  publishedAt?: string | null;
}

const A = {
  id: "uuid-a-konec",
  slug: "statya-a",
  body: END_BODY,
  sortOrder: 0,
  updatedAt: "2026-03-01T08:00:00.000Z",
  publishedAt: "2026-02-01T08:00:00.000Z",
};
const B = {
  id: "uuid-b-seredina",
  slug: "statya-b",
  body: MIDDLE_BODY,
  sortOrder: 1,
  updatedAt: "2026-03-02T09:15:30.123Z",
  publishedAt: "2026-02-02T09:00:00.000Z",
};
const C = {
  id: "uuid-c-chernovik",
  slug: "statya-c",
  body: CRLF_BODY,
  status: "draft",
  sortOrder: 2,
  updatedAt: "2026-03-03T10:00:00.000Z",
  publishedAt: null,
};
const D = {
  id: "uuid-d-bez-sekcii",
  slug: "statya-d",
  body: NO_SECTION_BODY,
  sortOrder: 3,
  updatedAt: "2026-03-04T11:00:00.000Z",
  publishedAt: "2026-02-04T11:00:00.000Z",
};

let temporaryDirectory: string;
let manifestPath: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-remove-legacy-"));
  manifestPath = path.join(temporaryDirectory, "manifest.json");
});

afterEach(() => {
  extractorOverride.current = undefined;
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function freshDatabase(target = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(target);
  migrations.forEach((migration) => db.exec(migration.sql));
  return db;
}

function addArticle(db: DatabaseSync, article: ArticleSeed): void {
  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, status, sort_order,
                           published_at, created_at, updated_at)
     VALUES (?, ?, ?, 'Анонс.', ?, 'blog', ?, ?, ?, ?, ?)`,
  ).run(
    article.id,
    article.slug,
    `Статья ${article.slug}`,
    article.body,
    article.status ?? "published",
    article.sortOrder ?? 0,
    article.publishedAt === undefined ? "2026-02-01T00:00:00.000Z" : article.publishedAt,
    CREATED,
    article.updatedAt ?? "2026-03-01T00:00:00.000Z",
  );
}

function addHistory(db: DatabaseSync): void {
  const relation = db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                    sort_order, created_at, updated_at)
     VALUES ('article', ?, ?, ?, 'related', ?, ?, ?)`,
  );
  relation.run(A.id, "article", B.id, 0, CREATED, "2026-04-01T00:00:00.000Z");
  relation.run(A.id, "product", "uuid-product-1", 1, CREATED, "2026-04-02T00:00:00.000Z");
  relation.run(B.id, "case", "uuid-case-1", 0, CREATED, "2026-04-03T00:00:00.000Z");
  db.prepare(
    `INSERT INTO content_revisions (entity_type, entity_id, previous_data, created_at)
     VALUES ('article', ?, ?, ?)`,
  ).run(A.id, JSON.stringify({ bodyMarkdown: END_BODY }), "2026-03-01T07:59:00.000Z");
  db.prepare(
    `INSERT INTO activity_log (entity, entity_id, action, summary, created_at)
     VALUES ('article', ?, 'update', 'Правка статьи', ?)`,
  ).run(A.id, "2026-03-01T08:00:00.000Z");
}

/** A — секция в конце, B — в середине, C — черновик с CRLF, D — без секции; связи, ревизия, журнал. */
function standardFixture(db: DatabaseSync): void {
  [A, B, C, D].forEach((article) => addArticle(db, article));
  addHistory(db);
}

const rows = (db: DatabaseSync, sql: string): Row[] => db.prepare(sql).all() as Row[];

function snapshot(db: DatabaseSync) {
  return {
    articles: rows(db, "SELECT * FROM articles ORDER BY id"),
    relations: rows(
      db,
      `SELECT * FROM content_relations
        ORDER BY source_type, source_id, target_type, target_id, relation_role, sort_order`,
    ),
    revisions: rows(db, "SELECT * FROM content_revisions ORDER BY id"),
    activity: rows(db, "SELECT * FROM activity_log ORDER BY id"),
  };
}

const bodyOf = (db: DatabaseSync, id: string): string =>
  String(
    (db.prepare("SELECT body_markdown FROM articles WHERE id = ?").get(id) as Row).body_markdown,
  );

const readManifest = (): Row => JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Row;

const sha256 = (value: string | Buffer): string =>
  crypto.createHash("sha256").update(value).digest("hex");

/** Фиксирует каждый SQL, который скрипт отправляет базе. */
function recordingDb(db: DatabaseSync) {
  const prepared: string[] = [];
  const executed: string[] = [];
  const recorder = {
    prepare: (sql: string) => {
      prepared.push(sql);
      return db.prepare(sql);
    },
    exec: (sql: string) => {
      executed.push(sql);
      db.exec(sql);
    },
  };
  return { db: recorder as unknown as DatabaseSync, prepared, executed };
}

function applyStandard(db: DatabaseSync) {
  standardFixture(db);
  const before = snapshot(db);
  const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });
  return { before, after: snapshot(db), report };
}

function runCli(env: Record<string, string>, ...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

describe("удаление legacy-секции: точный диапазон (D9)", () => {
  it("1. секция в конце: удалён ровно её текст", () => {
    const db = freshDatabase();
    addArticle(db, A);

    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(report).toMatchObject({ state: "applied", changed: 1, plannedChanges: 1 });
    expect(report.candidates[0].range).toEqual({
      start: PREFIX.length,
      end: PREFIX.length + SECTION.length,
    });
    expect(report.candidates[0].removedLength).toBe(SECTION.length);
    expect(bodyOf(db, A.id)).toBe(PREFIX);
  });

  it("2. секция в середине: текст до и после сохранён", () => {
    const db = freshDatabase();
    addArticle(db, B);

    runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(bodyOf(db, B.id)).toBe(PREFIX + SUFFIX);
  });

  it("3. соседний текст побайтно тот же: пробелы в конце строк и пустые строки не тронуты", () => {
    const db = freshDatabase();
    addArticle(db, B);

    runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    const after = Buffer.from(bodyOf(db, B.id), "utf8");
    expect(after.subarray(0, Buffer.byteLength(PREFIX)).equals(Buffer.from(PREFIX))).toBe(true);
    expect(after.subarray(Buffer.byteLength(PREFIX)).equals(Buffer.from(SUFFIX))).toBe(true);
    expect(after.length).toBe(Buffer.byteLength(PREFIX) + Buffer.byteLength(SUFFIX));
  });

  it("4. CRLF вне удалённого диапазона сохраняется", () => {
    const db = freshDatabase();
    addArticle(db, C);

    runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    const after = bodyOf(db, C.id);
    expect(after).toBe(crlf(PREFIX) + crlf(SUFFIX));
    expect(after.replace(/\r\n/gu, "")).not.toContain("\n");
  });
});

describe("состав статей и блокеры (D10)", () => {
  it("5. только статьи без секции — already-applied и ничего не пишется", () => {
    const db = freshDatabase();
    addArticle(db, D);
    const before = snapshot(db);

    const dryRun = runRemoveLegacyMaterialSections(db);
    const applied = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(dryRun).toMatchObject({ state: "already-applied", plannedChanges: 0, changed: 0 });
    expect(applied).toMatchObject({ state: "already-applied", plannedChanges: 0, changed: 0 });
    expect(snapshot(db)).toEqual(before);
    expect(readManifest().state).toBe("already-applied");
  });

  it("6. смешанно ok + no_section: чистится только статья с секцией", () => {
    const db = freshDatabase();
    addArticle(db, A);
    addArticle(db, D);

    const dryRun = runRemoveLegacyMaterialSections(db);
    expect(dryRun).toMatchObject({
      state: "ready",
      totalArticles: 2,
      withLegacySection: 1,
      noSection: 1,
      invalid: 0,
      plannedChanges: 1,
      changed: 0,
    });

    runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });
    expect(bodyOf(db, A.id)).toBe(PREFIX);
    expect(bodyOf(db, D.id)).toBe(NO_SECTION_BODY);
  });

  it("7. черновик тоже очищается", () => {
    const db = freshDatabase();
    addArticle(db, C);

    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(report.byStatus).toEqual({ published: 0, draft: 1, other: 0 });
    expect(report.candidates.map((item: Row) => [item.slug, item.status])).toEqual([
      [C.slug, "draft"],
    ]);
    expect(bodyOf(db, C.id)).toBe(crlf(PREFIX) + crlf(SUFFIX));
  });

  it.each([
    ["8. invalid в опубликованной статье", "published"],
    ["9. invalid в черновике", "draft"],
  ])("%s блокирует ВСЁ", (_label, status) => {
    const db = freshDatabase();
    standardFixture(db);
    addArticle(db, {
      id: "uuid-e-invalid",
      slug: "statya-e",
      body: INVALID_BODY,
      status,
      sortOrder: 9,
    });
    const before = snapshot(db);

    const dryRun = runRemoveLegacyMaterialSections(db);
    const applied = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    for (const report of [dryRun, applied]) {
      expect(report).toMatchObject({ state: "blocked", invalid: 1, changed: 0 });
      expect(report.problems.invalidSections.map((item: Row) => [item.slug, item.status])).toEqual([
        ["statya-e", status],
      ]);
    }
    expect(exitCodeFor(applied.state)).toBe(1);
    expect(snapshot(db)).toEqual(before);
    expect(readManifest().state).toBe("blocked");
  });

  it("10. неизвестное состояние extractor и недопустимый диапазон — fail closed", () => {
    const db = freshDatabase();
    standardFixture(db);
    addArticle(db, { id: "uuid-f", slug: "statya-f", body: "СТРАННОЕ состояние.", sortOrder: 10 });
    addArticle(db, { id: "uuid-g", slug: "statya-g", body: "ПЛОХОЙ диапазон.", sortOrder: 11 });
    extractorOverride.current = (markdown, actual) => {
      if (markdown.startsWith("СТРАННОЕ")) return { state: "weird" };
      if (markdown.startsWith("ПЛОХОЙ")) return { state: "ok", range: { start: 5, end: 2 } };
      return actual(markdown);
    };
    const before = snapshot(db);

    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(report.state).toBe("blocked");
    expect(report.problems.unexpectedStates.map((item: Row) => [item.slug, item.state])).toEqual([
      ["statya-f", "weird"],
      ["statya-g", "ok"],
    ]);
    expect(snapshot(db)).toEqual(before);
  });

  it("11. пустое тело после удаления блокирует", () => {
    const db = freshDatabase();
    standardFixture(db);
    addArticle(db, { id: "uuid-h", slug: "statya-h", body: `\n\n${SECTION}\n`, sortOrder: 12 });
    const before = snapshot(db);

    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(report.state).toBe("blocked");
    expect(report.problems.emptyBodies.map((item: Row) => item.slug)).toEqual(["statya-h"]);
    expect(snapshot(db)).toEqual(before);
  });

  it("12. секция, оставшаяся после удаления, блокирует", () => {
    const db = freshDatabase();
    standardFixture(db);
    addArticle(db, {
      id: "uuid-i",
      slug: "statya-i",
      body: `ОСТАТОК\n\n${SECTION}`,
      sortOrder: 13,
    });
    extractorOverride.current = (markdown, actual) => {
      const result = actual(markdown) as { state: string };
      return result.state === "no_section" && markdown.startsWith("ОСТАТОК")
        ? { state: "ok", range: { start: 0, end: 7 }, targets: [] }
        : result;
    };
    const before = snapshot(db);

    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(report.state).toBe("blocked");
    expect(report.problems.residualSections.map((item: Row) => item.slug)).toEqual(["statya-i"]);
    expect(snapshot(db)).toEqual(before);
  });
});

describe("транзакция и конкурентные изменения", () => {
  it("13. несколько статей — одна транзакция BEGIN IMMEDIATE … COMMIT", () => {
    const db = freshDatabase();
    standardFixture(db);
    const recorded = recordingDb(db);

    const report = runRemoveLegacyMaterialSections(recorded.db, { apply: true, manifestPath, now });

    expect(report).toMatchObject({ state: "applied", plannedChanges: 3, changed: 3 });
    expect(recorded.executed).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
    const writes = recorded.prepared.filter((sql) => !/^\s*SELECT/iu.test(sql));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^\s*UPDATE articles\s+SET body_markdown = \?\s+WHERE id = \?/u);
  });

  it("14. сбой одного UPDATE откатывает всю уборку, manifest остаётся planned", () => {
    const db = freshDatabase();
    standardFixture(db);
    db.exec(`CREATE TRIGGER skip_b BEFORE UPDATE OF body_markdown ON articles
             WHEN OLD.id = '${B.id}' BEGIN SELECT RAISE(IGNORE); END;`);
    const before = snapshot(db);

    expect(() => runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now })).toThrow(
      /«statya-b» изменил 0 строк/u,
    );
    expect(snapshot(db)).toEqual(before);
    expect(readManifest().state).toBe("planned");
  });

  it.each([
    ["14a. тело", `UPDATE articles SET body_markdown = body_markdown || ' ' WHERE id = '${B.id}'`],
    ["14b. updated_at", `UPDATE articles SET updated_at = 'сдвинуто' WHERE id = '${B.id}'`],
  ])(
    "%s другой статьи изменилось внутри транзакции — UPDATE не находит строку, полный откат",
    (_label, sql) => {
      const db = freshDatabase();
      standardFixture(db);
      db.exec(`CREATE TRIGGER touch_b AFTER UPDATE OF body_markdown ON articles
               WHEN NEW.id = '${A.id}' BEGIN ${sql}; END;`);
      const before = snapshot(db);

      expect(() => runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now })).toThrow(
        /«statya-b» изменил 0 строк/u,
      );
      expect(snapshot(db)).toEqual(before);
    },
  );

  it.each([
    [
      "15. тело изменилось",
      `UPDATE articles SET body_markdown = body_markdown || ' ' WHERE id = '${B.id}'`,
    ],
    [
      "16. updated_at изменился",
      `UPDATE articles SET updated_at = '2026-09-15T00:00:00.000Z' WHERE id = '${B.id}'`,
    ],
    [
      "17. диапазон и хэш изменились",
      `UPDATE articles SET body_markdown = 'Новый абзац.\n' || body_markdown WHERE id = '${B.id}'`,
    ],
  ])(
    "%s между планом и транзакцией — blocked, concurrentChange, ничего не записано",
    (_label, sql) => {
      const db = freshDatabase();
      standardFixture(db);
      const plan = buildCleanupPlan(db);
      db.exec(sql);
      const before = snapshot(db);

      const report = applyCleanupPlan(db, plan, { manifestPath, now });

      expect(report).toMatchObject({ state: "blocked", concurrentChange: true, changed: 0 });
      expect(snapshot(db)).toEqual(before);
      expect(readManifest()).toMatchObject({ state: "blocked", concurrentChange: true });
    },
  );

  it("17a. связь или статья без секции изменились между планом и транзакцией — тоже concurrentChange", () => {
    for (const [index, sql] of [
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                      sort_order, created_at, updated_at)
       VALUES ('article', '${D.id}', 'product', 'uuid-novyj', 'related', 0, 't', 't')`,
      `UPDATE articles SET updated_at = '2026-09-15T00:00:00.000Z' WHERE id = '${D.id}'`,
    ].entries()) {
      const db = freshDatabase();
      standardFixture(db);
      const plan = buildCleanupPlan(db);
      db.exec(sql);
      const before = snapshot(db);

      const report = applyCleanupPlan(db, plan, {
        manifestPath: path.join(temporaryDirectory, `manifest-17a-${index}.json`),
        now,
      });

      expect(report).toMatchObject({ state: "blocked", concurrentChange: true, changed: 0 });
      expect(snapshot(db)).toEqual(before);
    }
  });

  it.each([
    [
      "articlesMeta",
      "UPDATE articles SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = NEW.id",
    ],
    [
      "relations",
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                      sort_order, created_at, updated_at)
       VALUES ('article', NEW.id, 'product', 'uuid-lishnij', 'related', 99, 't', 't')`,
    ],
  ])("пост-проверка отпечатка %s до COMMIT — ROLLBACK и blocked", (_label, sql) => {
    const db = freshDatabase();
    standardFixture(db);
    db.exec(`CREATE TRIGGER side_effect AFTER UPDATE OF body_markdown ON articles
             WHEN NEW.id = '${A.id}' BEGIN ${sql}; END;`);
    const before = snapshot(db);

    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });

    expect(report).toMatchObject({ state: "blocked", changed: 0, concurrentChange: false });
    expect(report.fingerprints.after).not.toEqual(report.fingerprints.before);
    expect(report.fingerprints.afterState).toBe("rolled-back");
    expect(snapshot(db)).toEqual(before);
  });
});

describe("инварианты успешной уборки", () => {
  it("18. updated_at каждой статьи побайтно тот же", () => {
    const db = freshDatabase();
    const { report } = applyStandard(db);

    expect(report.state).toBe("applied");
    const values = rows(db, "SELECT id, updated_at FROM articles ORDER BY id");
    expect(values).toEqual(
      [A, B, C, D]
        .map((article) => ({ id: article.id, updated_at: article.updatedAt }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  it("19. published_at каждой статьи тот же, включая NULL черновика", () => {
    const db = freshDatabase();
    applyStandard(db);

    const values = rows(db, "SELECT id, published_at, status FROM articles ORDER BY id");
    expect(values).toEqual(
      [A, B, C, D]
        .map((article) => ({
          id: article.id,
          published_at: article.publishedAt,
          status: "status" in article ? article.status : "published",
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  it("18–19. все колонки статей, кроме body_markdown, неизменны", () => {
    const db = freshDatabase();
    const { before, after } = applyStandard(db);

    const withoutBody = (list: Row[]) =>
      list.map((row) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => key !== "body_markdown")),
      );
    expect(withoutBody(after.articles)).toEqual(withoutBody(before.articles));
  });

  it("20. content_relations полностью неизменна", () => {
    const db = freshDatabase();
    const { before, after } = applyStandard(db);
    expect(after.relations).toHaveLength(3);
    expect(after.relations).toEqual(before.relations);
  });

  it("21. content_revisions неизменна", () => {
    const db = freshDatabase();
    const { before, after } = applyStandard(db);
    expect(after.revisions).toHaveLength(1);
    expect(after.revisions).toEqual(before.revisions);
  });

  it("22. activity_log неизменен", () => {
    const db = freshDatabase();
    const { before, after } = applyStandard(db);
    expect(after.activity).toHaveLength(1);
    expect(after.activity).toEqual(before.activity);
  });

  it("23. повторный apply — already-applied, ни одной записи", () => {
    const db = freshDatabase();
    const { after } = applyStandard(db);
    const appliedManifest = fs.readFileSync(manifestPath);
    const recorded = recordingDb(db);
    const repeatManifestPath = path.join(temporaryDirectory, "manifest-repeat.json");

    const repeat = runRemoveLegacyMaterialSections(recorded.db, {
      apply: true,
      manifestPath: repeatManifestPath,
      now,
    });

    expect(repeat).toMatchObject({ state: "already-applied", plannedChanges: 0, changed: 0 });
    expect(recorded.executed).toEqual([]);
    expect(recorded.prepared.every((sql) => /^\s*SELECT/iu.test(sql))).toBe(true);
    expect(snapshot(db)).toEqual(after);
    expect(fs.readFileSync(manifestPath).equals(appliedManifest)).toBe(true);
    expect(JSON.parse(fs.readFileSync(repeatManifestPath, "utf8"))).toMatchObject({
      state: "already-applied",
      candidates: [],
    });
  });

  it("24. dry-run на базе, открытой только на чтение, ничего не пишет", () => {
    const dbPath = path.join(temporaryDirectory, "readonly.db");
    const setup = freshDatabase(dbPath);
    standardFixture(setup);
    setup.close();
    const fileBefore = sha256(fs.readFileSync(dbPath));

    const db = new DatabaseSync(dbPath, { readOnly: true });
    const recorded = recordingDb(db);
    const report = runRemoveLegacyMaterialSections(recorded.db);
    db.close();

    expect(report).toMatchObject({
      mode: "dry-run",
      state: "ready",
      plannedChanges: 3,
      changed: 0,
    });
    expect(recorded.executed).toEqual([]);
    expect(recorded.prepared.every((sql) => /^\s*SELECT/iu.test(sql))).toBe(true);
    expect(sha256(fs.readFileSync(dbPath))).toBe(fileBefore);
    expect(fs.existsSync(manifestPath)).toBe(false);
  });
});

describe("manifest и CLI (D12)", () => {
  it("25. apply без manifest отвергается — в функции, в разборе аргументов и в CLI", () => {
    const ready = freshDatabase();
    standardFixture(ready);
    const cleaned = freshDatabase();
    addArticle(cleaned, D);
    for (const db of [ready, cleaned]) {
      const before = snapshot(db);
      expect(() => runRemoveLegacyMaterialSections(db, { apply: true })).toThrow(/--manifest/u);
      expect(snapshot(db)).toEqual(before);
    }
    const plan = buildCleanupPlan(ready);
    expect(() => applyCleanupPlan(ready, plan, {})).toThrow(/--manifest/u);
    expect(() => parseCliArgs(["--apply"])).toThrow(/--manifest/u);
    expect(parseCliArgs(["--apply", "--manifest", "m.json"])).toEqual({
      apply: true,
      manifestPath: "m.json",
    });

    const dbPath = path.join(temporaryDirectory, "cli.db");
    const setup = freshDatabase(dbPath);
    standardFixture(setup);
    setup.close();
    const fileBefore = sha256(fs.readFileSync(dbPath));

    const result = runCli({ QBIT_DB_PATH: dbPath }, "--apply");
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--manifest/u);
    expect(sha256(fs.readFileSync(dbPath))).toBe(fileBefore);
  });

  it("26. несуществующий путь базы при --apply не создаёт пустую базу", () => {
    const dbPath = path.join(temporaryDirectory, "net-takoj.db");

    const result = runCli({ QBIT_DB_PATH: dbPath }, "--apply", "--manifest", manifestPath);

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Файл базы не найден/u);
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.existsSync(manifestPath)).toBe(false);
  });

  it("27. manifest содержит точный вырезанный текст и хэши каждого кандидата", () => {
    const db = freshDatabase();
    standardFixture(db);

    const report = runRemoveLegacyMaterialSections(db, { manifestPath, now });
    const manifest = readManifest();

    expect(manifest).toMatchObject({ generatedAt: NOW, mode: "dry-run", state: "ready" });
    expect((manifest.fingerprints as Row).before).toEqual(report.fingerprints.before);
    const expected = [
      { article: A, removed: SECTION, oldBody: END_BODY, newBody: PREFIX },
      { article: B, removed: SECTION, oldBody: MIDDLE_BODY, newBody: PREFIX + SUFFIX },
      {
        article: C,
        removed: crlf(SECTION),
        oldBody: CRLF_BODY,
        newBody: crlf(PREFIX) + crlf(SUFFIX),
      },
    ];
    expect(manifest.candidates).toEqual(
      expected.map(({ article, removed, oldBody, newBody }) => ({
        id: article.id,
        slug: article.slug,
        status: "status" in article ? article.status : "published",
        updatedAt: article.updatedAt,
        publishedAt: article.publishedAt,
        range: { start: oldBody.indexOf(removed), end: oldBody.indexOf(removed) + removed.length },
        oldSha256: sha256(oldBody),
        newSha256: sha256(newBody),
        removedSha256: sha256(removed),
        removedLength: removed.length,
        exactRemovedText: removed,
      })),
    );
    expect(report.candidates[0]).not.toHaveProperty("exactRemovedText");
  });

  it("28. после apply manifest получает state=applied и совпадающие отпечатки after", () => {
    const db = freshDatabase();
    const { report } = applyStandard(db);
    const manifest = readManifest();

    expect(manifest).toMatchObject({ mode: "apply", state: "applied", concurrentChange: false });
    const fingerprints = manifest.fingerprints as { before: Row; after: Row; afterState: string };
    expect(fingerprints.afterState).toBe("committed");
    expect(fingerprints.after).toEqual(fingerprints.before);
    expect(fingerprints.before).toEqual(report.fingerprints.before);
    expect((manifest.candidates as Row[]).map((item) => item.exactRemovedText)).toEqual([
      SECTION,
      SECTION,
      crlf(SECTION),
    ]);
    expect(fs.readdirSync(temporaryDirectory).filter((name) => name.includes(".tmp-"))).toEqual([]);
  });

  it("36. существующий manifest не перезаписывается ни dry-run, ни apply, ни applyCleanupPlan, ни CLI", () => {
    const db = freshDatabase();
    const { after } = applyStandard(db);
    const appliedManifest = fs.readFileSync(manifestPath);
    const refused = /Manifest уже существует/u;

    const cleaned = freshDatabase();
    standardFixture(cleaned);
    const readyBefore = snapshot(cleaned);
    const plan = buildCleanupPlan(cleaned);
    const recorded = recordingDb(cleaned);

    expect(() => runRemoveLegacyMaterialSections(db, { manifestPath, now })).toThrow(refused);
    expect(() => runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now })).toThrow(
      refused,
    );
    expect(() =>
      runRemoveLegacyMaterialSections(recorded.db, { apply: true, manifestPath, now }),
    ).toThrow(refused);
    expect(recorded.prepared).toEqual([]);
    expect(() => applyCleanupPlan(cleaned, plan, { manifestPath, now })).toThrow(refused);

    expect(snapshot(db)).toEqual(after);
    expect(snapshot(cleaned)).toEqual(readyBefore);
    expect(fs.readFileSync(manifestPath).equals(appliedManifest)).toBe(true);
    expect(JSON.parse(appliedManifest.toString("utf8"))).toMatchObject({ state: "applied" });

    // Проверка manifest идёт до проверки и открытия базы: путь базы не существует и не создаётся.
    const missingDb = path.join(temporaryDirectory, "net-bazy.db");
    const cli = runCli({ QBIT_DB_PATH: missingDb }, "--apply", "--manifest", manifestPath);
    expect(cli.status).toBe(2);
    expect(cli.stderr).toMatch(refused);
    expect(fs.existsSync(missingDb)).toBe(false);
    expect(fs.readFileSync(manifestPath).equals(appliedManifest)).toBe(true);
  });

  it("37. сбой записи manifest после COMMIT — понятная ошибка, planned с вырезанным текстом сохранён", () => {
    const db = freshDatabase();
    standardFixture(db);
    let calls = 0;
    const failingNow = () => {
      calls += 1;
      if (calls > 1) throw new Error("диск недоступен");
      return NOW;
    };

    expect(() =>
      runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now: failingNow }),
    ).toThrow(/COMMIT выполнен: база изменена \(статей: 3\)[\s\S]*проверьте результат dry-run/u);

    expect(bodyOf(db, A.id)).toBe(PREFIX);
    const manifest = readManifest();
    expect(manifest.state).toBe("planned");
    expect((manifest.candidates as Row[]).map((item) => item.exactRemovedText)).toEqual([
      SECTION,
      SECTION,
      crlf(SECTION),
    ]);
    expect(runRemoveLegacyMaterialSections(db).state).toBe("already-applied");
  });

  it("CLI: dry-run → apply → повтор, коды возврата; blocked → 1", () => {
    const dbPath = path.join(temporaryDirectory, "flow.db");
    const setup = freshDatabase(dbPath);
    standardFixture(setup);
    setup.close();
    const env = { QBIT_DB_PATH: dbPath };

    const dryRun = runCli(env);
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({ state: "ready", changed: 0 });

    const applied = runCli(env, "--apply", "--manifest", manifestPath);
    expect(applied.status, applied.stderr).toBe(0);
    expect(JSON.parse(applied.stdout)).toMatchObject({ state: "applied", changed: 3 });

    const appliedManifest = fs.readFileSync(manifestPath);
    for (const args of [
      ["--manifest", manifestPath],
      ["--apply", "--manifest", manifestPath],
    ]) {
      const reused = runCli(env, ...args);
      expect(reused.status).toBe(2);
      expect(reused.stderr).toMatch(/Manifest уже существует/u);
      expect(fs.readFileSync(manifestPath).equals(appliedManifest)).toBe(true);
    }

    const repeatManifestPath = path.join(temporaryDirectory, "manifest-repeat.json");
    const repeat = runCli(env, "--apply", "--manifest", repeatManifestPath);
    expect(repeat.status, repeat.stderr).toBe(0);
    expect(JSON.parse(repeat.stdout)).toMatchObject({ state: "already-applied", changed: 0 });

    const blocked = new DatabaseSync(dbPath);
    addArticle(blocked, { id: "uuid-e", slug: "statya-e", body: INVALID_BODY, sortOrder: 20 });
    blocked.close();
    const refused = runCli(env);
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.stdout)).toMatchObject({ state: "blocked" });
    expect(exitCodeFor("ready")).toBe(0);
    expect(exitCodeFor("already-applied")).toBe(0);
    expect(exitCodeFor("applied")).toBe(0);
  });
});

describe("публичная эквивалентность", () => {
  const cases = [
    { article: A, old: END_BODY },
    { article: B, old: MIDDLE_BODY },
    { article: C, old: CRLF_BODY },
  ];

  it("29. publicArticleBody(старое тело).body === новое тело", () => {
    const db = freshDatabase();
    applyStandard(db);
    for (const { article, old } of cases) {
      expect(bodyOf(db, article.id)).toBe(publicArticleBody(old).body);
    }
  });

  it("30. strip после уборки — no-op, секции нет", () => {
    const db = freshDatabase();
    applyStandard(db);
    for (const { article } of cases) {
      const body = bodyOf(db, article.id);
      expect(publicArticleBody(body)).toEqual({ body, legacySection: "no_section" });
      expect(stripLegacyRelatedSection(body)).toBe(body);
    }
  });

  it("31–33. wordCount, readingTime и разделы не меняются", () => {
    const db = freshDatabase();
    applyStandard(db);
    for (const { article, old } of cases) {
      const publicOld = publicArticleBody(old).body;
      const body = bodyOf(db, article.id);
      expect(countWords(body)).toBe(countWords(publicOld));
      expect(readingTimeLabel(countWords(body))).toBe(readingTimeLabel(countWords(publicOld)));
      expect(parseBlogMarkdown(body)).toEqual(parseBlogMarkdown(publicOld));
    }
  });

  it("34–35. getPublishedArticles до и после уборки совпадает, включая материалы по теме", async () => {
    vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "public.db"));
    vi.resetModules();
    const { getDatabase } = await import("@/server/db/client");
    const db = getDatabase();
    standardFixture(db);
    db.prepare(
      `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                             is_published, created_at, updated_at)
       VALUES ('uuid-product-1', 'sbor-zayavok', 'Меню', 'Сбор заявок', '{}', 'wide', 'sales',
               'Иллюстрация', 1, ?, ?)`,
    ).run(CREATED, CREATED);

    const { getPublishedArticles } = await import("@/server/content/articles");
    const project = (posts: BlogPost[]) =>
      posts.map((post) => ({
        slug: post.slug,
        sections: post.sections,
        wordCount: post.wordCount,
        readingTime: post.readingTime,
        modifiedAt: post.modifiedAt,
        publishedAt: post.publishedAt,
        relatedMaterials: post.relatedMaterials,
      }));

    const before = project(await getPublishedArticles());
    const report = runRemoveLegacyMaterialSections(db, { apply: true, manifestPath, now });
    const after = project(await getPublishedArticles());

    expect(report).toMatchObject({ state: "applied", changed: 3 });
    expect(before.map((post) => post.slug)).toEqual([A.slug, B.slug, D.slug]);
    expect(
      before.find((post) => post.slug === A.slug)?.relatedMaterials.map((item) => item.href),
    ).toEqual([`/blog/${B.slug}`, "/products/sbor-zayavok"]);
    expect(after).toEqual(before);
    expect(bodyOf(db, A.id)).not.toBe(END_BODY);
  });
});
