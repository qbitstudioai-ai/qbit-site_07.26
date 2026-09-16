import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { extractLegacyRelatedSection } from "../src/features/blog/legacyRelatedSection.mjs";
import { resolveDbPath } from "./db-lib.mjs";

/**
 * Физическое удаление legacy-секции «Материалы по теме» из `articles.body_markdown`
 * (Amendment 61 / Step REL-02F.3b).
 *
 * ЭТО УБОРКА ХРАНЕНИЯ, А НЕ ПРАВКА КОНТЕНТА. После REL-02F.2 публичный текст статьи уже не содержит
 * секцию (`publicArticleBody` вырезает тот же диапазон), поэтому удаление из базы публичный вывод не
 * меняет. Отсюда инварианты: SQL трогает ТОЛЬКО `body_markdown`; `updated_at`, `published_at`, статус и
 * прочие колонки статей, `content_relations`, `content_revisions`, `activity_log` неизменны; sitemap
 * lastmod не двигается; IndexNow и revalidate не вызываются. Скрипт не импортирует репозитории
 * приложения, запись ревизий и журнала.
 *
 * Не schema migration и не deploy hook: запускается человеком вручную (production — только REL-02F.3c).
 *
 * D9 — удаляется ровно диапазон extractor: без trim, без нормализации переводов строк, без
 * форматирования. D10 — проверяются ВСЕ статьи, включая черновики: черновик с секцией при публикации
 * вернул бы старый текст. `invalid` или неизвестное состояние в любой статье — `blocked`, запись не идёт.
 * D12 — `--apply` без manifest запрещён; manifest хранит точный вырезанный текст для точечного отката
 * (главный откат production — backup базы).
 *
 * @typedef {"ready" | "already-applied" | "blocked" | "applied"} CleanupState
 */

const KNOWN_STATES = new Set(["ok", "no_section", "invalid"]);

const MANIFEST_REQUIRED = "--apply требует --manifest <путь>: без manifest запись запрещена (D12)";

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

/**
 * Отпечатки всего, что уборка обязана оставить нетронутым.
 *
 * `articlesMeta` — ВСЕ колонки статей, кроме `body_markdown` (в том числе `updated_at`,
 * `published_at`, `status`): берутся `SELECT *`, чтобы колонка будущей миграции не выпала из проверки.
 */
export function readFingerprints(db) {
  const articles = db
    .prepare("SELECT * FROM articles ORDER BY id")
    .all()
    .map((row) => {
      const meta = { ...row };
      delete meta.body_markdown;
      return meta;
    });
  const relations = db
    .prepare(
      `SELECT * FROM content_relations
        ORDER BY source_type, source_id, target_type, target_id, relation_role, sort_order`,
    )
    .all();
  const revisions = db.prepare("SELECT * FROM content_revisions ORDER BY id").all();
  const activity = db.prepare("SELECT * FROM activity_log ORDER BY id").all();
  return {
    articlesMeta: sha256(JSON.stringify(articles)),
    relations: sha256(JSON.stringify(relations)),
    contentRevisions: sha256(JSON.stringify(revisions)),
    activityLog: sha256(JSON.stringify(activity)),
  };
}

const sameFingerprints = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function validRange(range, length) {
  return (
    range !== null &&
    typeof range === "object" &&
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.start < range.end &&
    range.end <= length
  );
}

/**
 * План уборки и отпечатки базы на момент его построения. Ничего не пишет; зовётся до транзакции,
 * внутри неё и после записи.
 *
 * Статья с дефектом в план не попадает, а сам дефект блокирует весь прогон.
 */
