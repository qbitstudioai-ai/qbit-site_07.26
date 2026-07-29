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
 * `dynamicParams = true`: статьи создаются в админ-панели уже после сборки. При `false` новый
 * материал открывался бы только после следующего деплоя — ровно то, ради чего затевалась
 * админ-панель.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ slug: [] }, ...getPublishedArticles().map((post) => ({ slug: [post.slug] }))];
}

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

  return {
    title: post.seoTitle || withBrand(post.title),
    description: post.description,
    authors: [{ name: post.author, url: SITE_URL }],
    alternates: { canonical },
    robots: INDEXABLE_ROBOTS,
    openGraph: buildOpenGraph({
      title: post.title,
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
      title: post.title,
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
