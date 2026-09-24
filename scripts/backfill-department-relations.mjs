import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";

/**
 * Перелинковка страниц отделов: 11 утверждённых связей `department → product|case` (SOL-OUT-03).
 *
 * ПОЧЕМУ СКРИПТ, А НЕ МИГРАЦИЯ. Ровно по тем же причинам, что у `backfill-article-relations.mjs`:
 * миграции применяются автоматически при первом обращении к базе, то есть при старте приложения, и
 * после выката неизменяемы. Переносу данных обе эти черты противопоказаны — ему нужен прогон
 * «показать и не трогать», разбор отчёта человеком и возможность отказаться, а отказ внутри
 * `applyMigrations()` означал бы, что сайт не поднимается. Схема шагом не меняется вовсе: миграция
 * `0004_content_relations` уже допускает источник `department` и цели `product`/`case`.
 *
 * ЧТО СКРИПТ НЕ ДЕЛАЕТ НИКОГДА:
 *
 * - не выполняет `DELETE` — ни общего по `source_type = 'department'`, ни какого-либо другого. Ни
 *   одной строки из таблицы он не удаляет даже при исправлении роли (см. ниже);
 * - не трогает связи статей и вообще ничего, чей `source_type` не `department`. Это проверяется не
 *   намерением, а сверкой дампа посторонних связей до и после записи ВНУТРИ транзакции;
 * - не пишет в `articles`, `products`, `cases` и `departments`;
 * - не заводит ни одной связи сверх манифеста: список закрытый и лежит здесь константой.
 *
 * ПОЧЕМУ ИСПРАВЛЕНИЕ РОЛИ — ЭТО UPDATE, А НЕ DELETE+INSERT. `relation_role` входит в первичный ключ
 * (`source_type, source_id, target_type, target_id, relation_role`), поэтому смена роли — это смена
 * значения ключевой колонки. Выполняется она адресным `UPDATE … WHERE` по ПОЛНОМУ старому ключу:
 * такой запрос физически не может задеть чужую строку. Конфликт ключа при этом исключён заранее —
 * две строки на одну цель у одного отдела скрипт считает аномалией и отказывается работать.
 *
 * ОТКАЗ ЦЕЛИКОМ, А НЕ ЧАСТЬЮ. Любая непройденная проверка отменяет прогон полностью. Записать
 * девять связей и промолчать про две означало бы оставить базу в состоянии, которое нельзя описать
 * одной фразой.
 *
 * @typedef {"ready" | "applied" | "already-applied" | "blocked"} BackfillState
 */

/** Источник всех связей манифеста. Целями бывают только продукт и кейс. */
export const SOURCE_TYPE = "department";

/**
 * УТВЕРЖДЁННЫЙ МАНИФЕСТ (руководитель, 2026-09-24). Закрытый список: 11 строк, ни одной сверх.
 *
 * `sourceId` — СИСТЕМНЫЙ идентификатор отдела, а не сегмент адреса. У дирекции это `executive`,
 * тогда как её страница живёт по адресу `/solutions/management`. Это не опечатка: идентификатор —
 * первичный ключ, сегмент адреса — публичное слово, и отображение между ними задано таблицей
 * `SOLUTION_PATH_BY_DEPARTMENT_ID` в `src/content/solutionPaths.ts`. Подставить сюда `management`
 * значило бы сослаться на несуществующий отдел, и скрипт остановится с `missing_department`.
 *
 * `expectedSlug` есть ТОЛЬКО у кейсов, и это следствие того, как составлен манифест: продукты в нём
 * названы идентификаторами (`product-03`), а кейсы — адресами, к которым идентификаторы подобраны
 * отдельно. Значит у кейса проверяемы обе стороны соответствия, и проверять их обязательно: перепутанный
 * идентификатор кейса дал бы карточку с чужим названием, и заметить это было бы некому. У продукта
 * второй стороны просто нет — адрес продукта владелец меняет из админ-панели, и требовать его
 * совпадения значило бы ломать backfill при законном переименовании.
 *
 * `sortOrder` — 10/20/30, а не 0/1/2: между утверждёнными позициями остаётся место, чтобы вставить
 * материал в середину, не переписывая весь список.
 */
