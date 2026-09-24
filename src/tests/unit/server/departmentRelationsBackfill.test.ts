import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrations } from "@/server/db/schema.mjs";
import {
  MANIFEST,
  SOURCE_TYPE,
  buildPlan,
  buildRollbackPlan,
  checkSchema,
  exitCodeFor,
  parseMode,
  problemCount,
  runBackfillDepartmentRelations,
  runRollbackDepartmentRelations,
} from "../../../../scripts/backfill-department-relations.mjs";

/**
 * Backfill 11 утверждённых связей отдела (SOL-OUT-03).
 *
 * База НАСТОЯЩАЯ, в памяти, с полным набором миграций: проверяется состояние таблицы после прогона,
 * а не факт вызова функций. Пользовательская `var/content.db` не открывается, production не
 * читается и не изменяется — скрипту база передаётся аргументом, поэтому подменять пути не нужно.
 *
 * Материалы заводятся прямым INSERT: проверяется backfill, и репозитории продуктов, кейсов и
 * отделов не должны быть его зависимостью. Идентификаторы целей — настоящие, из утверждённого
 * манифеста: тест, работающий на выдуманных id, не доказал бы ничего о самом манифесте.
 */

const NOW = "2026-09-24T10:00:00.000Z";
const LATER = "2026-09-25T10:00:00.000Z";

/** Кейсы манифеста: идентификатор и адрес, подтверждённые на production 2026-09-24. */
const CASE_LEADS = {
  id: "e71a2753-4034-4984-823c-276d11b6d3d4",
  slug: "sbor-zayavok-v-crm",
  fileNumber: "02",
};
const CASE_CALLS = {
  id: "case-sales-call-analysis",
  slug: "analiz-zvonkov-otdela-prodazh",
  fileNumber: "01",
};

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  migrations.forEach((migration) => db.exec(migration.sql));
});

afterEach(() => {
  db.close();
});

/**
 * Пять отделов, восемь продуктов и оба кейса — ровно то, чего требует манифест.
 *
 * Миграция 0003 уже переносит в базу кейс `case-sales-call-analysis`, поэтому второй раз он не
 * заводится: `id`, `slug` и `file_number` у него UNIQUE.
 */
function seedTargets(options: { publishedProduct?: string[]; publishedCase?: string[] } = {}) {
  const hidden = new Set(options.publishedProduct ?? []);
  const hiddenCases = new Set(options.publishedCase ?? []);

  const insertDepartment = db.prepare(
    `INSERT INTO departments (id, display_name, content, is_published, created_at, updated_at)
     VALUES (?, ?, '{}', 1, ?, ?)`,
  );
  for (const [id, name] of [
    ["sales", "Продажи"],
    ["support", "Поддержка"],
    ["executive", "Дирекция"],
    ["hr", "HR"],
    ["logistics", "Логистика"],
  ] as const) {
    insertDepartment.run(id, name, NOW, NOW);
  }

  const insertProduct = db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', 'wide', 'sales', 'Иллюстрация', ?, ?, ?)`,
  );
  for (const number of ["01", "02", "03", "04", "05", "06", "07", "10"]) {
    const id = `product-${number}`;
    insertProduct.run(
      id,
      `produkt-${number}`,
      `Меню ${number}`,
      `Продукт ${number}`,
      hidden.has(id) ? 0 : 1,
      NOW,
      NOW,
    );
  }

  // Кейс дела № 01 уже перенесён миграцией 0003 — здесь только приводим его статус к нужному.
  db.prepare("UPDATE cases SET status = ? WHERE id = ?").run(
    hiddenCases.has(CASE_CALLS.id) ? "draft" : "published",
    CASE_CALLS.id,
  );

  db.prepare(
    `INSERT INTO cases (id, slug, title, short_title, file_number, status, created_at, updated_at)
     VALUES (?, ?, 'Автоматический сбор заявок в CRM', 'Сбор заявок в CRM', ?, ?, ?, ?)`,
  ).run(
    CASE_LEADS.id,
    CASE_LEADS.slug,
    CASE_LEADS.fileNumber,
    hiddenCases.has(CASE_LEADS.id) ? "draft" : "published",
    NOW,
    NOW,
  );
}

