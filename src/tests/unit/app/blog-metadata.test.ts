import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/features/blog/posts";
import { seedBlogPosts } from "@/tests/fixtures/seedContent";

/**
 * `<title>`, `og:title` и `twitter:title` статьи.
 *
 * До 2026-07-30 заголовок расходился внутри одной страницы: `<title>` брал SEO-заголовок, а
 * Open Graph и Twitter — видимое название статьи. Тест фиксирует, что все три берутся из одного
 * места, и что при пустом SEO-заголовке работает прежний запасной вариант «название + бренд».
 */

const post = seedBlogPosts[0];

const getArticleBySlug = vi.fn<(slug?: string) => BlogPost | undefined>();

vi.mock("@/server/content/articles", () => ({
  getArticleBySlug: (slug?: string) => getArticleBySlug(slug),
  getPublishedArticles: () => [],
  getBlogPageCopy: () => ({
    eyebrow: "Блог",
    headline: "Блог QBit-Studio-Ai",
    railTitle: "Материалы",
    seoDescription: "Материалы об автоматизации бизнес-процессов.",
  }),
}));

async function metadataFor(article: BlogPost | undefined) {
  getArticleBySlug.mockReturnValue(article);
  const { generateMetadata } = await import("@/app/blog/[[...slug]]/page");
  return generateMetadata({ params: Promise.resolve({ slug: [post.slug] }) });
}

describe("metadata статьи", () => {
  beforeEach(() => {
    getArticleBySlug.mockReset();
  });

  it("заданный SEO-заголовок попадает во все три места", async () => {
    const metadata = await metadataFor(post);

    expect(post.seoTitle).not.toBeNull();
    expect(metadata.title).toBe(post.seoTitle);
    expect(metadata.openGraph?.title).toBe(post.seoTitle);
    expect(metadata.twitter?.title).toBe(post.seoTitle);
  });

  it("пустой SEO-заголовок возвращает прежний вариант «название + бренд»", async () => {
    const metadata = await metadataFor({ ...post, seoTitle: null });
    const expected = `${post.title} — QBit-Studio-Ai`;

    expect(metadata.title).toBe(expected);
    expect(metadata.openGraph?.title).toBe(expected);
    expect(metadata.twitter?.title).toBe(expected);
  });

  it("бренд не дописывается второй раз, если он уже внутри названия", async () => {
    const metadata = await metadataFor({
      ...post,
      seoTitle: null,
      title: "Блог QBit-Studio-Ai о заявках",
    });

    expect(metadata.title).toBe("Блог QBit-Studio-Ai о заявках");
    expect(String(metadata.title).match(/QBit-Studio-Ai/g)).toHaveLength(1);
  });

  it("заданный заголовок берётся дословно — бренд не приписывается автоматически", async () => {
    // Иначе сохранённая строка и строка в выдаче различались бы, а владелец сайта об этом не знал.
    const metadata = await metadataFor({ ...post, seoTitle: "Заголовок без бренда" });

    expect(metadata.title).toBe("Заголовок без бренда");
  });

  it("SEO-заголовок не влияет на description, canonical и авторство", async () => {
    const withTitle = await metadataFor(post);
    const withoutTitle = await metadataFor({ ...post, seoTitle: null });

    expect(withTitle.description).toBe(withoutTitle.description);
    expect(withTitle.alternates?.canonical).toBe(withoutTitle.alternates?.canonical);
    expect(withTitle.alternates?.canonical).toBe(`https://allqbit.ru/blog/${post.slug}`);
    expect(withTitle.authors).toEqual(withoutTitle.authors);
    expect(withTitle.openGraph?.images).toEqual(withoutTitle.openGraph?.images);
  });
});