export const MANIFEST = Object.freeze([
  {
    sourceId: "sales",
    targetType: "product",
    targetId: "product-03",
    role: "primary",
    sortOrder: 10,
  },
  {
    sourceId: "sales",
    targetType: "product",
    targetId: "product-04",
    role: "related",
    sortOrder: 20,
  },
  {
    sourceId: "sales",
    targetType: "case",
    targetId: "e71a2753-4034-4984-823c-276d11b6d3d4",
    expectedSlug: "sbor-zayavok-v-crm",
    role: "primary",
    sortOrder: 30,
  },

  {
    sourceId: "support",
    targetType: "product",
    targetId: "product-01",
    role: "primary",
    sortOrder: 10,
  },
  {
    sourceId: "support",
    targetType: "product",
    targetId: "product-02",
    role: "related",
    sortOrder: 20,
  },

  {
    sourceId: "executive",
    targetType: "product",
    targetId: "product-05",
    role: "primary",
    sortOrder: 10,
  },
  {
    sourceId: "executive",
    targetType: "product",
    targetId: "product-07",
    role: "related",
    sortOrder: 20,
  },
  {
    sourceId: "executive",
    targetType: "case",
    targetId: "case-sales-call-analysis",
    expectedSlug: "analiz-zvonkov-otdela-prodazh",
    role: "primary",
    sortOrder: 30,
  },

  { sourceId: "hr", targetType: "product", targetId: "product-06", role: "primary", sortOrder: 10 },
  { sourceId: "hr", targetType: "product", targetId: "product-01", role: "related", sortOrder: 20 },

  {
    sourceId: "logistics",
    targetType: "product",
    targetId: "product-10",
    role: "primary",
    sortOrder: 10,
  },
]);

/**
 * Ключ ЦЕЛИ связи — без роли и без порядка.
 *
 * Роль в ключ не входит намеренно: связь «отдел ссылается на этот продукт» существует в одном
 * экземпляре независимо от того, какая у неё роль, и именно по такому ключу строка манифеста
 * сопоставляется с уже лежащей в базе. Если бы роль входила в ключ, изменение роли выглядело бы как
 * «одна связь лишняя, другой не хватает», и скрипт вместо исправления потребовал бы вмешательства.
 *
 * Разделитель — символ, который не может встретиться в идентификаторе.
 */
const targetKey = (relation) =>
  [relation.sourceId, relation.targetType, relation.targetId].join("\u0000");

/** Условие публикации цели — то же, при котором её публичная страница отвечает 200, а не 404. */
const PUBLISHED_CONDITION = Object.freeze({
  product: "is_published = 1",
  case: "status = 'published'",
});

const TARGET_TABLE = Object.freeze({ product: "products", case: "cases" });

/**
 * Схема таблицы связей в том виде, на который скрипт рассчитывает.
 *
 * Проверяется через `PRAGMA`, а не сверкой текста `CREATE TABLE`: текст миграции может законно
 * измениться комментарием или переносом строки, а состав колонок и первичный ключ — нет. Скрипт,
 * который пишет в таблицу по угаданной форме, опаснее скрипта, который отказался работать.
 */
const EXPECTED_COLUMNS = Object.freeze([
  "source_type",
  "source_id",
  "target_type",
  "target_id",
  "relation_role",
  "sort_order",
  "created_at",
  "updated_at",
]);

const EXPECTED_PRIMARY_KEY = Object.freeze([
  "source_type",
  "source_id",
  "target_type",
  "target_id",
  "relation_role",
]);

