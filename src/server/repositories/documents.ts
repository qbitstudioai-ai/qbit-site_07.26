import { getDatabase, nowIso, transaction } from "../db/client";
import { logActivity, saveRevision } from "./revisions";

/**
 * Репозиторий документов и их категорий.
 *
 * Размер файла хранится ЧИСЛОМ в байтах, а не строкой «1,8 МБ»: строку нельзя ни отсортировать, ни
 * сравнить, ни пересчитать под другую локаль. Форматирование — задача интерфейса
 * (`formatFileSize` в `src/features/documents/documents.ts`).
 *
 * У предпросмотра ДВА независимых поля: `auto_preview_key` (сгенерирован сервером) и
 * `manual_preview_key` (загружен администратором). Ручной перекрывает автоматический, но не
 * затирает его — поэтому «удалить ручной preview» возвращает автоматический, а не оставляет
 * документ вовсе без изображения.
 */

export interface DocumentRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  originalFileName: string;
  originalFileUrl: string;
  storageKey: string;
  previewUrl: string | null;
  autoPreviewKey: string | null;
  manualPreviewKey: string | null;
  sortOrder: number;
  isPublished: boolean;
  documentDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCategoryRecord {
  id: string;
  label: string;
  sortOrder: number;
}

function toDocument(raw: unknown): DocumentRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    category: String(row.category),
    fileType: String(row.file_type),
    mimeType: String(row.mime_type),
    fileSize: Number(row.file_size ?? 0),
    originalFileName: String(row.original_file_name),
    originalFileUrl: String(row.original_file_url),
    storageKey: String(row.storage_key ?? ""),
    previewUrl: row.preview_url ? String(row.preview_url) : null,
    autoPreviewKey: row.auto_preview_key ? String(row.auto_preview_key) : null,
    manualPreviewKey: row.manual_preview_key ? String(row.manual_preview_key) : null,
    sortOrder: Number(row.sort_order),
    isPublished: Number(row.is_published) === 1,
    documentDate: row.document_date ? String(row.document_date) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const SELECT = `SELECT id, title, description, category, file_type, mime_type, file_size,
                       original_file_name, original_file_url, storage_key, preview_url,
                       auto_preview_key, manual_preview_key, sort_order, is_published,
                       document_date, created_at, updated_at FROM documents`;

export function getPublishedDocuments(): DocumentRecord[] {
  return getDatabase()
    .prepare(`${SELECT} WHERE is_published = 1 ORDER BY sort_order ASC, title ASC`)
    .all()
    .map(toDocument);
}

export function listAllDocuments(): DocumentRecord[] {
  return getDatabase()
    .prepare(`${SELECT} ORDER BY sort_order ASC, title ASC`)
    .all()
    .map(toDocument);
}

export function getDocumentById(id: string): DocumentRecord | undefined {
  const row = getDatabase().prepare(`${SELECT} WHERE id = ?`).get(id);
  return row ? toDocument(row) : undefined;
}

/**
 * Документ, которому принадлежит файл хранилища, — по ключу оригинала или любого из предпросмотров.
 *
 * Нужен раздаче файлов: до аудита 2026-07-27 `/api/files/*` отдавал байты, не заглядывая в базу, и
 * снятие документа с публикации не отзывало доступ по прямой ссылке. Непредсказуемость имени
 * (UUIDv4) защитой не является: ссылка попадает в поисковый кэш, историю браузера и Referer-логи.
 *
 * Возвращается минимум полей — раздаче нужен только факт публикации.
 */
export function findDocumentByStorageKey(
  storageKey: string,
): { id: string; isPublished: boolean } | undefined {
  const row = getDatabase()
    .prepare(
      `SELECT id, is_published FROM documents
        WHERE storage_key = ? OR auto_preview_key = ? OR manual_preview_key = ?
        LIMIT 1`,
    )
    .get(storageKey, storageKey, storageKey) as { id?: string; is_published?: number } | undefined;

  if (!row?.id) return undefined;
  return { id: String(row.id), isPublished: Number(row.is_published) === 1 };
}