/** Связь статьи — сторож чужих данных: backfill не имеет права её коснуться. */
function seedArticleRelation() {
  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, status,
                           created_at, updated_at)
     VALUES ('article-a', 'statya', 'Статья', 'Анонс.', 'Текст.', 'blog', 'published', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                    relation_role, sort_order, created_at, updated_at)
     VALUES ('article', 'article-a', 'product', 'product-03', 'related', 7, ?, ?)`,
  ).run(NOW, NOW);
}

function departmentRows() {
  return db
    .prepare(
      `SELECT source_id, target_type, target_id, relation_role, sort_order, created_at, updated_at
         FROM content_relations
        WHERE source_type = ?
        ORDER BY source_id ASC, sort_order ASC, target_type ASC, target_id ASC`,
    )
    .all(SOURCE_TYPE);
}

function foreignRows() {
  return db
    .prepare(
      `SELECT source_type, source_id, target_type, target_id, relation_role, sort_order,
              created_at, updated_at
         FROM content_relations
        WHERE source_type <> ?
        ORDER BY source_id ASC, target_id ASC`,
    )
    .all(SOURCE_TYPE);
}

function apply() {
  return runBackfillDepartmentRelations(db, { apply: true, now: () => NOW });
}

describe("манифест SOL-OUT-03", () => {
  it("содержит ровно 11 утверждённых связей без дублей целей", () => {
    expect(MANIFEST).toHaveLength(11);

    const keys = MANIFEST.map(
      (relation) => `${relation.sourceId}|${relation.targetType}|${relation.targetId}`,
    );
    expect(new Set(keys).size).toBe(11);
  });

  it("использует executive как source_id страницы /solutions/management", () => {
    /**
     * Дирекция — единственный отдел, у которого идентификатор и сегмент адреса не совпадают.
     * Подстановка `management` дала бы ссылку на несуществующий отдел, и заметить это было бы
     * некому: остальные четыре отдела работали бы.
     */
    const sources = new Set(MANIFEST.map((relation) => relation.sourceId));

    expect(sources.has("executive")).toBe(true);
    expect(sources.has("management")).toBe(false);
    expect([...sources].sort()).toEqual(["executive", "hr", "logistics", "sales", "support"]);

    const executive = MANIFEST.filter((relation) => relation.sourceId === "executive");
    expect(executive.map((relation) => relation.targetId)).toEqual([
      "product-05",
      "product-07",
      "case-sales-call-analysis",
    ]);
  });

  it("роли и порядок совпадают с утверждёнными значениями", () => {
    expect(
      MANIFEST.map((relation) => [
        relation.sourceId,
        relation.targetId,
        relation.role,
        relation.sortOrder,
      ]),
    ).toEqual([
      ["sales", "product-03", "primary", 10],
      ["sales", "product-04", "related", 20],
      ["sales", CASE_LEADS.id, "primary", 30],
      ["support", "product-01", "primary", 10],
      ["support", "product-02", "related", 20],
      ["executive", "product-05", "primary", 10],
      ["executive", "product-07", "related", 20],
      ["executive", CASE_CALLS.id, "primary", 30],
      ["hr", "product-06", "primary", 10],
      ["hr", "product-01", "related", 20],
      ["logistics", "product-10", "primary", 10],
    ]);
  });

  it("адрес указан у кейсов и проверяется, у продуктов — нет", () => {
    const withSlug = MANIFEST.filter((relation) => relation.expectedSlug);

    expect(withSlug).toHaveLength(2);
    expect(withSlug.map((relation) => [relation.targetId, relation.expectedSlug])).toEqual([
      [CASE_LEADS.id, CASE_LEADS.slug],
      [CASE_CALLS.id, CASE_CALLS.slug],
    ]);
  });
});

describe("схема content_relations", () => {
  it("соответствует ожиданиям скрипта", () => {
    expect(checkSchema(db)).toEqual([]);
  });

  it("отсутствие таблицы останавливает операцию до любых запросов", () => {
    db.exec("DROP TABLE content_relations");

    expect(checkSchema(db)).toEqual(["таблицы content_relations не существует"]);

    const report = runBackfillDepartmentRelations(db, { apply: true, now: () => NOW });
    expect(report.state).toBe("blocked");
    expect(exitCodeFor(report.state)).toBe(1);
  });
});

describe("dry-run", () => {
  it("не изменяет ни одной таблицы и показывает полный план", () => {
    seedTargets();
    seedArticleRelation();
    const foreignBefore = foreignRows();

    const report = runBackfillDepartmentRelations(db, { now: () => NOW });

    expect(report.mode).toBe("dry-run");
    expect(report.state).toBe("ready");
    expect(report.changed).toBe(0);
    expect(report.planned).toEqual({ insert: 11, update: 0, unchanged: 0 });
    expect(report.expectedTotalAfterApply).toBe(11);
    expect(report.plan).toHaveLength(11);

    // Главное: база не тронута.
    expect(departmentRows()).toEqual([]);
    expect(foreignRows()).toEqual(foreignBefore);
  });

  it("dry-run на уже применённом состоянии сообщает already-applied", () => {
    seedTargets();
    apply();

    const report = runBackfillDepartmentRelations(db, { now: () => LATER });

    expect(report.state).toBe("already-applied");
    expect(report.planned).toEqual({ insert: 0, update: 0, unchanged: 11 });
  });
});

describe("apply", () => {
  it("создаёт ровно 11 связей с точными ролями и порядком", () => {
    seedTargets();

    const report = apply();

    expect(report.state).toBe("applied");
    expect(report.changed).toBe(11);
    expect(exitCodeFor(report.state)).toBe(0);

    const rows = departmentRows();
    expect(rows).toHaveLength(11);

    const actual = rows.map((row) => [
      String(row.source_id),
      String(row.target_type),
      String(row.target_id),
      String(row.relation_role),
      Number(row.sort_order),
    ]);
    const expected = MANIFEST.map((relation) => [
      relation.sourceId,
      relation.targetType,
      relation.targetId,
      relation.role,
      relation.sortOrder,
    ]).sort();

    expect([...actual].sort()).toEqual(expected);
  });

  it("повторный apply идемпотентен: ничего не меняется и метки времени прежние", () => {
    seedTargets();
    apply();
    const after = departmentRows();

    const second = runBackfillDepartmentRelations(db, { apply: true, now: () => LATER });

    expect(second.state).toBe("already-applied");
    expect(second.changed).toBe(0);
    // Идемпотентность именно по данным: `updated_at` не переписан «на всякий случай».
    expect(departmentRows()).toEqual(after);
  });

  it("исправляет роль и порядок существующей связи манифеста, не удаляя строку", () => {
    seedTargets();
    db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('department', 'sales', 'product', 'product-03', 'related', 99, ?, ?)`,
    ).run(NOW, NOW);

    const report = runBackfillDepartmentRelations(db, { apply: true, now: () => LATER });

    expect(report.state).toBe("applied");
    expect(report.planned).toEqual({ insert: 10, update: 1, unchanged: 0 });

    const corrected = departmentRows().find(
      (row) => String(row.source_id) === "sales" && String(row.target_id) === "product-03",
    );
    expect(String(corrected?.relation_role)).toBe("primary");
    expect(Number(corrected?.sort_order)).toBe(10);
    // Связь ИСПРАВЛЕНА, а не заведена заново: дата создания прежняя.
    expect(String(corrected?.created_at)).toBe(NOW);
    expect(String(corrected?.updated_at)).toBe(LATER);
  });

  it("не трогает связи статей", () => {
    seedTargets();
    seedArticleRelation();
    const before = foreignRows();

    apply();

    expect(foreignRows()).toEqual(before);
    expect(before).toHaveLength(1);
  });
});