/** @returns {string[]} расхождения схемы; пустой массив — схема та, что ожидается. */
export function checkSchema(db) {
  const problems = [];

  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content_relations'")
    .get();
  if (!table) return ["таблицы content_relations не существует"];

  const columns = db.prepare("PRAGMA table_info(content_relations)").all();
  const names = columns.map((column) => String(column.name));

  for (const expected of EXPECTED_COLUMNS) {
    if (!names.includes(expected)) problems.push(`нет колонки ${expected}`);
  }

  /**
   * Порядок колонок первичного ключа значим: по нему построен индекс, и от него зависит, что
   * адресный `UPDATE` попадает ровно в одну строку.
   */
  const primaryKey = columns
    .filter((column) => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map((column) => String(column.name));

  if (primaryKey.join(",") !== EXPECTED_PRIMARY_KEY.join(",")) {
    problems.push(
      `первичный ключ — (${primaryKey.join(", ")}), ожидался (${EXPECTED_PRIMARY_KEY.join(", ")})`,
    );
  }

  return problems;
}

/** Все связи отдела, уже лежащие в базе, в порядке, не зависящем от порядка вставки. */
function readDepartmentRelations(db) {
  return db
    .prepare(
      `SELECT source_id, target_type, target_id, relation_role, sort_order, created_at
         FROM content_relations
        WHERE source_type = ?
        ORDER BY source_id ASC, target_type ASC, target_id ASC, relation_role ASC`,
    )
    .all(SOURCE_TYPE);
}

/**
 * Дамп ВСЕХ связей, кроме department-связей, — сторож чужих данных.
 *
 * Снимается до записи и сверяется после неё, внутри той же транзакции. Это единственная проверка,
 * которая доказывает обещание «article-связи не изменились» фактом, а не рассуждением о том, какие
 * запросы выполняет скрипт.
 */
function readForeignRelations(db) {
  return db
    .prepare(
      `SELECT source_type, source_id, target_type, target_id, relation_role, sort_order,
              created_at, updated_at
         FROM content_relations
        WHERE source_type <> ?
        ORDER BY source_type ASC, source_id ASC, target_type ASC, target_id ASC,
                 relation_role ASC`,
    )
    .all(SOURCE_TYPE)
    .map((row) => JSON.stringify(row))
    .join("\n");
}

/**
 * План и препятствия. НИЧЕГО не пишет: результат — только описание.
 *
 * Отдельная функция потому, что её зовут дважды — до транзакции и внутри неё, перед самой записью.
 */
export function buildPlan(db) {
  const problems = {
    schema: checkSchema(db),
    missingDepartment: [],
    missingTarget: [],
    unpublishedTarget: [],
    slugMismatch: [],
    duplicateRelation: [],
    unknownRelation: [],
  };

  // Схема не та — дальше идти нельзя: любой запрос ниже опирается на её форму.
  if (problems.schema.length > 0) {
    return { plan: [], problems, existing: [] };
  }

  const departmentExists = db.prepare("SELECT 1 FROM departments WHERE id = ?");
  const sourceIds = [...new Set(MANIFEST.map((relation) => relation.sourceId))];
  for (const sourceId of sourceIds) {
    if (!departmentExists.get(sourceId)) problems.missingDepartment.push(sourceId);
  }

  const findTarget = Object.fromEntries(
    Object.entries(TARGET_TABLE).map(([type, table]) => [
      type,
      db.prepare(
        `SELECT id, slug, (${PUBLISHED_CONDITION[type]}) AS is_public FROM ${table} WHERE id = ?`,
      ),
    ]),
  );

  for (const relation of MANIFEST) {
    const target = findTarget[relation.targetType].get(relation.targetId);
    const label = `${relation.targetType}:${relation.targetId}`;

    if (!target) {
      problems.missingTarget.push(label);
      continue;
    }
    if (!Number(target.is_public)) {
      problems.unpublishedTarget.push(label);
    }
    /**
     * Адрес сверяется ТОЛЬКО там, где манифест назвал обе стороны, — у кейсов. Перепутанный
     * идентификатор кейса иначе прошёл бы молча и дал бы на странице отдела чужой заголовок.
     */
    if (relation.expectedSlug && String(target.slug) !== relation.expectedSlug) {
      problems.slugMismatch.push(
        `${label}: адрес «${String(target.slug)}», ожидался «${relation.expectedSlug}»`,
      );
    }
  }

  const existing = readDepartmentRelations(db);

  /**
   * Сопоставление с тем, что уже есть, — по КЛЮЧУ ЦЕЛИ, без роли.
   *
   * Две строки на одну цель (разные роли) — аномалия: репозиторий такую пару не запишет, а прямой
   * SQL — запишет. Какую из двух считать утверждённой, скрипт решать не вправе, поэтому отказ.
   */
  const existingByTarget = new Map();
  for (const row of existing) {
    const key = targetKey({
      sourceId: String(row.source_id),
      targetType: String(row.target_type),
      targetId: String(row.target_id),
    });
    const bucket = existingByTarget.get(key);
    if (bucket) {
      problems.duplicateRelation.push(
        `${String(row.source_id)} → ${String(row.target_type)}:${String(row.target_id)} ` +
          `(роли «${String(bucket.relation_role)}» и «${String(row.relation_role)}»)`,
      );
      continue;
    }
    existingByTarget.set(key, row);
  }

  const manifestKeys = new Set(MANIFEST.map(targetKey));

  /**
   * Любая department-связь вне манифеста — STOP.
   *
   * Её мог завести человек или другая задача, и трогать её скрипт не имеет права: манифест
   * описывает, что ДОЛЖНО быть, а не что должно остаться единственным. Поэтому не удаление, а отказ
   * с полным перечнем — решение принимает человек.
   */
  for (const [key, row] of existingByTarget) {
    if (manifestKeys.has(key)) continue;
    problems.unknownRelation.push(
      `${String(row.source_id)} → ${String(row.target_type)}:${String(row.target_id)} ` +
        `(роль ${String(row.relation_role)}, порядок ${Number(row.sort_order)})`,
    );
  }

  const plan = MANIFEST.map((relation) => {
    const current = existingByTarget.get(targetKey(relation));

    if (!current) return { ...relation, action: "insert", current: null };

    const same =
      String(current.relation_role) === relation.role &&
      Number(current.sort_order) === relation.sortOrder;

    return {
      ...relation,
      action: same ? "unchanged" : "update",
      current: {
        role: String(current.relation_role),
        sortOrder: Number(current.sort_order),
        createdAt: String(current.created_at),
      },
    };
  });

  return { plan, problems, existing };
}

export function problemCount(problems) {
  return Object.values(problems).reduce((total, list) => total + list.length, 0);
}

function buildReport({ mode, state, plan, problems, existing, changed }) {
  const byAction = (action) => plan.filter((relation) => relation.action === action);

  return {
    script: "backfill-department-relations",
    mode,
    state,
    manifestSize: MANIFEST.length,
    existingDepartmentRelations: existing.length,
    planned: {
      insert: byAction("insert").length,
      update: byAction("update").length,
      unchanged: byAction("unchanged").length,
    },
    /** Сколько связей отдела будет в базе, когда прогон закончится успешно. */
    expectedTotalAfterApply: MANIFEST.length,
    changed,
    problems,
    plan: plan.map((relation) => ({
      action: relation.action,
      source: `${SOURCE_TYPE}:${relation.sourceId}`,
      target: `${relation.targetType}:${relation.targetId}`,
      role: relation.role,
      sortOrder: relation.sortOrder,
      current: relation.current,
    })),
  };
}

/**
 * Итоговая проверка ПОСЛЕ записи и ДО коммита.
 *
 * Читает таблицу заново и сверяет её с манифестом построчно: 11 строк, точные роли и порядок, ни
 * одной лишней. Плюс сверка дампа чужих связей со снимком, снятым до записи. Любое расхождение —
 * исключение, то есть `ROLLBACK`: прогон, который не может доказать свой результат, не должен его
 * оставлять.
 */
function verifyAfterWrite(db, foreignBefore) {
  const actual = readDepartmentRelations(db);

  if (actual.length !== MANIFEST.length) {
    throw new Error(
      `после записи связей отдела ${actual.length}, ожидалось ${MANIFEST.length}: перенос отменён`,
    );
  }

  const actualByKey = new Map(
    actual.map((row) => [
      targetKey({
        sourceId: String(row.source_id),
        targetType: String(row.target_type),
        targetId: String(row.target_id),
      }),
      row,
    ]),
  );

  for (const relation of MANIFEST) {
    const row = actualByKey.get(targetKey(relation));
    if (!row) {
      throw new Error(
        `после записи нет связи ${relation.sourceId} → ${relation.targetType}:${relation.targetId}`,
      );
    }
    if (String(row.relation_role) !== relation.role) {
      throw new Error(
        `после записи роль ${relation.sourceId} → ${relation.targetType}:${relation.targetId} — ` +
          `«${String(row.relation_role)}», ожидалась «${relation.role}»`,
      );
    }
    if (Number(row.sort_order) !== relation.sortOrder) {
      throw new Error(
        `после записи порядок ${relation.sourceId} → ${relation.targetType}:${relation.targetId} — ` +
          `${Number(row.sort_order)}, ожидался ${relation.sortOrder}`,
      );
    }
  }

  if (readForeignRelations(db) !== foreignBefore) {
    throw new Error("изменились связи, не принадлежащие отделам: перенос отменён");
  }
}

/**
 * Прогон переноса.
 *
 * Транзакция ОДНА на весь набор, а не на связь: отказ на одиннадцатой строке не должен оставлять
 * записанными десять.
 */
export function runBackfillDepartmentRelations(
  db,
  { apply = false, now = () => new Date().toISOString() } = {},
) {
  const mode = apply ? "apply" : "dry-run";
  let snapshot = buildPlan(db);

  const report = (state, changed) => buildReport({ mode, state, ...snapshot, changed });

  if (problemCount(snapshot.problems) > 0) return report("blocked", 0);

  const pending = snapshot.plan.filter((relation) => relation.action !== "unchanged");
  if (pending.length === 0) return report("already-applied", 0);
  if (!apply) return report("ready", 0);

  const insert = db.prepare(
    `INSERT INTO content_relations
       (source_type, source_id, target_type, target_id, relation_role, sort_order,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  /**
   * Адресный `UPDATE` по ПОЛНОМУ старому первичному ключу, включая прежнюю роль.
   *
   * `created_at` не трогается: связь не заводится заново, у неё исправляются роль и порядок.
   */
  const update = db.prepare(
    `UPDATE content_relations
        SET relation_role = ?, sort_order = ?, updated_at = ?
      WHERE source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?
        AND relation_role = ?`,
  );

  const timestamp = now();
  let changed = 0;

  db.exec("BEGIN");
  try {
    // Повторная проверка внутри транзакции — последний рубеж перед записью.
    const fresh = buildPlan(db);
    if (problemCount(fresh.problems) > 0) {
      throw new Error("Данные изменились между проверкой и записью: перенос отменён");
    }
    snapshot = fresh;

    const foreignBefore = readForeignRelations(db);

    for (const relation of fresh.plan) {
      if (relation.action === "unchanged") continue;

      if (relation.action === "insert") {
        insert.run(
          SOURCE_TYPE,
          relation.sourceId,
          relation.targetType,
          relation.targetId,
          relation.role,
          relation.sortOrder,
          timestamp,
          timestamp,
        );
        changed += 1;
        continue;
      }

      const result = update.run(
        relation.role,
        relation.sortOrder,
        timestamp,
        SOURCE_TYPE,
        relation.sourceId,
        relation.targetType,
        relation.targetId,
        relation.current.role,
      );
      /**
       * Ровно одна строка. Ноль означал бы, что адресный ключ не нашёл цель; больше одной —
       * что ключ не уникален. И то и другое противоречит схеме, проверенной выше.
       */
      if (Number(result.changes) !== 1) {
        throw new Error(
          `исправление связи ${relation.sourceId} → ${relation.targetType}:${relation.targetId} ` +
            `затронуло строк: ${Number(result.changes)}, ожидалась 1`,
        );
      }
      changed += 1;
    }

    verifyAfterWrite(db, foreignBefore);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return report("applied", changed);
}

/** Ненулевой код возврата — только там, где человек обязан вмешаться. */
export function exitCodeFor(state) {
  return state === "blocked" ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  /**
   * Без `--apply` база физически недоступна на запись: обещание «dry-run ничего не пишет»
   * обеспечивается дескриптором, а не только ветвлением в коде.
   *
   * Путь берётся из `resolveDbPath()` — общей конфигурации проекта (`QBIT_DB_PATH`, иначе
   * `QBIT_DATA_DIR/content.db`). Ни одного пути к production в коде нет и быть не должно.
   */
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    const result = runBackfillDepartmentRelations(db, { apply });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCodeFor(result.state);
  } finally {
    db.close();
  }
}
