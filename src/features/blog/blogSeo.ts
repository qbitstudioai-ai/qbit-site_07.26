import {
  breadcrumbNode,
  CONTENT_LANGUAGE,
  ORGANIZATION_ID,
  organizationNode,
  SITE_URL,
  webPageNode,
  withBrand,
} from "@/lib/seo";
import type { BlogPost } from "./posts";

export const BLOG_URL = `${SITE_URL}/blog`;

export function blogPostUrl(post: BlogPost) {
  return `${BLOG_URL}/${post.slug}`;
}

export function blogPostStructuredData(post: BlogPost) {
  const url = blogPostUrl(post);
  const image = `${SITE_URL}${post.coverImage}`;

  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Блог", url: BLOG_URL },
      { name: post.title, url },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt,
      wordCount: post.wordCount,
      inLanguage: CONTENT_LANGUAGE,
      articleSection: post.category,
      keywords: post.tags,
      /**
       * Автор — ровно то значение, что хранится у статьи и показано читателю в подписи. Здесь
       * НЕЛЬЗЯ подставлять человека «по умолчанию»: указанный в разметке автор, которого нет на
       * странице, это заявление о несуществующем авторстве.
       */
      author: {
        "@type": "Organization",
        name: post.author,
        url: SITE_URL,
      },
      publisher: { "@id": ORGANIZATION_ID },
      mainEntityOfPage: { "@id": `${url}#webpage` },
      url,
      image,
    },
    webPageNode({
      url,
      name: post.title,
      description: post.description,
    }),
    organizationNode(),
  ];
}

/**
 * `headline`/`description` приходят из содержимого раздела (правится в админ-панели), а не
 * зашиты здесь: описание в разметке обязано совпадать с описанием страницы, иначе поисковая
 * система видит два разных заявления об одном документе.
 */
export function blogIndexStructuredData(
  posts: readonly BlogPost[],
  page: { headline: string; description: string },
) {
  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Блог", url: BLOG_URL },
    ]),
    webPageNode({
      url: BLOG_URL,
      name: withBrand(page.headline),
      description: page.description,
      type: "CollectionPage",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: withBrand(page.headline),
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.title,
        url: blogPostUrl(post),
      })),
    },
    organizationNode(),
  ];
}
