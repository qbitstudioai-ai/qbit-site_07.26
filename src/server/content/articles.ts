import { cache } from "react";
import seedPageContent from "../../../data/seed/page-content.json";
import { DEFAULT_ARTICLE_PLACEMENT } from "@/content/article-placements";
import { publicArticleBody } from "@/features/blog/articleBody";
import { parseBlogMarkdown } from "@/features/blog/markdown";
import {
  countWords,
  formatRuDate,
  readingTimeLabel,
  type BlogPost,
  type PublicRelatedMaterial,
} from "@/features/blog/posts";
import {
  getPublishedArticleBySlug,
  getPublishedArticles as readPublishedArticles,
  type ArticleRecord,
} from "../repositories/articles";
import { listPublishedArticleRelatedMaterials } from "../repositories/contentRelations";
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

/**
 * `relatedMaterials` приходит отдельным аргументом, а не из `record`: публичный блок «Материалы по
 * теме» читает только таблицу связей. Прежняя колонка `related_slugs` в записи остаётся ради
 * переходного dual-write админ-панели, но на публичный вывод не влияет.
 *
 * Разделы, число слов и время чтения считаются по ПУБЛИЧНОМУ телу — без скрытой legacy-секции
 * (REL-02F.2). Так уборка секции из базы в REL-02F.3 не поменяет ни текст страницы, ни `wordCount` в
 * микроразметке. Нераспознанная секция остаётся в тексте (D5), и об этом сообщается в лог сервера.
 */
function toBlogPost(
  record: ArticleRecord,
  index: number,
  relatedMaterials: PublicRelatedMaterial[],
): BlogPost {
  const { body, legacySection } = publicArticleBody(record.bodyMarkdown);
  if (legacySection === "invalid") {
    console.warn(
      `[blog] статья ${record.id} (${record.slug}): legacy-секция «Материалы по теме» не распознана и оставлена в тексте`,
    );
  }
  const wordCount = countWords(body);
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
    sections: parseBlogMarkdown(body),
    relatedMaterials,
  };
}

/**
 * Опубликованные статьи выбранного раздела сайта.
 *
 * Связи раздела читаются ОДНИМ запросом и раздаются КАЖДОЙ статье списка: при переходе между
 * статьями без перезагрузки клиент берёт материалы по теме из этого же списка.
 */
export const getPublishedArticles = cache(
  (placement: string = DEFAULT_ARTICLE_PLACEMENT): BlogPost[] => {
    const relatedMaterials = listPublishedArticleRelatedMaterials(placement);
    return readPublishedArticles(placement).map((record, index) =>
      toBlogPost(record, index, relatedMaterials.get(record.id) ?? []),
    );
  },
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
