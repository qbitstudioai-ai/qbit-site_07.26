import type { ArticleStatus } from "@/content/article-placements";
import { getDatabase, nowIso, parseJsonColumn, transaction } from "../db/client";
import { logActivity, saveRevision } from "./revisions";

/**
 * Репозиторий статей.
 *
 * `slug` уникален на уровне схемы (UNIQUE): два материала по одному адресу означали бы, что один из
 * них недоступен. Нарушение перехватывается и превращается в понятную ошибку формы, а не в 500.
 *
 * `placement` — раздел публичного сайта из общего справочника `src/content/article-placements.ts`.
 * Свободного текста здесь нет: статья с выдуманным разделом нигде бы не показалась.
 */

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  description: string;
  bodyMarkdown: string;
  coverUrl: string;
  coverAlt: string;
  placement: string;
  category: string;
  tags: string[];
  relatedSlugs: string[];
  author: string;
  seoTitle: string;
  seoDescription: string;
  status: ArticleStatus;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toArticle(raw: unknown): ArticleRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.excerpt),
    description: String(row.description ?? ""),
    bodyMarkdown: String(row.body_markdown ?? ""),
    coverUrl: String(row.cover_url ?? ""),
    coverAlt: String(row.cover_alt ?? ""),
    placement: String(row.placement),
    category: String(row.category ?? ""),
    tags: parseJsonColumn<string[]>(row.tags, []),
    relatedSlugs: parseJsonColumn<string[]>(row.related_slugs, []),
    author: String(row.author ?? ""),
    seoTitle: String(row.seo_title ?? ""),
    seoDescription: String(row.seo_description ?? ""),
    status: (String(row.status) === "published" ? "published" : "draft") as ArticleStatus,
    isFeatured: Number(row.is_featured) === 1,
    sortOrder: Number(row.sort_order),
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const SELECT = `SELECT id, slug, title, excerpt, description, body_markdown, cover_url, cover_alt,
                       placement, category, tags, related_slugs, author, seo_title, seo_description,
                       status, is_featured, sort_order, published_at, created_at, updated_at
                  FROM articles`;

/** Опубликованные статьи раздела, в порядке отображения. */
export function getPublishedArticles(placement?: string): ArticleRecord[] {
  const db = getDatabase();
  const rows = placement
    ? db
        .prepare(
          `${SELECT} WHERE status = 'published' AND placement = ?
             ORDER BY sort_order ASC, published_at DESC, id ASC`,
        )
        .all(placement)
    : db
        .prepare(
          `${SELECT} WHERE status = 'published' ORDER BY sort_order ASC, published_at DESC, id ASC`,
        )
        .all();

  return rows.map(toArticle);
}

export function listAllArticles(): ArticleRecord[] {
  return getDatabase()
    .prepare(`${SELECT} ORDER BY sort_order ASC, created_at DESC`)
    .all()
    .map(toArticle);
}

export function getArticleBySlug(slug: string | undefined): ArticleRecord | undefined {
  if (!slug) return undefined;
  const row = getDatabase().prepare(`${SELECT} WHERE slug = ?`).get(slug);
  return row ? toArticle(row) : undefined;
}

export function getPublishedArticleBySlug(slug: string | undefined): ArticleRecord | undefined {
  const article = getArticleBySlug(slug);
  return article?.status === "published" ? article : undefined;
}

export function getArticleById(id: string): ArticleRecord | undefined {
  const row = getDatabase().prepare(`${SELECT} WHERE id = ?`).get(id);
  return row ? toArticle(row) : undefined;
}

export function isArticleSlugTaken(slug: string, exceptId?: string): boolean {
  const db = getDatabase();
  const row = exceptId
    ? db.prepare("SELECT 1 FROM articles WHERE slug = ? AND id <> ?").get(slug, exceptId)
    : db.prepare("SELECT 1 FROM articles WHERE slug = ?").get(slug);
  return Boolean(row);
}

export type ArticleInput = Omit<ArticleRecord, "id" | "createdAt" | "updatedAt">;

function bind(input: ArticleInput): unknown[] {
  return [
    input.slug,
    input.title,
    input.excerpt,
    input.description,
    input.bodyMarkdown,
    input.coverUrl,
    input.coverAlt,
    input.placement,
    input.category,
    JSON.stringify(input.tags),
    JSON.stringify(input.relatedSlugs),
    input.author,
    input.seoTitle,
    input.seoDescription,
    input.status,
    input.isFeatured ? 1 : 0,
    input.sortOrder,
    input.publishedAt,
  ];
}

export function createArticle(id: string, input: ArticleInput): ArticleRecord {
  return transaction(() => {
    const timestamp = nowIso();
    getDatabase()
      .prepare(
        `INSERT INTO articles (slug, title, excerpt, description, body_markdown, cover_url, cover_alt,
                               placement, category, tags, related_slugs, author, seo_title,
                               seo_description, status, is_featured, sort_order, published_at,
                               id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...(bind(input) as never[]), id, timestamp, timestamp);

    logActivity("article", id, "create", `Статья «${input.title}» создана`);
    return getArticleById(id) as ArticleRecord;
  });
}

export function updateArticle(id: string, input: ArticleInput): ArticleRecord {
  return transaction(() => {
    const previous = getArticleById(id);
    if (!previous) throw new Error(`Статья «${id}» не найдена`);
    saveRevision("article", id, previous);

    getDatabase()
      .prepare(
        `UPDATE articles
            SET slug = ?, title = ?, excerpt = ?, description = ?, body_markdown = ?, cover_url = ?,
                cover_alt = ?, placement = ?, category = ?, tags = ?, related_slugs = ?, author = ?,
                seo_title = ?, seo_description = ?, status = ?, is_featured = ?, sort_order = ?,
                published_at = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(...(bind(input) as never[]), nowIso(), id);

    logActivity("article", id, "update", `Статья «${input.title}» обновлена`);
    return getArticleById(id) as ArticleRecord;
  });
}

export function deleteArticle(id: string): boolean {
  return transaction(() => {
    const previous = getArticleById(id);
    if (!previous) return false;
    saveRevision("article", id, previous);

    getDatabase().prepare("DELETE FROM articles WHERE id = ?").run(id);
    logActivity("article", id, "delete", `Статья «${previous.title}» удалена`);
    return true;
  });
}

export function reorderArticles(order: readonly string[]): void {
  transaction(() => {
    const statement = getDatabase().prepare(
      "UPDATE articles SET sort_order = ?, updated_at = ? WHERE id = ?",
    );
    const timestamp = nowIso();
    order.forEach((id, index) => statement.run((index + 1) * 10, timestamp, id));
    logActivity("article", "*", "reorder", "Изменён порядок статей");
  });
}

export function countPublishedArticles(): number {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) AS total FROM articles WHERE status = 'published'")
    .get() as { total?: number } | undefined;
  return Number(row?.total ?? 0);
}

export function insertArticleIfMissing(id: string, input: ArticleInput): boolean {
  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM articles WHERE id = ?").get(id)) return false;
  createArticle(id, input);
  return true;
}
