import seedArticles from "../../../data/seed/articles.json";
import seedContacts from "../../../data/seed/contacts.json";
import seedDocuments from "../../../data/seed/documents.json";
import seedProducts from "../../../data/seed/products.json";
import { stripLegacyRelatedSection } from "@/features/blog/articleBody";
import { extractLegacyRelatedSection } from "@/features/blog/legacyRelatedSection.mjs";
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
 * Материалы по теме на СВЕЖЕЙ seed-базе (REL-02F.1/F.2): сначала статьи из `relatedSlugs`, затем
 * продукты и кейсы из legacy-секции текста — ровно в том порядке, в каком их пишет `db:seed`.
 *
 * `id` статьи здесь — её адрес: seed присваивает статьям случайный идентификатор при вставке, и
 * узнать его без базы нельзя. Проверки по фикстуре сравнивают адреса и названия, а не `id`.
 */
function seedRelatedMaterials(article: (typeof seedArticles)[number]): PublicRelatedMaterial[] {
  const articles = article.relatedSlugs.map((slug): PublicRelatedMaterial => {
    const target = seedArticles.find((candidate) => candidate.slug === slug);
    if (!target) throw new Error(`seed: связанная статья «${slug}» не найдена`);
    return { type: "article", id: slug, slug, title: target.title, href: `/blog/${slug}` };
  });

  const extraction = extractLegacyRelatedSection(article.bodyMarkdown);
  const materials =
    extraction.state === "ok"
      ? extraction.targets
          .filter((target) => target.type !== "article")
          .map((target): PublicRelatedMaterial => {
            const product = seedProducts.find((candidate) => candidate.slug === target.slug);
            if (target.type !== "product" || !product) {
              throw new Error(`seed: цель «${target.href}» не является продуктом seed`);
            }
            return {
              type: "product",
              id: product.id,
              slug: product.slug,
              title: product.fullTitle,
              href: `/products/${product.slug}`,
            };
          })
      : [];

  return [...articles, ...materials];
}

export const seedBlogPosts: BlogPost[] = seedArticles.map((article, index) => {
  // Публичное тело — без скрытой legacy-секции, как у `server/content/articles.ts`.
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
