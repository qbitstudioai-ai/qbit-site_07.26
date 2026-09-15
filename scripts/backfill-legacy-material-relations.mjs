import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { extractLegacyRelatedSection } from "../src/features/blog/legacyRelatedSection.mjs";
import { resolveDbPath } from "./db-lib.mjs";

/**
 * Импорт product/case из legacy-секции «Материалы по теме» в `content_relations`
 * (Amendment 61 / Step REL-02F.1).
 *
 * ЧТО ПЕРЕНОСИТСЯ. Только ссылки статьи на продукты и кейсы: они существуют сегодня лишь в тексте
 * статьи. Ссылки на статьи НЕ переносятся никогда (решение D1): после REL-02E структурные связи
 * article→article — источник истины, и старый текст не вправе их дополнять, удалять или
 * переставлять. Расхождение текста с ними попадает в отчёт `legacyArticleDrift` и работу не
 * останавливает. Отделы не импортируются, связи «по смыслу» не придумываются.
 *
 * СУЩЕСТВУЮЩИЕ СВЯЗИ НЕПРИКОСНОВЕННЫ. Скрипт только вставляет: ни `DELETE`, ни `UPDATE`. Новые связи
 * встают после наибольшего `sort_order` источника, между собой — в порядке текста, поэтому
 * относительный порядок всего, что уже было, не меняется.
 *
 * ТАБЛИЦА `articles` НЕ МЕНЯЕТСЯ. Ни `body_markdown`, ни `related_slugs`, ни `updated_at`: импорт
 * не является правкой статьи и не должен двигать её дату изменения, ревизии и журнал.
 *
 * ОТКАЗ ЦЕЛИКОМ. Как и `backfill-article-relations.mjs`: вся база проверяется до записи, любой
 * блокирующий дефект отменяет прогон, запись идёт одной транзакцией с повторной проверкой внутри неё.
 *
 * @typedef {"ready" | "applied" | "already-applied" | "blocked"} LegacyImportState
 */

export const SOURCE_TYPE = "article";
export const RELATION_ROLE = "related";

/** Предел связей одного материала. Совпадает с `.max(24)` схемы API и `MAX_RELATIONS` админ-панели. */
export const MAX_RELATIONS_PER_SOURCE = 24;

const SECTION_ERROR_CODES = new Set([
  "ambiguous_heading",
  "duplicate_section",
  "malformed_section",
  "malformed_item",
]);

/**
 * Цель из текста → строка базы.
 *
 * Адрес разрешается ТОЛЬКО по колонке `slug` соответствующей таблицы; в связь попадает `id` строки.
 * Публикация проверяется по самой строке, прямым SQL: у кейса `toCase()` приложения всегда отдаёт
 * `status: "published"`, и опора на него пропустила бы скрытый кейс.
 *
 * `isProductId` — адрес не совпал ни с одним slug, но совпал с идентификатором продукта: это старая
 * ссылка вида `/products/<id>`, и такую форму импорт отвергает, а не угадывает.
 *
 * Экспортируется ради `db-seed.mjs`: seed и импорт обязаны одинаково понимать ссылку на продукт или
 * кейс. Article-ветку (с `placement`) зовёт только импорт — для диагностики; seed article-ссылки
 * текста пропускает (Amendment 61.1).
 */
export function resolveLegacyTarget(db, target) {
  if (target.type === "article") {
    const row = db
      .prepare("SELECT id, status, placement FROM articles WHERE slug = ?")
      .get(target.slug);
    return row
      ? {
          found: true,
          id: String(row.id),
          published: String(row.status) === "published",
          placement: String(row.placement),
        }
      : { found: false, isProductId: false };
  }

  if (target.type === "product") {
    const row = db.prepare("SELECT id, is_published FROM products WHERE slug = ?").get(target.slug);
    if (!row) {
      const byId = db.prepare("SELECT 1 FROM products WHERE id = ?").get(target.slug);
      return { found: false, isProductId: Boolean(byId) };
    }
    return { found: true, id: String(row.id), published: Number(row.is_published) === 1 };
  }

  if (target.type === "case") {
    const row = db.prepare("SELECT id, status FROM cases WHERE slug = ?").get(target.slug);
    return row
      ? { found: true, id: String(row.id), published: String(row.status) === "published" }
      : { found: false, isProductId: false };
  }

  throw new Error(`Неизвестный тип цели «${String(target.type)}»`);
}

