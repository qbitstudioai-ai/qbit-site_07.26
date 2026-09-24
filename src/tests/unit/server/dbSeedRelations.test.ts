// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import seedArticlesJson from "../../../../data/seed/articles.json";
import seedProductsJson from "../../../../data/seed/products.json";
import { migrations } from "@/server/db/schema.mjs";
import { runBackfillArticleRelations } from "../../../../scripts/backfill-article-relations.mjs";
import { runBackfillLegacyMaterialRelations } from "../../../../scripts/backfill-legacy-material-relations.mjs";
import {
  RESET_RELATION_ENTITY_TYPES,
  SEED_RELATION_ROLE,
  seedArticles,
} from "../../../../scripts/db-seed.mjs";

/**
 * Seed создаёт структурные связи статей (Amendment 60 / REL-02E.1; источник — `relations[]`,
 * Amendment 61 / REL-02F.3a).
 *
 * Две группы проверок. Первая запускает НАСТОЯЩИЙ `scripts/db-seed.mjs` дочерним процессом на
 * временном `QBIT_DATA_DIR` и сверяет результат с зафиксированным baseline и функциями backfill-скриптов.
 * Вторая вызывает `seedArticles()` на базе в памяти с данными, которых нет в `data/seed`: идентификатор,
 * отличный от адреса, и заведомо недопустимые связи.
 *
 * Пользовательская `var/content.db` не открывается: переменные пути базы и хранилища у дочернего
 * процесса перекрыты, и путь базы, который печатает seed, проверяется явно.
 */

type Row = Record<string, unknown>;

const PROJECT_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SEED_SCRIPT = path.join(PROJECT_ROOT, "scripts", "db-seed.mjs");
const SEED_TIMEOUT = 120_000;
const MIGRATED_CASE_ID = "case-sales-call-analysis";

/**
 * Baseline свежего seed ДО REL-02F.3a (снят 2026-09-15 на `db-seed --reset`): по каждой статье в
 * порядке файла — цели в порядке `sort_order`. Переход на `relations[]` и удаление legacy-секций из
 * seed обязаны воспроизвести его ровно. Константа, а не вывод из данных: вывод из тех же данных
 * подтвердил бы сам себя.
 */
const BASELINE: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "kak-avtomatizirovat-obrabotku-zayavok",
    [
      "article:sayt-crm-i-messendzhery",
      "article:ai-assistent-po-baze-znaniy",
      "product:product-03",
    ],
  ],
  [
    "ai-assistent-po-baze-znaniy",
    [
      "article:avtomatizatsiya-dokumentov-s-ai",
      "article:kak-avtomatizirovat-obrabotku-zayavok",
      "product:product-01",
    ],
  ],
  [
    "analiz-zvonkov-otdela-prodazh",
    [
      "article:kak-avtomatizirovat-obrabotku-zayavok",
      "article:sayt-crm-i-messendzhery",
      "product:product-05",
    ],
  ],
  [
    "avtomatizatsiya-dokumentov-s-ai",
    [
      "article:ai-assistent-po-baze-znaniy",
      "article:chto-mozhno-avtomatizirovat-na-n8n",
      "product:product-08",
    ],
  ],
  [
    "sayt-crm-i-messendzhery",
    [
      "article:kak-avtomatizirovat-obrabotku-zayavok",
      "article:chto-mozhno-avtomatizirovat-na-n8n",
      "product:product-03",
    ],
  ],
  [
    "chto-mozhno-avtomatizirovat-na-n8n",
    [
      "article:sayt-crm-i-messendzhery",
      "article:avtomatizatsiya-dokumentov-s-ai",
      "product:product-10",
    ],
  ],
];

/** Полный dump baseline: статья, `sort_order`, тип и id цели, роль. */
const BASELINE_DUMP = BASELINE.flatMap(([source, targets]) =>
  targets.map((target, index) => {
    const [targetType, targetId] = target.split(":");
    return {
      source,
      sort_order: index,
      target_type: targetType,
      target_id: targetId,
      relation_role: "related",
    };
  }),
);

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

/** Связи статей в порядке статей файла и `sort_order` — в форме baseline. */
function articleSourceDump(db: DatabaseSync): Row[] {
  return db
    .prepare(
      `SELECT article.slug AS source, relation.sort_order, relation.target_type,
              relation.target_id, relation.relation_role
         FROM content_relations AS relation
         JOIN articles AS article
           ON relation.source_type = 'article' AND article.id = relation.source_id
        ORDER BY article.sort_order, article.id, relation.sort_order`,
    )
    .all() as Row[];
}

