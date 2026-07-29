import seedArticles from "../../../data/seed/articles.json";
import seedContacts from "../../../data/seed/contacts.json";
import seedDocuments from "../../../data/seed/documents.json";
import seedProducts from "../../../data/seed/products.json";
import type { BlogPost } from "@/features/blog/posts";
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
  }),
);

export const seedBlogPosts: BlogPost[] = seedArticles.map((article, index) => {
  const wordCount = countWords(article.bodyMarkdown);

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
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    sections: parseBlogMarkdown(article.bodyMarkdown),
    relatedSlugs: [...article.relatedSlugs],
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
