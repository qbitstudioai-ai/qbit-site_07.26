import seedArticles from "../../../data/seed/articles.json";
import seedContacts from "../../../data/seed/contacts.json";
import seedDocuments from "../../../data/seed/documents.json";
import seedProducts from "../../../data/seed/products.json";
import { stripLegacyRelatedSection } from "@/features/blog/articleBody";
import type { BlogPost, PublicRelatedMaterial } from "@/features/blog/posts";
import { countWords, formatRuDate, readingTimeLabel } from "@/features/blog/posts";
import { parseBlogMarkdown } from "@/features/blog/markdown";
import type { DocumentCategory, DocumentItem } from "@/features/documents/documents";
import {
  buildProductLocation,
  type ProductContent,
  type ProductHotspot,
  type ProductId,
  type ProductLayout,
  type ProductLocation,
} from "@/features/products/products";
import { normalizeSeoTitle } from "@/lib/seo";

/**
 * Исходный контент сайта для тестов.
 *
 * После переезда контента в базу тесты не могут импортировать массивы из модулей — их там больше
 * нет. Но проверять содержимое всё равно нужно: `data/seed/*.json` — это ровно те тексты, которые
 * попадают в базу при первом заполнении, поэтому здесь они собираются в те же структуры, что
 * отдаёт публичный слой контента. Так проверки остаются проверками реального контента, а не
 * выдуманных заглушек, и при этом не требуют запущенной базы.
 */

export const seedProductLocations: ProductLocation[] = seedProducts.map((product) =>
  buildProductLocation({
    id: product.id as ProductId,
    slug: product.slug,
    menuTitle: product.menuTitle,
    fullTitle: product.fullTitle,
    order: product.order,
    alt: product.imageAlt,
    hotspot: product.hotspot as ProductHotspot,
    content: product.content as ProductContent,
    layout: product.layout as ProductLayout,
    seoTitle: product.seoTitle,
  }),
);

/**
 * Материалы по теме на СВЕЖЕЙ seed-базе: ровно `relations[]` seed-статьи в порядке массива — тот же
 * источник, из которого их пишет `db:seed` (REL-02F.3a). Цель ищется по stable id; адрес и название —
 * из seed-строки цели, как у публичного reader. Кейсов в `data/seed` нет (кейс переносит миграция),
 * поэтому кейс-цель фикстура не поддерживает и отказывает явно.
 */
function seedRelatedMaterials(article: (typeof seedArticles)[number]): PublicRelatedMaterial[] {
  return article.relations.map((relation): PublicRelatedMaterial => {
    if (relation.targetType === "article") {
      const target = seedArticles.find((candidate) => candidate.id === relation.targetId);
      if (!target) throw new Error(`seed: статья «${relation.targetId}» не найдена`);
      return {
        type: "article",
        id: target.id,
        slug: target.slug,
        title: target.title,
        href: `/blog/${target.slug}`,
      };
    }

    const product = seedProducts.find((candidate) => candidate.id === relation.targetId);
    if (relation.targetType !== "product" || !product) {
      throw new Error(`seed: цель «${relation.targetType}:${relation.targetId}» не поддерживается`);
    }
    return {
      type: "product",
      id: product.id,
      slug: product.slug,
      title: product.fullTitle,
      href: `/products/${product.slug}`,
    };
  });
}

export const seedBlogPosts: BlogPost[] = seedArticles.map((article, index) => {
  // Публичное тело — тем же strip, что `server/content/articles.ts`. После REL-02F.3a секций в seed
  // нет, и strip здесь no-op (это проверяет `posts.test.ts`).
  const body = stripLegacyRelatedSection(article.bodyMarkdown);
  const wordCount = countWords(body);

  return {
    id: index + 1,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    description: article.seoDescription || article.description,
    category: article.category,
    tags: [...article.tags],
    publishedAt: article.publishedAt,
    publishedLabel: formatRuDate(article.publishedAt),
    modifiedAt: article.modifiedAt,
    modifiedLabel: formatRuDate(article.modifiedAt),
    author: article.author,
    readingTime: readingTimeLabel(wordCount),
    wordCount,
    draft: article.status !== "published",
    coverImage: article.coverUrl,
    coverAlt: article.coverAlt,
    seoTitle: normalizeSeoTitle(article.seoTitle),
    seoDescription: article.seoDescription,
    sections: parseBlogMarkdown(body),
    relatedMaterials: seedRelatedMaterials(article),
  };
});

export const seedDocumentCategories: DocumentCategory[] = seedDocuments.categories.map(
  (category) => ({ id: category.id, label: category.label }),
);

export const seedDocumentItems: DocumentItem[] = seedDocuments.documents.map((document) => ({
  id: document.id,
  title: document.title,
  description: document.description,
  category: document.category,
  fileType: document.sourceFile.split(".").pop() ?? "",
  fileUrl: `/api/files/documents/${document.id}`,
  previewUrl: document.previewFile?.replace(/^public\//, "/"),
  sortOrder: document.sortOrder,
  isPublished: document.isPublished,
  updatedAt: document.documentDate,
}));

export const seedContactChannels = seedContacts.map((contact) => ({
  id: contact.id,
  kind: contact.kind,
  label: contact.label,
  value: contact.value,
  href: contact.href,
  external: contact.isExternal,
  accessibleLabel: contact.accessibleLabel,
}));