function countsByTargetType(db: DatabaseSync): Row[] {
  return db
    .prepare(
      `SELECT source_type, target_type, COUNT(*) AS total FROM content_relations
        GROUP BY source_type, target_type ORDER BY source_type, target_type`,
    )
    .all() as Row[];
}

const TOTAL_ARTICLE_RELATIONS = seedArticlesJson.reduce(
  (total, article) => total + article.relatedSlugs.length,
  0,
);

function expectParityWithBackfill(db: DatabaseSync): void {
  const report = runBackfillArticleRelations(db);
  expect(report.state).toBe("already-applied");
  expect(report.conflicts).toBe(0);
  expect(report.changed).toBe(0);
  expect(report.plannedRelations).toBe(TOTAL_ARTICLE_RELATIONS);
  expect(report.existingArticleRelations).toBe(TOTAL_ARTICLE_RELATIONS);
}

/** Свежий seed — ровно baseline: состав, порядок, счётчики, роль. */
function expectBaseline(db: DatabaseSync): void {
  expect(articleSourceDump(db)).toEqual(BASELINE_DUMP);
  expect(countsByTargetType(db)).toEqual([
    { source_type: "article", target_type: "article", total: 12 },
    { source_type: "article", target_type: "product", total: 6 },
  ]);
  expect(
    Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS total FROM content_relations WHERE source_type = 'article' AND target_type = 'case'",
          )
          .get() as Row
      ).total,
    ),
  ).toBe(0);
}