describe("STOP: проверки до записи", () => {
  it("отсутствующий продукт останавливает операцию без единой записи", () => {
    seedTargets();
    db.prepare("DELETE FROM products WHERE id = 'product-07'").run();

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.missingTarget).toEqual(["product:product-07"]);
    expect(departmentRows()).toEqual([]);
  });

  it("отсутствующий отдел останавливает операцию", () => {
    seedTargets();
    db.prepare("DELETE FROM departments WHERE id = 'executive'").run();

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.missingDepartment).toEqual(["executive"]);
    expect(departmentRows()).toEqual([]);
  });

  it("отсутствующий кейс останавливает операцию", () => {
    seedTargets();
    db.prepare("DELETE FROM cases WHERE id = ?").run(CASE_LEADS.id);

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.missingTarget).toEqual([`case:${CASE_LEADS.id}`]);
    expect(departmentRows()).toEqual([]);
  });

  it("несовпадение id кейса и утверждённого адреса останавливает операцию", () => {
    /**
     * Самая опасная из возможных ошибок манифеста: идентификатор существует, цель опубликована, и
     * молча встала бы карточка чужого кейса. Поэтому у кейсов сверяются ОБЕ стороны.
     */
    seedTargets();
    db.prepare("UPDATE cases SET slug = 'sovsem-drugoy-keys' WHERE id = ?").run(CASE_LEADS.id);

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.slugMismatch).toHaveLength(1);
    expect(report.problems.slugMismatch[0]).toContain(CASE_LEADS.id);
    expect(report.problems.slugMismatch[0]).toContain(CASE_LEADS.slug);
    expect(departmentRows()).toEqual([]);
  });

  it("неопубликованный продукт останавливает операцию", () => {
    seedTargets({ publishedProduct: ["product-01"] });

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.unpublishedTarget).toEqual(["product:product-01", "product:product-01"]);
    expect(departmentRows()).toEqual([]);
  });

  it("неопубликованный кейс останавливает операцию", () => {
    seedTargets({ publishedCase: [CASE_CALLS.id] });

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.unpublishedTarget).toEqual([`case:${CASE_CALLS.id}`]);
    expect(departmentRows()).toEqual([]);
  });

  it("посторонняя department-связь вызывает STOP и сохраняется нетронутой", () => {
    seedTargets();
    db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('department', 'hr', 'product', 'product-02', 'related', 40, ?, ?)`,
    ).run(NOW, NOW);

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.unknownRelation).toHaveLength(1);
    expect(report.problems.unknownRelation[0]).toContain("hr → product:product-02");
    expect(exitCodeFor(report.state)).toBe(1);

    /**
     * Чужая связь остаётся ровно там, где была: скрипт не удаляет её и не «приводит к манифесту».
     * Манифест описывает, что ДОЛЖНО быть, а не что должно остаться единственным.
     */
    const rows = departmentRows();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].target_id)).toBe("product-02");
    expect(Number(rows[0].sort_order)).toBe(40);
  });

  it("две роли на одну цель — аномалия, операция останавливается", () => {
    seedTargets();
    const insert = db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('department', 'sales', 'product', 'product-03', ?, ?, ?, ?)`,
    );
    insert.run("primary", 10, NOW, NOW);
    insert.run("related", 20, NOW, NOW);

    const report = apply();

    expect(report.state).toBe("blocked");
    expect(report.problems.duplicateRelation).toHaveLength(1);
    expect(departmentRows()).toHaveLength(2);
  });

  it("problemCount считает все виды препятствий", () => {
    seedTargets();
    db.prepare("DELETE FROM products WHERE id = 'product-10'").run();
    db.prepare("DELETE FROM departments WHERE id = 'hr'").run();

    const { problems } = buildPlan(db);
    expect(problemCount(problems)).toBe(2);
  });
});

