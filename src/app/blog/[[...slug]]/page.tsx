import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHomepageCopy } from "@/content/homepage-copy";
import {
  BLOG_URL,
  blogIndexStructuredData,
  blogPostStructuredData,
  blogPostUrl,
} from "@/features/blog/blogSeo";
import { BlogExperience } from "@/features/blog/BlogExperience";
import { SITE_URL } from "@/features/products/productSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import { buildOpenGraph, buildTwitter, INDEXABLE_ROBOTS, withBrand } from "@/lib/seo";
import { getArticleBySlug, getBlogPageCopy, getPublishedArticles } from "@/server/content/articles";

interface BlogPageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Раздел рендерится на запрос, а не на сборке.
 *
 * Причина конкретная, найдена на первом же деплое 2026-07-29: образ собирается там, где базы
 * контента ещё нет — она живёт на постоянном томе сервера и наполняется уже после сборки. Список
 * статей читается ТОЛЬКО из базы (в отличие от отделов и продуктов, у которых есть запасные тексты
 * в `data/`), поэтому пререндер запёк пустую страницу, и `db:seed` её уже не менял: готовый HTML
 * лежал в образе. Шесть статей были в базе, а посетитель видел пустой блог.
 *
 * Статический пререндер здесь и не имеет смысла: содержимое раздела на 100% принадлежит
 * админ-панели, разумного «состояния по умолчанию» для него не существует. Цена решения — разбор
 * Markdown на каждый запрос списка; для нагрузки этого сайта она незаметна, а гарантия того, что
 * посетитель видит ровно то, что лежит в базе, важнее.
 *
 * Из этого же следует, что `generateStaticParams` тут больше не нужен: адреса статей разрешаются
 * на запрос, и новый материал из админ-панели открывается сразу.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getArticleBySlug(slug?.[0]);
  const pageCopy = getBlogPageCopy();

  if (!post) {
    // `withBrand`, а не безусловная приписка: видимый заголовок раздела — «Блог QBit-Studio-Ai»,
    // и шаблон «%s — QBit-Studio-Ai» давал title «Блог QBit-Studio-Ai — QBit-Studio-Ai».
    const title = withBrand(pageCopy.headline);
    const image = {
      url: `${SITE_URL}/blog/workspace-notebook-1672.webp`,
      alt: "Рабочий стол с открытым блокнотом",
    };
    return {
      title,
      description: pageCopy.seoDescription,
      alternates: { canonical: BLOG_URL },
      robots: INDEXABLE_ROBOTS,
      openGraph: buildOpenGraph({
        title,
        description: pageCopy.seoDescription,
        url: BLOG_URL,
        images: [image],
      }),
      twitter: buildTwitter({
        title,
        description: pageCopy.seoDescription,
        images: [image.url],
      }),
    };
  }

  const canonical = blogPostUrl(post);
  const image = `${SITE_URL}${post.coverImage}`;

  /**
   * Один заголовок на три места: `<title>`, `og:title`, `twitter:title`.
   *
   * Раньше `<title>` брал `seoTitle`, а Open Graph и Twitter — видимый `post.title`, и на всех
   * шести статьях это давало три разных заголовка одной страницы. Заданный заголовок берётся
   * дословно (в нём уже есть бренд), у запасного бренд дописывает `withBrand`. Видимый H1 статьи
   * рисует `BlogExperience` из `post.title` — здесь он не участвует.
   */
  const seoTitle = post.seoTitle ?? withBrand(post.title);

  return {
    title: seoTitle,
    description: post.description,
    authors: [{ name: post.author, url: SITE_URL }],
    alternates: { canonical },
    robots: INDEXABLE_ROBOTS,
    openGraph: buildOpenGraph({
      title: seoTitle,
      description: post.description,
      url: canonical,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: image, alt: post.coverAlt || "Рабочий стол с открытым блокнотом" }],
    }),
    twitter: buildTwitter({
      title: seoTitle,
      description: post.description,
      images: [image],
    }),
  };
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { slug } = await params;

  if (slug && slug.length > 1) {
    notFound();
  }

  const posts = getPublishedArticles();
  const post = getArticleBySlug(slug?.[0]);
  if (slug?.[0] && !post) {
    notFound();
  }

  const copy = getHomepageCopy();
  const pageCopy = getBlogPageCopy();
  const structuredData = post
    ? blogPostStructuredData(post)
    : blogIndexStructuredData(posts, {
        headline: pageCopy.headline,
        description: pageCopy.seoDescription,
      });

  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/blog/workspace-notebook-1672.avif"
        imageSrcSet="/blog/workspace-notebook-960.avif 960w, /blog/workspace-notebook-1672.avif 1672w"
        imageSizes="100vw"
        type="image/avif"
        fetchPriority="high"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <BlogExperience
        posts={posts}
        pageCopy={pageCopy}
        initialSlug={post?.slug ?? null}
        ctaLabel={copy.taskSection.overviewCtaLabel}
        ctaHref={copy.contactHref}
        ctaText={copy.taskSection.intro}
      />
    </>
  );
}
