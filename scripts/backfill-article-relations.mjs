import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";

/**
 * Перенос прежней перелинковки статей в таблицу связей: `articles.related_slugs` →
 * `content_relations` (Amendment 58 / Step REL-02C).
 *
 * ПОЧЕМУ СКРИПТ, А НЕ МИГРАЦИЯ СХЕМЫ. Миграции из `src/server/db/schema.mjs` применяются
 * автоматически при первом обращении к базе, то есть при старте приложения, и после выката
 * неизменяемы. Перенос данных с обеими этими свойствами несовместим: у него обязан быть прогон
 * «показать и не трогать» до записи, разбор отчёта человеком и возможность отказаться, а отказ
 * внутри `applyMigrations()` означал бы, что сайт не поднимается. Поэтому перенос — отдельная
 * ручная операция, а схема шагом не меняется вовсе.
 *
 * ЧТО ЭТОТ СКРИПТ НЕ ДЕЛАЕТ НИКОГДА. Он не пишет в таблицу `articles`: ни `related_slugs`, ни
 * `updated_at`, ни что-либо ещё. Прежняя колонка остаётся единственным источником для публичного
 * блока «материалы по теме» до отдельного шага переключения, и перенос обязан быть обратимым
 * простым `DELETE` из таблицы связей, без восстановления чего-либо в статьях.
 *
 * СВЯЗЬ ХРАНИТСЯ ПО ИДЕНТИФИКАТОРУ. Адрес разрешается в идентификатор через `articles.slug` и в
 * колонки `source_id`/`target_id` не попадает ни при каком входе. У материалов из `data/seed`
 * идентификатор случайно совпадает с адресом (так их записал seed), а статья, созданная в
 * админ-панели, получает `randomUUID()`. Подстановка адреса вместо идентификатора прошла бы
 * незамеченной на первой базе и сломалась бы на второй, поэтому совпадение нигде не используется.
 *
 * ОТКАЗ ЦЕЛИКОМ, А НЕ ЧАСТЬЮ. Вся база проверяется до первой записи, и любая непереносимая строка
 * отменяет прогон полностью. Перенести исправные статьи и промолчать про остальные означало бы
 * оставить базу в состоянии, которое нельзя описать одной фразой: часть связей в новой таблице,
 * часть только в старой колонке, и никакого признака, где проходит граница.
 *
 * @typedef {"ready" | "applied" | "already-applied" | "conflict" | "blocked"} BackfillState
 */

/** Обе стороны переносимой связи — статьи. Роль у прежней модели ровно одна. */
export const SOURCE_TYPE = "article";
export const TARGET_TYPE = "article";
export const RELATION_ROLE = "related";

/**
 * Ключ связи для сравнения плана с тем, что уже лежит в базе.
 *
 * В ключ входят все четыре значащих поля, включая `sort_order`: изменённый человеком порядок — это
 * другое состояние таблицы, а не то же самое. Разделитель — символ, который не может встретиться в
 * идентификаторе, иначе пара «a|b» и «a», «|b» дала бы один ключ.
 */
const relationKey = (relation) =>
  [relation.sourceId, relation.targetId, relation.role, relation.sortOrder].join("\u0000");

/**
 * План переноса и список того, что перенести нельзя.
 *
 * Проверки идут по ВСЕЙ базе за один проход и НИЧЕГО не пишут: результат — только описание.
 * Отдельная функция нужна ровно потому, что её зовут дважды — до транзакции и внутри неё.
 */