describe("транзакция", () => {
  it("ошибка посередине откатывает всё: ни одной связи не остаётся", () => {
    /**
     * Моделируется отказ ПОСЛЕ части записей — десять связей уже вставлены, одиннадцатая падает.
     * Перехватывается подготовленный statement, а не `db.prepare`: скрипт готовит `INSERT` один
     * раз и вызывает `run()` в цикле, поэтому счётчик на `prepare` никогда не дошёл бы до
     * одиннадцати и тест был бы вакуумным.
     */
    seedTargets();
    seedArticleRelation();
    const foreignBefore = foreignRows();

    const originalPrepare = db.prepare.bind(db);
    let inserts = 0;

    db.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);
      if (!sql.includes("INSERT INTO content_relations")) return statement;

      return {
        ...statement,
        run: (...args: unknown[]) => {
          inserts += 1;
          if (inserts === 11) throw new Error("сбой на одиннадцатой связи");
          return (statement.run as (...values: unknown[]) => unknown)(...args);
        },
      };
    }) as unknown as typeof db.prepare;

    try {
      expect(() => apply()).toThrow(/сбой на одиннадцатой связи/u);
    } finally {
      db.prepare = originalPrepare;
    }

    // Десять вставок уже прошли внутри транзакции — доказывается именно ОТКАТ, а не отказ до начала.
    expect(inserts).toBe(11);
    expect(departmentRows()).toEqual([]);
    expect(foreignRows()).toEqual(foreignBefore);
  });

  it("сбой итоговой сверки тоже откатывает запись целиком", () => {
    /**
     * Второй рубеж: строки записаны без ошибок, но итоговая сверка нашла расхождение. Здесь оно
     * создаётся искусственно — вставкой лишней department-связи прямо во время прогона, между
     * последней записью и проверкой.
     */
    seedTargets();
    const originalPrepare = db.prepare.bind(db);
    let inserts = 0;

    db.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);
      if (!sql.includes("INSERT INTO content_relations")) return statement;

      return {
        ...statement,
        run: (...args: unknown[]) => {
          const result = (statement.run as (...values: unknown[]) => unknown)(...args);
          inserts += 1;
          if (inserts === MANIFEST.length) {
            originalPrepare(
              `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                              relation_role, sort_order, created_at, updated_at)
               VALUES ('department', 'hr', 'case', ?, 'related', 90, ?, ?)`,
            ).run(CASE_LEADS.id, NOW, NOW);
          }
          return result;
        },
      };
    }) as unknown as typeof db.prepare;

    try {
      expect(() => apply()).toThrow(/после записи связей отдела/u);
    } finally {
      db.prepare = originalPrepare;
    }

    expect(departmentRows()).toEqual([]);
  });
});

