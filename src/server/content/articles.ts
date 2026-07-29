import { cache } from "react";
import seedPageContent from "../../../data/seed/page-content.json";
import { DEFAULT_ARTICLE_PLACEMENT } from "@/content/article-placements";
import { parseBlogMarkdown } from "@/features/blog/markdown";
import { countWords, formatRuDate, readingTimeLabel, type BlogPost } from "@/features/blog/posts";
import {
  getPublishedArticleBySlug,
  getPublishedArticles as readPublishedArticles,
  type ArticleRecord,
} from "../repositories/articles";
import { getPageContent } from "../repositories/pageContent";
import { safePageCopy } from "./pageContentSchemas";

/**
 * Публичный доступ к статьям.
 *
 * Запись базы превращается в `BlogPost` — форму, которую уже умеет отрисовывать `BlogExperience`.
 * Производные поля (разбор Markdown на разделы, число слов, время чтения, русские даты) считаются
 * здесь, а не хранятся в базе: они полностью выводятся из текста, и хранение означало бы
 * возможность рассинхрона после правки статьи.
 */

export interface BlogPageCopy {
  eyebrow: string;
  headline: string;
  railTitle: string;
  seoDescription: string;
}

function toBlogPost(record: ArticleRecord, index: number): BlogPost {
  const wordCount = countWords(record.bodyMarkdown);
  const publishedAt = record.publishedAt ?? record.createdAt.slice(0, 10);
  const modifiedAt = record.updatedAt.slice(0, 10);

  return {
    id: index + 1,
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt,
    description: record.seoDescription || record.description || record.excerpt,
    category: record.category,
    tags: record.tags,
    publishedAt,
    publishedLabel: formatRuDate(publishedAt),
    modifiedAt,
    modifiedLabel: formatRuDate(modifiedAt),
    author: record.author,
    readingTime: readingTimeLabel(wordCount),
    wordCount,
    draft: record.status !== "published",
    coverImage: record.coverUrl,
    coverAlt: record.coverAlt,
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
    sections: parseBlogMarkdown(record.bodyMarkdown),
    relatedSlugs: record.relatedSlugs,
  };
}

/** Опубликованные статьи выбранного раздела сайта. */
export const getPublishedArticles = cache(
  (placement: string = DEFAULT_ARTICLE_PLACEMENT): BlogPost[] =>
    readPublishedArticles(placement).map(toBlogPost),
);

/**
 * Статья по адресу. Ищется среди опубликованных того же раздела, чтобы `id` (порядковый номер) и
 * «соседние статьи» совпадали с тем, что видит посетитель в списке.
 */
export function getArticleBySlug(slug: string | undefined): BlogPost | undefined {
  if (!slug) return undefined;

  const record = getPublishedArticleBySlug(slug);
  if (!record) return undefined;

  const list = getPublishedArticles(record.placement);
  return list.find((post) => post.slug === slug);
}

export const getBlogPageCopy = cache((): BlogPageCopy => {
  const fallback = seedPageContent.blog as BlogPageCopy;
  const merged = { ...fallback, ...getPageContent<Partial<BlogPageCopy>>("blog", fallback) };
  return safePageCopy("blog", merged, fallback);
});