describe("db-seed: реальный скрипт на временной базе", { timeout: SEED_TIMEOUT }, () => {
  it("seed-данные содержат перелинковку — иначе проверки ниже были бы вакуумными", () => {
    expect(BASELINE_DUMP).toHaveLength(18);
    expect(TOTAL_ARTICLE_RELATIONS).toBe(12);
    expect(seedArticlesJson.every((article) => article.relations.length === 3)).toBe(true);
  });

  it("seed-файл задаёт связи в форме baseline: relations[] по stable id", () => {
    expect(
      seedArticlesJson.map((article) => [
        article.slug,
        article.relations.map((relation) => `${relation.targetType}:${relation.targetId}`),
      ]),
    ).toEqual(BASELINE);
  });

  it("свежая база: ровно baseline 18 связей, related_slugs и backfill в parity", () => {
    runSeed();

    withDatabase((db) => {
      expectBaseline(db);
      expect(allRelations(db).every((row) => row.relation_role === SEED_RELATION_ROLE)).toBe(true);

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

  it("цели продуктов — stable id, а не адрес продукта", () => {
    runSeed();

    const productSlugs = new Set(seedProductsJson.map((product) => product.slug));
    withDatabase((db) => {
      const productTargets = (
        db
          .prepare("SELECT target_id FROM content_relations WHERE target_type = 'product'")
          .all() as Row[]
      ).map((row) => String(row.target_id));

      expect(productTargets).toHaveLength(6);
      expect(productTargets.every((id) => /^product-\d+$/u.test(id))).toBe(true);
      expect(productTargets.some((id) => productSlugs.has(id))).toBe(false);
    });
  });

  it("F.1 backfill на свежем очищенном seed — already-applied без секций и без плана", () => {
    runSeed();

    withDatabase((db) => {
      const report = runBackfillLegacyMaterialRelations(db);
      expect(report.state).toBe("already-applied");
      expect(report.articlesWithSection).toBe(0);
      expect(report.noSection).toBe(seedArticlesJson.length);
      expect(report.plannedProductRelations).toBe(0);
      expect(report.plannedCaseRelations).toBe(0);
      expect(report.changed).toBe(0);
      expect(
        report.ambiguousSections +
          report.unknownUrls +
          report.missingTargets +
          report.unpublishedProducts +
          report.unpublishedCases +
          report.duplicates +
          report.structuralAnomalies +
          report.limitViolations,
      ).toBe(0);
    });
  });

  it("повторный seed не меняет ни одной связи, включая правку владельца", () => {
    runSeed();

    // Правка владельца: у первой статьи со связями удалена одна связь.
    const edited = seedArticlesJson.find((article) => article.relations.length > 0)!;
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

  it("повторный seed без правок — тот же baseline", () => {
    runSeed();
    const before = withDatabase(allRelations);

    runSeed();

    expect(withDatabase(allRelations)).toEqual(before);
    withDatabase(expectBaseline);
  });

  it("--reset снимает связи статей, продуктов и отделов, сохраняет связи между кейсами и повторяет baseline", () => {
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
      // Связи статей seed создаёт заново из relations[], поэтому сверяются только связи с
      // источником не-статьёй: из них после сброса обязана остаться лишь связь кейс → кейс.
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

      expect(articleSourceDump(db)).toEqual(BASELINE_DUMP);
      expectParityWithBackfill(db);
    });
  });

  it("--reset перечисляет поимённо связи отдела, которые seed не создаст заново", () => {
    /**
     * Защита будущих связей SOL-OUT-03. Сброс обязан их снять — таблицы `departments` и `products`
     * он очищает, и оставленная связь стала бы ссылкой в никуда. Но снимать их МОЛЧА он не должен:
     * seed пишет связи только для статей, восстановить department-связи из `data/` нечем, и
     * владелец узнавал бы о пропаже по пустым блокам на страницах отделов.
     *
     * Поэтому проверяется не сохранение строк, а то, что сброс перестал быть тихим: в выводе стоит
     * предупреждение и полная строка каждой снятой связи — источник, цель, роль и порядок, то есть
     * готовый список для повторного ввода.
     */
    runSeed();

    const stamp = "2026-01-01T00:00:00.000Z";
    withDatabase((db) => {
      const insert = db.prepare(
        `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                        relation_role, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("department", "sales", "product", "product-03", "primary", 0, stamp, stamp);
      insert.run("department", "executive", "case", MIGRATED_CASE_ID, "primary", 1, stamp, stamp);
    }, false);

    const { stdout, stderr } = runSeed("--reset");
    const output = `${stdout}\n${stderr}`;

    expect(output).toContain("ВНИМАНИЕ");
    expect(output).toContain("department:sales → product:product-03 (роль primary, порядок 0)");
    expect(output).toContain(
      `department:executive → case:${MIGRATED_CASE_ID} (роль primary, порядок 1)`,
    );

    // Связи статей seed создаёт заново сам, поэтому в предупреждении их быть не должно.
    expect(output).not.toContain("article:");
  });

  it("--reset без связей вручную не печатает предупреждения", () => {
    runSeed();
    const { stdout, stderr } = runSeed("--reset");

    expect(`${stdout}\n${stderr}`).not.toContain("ВНИМАНИЕ");
  });
});

describe("seedArticles: relations[], транзакция и существующие статьи", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    migrations.forEach((migration) => db.exec(migration.sql));
  });

  afterEach(() => {
    db.close();
  });

  type Relation = { targetType: unknown; targetId: unknown };

  /**
   * Seed-статья. `relatedSlugs` по умолчанию выводится из article-связей: идентификатор `id-x`
   * соответствует адресу `x`. Намеренно: идентификатор и адрес различаются, и seed обязан разрешать
   * цель по id, а `relatedSlugs` — по адресу.
   */
  function seedArticle(
    id: string,
    slug: string,
    relations: Relation[] = [],
    options: { relatedSlugs?: unknown[]; status?: string; bodyMarkdown?: string } = {},
  ) {
    return {
      id,
      slug,
      title: `Статья ${slug}`,
      excerpt: "Анонс",
      description: "Описание",
      bodyMarkdown: options.bodyMarkdown ?? "Текст",
      coverUrl: "",
      coverAlt: "",
      placement: "blog",
      category: "Процессы",
      tags: [],
      relatedSlugs:
        options.relatedSlugs ??
        relations
          .filter((relation) => relation.targetType === "article")
          .map((relation) => String(relation.targetId).replace(/^id-/u, "")),
      relations,
      author: "Автор",
      seoTitle: "",
      seoDescription: "",
      status: options.status ?? "published",
      isFeatured: false,
      sortOrder: 0,
      publishedAt: "2026-01-01",
      modifiedAt: "2026-01-01",
    };
  }

  const article = (targetId: string): Relation => ({ targetType: "article", targetId });
  const product = (targetId: string): Relation => ({ targetType: "product", targetId });
  const study = (targetId: string): Relation => ({ targetType: "case", targetId });

  const count = (table: string) =>
    Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as Row).total);

  function addProduct(id: string, slug: string, published = true) {
    db.prepare(
      `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                             is_published, created_at, updated_at)
       VALUES (?, ?, 'Меню', 'Полное', '{}', '{}', '{}', 'alt', ?, '2026-01-01', '2026-01-01')`,
    ).run(id, slug, published ? 1 : 0);
  }

  function addCase(id: string, slug: string, fileNumber: string, status: string) {
    db.prepare(
      `INSERT INTO cases (id, slug, title, short_title, file_number, status, created_at, updated_at)
       VALUES (?, ?, 'Кейс', 'Кейс', ?, ?, '2026-01-01', '2026-01-01')`,
    ).run(id, slug, fileNumber, status);
  }

  const allArticleSourceRelations = () =>
    db
      .prepare(
        `SELECT source_id, target_type, target_id, relation_role, sort_order FROM content_relations
          WHERE source_type = 'article' ORDER BY source_id, sort_order`,
      )
      .all();

  it("пишет идентификаторы в порядке relations: статья, продукт, кейс — sort_order = позиция", () => {
    addProduct("product-uuid-x", "sbor-zayavok");

    const inserted = seedArticles(db, [
      seedArticle("id-a", "a", [
        product("product-uuid-x"),
        article("id-c"),
        study(MIGRATED_CASE_ID),
        article("id-b"),
      ]),
      seedArticle("id-b", "b"),
      seedArticle("id-c", "c", [article("id-a")]),
    ]);

    expect(inserted).toBe(3);
    expect(allArticleSourceRelations()).toEqual([
      {
        source_id: "id-a",
        target_type: "product",
        target_id: "product-uuid-x",
        relation_role: "related",
        sort_order: 0,
      },
      {
        source_id: "id-a",
        target_type: "article",
        target_id: "id-c",
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
      {
        source_id: "id-a",
        target_type: "article",
        target_id: "id-b",
        relation_role: "related",
        sort_order: 3,
      },
      {
        source_id: "id-c",
        target_type: "article",
        target_id: "id-a",
        relation_role: "related",
        sort_order: 0,
      },
    ]);
    // Колонка прежней модели — ровно relatedSlugs.
    expect(
      JSON.parse(
        String(
          (db.prepare("SELECT related_slugs FROM articles WHERE id = 'id-a'").get() as Row)
            .related_slugs,
        ),
      ),
    ).toEqual(["c", "b"]);
  });

  it("legacy-секция в тексте связей не создаёт: источник — только relations", () => {
    addProduct("product-uuid-x", "sbor-zayavok");
    const bodyMarkdown = [
      "**Материалы по теме:**",
      "- «[Продукт](/products/sbor-zayavok)» — пояснение.",
      "- «[Статья b](/blog/b)» — пояснение.",
    ].join("\n");

    seedArticles(db, [seedArticle("id-a", "a", [], { bodyMarkdown }), seedArticle("id-b", "b")]);

    expect(count("articles")).toBe(2);
    expect(count("content_relations")).toBe(0);
  });

  it("адрес вместо идентификатора цели — отказ: цель ищется только по id", () => {
    addProduct("product-uuid-x", "sbor-zayavok");

    expect(() => seedArticles(db, [seedArticle("id-a", "a", [product("sbor-zayavok")])])).toThrow(
      /не найдена/u,
    );
    expect(count("articles")).toBe(0);
    expect(count("content_relations")).toBe(0);
  });

  // Причина отказа по каждому случаю: без неё одно правило маскируется соседним (расхождение с
  // relatedSlugs, ошибка ограничения базы), и снятие проверки проходит незамеченным.
  const REJECTION_REASONS: Record<string, RegExp> = {
    "relations не массив": /relations не является массивом/u,
    "больше 24 связей": /больше 24 связей/u,
    "неизвестная статья по id": /цель «article:id-net» не найдена/u,
    "неизвестный продукт по id": /цель «product:product-net» не найдена/u,
    "неизвестный кейс по id": /цель «case:case-net» не найдена/u,
    "неопубликованная статья": /цель «article:id-b» не опубликована/u,
    "скрытый продукт": /цель «product:product-hidden» не опубликована/u,
    "неопубликованный кейс": /цель «case:case-draft» не опубликована/u,
    "отдел как цель": /недопустимый тип цели «department»/u,
    "неизвестный тип цели": /недопустимый тип цели «document»/u,
    "пустой идентификатор цели": /пустой идентификатор цели на позиции 0/u,
    "ссылка статьи на себя": /ссылается сама на себя/u,
    "повтор type:id": /цель «product:product-uuid-x» указана дважды/u,
    "relatedSlugs: пропущена article-связь": /не совпадают с relatedSlugs/u,
    "relatedSlugs: лишняя article-связь": /не совпадают с relatedSlugs/u,
    "relatedSlugs: другой порядок": /не совпадают с relatedSlugs/u,
    "relatedSlugs: неизвестный адрес": /связанная статья «net-takoy» из relatedSlugs не найдена/u,
    "relatedSlugs: пустой адрес": /пустой адрес в relatedSlugs на позиции 0/u,
  };

  const tooMany = () =>
    Array.from({ length: 25 }, (_, index) => {
      addProduct(`product-many-${index}`, `mnogo-${index}`);
      return product(`product-many-${index}`);
    });

  it.each<[string, () => unknown[]]>([
    ["relations не массив", () => [{ ...seedArticle("id-a", "a"), relations: undefined }]],
    ["больше 24 связей", () => [seedArticle("id-a", "a", tooMany())]],
    [
      "неизвестная статья по id",
      () => [seedArticle("id-a", "a", [article("id-net")], { relatedSlugs: [] })],
    ],
    ["неизвестный продукт по id", () => [seedArticle("id-a", "a", [product("product-net")])]],
    ["неизвестный кейс по id", () => [seedArticle("id-a", "a", [study("case-net")])]],
    [
      "неопубликованная статья",
      () => [
        seedArticle("id-a", "a", [article("id-b")]),
        seedArticle("id-b", "b", [], { status: "draft" }),
      ],
    ],
    [
      "скрытый продукт",
      () => {
        addProduct("product-hidden", "skrytyj", false);
        return [seedArticle("id-a", "a", [product("product-hidden")])];
      },
    ],
    [
      "неопубликованный кейс",
      () => {
        addCase("case-draft", "kejs-chernovik", "90", "draft");
        return [seedArticle("id-a", "a", [study("case-draft")])];
      },
    ],
    [
      "отдел как цель",
      () => [seedArticle("id-a", "a", [{ targetType: "department", targetId: "sales" }])],
    ],
    [
      "неизвестный тип цели",
      () => [seedArticle("id-a", "a", [{ targetType: "document", targetId: "doc-1" }])],
    ],
    [
      "пустой идентификатор цели",
      () => [seedArticle("id-a", "a", [{ targetType: "product", targetId: " " }])],
    ],
    ["ссылка статьи на себя", () => [seedArticle("id-a", "a", [article("id-a")])]],
    [
      "повтор type:id",
      () => {
        addProduct("product-uuid-x", "sbor-zayavok");
        return [seedArticle("id-a", "a", [product("product-uuid-x"), product("product-uuid-x")])];
      },
    ],
    [
      "relatedSlugs: пропущена article-связь",
      () => [
        seedArticle("id-a", "a", [article("id-b")], { relatedSlugs: ["b", "c"] }),
        seedArticle("id-b", "b"),
        seedArticle("id-c", "c"),
      ],
    ],
    [
      "relatedSlugs: лишняя article-связь",
      () => [
        seedArticle("id-a", "a", [article("id-b"), article("id-c")], { relatedSlugs: ["b"] }),
        seedArticle("id-b", "b"),
        seedArticle("id-c", "c"),
      ],
    ],
    [
      "relatedSlugs: другой порядок",
      () => [
        seedArticle("id-a", "a", [article("id-b"), article("id-c")], { relatedSlugs: ["c", "b"] }),
        seedArticle("id-b", "b"),
        seedArticle("id-c", "c"),
      ],
    ],
    [
      "relatedSlugs: неизвестный адрес",
      () => [
        seedArticle("id-a", "a", [], { relatedSlugs: ["net-takoy"] }),
        seedArticle("id-b", "b"),
      ],
    ],
    ["relatedSlugs: пустой адрес", () => [seedArticle("id-a", "a", [], { relatedSlugs: [""] })]],
  ])("%s — исключение и откат всего блока статей", (label, build) => {
    const reason = REJECTION_REASONS[label];
    expect(reason).toBeInstanceOf(RegExp);
    const articles = build();
    const productsBefore = count("products");

    expect(() => seedArticles(db, articles as Parameters<typeof seedArticles>[1])).toThrow(reason);
    expect(count("articles")).toBe(0);
    expect(count("content_relations")).toBe(0);
    expect(count("products")).toBe(productsBefore);
  });

  it("не пишет связи для статьи, которая уже была в базе", () => {
    addProduct("product-uuid-x", "sbor-zayavok");
    seedArticles(db, [seedArticle("id-a", "a"), seedArticle("id-b", "b")]);

    const inserted = seedArticles(db, [
      seedArticle("id-a", "a", [article("id-b"), product("product-uuid-x")]),
      seedArticle("id-b", "b"),
      seedArticle("id-c", "c", [article("id-b")]),
    ]);

    expect(inserted).toBe(1);
    expect(allArticleSourceRelations()).toEqual([
      {
        source_id: "id-c",
        target_type: "article",
        target_id: "id-b",
        relation_role: "related",
        sort_order: 0,
      },
    ]);
  });
});