/**
 * Расхождение article-ссылок текста со структурными связями. Только описание, никогда не запись.
 *
 * `orderDiff` сравнивает порядок ОБЩИХ целей: недостающая или лишняя цель уже названа своими
 * списками и порядок не должна «портить» дважды.
 *
 * Сравниваются только article-ссылки, пригодные для блока: существующая, опубликованная статья того же
 * раздела, не сама статья, первое вхождение. Остальные названы своими списками `issues`
 * (`unresolvedArticle`, `unpublishedArticle`, `placementMismatch`, `selfLink`, `duplicateArticle`) —
 * ТОЛЬКО диагностика (уточнение D1 от 2026-09-15): ни одно из этих состояний импорт не блокирует.
 */
function articleDrift(source, markdownArticles, structuredArticles, issues) {
  const markdownIds = new Set(markdownArticles.map((item) => item.id));
  const structuredIds = new Set(structuredArticles.map((item) => item.id));

  const missingInStructured = markdownArticles
    .filter((item) => !structuredIds.has(item.id))
    .map((item) => item.slug);
  const extraInStructured = structuredArticles
    .filter((item) => !markdownIds.has(item.id))
    .map((item) => item.slug);

  const commonMarkdown = markdownArticles.filter((item) => structuredIds.has(item.id));
  const commonStructured = structuredArticles.filter((item) => markdownIds.has(item.id));
  const orderDiff = commonMarkdown.some((item, index) => item.id !== commonStructured[index].id);

  const hasIssues = Object.values(issues).some((list) => list.length > 0);

  if (
    missingInStructured.length === 0 &&
    extraInStructured.length === 0 &&
    !orderDiff &&
    !hasIssues
  ) {
    return null;
  }

  return {
    source: source.slug,
    sourceId: source.id,
    markdown: markdownArticles.map((item) => item.slug),
    structured: structuredArticles.map((item) => item.slug),
    missingInStructured,
    extraInStructured,
    orderDiff,
    ...issues,
  };
}

/**
 * План импорта и всё, что импорт останавливает. Ничего не пишет; зовётся до транзакции и внутри неё.
 *
 * Источники — только ОПУБЛИКОВАННЫЕ статьи: черновик публично не показывается, и его текст ещё
 * правится. Статья, у которой нашёлся хотя бы один дефект, в план не попадает целиком: частичный
 * план одной статьи после исправления текста дал бы другие `sort_order`.
 */
