import type { MetadataRoute } from "next";
import { BLOG_URL, blogPostUrl } from "@/features/blog/blogSeo";
import { CONTACTS_URL } from "@/features/contacts/contactsSeo";
import { FAQ_PUBLISHED_AT, FAQ_URL } from "@/features/faq/faqSeo";
import { productUrl } from "@/features/products/productSeo";
import { SITE_URL } from "@/lib/seo";
import { getPublishedArticles } from "@/server/content/articles";
import { getProducts } from "@/server/content/products";

/**
 * Карта сайта. Только canonical-адреса публичных страниц, отвечающих 200.
 *
 * Чего здесь НЕТ и не должно появиться: `/admin`, `/login`, `/api/*`, прямых ссылок на файлы
 * документов (`/api/files/*`), адресов с параметрами запроса (`?department=…` — состояние главной,
 * а не отдельный документ) и неопубликованных материалов.
 *
 * `lastModified` проставляется ТОЛЬКО там, где есть настоящая дата изменения. Подставлять
 * `new Date()` всем строкам запрещено: это сообщало бы поисковой системе, что весь сайт
 * обновляется при каждой сборке, и обесценивало бы сигнал целиком.
 *
 * Карта пересобирается по `revalidatePath("/sitemap.xml")` из `src/server/api/revalidate.ts`
 * после каждой правки в админ-панели — иначе снятая с публикации статья оставалась бы в карте до
 * следующего деплоя.
 */
/**
 * Собирается на запрос. На сборке образа базы ещё нет, и статическая карта уходила в production
 * без единой статьи — проверено на живом домене 2026-07-29: 17 адресов вместо 23. Для карты сайта
 * это дороже, чем для страницы: поисковая система забирает её редко, и ошибка держится долго.
 */
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  // Списки читаются из базы: статью, созданную в админ-панели, поисковые системы должны увидеть
  // без пересборки проекта.
  const blogPosts = getPublishedArticles();
  const products = getProducts();

  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/products`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/documents`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/how-we-work`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: FAQ_URL,
      lastModified: FAQ_PUBLISHED_AT,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: CONTACTS_URL,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: BLOG_URL,
      lastModified: blogPosts[0]?.modifiedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPosts.map((post) => ({
      url: blogPostUrl(post),
      lastModified: post.modifiedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: productUrl(product),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