export function buildCleanupPlan(db) {
  const rows = db
    .prepare(
      `SELECT id, slug, status, published_at, updated_at, body_markdown
         FROM articles
        ORDER BY sort_order, id`,
    )
    .all();

  const byStatus = { published: 0, draft: 0, other: 0 };
  const candidates = [];
  const problems = {
    invalidSections: [],
    unexpectedStates: [],
    emptyBodies: [],
    residualSections: [],
  };
  let withLegacySection = 0;
  let noSection = 0;
  let invalid = 0;

  for (const row of rows) {
    const status = String(row.status);
    if (status === "published") byStatus.published += 1;
    else if (status === "draft") byStatus.draft += 1;
    else byStatus.other += 1;

    const article = {
      id: String(row.id),
      slug: String(row.slug),
      status,
      updatedAt: String(row.updated_at),
      publishedAt: row.published_at === null ? null : String(row.published_at),
    };
    const oldBody = row.body_markdown;
    const extraction = extractLegacyRelatedSection(oldBody);
    const state = extraction?.state;

    if (!KNOWN_STATES.has(state)) {
      problems.unexpectedStates.push({ ...article, state: String(state) });
      continue;
    }
    if (state === "no_section") {
      noSection += 1;
      continue;
    }
    if (state === "invalid") {
      invalid += 1;
      problems.invalidSections.push({ ...article, errors: extraction.errors });
      continue;
    }

    withLegacySection += 1;
    if (typeof oldBody !== "string" || !validRange(extraction.range, oldBody.length)) {
      problems.unexpectedStates.push({ ...article, state: "ok", range: extraction.range ?? null });
      continue;
    }

    // D9: ровно диапазон extractor, без trim и нормализации.
    const { start, end } = extraction.range;
    const removedText = oldBody.slice(start, end);
    const newBody = oldBody.slice(0, start) + oldBody.slice(end);

    if (newBody.trim() === "") {
      problems.emptyBodies.push({ ...article, range: { start, end } });
      continue;
    }
    const residual = extractLegacyRelatedSection(newBody);
    if (residual?.state !== "no_section") {
      problems.residualSections.push({ ...article, state: String(residual?.state) });
      continue;
    }

    candidates.push({
      ...article,
      range: { start, end },
      oldSha256: sha256(oldBody),
      newSha256: sha256(newBody),
      removedSha256: sha256(removedText),
      removedLength: removedText.length,
      exactRemovedText: removedText,
      oldBody,
      newBody,
    });
  }

  return {
    totalArticles: rows.length,
    byStatus,
    withLegacySection,
    noSection,
    invalid,
    candidates,
    problems,
    fingerprints: readFingerprints(db),
  };
}

const problemCount = (problems) =>
  Object.values(problems).reduce((total, list) => total + list.length, 0);

/** Кандидат для отчёта (без текста) и для manifest (с точным вырезанным текстом); полных тел нет. */
function describeCandidate(item, withRemovedText) {
  const described = {
    id: item.id,
    slug: item.slug,
    status: item.status,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    range: item.range,
    oldSha256: item.oldSha256,
    newSha256: item.newSha256,
    removedSha256: item.removedSha256,
    removedLength: item.removedLength,
  };
  return withRemovedText ? { ...described, exactRemovedText: item.exactRemovedText } : described;
}

/** Запись обязана идти ровно по плану, который был показан и записан в manifest. */
function planSignature(plan) {
  return JSON.stringify(
    plan.candidates.map((item) => [
      item.id,
      item.oldSha256,
      item.newSha256,
      item.removedSha256,
      item.updatedAt,
      item.publishedAt,
      item.status,
      item.range.start,
      item.range.end,
    ]),
  );
}

/**
 * Manifest одного запуска пишется ТОЛЬКО по новому пути. Существующий файл может быть manifest прошлого
 * apply с точным вырезанным текстом — единственной точечной страховкой отката (D12); повторный запуск
 * или проверочный dry-run с тем же путём не вправе его затереть.
 */
export function assertManifestAbsent(manifestPath) {
  if (manifestPath && fs.existsSync(path.resolve(manifestPath))) {
    throw new Error(
      `Manifest уже существует: ${path.resolve(manifestPath)} — укажите новый путь; ` +
        "существующий manifest не перезаписывается (D12)",
    );
  }
}

