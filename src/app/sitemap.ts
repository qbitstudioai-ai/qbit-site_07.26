import type { MetadataRoute } from "next";
import { BLOG_URL, blogPostUrl } from "@/features/blog/blogSeo";
import { CONTACTS_URL } from "@/features/contacts/contactsSeo";
import { FAQ_PUBLISHED_AT, FAQ_URL } from "@/features/faq/faqSeo";
import { productUrl } from "@/features/products/productSeo";
import { SITE_URL } from "@/lib/seo";
import { getPublishedArticles } from "@/server/content/articles";
import {
  blogIndexPageContentLastModified,
  contactsLastModified,
  documentsLastModified,
  homepageLastModified,
  latestDate,
  productLastModifiedBySlug,
  productsIndexLastModified,
} from "@/server/content/lastModified";
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
  const productDates = productLastModifiedBySlug();

  /**
   * Дата раздела «Блог» — позднейшая из даты самого текста раздела и дат всех опубликованных
   * статей. Прежнее `blogPosts[0]?.modifiedAt` брало первую строку списка, а список отсортирован
   * по `sort_order`, затем по дате публикации — то есть первой оказывалась не обязательно самая
   * свежая по ИЗМЕНЕНИЮ статья. Правка старого материала не двигала дату раздела вовсе.
   */
  const blogLastModified = latestDate(
    blogIndexPageContentLastModified()?.toISOString(),
    ...blogPosts.map((post) => post.modifiedAt),
  );

  return [
    {
      url: SITE_URL,
      lastModified: homepageLastModified(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: productsIndexLastModified(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/documents`,
      lastModified: documentsLastModified(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      // `lastModified` здесь СОЗНАТЕЛЬНО нет. Содержимое `/how-we-work` целиком лежит в коде
      // (`src/features/how-we-work/HowWeWorkPage.tsx`), в базе у страницы нет ни строки, а значит
      // и настоящей даты изменения. Дата сборки или «сегодня» на её месте были бы выдумкой —
      // см. док-комментарий `src/server/content/lastModified.ts`.
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
      lastModified: contactsLastModified(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: BLOG_URL,
      lastModified: blogLastModified,
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
      // Продукта может не быть в базе — тогда каталог отдаётся запасным набором из `data/`, и
      // настоящей даты у него нет. `undefined` означает строку без `lastmod`.
      lastModified: productDates.get(product.slug),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