export function buildPlan(db) {
  const rows = db
    .prepare(
      `SELECT id, slug, status, related_slugs
         FROM articles
        ORDER BY sort_order ASC, id ASC`,
    )
    .all();

  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const plan = [];
  const invalidJson = [];
  const invalidEntries = [];
  const unresolved = [];
  const selfLinks = [];
  const duplicates = [];
  const draftTargets = [];

  let articlesWithLinks = 0;

  for (const row of rows) {
    let list;
    try {
      list = JSON.parse(row.related_slugs);
    } catch {
      invalidJson.push({ source: row.slug, reason: "не разбирается как JSON" });
      continue;
    }

    // Колонка объявлена `NOT NULL DEFAULT '[]'`, но объявление не мешает записать туда что угодно
    // прямым SQL. Значение не массива — не пустая перелинковка, а неизвестное состояние.
    if (!Array.isArray(list)) {
      invalidJson.push({ source: row.slug, reason: "значение не является массивом" });
      continue;
    }

    if (list.length > 0) articlesWithLinks += 1;

    const seen = new Set();
    list.forEach((value, index) => {
      if (typeof value !== "string" || value.trim() === "") {
        invalidEntries.push({ source: row.slug, index });
        return;
      }

      if (seen.has(value)) {
        duplicates.push({ source: row.slug, target: value, index });
        return;
      }
      seen.add(value);

      const targetId = idBySlug.get(value);
      if (targetId === undefined) {
        unresolved.push({ source: row.slug, target: value, index });
        return;
      }

      // Сравнение по идентификатору, а не только по адресу: совпадение адресов ловится тем же
      // условием, но проверка идентификатора остаётся верной и там, где адрес уже сменился.
      if (targetId === row.id) {
        selfLinks.push({ source: row.slug, target: value, index });
        return;
      }

      const target = byId.get(targetId);
      // Черновик как цель блокирует перенос намеренно. Сегодня публичный блок такую ссылку молча
      // не показывает, и в базе она выглядит исправной; в таблице связей она стала бы настоящей
      // строкой, и решать, публиковать ли цель или убрать ссылку, обязан человек, а не скрипт.
      if (target.status !== "published") {
        draftTargets.push({ source: row.slug, target: value, status: target.status });
        return;
      }

      plan.push({
        sourceId: row.id,
        sourceSlug: row.slug,
        targetId,
        targetSlug: value,
        role: RELATION_ROLE,
        sortOrder: index,
      });
    });
  }

  return {
    articles: rows.length,
    articlesWithLinks,
    plan,
    problems: { invalidJson, invalidEntries, unresolved, selfLinks, duplicates, draftTargets },
  };
}

/** Сколько всего непереносимых записей нашлось. Ноль означает «переносить можно». */
function problemCount(problems) {
  return Object.values(problems).reduce((total, list) => total + list.length, 0);
}

/**
 * Уже существующие связи СТАТЬИ НА СТАТЬЮ.
 *
 * Отбор именно по паре типов принципиален: связи статьи на продукт, кейс или отдел этот скрипт не
 * создаёт и не может воспроизвести из прежней колонки, поэтому считать их «лишними» и уж тем более
 * трогать — значит удалять то, чего перенос не касается.
 */
export function readExistingArticleRelations(db) {
  return db
    .prepare(
      `SELECT source_id, target_id, relation_role, sort_order
         FROM content_relations
        WHERE source_type = ? AND target_type = ?
        ORDER BY source_id ASC, sort_order ASC`,
    )
    .all(SOURCE_TYPE, TARGET_TYPE)
    .map((row) => ({
      sourceId: String(row.source_id),
      targetId: String(row.target_id),
      role: String(row.relation_role),
      sortOrder: Number(row.sort_order),
    }));
}

/**
 * Состояние таблицы относительно плана: `ready`, `already-applied` или `conflict`.
 *
 * Три состояния вместо двух — главное свойство этого скрипта. Совпадение состава ОДИН В ОДИН
 * означает, что перенос уже выполнялся, и повтор обязан не делать ничего: ни `DELETE`, ни
 * повторной вставки, ни обновления отметок времени. Любое расхождение означает, что кто-то правил
 * связи помимо переноса, и тогда молчаливое слияние вернуло бы удалённую человеком связь обратно,
 * а замена стёрла бы добавленную. Оба исхода необратимы и незаметны, поэтому расхождение
 * останавливает работу и показывает разницу.
 */
export function compareWithExisting(plan, existing) {
  const plannedKeys = new Set(plan.map(relationKey));
  const existingKeys = new Set(existing.map(relationKey));

  const missing = plan.filter((relation) => !existingKeys.has(relationKey(relation)));
  const unexpected = existing.filter((relation) => !plannedKeys.has(relationKey(relation)));

  if (existing.length === 0) return { state: "ready", missing, unexpected };
  if (missing.length === 0 && unexpected.length === 0) {
    return { state: "already-applied", missing, unexpected };
  }
  return { state: "conflict", missing, unexpected };
}

function buildReport({
  mode,
  state,
  articles,
  articlesWithLinks,
  plan,
  problems,
  existing,
  comparison,
  changed,
}) {
  const conflict = comparison.state === "conflict";
  return {
    mode,
    state,
    articles,
    articlesWithLinks,
    plannedRelations: plan.length,
    existingArticleRelations: existing.length,
    unresolved: problems.unresolved.length,
    selfLinks: problems.selfLinks.length,
    duplicates: problems.duplicates.length,
    draftTargets: problems.draftTargets.length,
    invalidJson: problems.invalidJson.length,
    invalidEntries: problems.invalidEntries.length,
    // Расхождения считаются ТОЛЬКО в состоянии `conflict`. В состоянии `ready` таблица пуста, и
    // тогда «недостающими» числятся все запланированные связи разом: показать их как конфликты
    // означало бы отчитаться о проблемах ровно там, где не найдено ни одной.
    conflicts: conflict ? comparison.missing.length + comparison.unexpected.length : 0,
    changed,
    details: {
      ...problems,
      conflictMissing: conflict ? comparison.missing : [],
      conflictUnexpected: conflict ? comparison.unexpected : [],
    },
  };
}