/**
 * Атомарная запись: временный файл рядом с целью, затем `link` (первая запись запуска — атомарно и без
 * перезаписи чужого файла) или `rename` (следующие записи того же запуска поверх своего файла).
 */
export function writeManifestAtomic(manifestPath, manifest, { create = false } = {}) {
  const target = path.resolve(manifestPath);
  const temporary = `${target}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    if (create) {
      fs.linkSync(temporary, target);
      fs.rmSync(temporary);
    } else {
      fs.renameSync(temporary, target);
    }
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * Отчёт и (если задан путь) manifest. `before` — отпечатки ИСХОДНОГО плана, `current` — план, по
 * которому описывается результат (при конкурентном изменении — найденный в транзакции).
 *
 * `fingerprints.afterState`: `committed` — отпечатки базы после COMMIT; `rolled-back` — отпечатки,
 * снятые внутри транзакции, которая затем откачена (реальная база осталась в состоянии `before`).
 */
function reporter({ mode, initial, manifestPath, now }) {
  let written = false;
  return (
    state,
    { current = initial, changed = 0, concurrentChange = false, after, afterState } = {},
  ) => {
    const before = initial.fingerprints;
    const report = {
      mode,
      state,
      concurrentChange,
      totalArticles: current.totalArticles,
      byStatus: current.byStatus,
      withLegacySection: current.withLegacySection,
      noSection: current.noSection,
      invalid: current.invalid,
      plannedChanges: current.candidates.length,
      changed,
      candidates: current.candidates.map((item) => describeCandidate(item, false)),
      problems: current.problems,
      fingerprints: after ? { before, after, afterState } : { before },
    };
    if (manifestPath) {
      writeManifestAtomic(
        manifestPath,
        {
          generatedAt: now(),
          mode,
          state,
          concurrentChange,
          fingerprints: report.fingerprints,
          candidates: current.candidates.map((item) => describeCandidate(item, true)),
        },
        { create: !written },
      );
      written = true;
    }
    return report;
  };
}

/**
 * Запись готового плана. Не доверяет плану: под `BEGIN IMMEDIATE` план и отпечатки строятся заново и
 * обязаны совпасть. Расхождение — ROLLBACK и `blocked` с `concurrentChange: true`. Сбой самой записи
 * (`changes !== 1`) — ROLLBACK и исключение. Пост-проверки до COMMIT (отпечатки, пустой повторный
 * план, тела ровно по плану) — иначе ROLLBACK и `blocked`. Частичной уборки не бывает.
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {ReturnType<typeof buildCleanupPlan>} plan
 * @param {{ manifestPath?: string, now?: () => string }} [options]
 */
export function applyCleanupPlan(
  db,
  plan,
  { manifestPath, now = () => new Date().toISOString() } = {},
) {
  if (!manifestPath) throw new Error(MANIFEST_REQUIRED);
  assertManifestAbsent(manifestPath);
  if (problemCount(plan.problems) > 0 || plan.candidates.length === 0) {
    throw new Error("План не готов к записи: есть блокеры или нет кандидатов");
  }

  const finish = reporter({ mode: "apply", initial: plan, manifestPath, now });
  finish("planned");

  const update = db.prepare(
    `UPDATE articles
        SET body_markdown = ?
      WHERE id = ?
        AND body_markdown = ?
        AND updated_at = ?`,
  );
  const readBody = db.prepare("SELECT body_markdown FROM articles WHERE id = ?");
  let open = false;
  const rollback = () => {
    open = false;
    db.exec("ROLLBACK");
  };

  let changed = 0;
  let after;
  db.exec("BEGIN IMMEDIATE");
  open = true;
  try {
    const locked = buildCleanupPlan(db);
    if (
      problemCount(locked.problems) > 0 ||
      planSignature(locked) !== planSignature(plan) ||
      !sameFingerprints(locked.fingerprints, plan.fingerprints)
    ) {
      rollback();
      return finish("blocked", { current: locked, concurrentChange: true });
    }

    for (const item of locked.candidates) {
      const result = update.run(item.newBody, item.id, item.oldBody, item.updatedAt);
      if (Number(result.changes) !== 1) {
        throw new Error(
          `UPDATE статьи «${item.slug}» изменил ${String(result.changes)} строк вместо 1`,
        );
      }
      changed += 1;
    }

    const residual = buildCleanupPlan(db);
    after = residual.fingerprints;
    const bodiesMatch = locked.candidates.every(
      (item) => readBody.get(item.id)?.body_markdown === item.newBody,
    );
    if (
      !sameFingerprints(after, plan.fingerprints) ||
      problemCount(residual.problems) > 0 ||
      residual.candidates.length !== 0 ||
      !bodiesMatch
    ) {
      rollback();
      return finish("blocked", { after, afterState: "rolled-back" });
    }

    db.exec("COMMIT");
    open = false;
  } catch (error) {
    if (open) rollback();
    throw error;
  }

  try {
    return finish("applied", { changed, after, afterState: "committed" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `COMMIT выполнен: база изменена (статей: ${changed}), но manifest «applied» не записан ` +
        `(${reason}). Manifest «planned» с exactRemovedText остаётся в ${path.resolve(manifestPath)}; ` +
        "проверьте результат dry-run (ожидается already-applied).",
      { cause: error },
    );
  }
}

/**
 * Уборка. Без `apply` в базу не пишет ничего (CLI открывает её только на чтение); manifest в dry-run
 * пишется, только если задан путь. Apply не доверяет отдельному прошлому dry-run: план строится здесь
 * же и перепроверяется в транзакции (`applyCleanupPlan`).
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ apply?: boolean, manifestPath?: string, now?: () => string }} [options]
 */
export function runRemoveLegacyMaterialSections(
  db,
  { apply = false, manifestPath, now = () => new Date().toISOString() } = {},
) {
  if (apply && !manifestPath) throw new Error(MANIFEST_REQUIRED);
  assertManifestAbsent(manifestPath);

  const plan = buildCleanupPlan(db);
  const finish = reporter({ mode: apply ? "apply" : "dry-run", initial: plan, manifestPath, now });

  if (problemCount(plan.problems) > 0) return finish("blocked");
  if (plan.candidates.length === 0) return finish("already-applied");
  if (!apply) return finish("ready");

  return applyCleanupPlan(db, plan, { manifestPath, now });
}

/** Ненулевой код возврата — только там, где человек обязан вмешаться. */
export function exitCodeFor(state) {
  return state === "blocked" ? 1 : 0;
}

/** Разбор аргументов. Любая ошибка — до открытия базы. */
export function parseCliArgs(argv) {
  let apply = false;
  let manifestPath;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--manifest требует путь к файлу");
      manifestPath = value;
      index += 1;
    } else {
      throw new Error(`Неизвестный аргумент «${arg}»`);
    }
  }
  if (apply && !manifestPath) throw new Error(MANIFEST_REQUIRED);
  return { apply, manifestPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { apply, manifestPath } = parseCliArgs(process.argv.slice(2));
    assertManifestAbsent(manifestPath);
    const dbPath = resolveDbPath();
    // Файл проверяется до открытия: DatabaseSync на ошибочном пути создал бы пустую базу.
    if (!fs.existsSync(dbPath) || !fs.statSync(dbPath).isFile()) {
      throw new Error(`Файл базы не найден: ${dbPath}`);
    }
    const db = new DatabaseSync(dbPath, { readOnly: !apply });
    try {
      db.exec("PRAGMA busy_timeout = 5000");
      const result = runRemoveLegacyMaterialSections(db, { apply, manifestPath });
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = exitCodeFor(result.state);
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