export function buildPlan(db) {
  const sources = db
    .prepare(
      `SELECT id, slug, placement, body_markdown
         FROM articles
        WHERE status = 'published'
        ORDER BY sort_order ASC, id ASC`,
    )
    .all();
  const readExisting = db.prepare(
    `SELECT target_type, target_id, relation_role, sort_order
       FROM content_relations
      WHERE source_type = ? AND source_id = ?
      ORDER BY sort_order ASC, target_type ASC, target_id ASC, relation_role ASC`,
  );
  const articleSlug = db.prepare("SELECT slug FROM articles WHERE id = ?");

  const plan = [];
  const alreadyExisting = [];
  const legacyArticleDrift = [];
  const problems = {
    ambiguousSections: [],
    unknownUrls: [],
    missingTargets: [],
    unpublishedProducts: [],
    unpublishedCases: [],
    duplicates: [],
    structuralAnomalies: [],
    limitViolations: [],
  };
  const problemTotal = () => Object.values(problems).reduce((sum, list) => sum + list.length, 0);

  let articlesWithSection = 0;
  let noSection = 0;

  for (const row of sources) {
    const source = {
      id: String(row.id),
      slug: String(row.slug),
      placement: String(row.placement),
    };
    const extraction = extractLegacyRelatedSection(String(row.body_markdown));

    if (extraction.state === "no_section") {
      noSection += 1;
      continue;
    }
    articlesWithSection += 1;

    if (extraction.state === "invalid") {
      for (const error of extraction.errors) {
        const entry = {
          source: source.slug,
          line: error.line,
          code: error.code,
          detail: error.detail,
        };
        if (SECTION_ERROR_CODES.has(error.code)) problems.ambiguousSections.push(entry);
        else if (error.code === "duplicate_target") problems.duplicates.push(entry);
        else problems.unknownUrls.push(entry);
      }
      continue;
    }

    const problemsBefore = problemTotal();
    const existing = readExisting.all(SOURCE_TYPE, source.id).map((relation) => ({
      targetType: String(relation.target_type),
      targetId: String(relation.target_id),
      role: String(relation.relation_role),
      sortOrder: Number(relation.sort_order),
    }));

    // Одна цель несколькими строками (разные роли) — состояние, которое репозиторий не создаёт.
    const rolesByTarget = new Map();
    for (const relation of existing) {
      const key = `${relation.targetType}:${relation.targetId}`;
      rolesByTarget.set(key, [...(rolesByTarget.get(key) ?? []), relation.role]);
    }
    for (const [key, roles] of rolesByTarget) {
      if (roles.length > 1) {
        problems.structuralAnomalies.push({ source: source.slug, target: key, roles });
      }
    }

    const markdownArticles = [];
    const articleIssues = {
      unresolvedArticle: [],
      unpublishedArticle: [],
      placementMismatch: [],
      selfLink: [],
      duplicateArticle: [],
    };
    const seenArticleSlugs = new Set();
    const additions = [];

    for (const target of extraction.targets) {
      const reference = {
        source: source.slug,
        sourceId: source.id,
        type: target.type,
        slug: target.slug,
        href: target.href,
        line: target.line,
      };

      // Article-ссылка текста — ТОЛЬКО диагностика (D1, Amendment 61.1): в план не попадает и ни в
      // одном состоянии не блокирует импорт. Синтаксис адреса уже проверил extractor.
      if (target.type === "article") {
        if (seenArticleSlugs.has(target.slug)) {
          articleIssues.duplicateArticle.push(target.slug);
          continue;
        }
        seenArticleSlugs.add(target.slug);

        const article = resolveLegacyTarget(db, target);
        if (!article.found) {
          articleIssues.unresolvedArticle.push(target.slug);
        } else if (article.id === source.id) {
          articleIssues.selfLink.push(target.slug);
        } else if (!article.published) {
          articleIssues.unpublishedArticle.push(target.slug);
        } else if (article.placement !== source.placement) {
          articleIssues.placementMismatch.push(target.slug);
        } else {
          markdownArticles.push({ id: article.id, slug: target.slug });
        }
        continue;
      }

      // Product/case — импортируемые типы, для них fail-closed без изменений.
      const resolved = resolveLegacyTarget(db, target);
      if (!resolved.found) {
        if (resolved.isProductId)
          problems.unknownUrls.push({ ...reference, code: "product_id_url" });
        else problems.missingTargets.push(reference);
        continue;
      }

      if (!resolved.published) {
        const list =
          target.type === "product" ? problems.unpublishedProducts : problems.unpublishedCases;
        list.push({ ...reference, targetId: resolved.id });
        continue;
      }

      if (rolesByTarget.has(`${target.type}:${resolved.id}`)) {
        alreadyExisting.push({ ...reference, targetId: resolved.id });
        continue;
      }

      additions.push({ ...reference, targetId: resolved.id });
    }

    if (existing.length + additions.length > MAX_RELATIONS_PER_SOURCE) {
      problems.limitViolations.push({
        source: source.slug,
        existing: existing.length,
        planned: additions.length,
        limit: MAX_RELATIONS_PER_SOURCE,
      });
    }

    const seenStructured = new Set();
    const structuredArticles = [];
    for (const relation of existing) {
      if (relation.targetType !== "article" || seenStructured.has(relation.targetId)) continue;
      seenStructured.add(relation.targetId);
      const slugRow = articleSlug.get(relation.targetId);
      structuredArticles.push({
        id: relation.targetId,
        slug: slugRow ? String(slugRow.slug) : `(нет статьи: ${relation.targetId})`,
      });
    }
    const drift = articleDrift(source, markdownArticles, structuredArticles, articleIssues);
    if (drift) legacyArticleDrift.push(drift);

    if (problemTotal() > problemsBefore) continue;

    const maxSortOrder = existing.reduce((max, relation) => Math.max(max, relation.sortOrder), -1);
    additions.forEach((addition, index) => {
      plan.push({
        sourceId: source.id,
        sourceSlug: source.slug,
        targetType: addition.type,
        targetId: addition.targetId,
        targetSlug: addition.slug,
        role: RELATION_ROLE,
        sortOrder: maxSortOrder + 1 + index,
      });
    });
  }

  return {
    articles: sources.length,
    articlesWithSection,
    noSection,
    plan,
    alreadyExisting,
    legacyArticleDrift,
    problems,
  };
}