export function countDocuments(): { total: number; published: number } {
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) AS published
         FROM documents`,
    )
    .get() as { total?: number; published?: number } | undefined;
  return { total: Number(row?.total ?? 0), published: Number(row?.published ?? 0) };
}

export type DocumentInput = Omit<DocumentRecord, "createdAt" | "updatedAt">;

export function createDocument(input: DocumentInput): DocumentRecord {
  return transaction(() => {
    const timestamp = nowIso();
    getDatabase()
      .prepare(
        `INSERT INTO documents (id, title, description, category, file_type, mime_type, file_size,
                                original_file_name, original_file_url, storage_key, preview_url,
                                auto_preview_key, manual_preview_key, sort_order, is_published,
                                document_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.title,
        input.description,
        input.category,
        input.fileType,
        input.mimeType,
        input.fileSize,
        input.originalFileName,
        input.originalFileUrl,
        input.storageKey,
        input.previewUrl,
        input.autoPreviewKey,
        input.manualPreviewKey,
        input.sortOrder,
        input.isPublished ? 1 : 0,
        input.documentDate,
        timestamp,
        timestamp,
      );

    logActivity("document", input.id, "create", `Документ «${input.title}» добавлен`);
    return getDocumentById(input.id) as DocumentRecord;
  });
}

export function updateDocument(id: string, input: DocumentInput): DocumentRecord {
  return transaction(() => {
    const previous = getDocumentById(id);
    if (!previous) throw new Error(`Документ «${id}» не найден`);
    saveRevision("document", id, previous);

    getDatabase()
      .prepare(
        `UPDATE documents
            SET title = ?, description = ?, category = ?, file_type = ?, mime_type = ?,
                file_size = ?, original_file_name = ?, original_file_url = ?, storage_key = ?,
                preview_url = ?, auto_preview_key = ?, manual_preview_key = ?, sort_order = ?,
                is_published = ?, document_date = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(
        input.title,
        input.description,
        input.category,
        input.fileType,
        input.mimeType,
        input.fileSize,
        input.originalFileName,
        input.originalFileUrl,
        input.storageKey,
        input.previewUrl,
        input.autoPreviewKey,
        input.manualPreviewKey,
        input.sortOrder,
        input.isPublished ? 1 : 0,
        input.documentDate,
        nowIso(),
        id,
      );

    logActivity("document", id, "update", `Документ «${input.title}» обновлён`);
    return getDocumentById(id) as DocumentRecord;
  });
}

export function deleteDocumentRow(id: string): DocumentRecord | undefined {
  return transaction(() => {
    const previous = getDocumentById(id);
    if (!previous) return undefined;
    saveRevision("document", id, previous);

    getDatabase().prepare("DELETE FROM documents WHERE id = ?").run(id);
    logActivity("document", id, "delete", `Документ «${previous.title}» удалён`);
    return previous;
  });
}

export function reorderDocuments(order: readonly string[]): void {
  transaction(() => {
    const statement = getDatabase().prepare(
      "UPDATE documents SET sort_order = ?, updated_at = ? WHERE id = ?",
    );
    const timestamp = nowIso();
    order.forEach((id, index) => statement.run((index + 1) * 10, timestamp, id));
    logActivity("document", "*", "reorder", "Изменён порядок документов");
  });
}

export function listDocumentCategories(): DocumentCategoryRecord[] {
  return getDatabase()
    .prepare(
      "SELECT id, label, sort_order FROM document_categories ORDER BY sort_order ASC, id ASC",
    )
    .all()
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        id: String(row.id),
        label: String(row.label),
        sortOrder: Number(row.sort_order),
      };
    });
}

/** Переименование категории. Системный ключ не меняется — на нём держатся фильтры и записи. */
export function renameDocumentCategory(id: string, label: string): void {
  getDatabase().prepare("UPDATE document_categories SET label = ? WHERE id = ?").run(label, id);
  logActivity("document-category", id, "update", `Категория «${label}» переименована`);
}

export function insertDocumentCategoryIfMissing(item: DocumentCategoryRecord): boolean {
  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM document_categories WHERE id = ?").get(item.id)) return false;
  db.prepare("INSERT INTO document_categories (id, label, sort_order) VALUES (?, ?, ?)").run(
    item.id,
    item.label,
    item.sortOrder,
  );
  return true;
}

export function documentExists(id: string): boolean {
  return Boolean(getDatabase().prepare("SELECT 1 FROM documents WHERE id = ?").get(id));
}
