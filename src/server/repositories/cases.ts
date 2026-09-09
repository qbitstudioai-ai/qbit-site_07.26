import type { CaseInput, CaseRecord } from "@/features/cases/caseRecord";
import { getDatabase, nowIso, parseJsonColumn, transaction } from "../db/client";
import { deleteRelationsForEntity } from "./contentRelations";
import { logActivity, saveRevision } from "./revisions";

/**
 * Репозиторий кейсов.
 *
 * Единственное место, которое читает и пишет таблицу `cases`. Ни страница, ни компонент, ни роут
 * не собирают SQL сами: все запросы параметризованы, и значение из формы физически не может стать
 * частью инструкции.
 *
 * Два UNIQUE-ограничения на уровне схемы, а не только в проверке формы: `slug` (два кейса по одному
 * адресу означали бы, что один из них недоступен) и `file_number` (два дела с одним номером в
 * архиве — ошибка ввода). Нарушение перехватывается роутом и превращается в понятную ошибку поля.
 */

function toCase(raw: unknown): CaseRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    shortTitle: String(row.short_title),
    folderCaption: String(row.folder_caption ?? ""),
    fileNumber: String(row.file_number),
    label: String(row.label ?? ""),
    summary: String(row.summary ?? ""),
    task: String(row.task ?? ""),
    implementation: String(row.implementation ?? ""),
    workflowSteps: parseJsonColumn<string[]>(row.workflow_steps, []),
    result: String(row.result ?? ""),
    metricLabel: String(row.metric_label ?? ""),
    metricBefore: String(row.metric_before ?? ""),
    metricAfter: String(row.metric_after ?? ""),
    metricSource: String(row.metric_source ?? ""),
    humanControl: String(row.human_control ?? ""),
    limitations: String(row.limitations ?? ""),
    ctaLabel: String(row.cta_label ?? ""),
    ctaHref: String(row.cta_href ?? ""),
    seoTitle: String(row.seo_title ?? ""),
    seoDescription: String(row.seo_description ?? ""),
    ogDescription: String(row.og_description ?? ""),
    status: "published",
    stampEnabled: Number(row.stamp_enabled) === 1,
    sortOrder: Number(row.sort_order),
    publishedAt: row.published_at ? String(row.published_at) : null,
    modifiedAt: row.modified_at ? String(row.modified_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const SELECT = `SELECT id, slug, title, short_title, folder_caption, file_number, label,
                       summary, task, implementation, workflow_steps, result,
                       metric_label, metric_before, metric_after, metric_source,
                       human_control, limitations, cta_label, cta_href,
                       seo_title, seo_description, og_description,
                       status, stamp_enabled, sort_order, published_at, modified_at,
                       created_at, updated_at
                  FROM cases`;

/**
 * Опубликованные кейсы в порядке картотеки.
 *
 * Сортировка стабильная: при равных `sort_order` порядок решает `slug`, иначе список тасовался бы
 * между запросами.
 */
export function listPublishedCases(): CaseRecord[] {
  return getDatabase()
    .prepare(`${SELECT} WHERE status = 'published' ORDER BY sort_order ASC, slug ASC`)
    .all()
    .map(toCase);
}

/** Все кейсы — для админ-панели. */
export function listAllCases(): CaseRecord[] {
  return getDatabase().prepare(`${SELECT} ORDER BY sort_order ASC, slug ASC`).all().map(toCase);
}

export function getCaseRecordBySlug(slug: string | undefined): CaseRecord | undefined {
  if (!slug) return undefined;
  const row = getDatabase().prepare(`${SELECT} WHERE slug = ? AND status = 'published'`).get(slug);
  return row ? toCase(row) : undefined;
}

export function getCaseById(id: string): CaseRecord | undefined {
  const row = getDatabase().prepare(`${SELECT} WHERE id = ?`).get(id);
  return row ? toCase(row) : undefined;
}

export function isCaseSlugTaken(slug: string, exceptId?: string): boolean {
  const db = getDatabase();
  const row = exceptId
    ? db.prepare("SELECT 1 FROM cases WHERE slug = ? AND id <> ?").get(slug, exceptId)
    : db.prepare("SELECT 1 FROM cases WHERE slug = ?").get(slug);
  return Boolean(row);
}

export function isCaseFileNumberTaken(fileNumber: string, exceptId?: string): boolean {
  const db = getDatabase();
  const row = exceptId
    ? db.prepare("SELECT 1 FROM cases WHERE file_number = ? AND id <> ?").get(fileNumber, exceptId)
    : db.prepare("SELECT 1 FROM cases WHERE file_number = ?").get(fileNumber);
  return Boolean(row);
}

/** Следующий свободный порядок в картотеке. Форма предлагает его при создании кейса. */
export function nextCaseSortOrder(): number {
  const row = getDatabase().prepare("SELECT MAX(sort_order) AS top FROM cases").get() as
    { top?: number | null } | undefined;
  return Number(row?.top ?? 0) + 1;
}

/** Пары «колонка → значение». Один список на INSERT и UPDATE: разъехаться им негде. */
function caseColumns(input: CaseInput): { name: string; value: unknown }[] {
  return [
    { name: "slug", value: input.slug },
    { name: "title", value: input.title },
    { name: "short_title", value: input.shortTitle },
    { name: "folder_caption", value: input.folderCaption },
    { name: "file_number", value: input.fileNumber },
    { name: "label", value: input.label },
    { name: "summary", value: input.summary },
    { name: "task", value: input.task },
    { name: "implementation", value: input.implementation },
    { name: "workflow_steps", value: JSON.stringify(input.workflowSteps) },
    { name: "result", value: input.result },
    { name: "metric_label", value: input.metricLabel },
    { name: "metric_before", value: input.metricBefore },
    { name: "metric_after", value: input.metricAfter },
    { name: "metric_source", value: input.metricSource },
    { name: "human_control", value: input.humanControl },
    { name: "limitations", value: input.limitations },
    { name: "cta_label", value: input.ctaLabel },
    { name: "cta_href", value: input.ctaHref },
    { name: "seo_title", value: input.seoTitle },
    { name: "seo_description", value: input.seoDescription },
    { name: "og_description", value: input.ogDescription },
    { name: "status", value: input.status },
    { name: "stamp_enabled", value: input.stampEnabled ? 1 : 0 },
    { name: "sort_order", value: input.sortOrder },
  ];
}

/**
 * Публикация кейса.
 *
 * `publishedAt` и `modifiedAt` приходят параметром, а не берутся здесь: время публикации ставит
 * роут — одно и то же значение в оба поля, чтобы «опубликован» и «изменён» у нового кейса
 * совпадали до секунды.
 */
export function createCase(id: string, input: CaseInput, publishedAt: string): CaseRecord {
  return transaction(() => {
    const columns = caseColumns(input);
    const names = columns.map((column) => column.name).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const timestamp = nowIso();

    getDatabase()
      .prepare(
        `INSERT INTO cases (${names}, id, published_at, modified_at, created_at, updated_at)
         VALUES (${placeholders}, ?, ?, ?, ?, ?)`,
      )
      .run(
        ...(columns.map((column) => column.value) as never[]),
        id,
        publishedAt,
        publishedAt,
        timestamp,
        timestamp,
      );

    logActivity("case", id, "create", `Кейс «${input.shortTitle}» опубликован`);
    return getCaseById(id) as CaseRecord;
  });
}

/**
 * Правка опубликованного кейса.
 *
 * `published_at` в списке колонок НЕТ намеренно: дата первой публикации не меняется никогда, и
 * единственный способ этого добиться — не давать её переписать. Обновляется `modified_at`.
 */
export function updateCase(id: string, input: CaseInput, modifiedAt: string): CaseRecord {
  return transaction(() => {
    const previous = getCaseById(id);
    if (!previous) throw new Error(`Кейс «${id}» не найден`);
    saveRevision("case", id, previous);

    const columns = caseColumns(input);
    const assignments = columns.map((column) => `${column.name} = ?`).join(", ");

    getDatabase()
      .prepare(`UPDATE cases SET ${assignments}, modified_at = ?, updated_at = ? WHERE id = ?`)
      .run(...(columns.map((column) => column.value) as never[]), modifiedAt, nowIso(), id);

    logActivity("case", id, "update", `Кейс «${input.shortTitle}» обновлён`);
    return getCaseById(id) as CaseRecord;
  });
}

/**
 * Удаление кейса вместе с его связями.
 *
 * Причина и порядок те же, что у статьи (см. `deleteArticle()`): каскада у полиморфной ссылки нет,
 * поэтому связи снимает код удаления, и снимает ОБЕ стороны — кейс чаще оказывается целью чужих
 * ссылок, чем источником своих. Всё в уже существующей транзакции удаления, второй не заводится.
 */
export function deleteCase(id: string): boolean {
  return transaction(() => {
    const previous = getCaseById(id);
    if (!previous) return false;
    // Предыдущая версия уходит в историю ДО удаления: страницы больше не будет, и восстановить
    // текст иначе было бы нечем.
    saveRevision("case", id, previous);

    getDatabase().prepare("DELETE FROM cases WHERE id = ?").run(id);
    deleteRelationsForEntity("case", id);
    logActivity("case", id, "delete", `Кейс «${previous.shortTitle}» удалён`);
    return true;
  });
}