function problemCount(problems) {
  return Object.values(problems).reduce((total, list) => total + list.length, 0);
}

/** Отпечаток плана: запись обязана идти ровно по тому плану, который был показан. */
function planSignature(plan) {
  return JSON.stringify(
    plan.map((item) => [item.sourceId, item.targetType, item.targetId, item.role, item.sortOrder]),
  );
}

function buildReport(mode, state, snapshot, changed, concurrentChange = false) {
  const { plan, problems } = snapshot;
  return {
    mode,
    state,
    concurrentChange,
    articles: snapshot.articles,
    articlesWithSection: snapshot.articlesWithSection,
    noSection: snapshot.noSection,
    plannedProductRelations: plan.filter((item) => item.targetType === "product").length,
    plannedCaseRelations: plan.filter((item) => item.targetType === "case").length,
    alreadyExisting: snapshot.alreadyExisting.length,
    legacyArticleDrift: snapshot.legacyArticleDrift,
    ambiguousSections: problems.ambiguousSections.length,
    unknownUrls: problems.unknownUrls.length,
    missingTargets: problems.missingTargets.length,
    unpublishedProducts: problems.unpublishedProducts.length,
    unpublishedCases: problems.unpublishedCases.length,
    duplicates: problems.duplicates.length,
    structuralAnomalies: problems.structuralAnomalies.length,
    limitViolations: problems.limitViolations.length,
    changed,
    details: { plan, alreadyExisting: snapshot.alreadyExisting, ...problems },
  };
}

/**
 * Импорт. Без `apply` не пишет ничего; CLI при этом открывает базу только на чтение.
 *
 * Внутри транзакции план строится заново и обязан совпасть с показанным: если между проверкой и
 * записью база изменилась (скрыли продукт, кто-то уже добавил связь), прогон отменяется целиком и
 * возвращает отчёт `blocked` с `concurrentChange: true` по состоянию, найденному в транзакции.
 * Исключением прогон завершается только при сбое самой записи — и тоже после ROLLBACK.
 */
export function runBackfillLegacyMaterialRelations(
  db,
  { apply = false, now = () => new Date().toISOString() } = {},
) {
  const mode = apply ? "apply" : "dry-run";
  let snapshot = buildPlan(db);
  const report = (state, changed) => buildReport(mode, state, snapshot, changed);

  if (problemCount(snapshot.problems) > 0) return report("blocked", 0);
  if (snapshot.plan.length === 0) return report("already-applied", 0);
  if (!apply) return report("ready", 0);

  const insert = db.prepare(
    `INSERT INTO content_relations
       (source_type, source_id, target_type, target_id, relation_role, sort_order,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let inserted = 0;

  db.exec("BEGIN");
  try {
    const fresh = buildPlan(db);
    if (
      problemCount(fresh.problems) > 0 ||
      planSignature(fresh.plan) !== planSignature(snapshot.plan)
    ) {
      db.exec("ROLLBACK");
      snapshot = fresh;
      return buildReport(mode, "blocked", snapshot, 0, true);
    }
    snapshot = fresh;

    const timestamp = now();
    for (const item of fresh.plan) {
      insert.run(
        SOURCE_TYPE,
        item.sourceId,
        item.targetType,
        item.targetId,
        item.role,
        item.sortOrder,
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
  return state === "blocked" ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    const result = runBackfillLegacyMaterialRelations(db, { apply });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCodeFor(result.state);
  } finally {
    db.close();
  }
}