/**
 * Перенос. Без `apply` не пишет ничего и работает на дескрипторе, открытом только на чтение.
 *
 * Порядок внутри `apply` задан требованием «проверить всё до первой записи»: план строится и
 * сверяется снаружи транзакции, а затем ПОВТОРНО внутри неё, непосредственно перед вставкой.
 * Второй проход не избыточен: между двумя вызовами база остаётся доступна другому процессу, и
 * запись должна опираться на то состояние, в котором она фактически происходит, а не на то, каким
 * оно было к моменту печати отчёта.
 *
 * Транзакция ОДНА на весь набор, а не на статью. Транзакция на статью означала бы, что отказ на
 * пятой статье оставляет перенесёнными четыре — ровно тот частичный результат, который запрещён.
 */
export function runBackfillArticleRelations(
  db,
  { apply = false, now = () => new Date().toISOString() } = {},
) {
  const mode = apply ? "apply" : "dry-run";
  const { articles, articlesWithLinks, plan, problems } = buildPlan(db);
  const existing = readExistingArticleRelations(db);
  const comparison = compareWithExisting(plan, existing);

  /**
   * Снимок, по которому собирается отчёт.
   *
   * До записи он один — тот, что посчитан выше. Внутри транзакции он ЗАМЕНЯЕТСЯ на состояние,
   * которым запись фактически руководствовалась, иначе отчёт об успешном переносе смешивал бы два
   * разных прохода: план из первого и число вставок из второго.
   */
  let snapshot = { articles, articlesWithLinks, plan, problems, existing, comparison };

  const report = (state, changed) => buildReport({ mode, state, ...snapshot, changed });

  if (problemCount(problems) > 0) return report("blocked", 0);
  if (comparison.state === "conflict") return report("conflict", 0);
  if (comparison.state === "already-applied") return report("already-applied", 0);
  if (!apply) return report("ready", 0);

  const insert = db.prepare(
    `INSERT INTO content_relations
       (source_type, source_id, target_type, target_id, relation_role, sort_order,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const timestamp = now();
  // Считаются ФАКТИЧЕСКИЕ вставки, а не длина плана, посчитанного до транзакции: писать в отчёт
  // число, полученное из другого прохода, значит сообщать не о том, что произошло.
  let inserted = 0;

  db.exec("BEGIN");
  try {
    // Повторная проверка внутри транзакции — последний рубеж перед записью.
    const fresh = buildPlan(db);
    if (problemCount(fresh.problems) > 0) {
      throw new Error("Данные изменились между проверкой и записью: перенос отменён");
    }
    const freshExisting = readExistingArticleRelations(db);
    const freshComparison = compareWithExisting(fresh.plan, freshExisting);
    if (freshComparison.state !== "ready") {
      throw new Error(
        `Состояние таблицы связей изменилось между проверкой и записью: ${freshComparison.state}`,
      );
    }

    // Отчёт с этого момента описывает состояние, по которому шла запись, а не то, что было до неё.
    snapshot = {
      articles: fresh.articles,
      articlesWithLinks: fresh.articlesWithLinks,
      plan: fresh.plan,
      problems: fresh.problems,
      existing: freshExisting,
      comparison: freshComparison,
    };

    for (const relation of fresh.plan) {
      insert.run(
        SOURCE_TYPE,
        relation.sourceId,
        TARGET_TYPE,
        relation.targetId,
        relation.role,
        relation.sortOrder,
        timestamp,
        timestamp,
      );
      inserted += 1;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return report("applied", inserted);
}

/** Ненулевой код возврата — только там, где человек обязан вмешаться. */
export function exitCodeFor(state) {
  return state === "conflict" || state === "blocked" ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  // Без `--apply` база физически недоступна на запись: обещание «dry-run ничего не пишет»
  // обеспечивается дескриптором, а не только ветвлением в коде.
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    const result = runBackfillArticleRelations(db, { apply });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCodeFor(result.state);
  } finally {
    db.close();
  }
}
