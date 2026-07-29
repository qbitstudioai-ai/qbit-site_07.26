import { getDatabase, nowIso, parseJsonColumn, transaction } from "../db/client";
import { logActivity, saveRevision } from "./revisions";

/**
 * Общие тексты страниц: заголовки, подписи разделов, примечания — всё, что не привязано к
 * конкретному отделу, продукту, статье или документу.
 *
 * Одна запись = одна страница. Содержимое хранится JSON-колонкой: у каждой страницы свой набор
 * полей, и заводить под них отдельные таблицы значило бы менять схему при каждой новой подписи.
 */

/** Ключи страниц. Стабильные, используются админ-панелью, API и публичными страницами. */
export const PAGE_KEYS = ["homepage", "products", "documents", "blog", "contacts"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === "string" && (PAGE_KEYS as readonly string[]).includes(value);
}

export function getPageContent<T>(pageKey: PageKey, fallback: T): T {
  const row = getDatabase()
    .prepare("SELECT content FROM page_content WHERE page_key = ?")
    .get(pageKey) as { content?: string } | undefined;

  if (!row?.content) return fallback;
  return parseJsonColumn<T>(row.content, fallback);
}

export function getPageContentRecord(
  pageKey: PageKey,
): { content: unknown; updatedAt: string } | undefined {
  const row = getDatabase()
    .prepare("SELECT content, updated_at FROM page_content WHERE page_key = ?")
    .get(pageKey) as { content?: string; updated_at?: string } | undefined;

  if (!row?.content) return undefined;
  return { content: parseJsonColumn<unknown>(row.content, {}), updatedAt: String(row.updated_at) };
}

export function updatePageContent(pageKey: PageKey, content: unknown, summary: string): void {
  transaction(() => {
    const previous = getPageContentRecord(pageKey);
    if (previous) saveRevision("page", pageKey, previous.content);

    getDatabase()
      .prepare(
        `INSERT INTO page_content (page_key, content, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (page_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(pageKey, JSON.stringify(content), nowIso());

    logActivity("page", pageKey, "update", summary);
  });
}

export function insertPageContentIfMissing(pageKey: string, content: unknown): boolean {
  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM page_content WHERE page_key = ?").get(pageKey)) return false;

  db.prepare("INSERT INTO page_content (page_key, content, updated_at) VALUES (?, ?, ?)").run(
    pageKey,
    JSON.stringify(content),
    nowIso(),
  );
  return true;
}