describe("разбор режима", () => {
  it("--apply вместе с --rollback — ошибка до всякого обращения к базе", () => {
    /**
     * Проверяется ЧИСТАЯ функция, а не запуск скрипта: она и существует ради того, чтобы
     * противоречие остановило прогон ДО `new DatabaseSync(...)`. Никакого дескриптора на запись к
     * моменту отказа не возникает — тест доказывает это тем, что базу для него заводить не нужно
     * вовсе.
     */
    expect(() => parseMode(["--apply", "--rollback"])).toThrow(/взаимоисключающие/u);
    expect(() => parseMode(["--rollback", "--apply"])).toThrow(/взаимоисключающие/u);
  });

  it("одиночные флаги и их отсутствие дают три режима", () => {
    expect(parseMode([])).toBe("dry-run");
    expect(parseMode(["--apply"])).toBe("apply");
    expect(parseMode(["--rollback"])).toBe("rollback");
  });
});

describe("rollback", () => {
  it("снимает ровно 11 строк манифеста после apply", () => {
    seedTargets();
    apply();
    expect(departmentRows()).toHaveLength(11);

    const report = runRollbackDepartmentRelations(db);

    expect(report.mode).toBe("rollback");
    expect(report.state).toBe("rolled-back");
    expect(report.removed).toBe(11);
    expect(report.alreadyAbsent).toBe(0);
    expect(report.changed).toBe(11);
    expect(report.expectedTotalAfterRollback).toBe(0);
    expect(exitCodeFor(report.state)).toBe(0);

    expect(departmentRows()).toEqual([]);
  });

  it("сохраняет чужие department-связи и связи статей", () => {
    seedTargets();
    seedArticleRelation();
    apply();

    // Сосед: department-связь, которой нет в манифесте. Откат не имеет права её трогать.
    db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('department', 'hr', 'product', 'product-02', 'related', 40, ?, ?)`,
    ).run(NOW, NOW);

    const foreignBefore = foreignRows();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("rolled-back");
    expect(report.removed).toBe(11);
    // Соседняя строка учтена в остатке, а не снесена заодно.
    expect(report.expectedTotalAfterRollback).toBe(1);

    const left = departmentRows();
    expect(left).toHaveLength(1);
    expect(String(left[0].source_id)).toBe("hr");
    expect(String(left[0].target_id)).toBe("product-02");
    expect(Number(left[0].sort_order)).toBe(40);

    expect(foreignRows()).toEqual(foreignBefore);
    expect(foreignBefore).toHaveLength(1);
  });

  it("повторный rollback ничего не меняет", () => {
    seedTargets();
    seedArticleRelation();
    apply();
    runRollbackDepartmentRelations(db);

    const foreignBefore = foreignRows();
    const second = runRollbackDepartmentRelations(db);

    expect(second.state).toBe("already-absent");
    expect(second.removed).toBe(0);
    expect(second.changed).toBe(0);
    expect(second.alreadyAbsent).toBe(11);
    expect(exitCodeFor(second.state)).toBe(0);

    expect(departmentRows()).toEqual([]);
    expect(foreignRows()).toEqual(foreignBefore);
  });

  it("на пустой базе связей rollback сразу успешен и идемпотентен", () => {
    seedTargets();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("already-absent");
    expect(report.removed).toBe(0);
    expect(report.alreadyAbsent).toBe(11);
    expect(departmentRows()).toEqual([]);
  });

  it("частично снятый манифест доснимается: остальные строки удаляются", () => {
    /**
     * Требование «отсутствующая строка допустима»: она показывается как `already-absent`, а
     * остальные утверждённые строки снимаются. Именно это делает откат довершаемым после прерывания.
     */
    seedTargets();
    apply();
    db.prepare(
      `DELETE FROM content_relations
        WHERE source_type = 'department' AND source_id = 'logistics'`,
    ).run();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("rolled-back");
    expect(report.removed).toBe(10);
    expect(report.alreadyAbsent).toBe(1);
    expect(
      report.plan.filter((entry: { action: string }) => entry.action === "already-absent"),
    ).toEqual([
      expect.objectContaining({ source: "department:logistics", target: "product:product-10" }),
    ]);
    expect(departmentRows()).toEqual([]);
  });

  it("изменённая роль строки манифеста — STOP без единого удаления", () => {
    seedTargets();
    apply();
    db.prepare(
      `UPDATE content_relations SET relation_role = 'related'
        WHERE source_type = 'department' AND source_id = 'sales'
          AND target_type = 'product' AND target_id = 'product-03'
          AND relation_role = 'primary'`,
    ).run();
    const before = departmentRows();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("blocked");
    expect(report.removed).toBe(0);
    expect(report.problems.modifiedRelation).toHaveLength(1);
    expect(report.problems.modifiedRelation[0]).toContain("sales → product:product-03");
    expect(exitCodeFor(report.state)).toBe(1);

    // Ни одна строка не тронута — включая те десять, что совпадали с манифестом.
    expect(departmentRows()).toEqual(before);
    expect(before).toHaveLength(11);
  });

  it("изменённый sort_order строки манифеста — STOP без единого удаления", () => {
    seedTargets();
    apply();
    db.prepare(
      `UPDATE content_relations SET sort_order = 99
        WHERE source_type = 'department' AND source_id = 'executive'
          AND target_type = 'case' AND target_id = ?`,
    ).run(CASE_CALLS.id);
    const before = departmentRows();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("blocked");
    expect(report.problems.modifiedRelation).toHaveLength(1);
    expect(report.problems.modifiedRelation[0]).toContain(CASE_CALLS.id);
    expect(departmentRows()).toEqual(before);
  });

  it("две роли на одну цель — STOP и при откате", () => {
    seedTargets();
    apply();
    db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('department', 'sales', 'product', 'product-03', 'related', 10, ?, ?)`,
    ).run(NOW, NOW);
    const before = departmentRows();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("blocked");
    expect(report.problems.duplicateRelation).toHaveLength(1);
    expect(departmentRows()).toEqual(before);
  });

  it("существование и публикация целей откату не нужны", () => {
    /**
     * Отличие от переноса, и оно содержательное: после удаления продукта связь на него стала
     * ссылкой в никуда. Требовать существования цели значило бы блокировать уборку ровно тогда,
     * когда она нужнее всего.
     */
    seedTargets();
    apply();
    db.prepare("UPDATE products SET is_published = 0 WHERE id = 'product-01'").run();
    db.prepare("DELETE FROM products WHERE id = 'product-10'").run();

    const report = runRollbackDepartmentRelations(db);

    expect(report.state).toBe("rolled-back");
    expect(report.removed).toBe(11);
    expect(departmentRows()).toEqual([]);
  });

  it("сбой посередине откатывает удаление целиком", () => {
    seedTargets();
    seedArticleRelation();
    apply();
    const before = departmentRows();
    const foreignBefore = foreignRows();

    const originalPrepare = db.prepare.bind(db);
    let deletes = 0;

    db.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);
      if (!sql.includes("DELETE FROM content_relations")) return statement;

      return {
        ...statement,
        run: (...args: unknown[]) => {
          deletes += 1;
          if (deletes === 6) throw new Error("сбой на шестой связи");
          return (statement.run as (...values: unknown[]) => unknown)(...args);
        },
      };
    }) as unknown as typeof db.prepare;

    try {
      expect(() => runRollbackDepartmentRelations(db)).toThrow(/сбой на шестой связи/u);
    } finally {
      db.prepare = originalPrepare;
    }

    // Пять удалений уже прошли внутри транзакции — доказывается именно откат.
    expect(deletes).toBe(6);
    expect(departmentRows()).toEqual(before);
    expect(foreignRows()).toEqual(foreignBefore);
  });

  it("buildRollbackPlan различает remove, already-absent и modified", () => {
    seedTargets();
    apply();
    db.prepare(
      `DELETE FROM content_relations
        WHERE source_type = 'department' AND source_id = 'logistics'`,
    ).run();
    db.prepare(
      `UPDATE content_relations SET sort_order = 77
        WHERE source_type = 'department' AND source_id = 'hr' AND target_id = 'product-06'`,
    ).run();

    const { plan, problems } = buildRollbackPlan(db);

    const counts = (plan as { action: string }[]).reduce<Record<string, number>>((total, entry) => {
      total[entry.action] = (total[entry.action] ?? 0) + 1;
      return total;
    }, {});

    expect(counts).toEqual({ remove: 9, "already-absent": 1, modified: 1 });
    expect(problemCount(problems)).toBe(1);
  });
});
