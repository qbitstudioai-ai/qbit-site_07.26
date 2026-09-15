import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seedArticles from "../../../../../data/seed/articles.json";
import { extractLegacyRelatedSection } from "@/features/blog/legacyRelatedSection.mjs";
import { findAdjacentBlogPosts, findBlogPost } from "@/features/blog/posts";
import { seedBlogPosts as blogPosts } from "@/tests/fixtures/seedContent";

const TARGET_PRODUCT_LINKS: Record<string, { href: string; anchor: string }> = {
  "kak-avtomatizirovat-obrabotku-zayavok": {
    href: "/products/leads-to-crm",
    anchor: "Единый сбор заявок в CRM",
  },
  "ai-assistent-po-baze-znaniy": {
    href: "/products/rag-ai-assistant",
    anchor: "AI-ассистент по знаниям компании",
  },
  "analiz-zvonkov-otdela-prodazh": {
    href: "/products/call-analysis",
    anchor: "AI-контроль качества звонков",
  },
  "avtomatizatsiya-dokumentov-s-ai": {
    href: "/products/document-analysis",
    anchor: "AI-обработка и анализ документов",
  },
  "sayt-crm-i-messendzhery": {
    href: "/products/leads-to-crm",
    anchor: "Единый сбор заявок с сайта и мессенджеров в CRM",
  },
  "chto-mozhno-avtomatizirovat-na-n8n": {
    href: "/products/n8n-automation",
    anchor: "Автоматизация бизнес-процесса на n8n",
  },
};

const PUBLIC_INTERNAL_PREFIXES = ["/blog/", "/products/"] as const;

function markdownLinkPattern(anchor: string, href: string): RegExp {
  return new RegExp(`\\[${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\(${href}\\)`, "g");
}

function seedArticle(slug: string) {
  const article = seedArticles.find((candidate) => candidate.slug === slug);
  if (!article) throw new Error(`seed-статья «${slug}» не найдена`);
  return article;
}

/**
 * Проверки исходного набора статей.
 *
 * После переезда контента в базу сами статьи живут там, а `data/seed/articles.json` — то, чем базу
 * заполняют при установке. Поэтому проверяется именно seed: он обязан совпадать с каноническими
 * Markdown-файлами в `src/content/blog` и сохранять все требования к материалу (источники, связи,
 * объём, автор).
 *
 * Legacy-секция «Материалы по теме» (REL-02F.2) остаётся в СЫРОМ тексте seed до REL-02F.3, но в
 * публичные разделы не попадает: проверки ссылок секции идут по сырому тексту, а не по `sections`.
 */
describe("исходный набор статей", () => {
  it("содержит шесть статей с уникальными адресами, названиями и описаниями", () => {
    expect(blogPosts).toHaveLength(6);
    expect(new Set(blogPosts.map((post) => post.slug)).size).toBe(blogPosts.length);
    expect(new Set(blogPosts.map((post) => post.title)).size).toBe(blogPosts.length);
    expect(new Set(blogPosts.map((post) => post.description)).size).toBe(blogPosts.length);
    expect(blogPosts.every((post) => !/[*[\]`]/.test(post.description))).toBe(true);
    expect(blogPosts.every((post) => post.draft === false)).toBe(true);
  });

  it("оставляет /blog списком и находит статью по адресу", () => {
    expect(findBlogPost(blogPosts)).toBeUndefined();
    expect(findBlogPost(blogPosts, blogPosts[1].slug)).toBe(blogPosts[1]);
    expect(findBlogPost(blogPosts, "missing")).toBeUndefined();
  });

  it("совпадает с каноническими Markdown-файлами и сохраняет требования к материалу", () => {
    for (const [index, post] of blogPosts.entries()) {
      const seed = seedArticles[index];
      const canonicalMarkdown = readFileSync(
        path.join(process.cwd(), "src", "content", "blog", `${seed.slug}.md`),
        "utf8",
      ).replace(/\r\n/g, "\n");

      // Тело статьи в seed — тот же файл без служебной шапки: заголовка, дат, автора и строки
      // «Краткий ответ». Проверяем, что текст не разошёлся с источником.
      expect(canonicalMarkdown).toContain(seed.bodyMarkdown.slice(0, 200));
      expect(canonicalMarkdown).toContain(seed.excerpt.slice(0, 120));
      expect(canonicalMarkdown.startsWith(`# ${index + 1}. ${seed.title}`)).toBe(true);

      expect(post.sections.some((section) => section.heading === "Источники")).toBe(true);
      // Секция есть в сыром тексте и распознана, но в публичных разделах её нет.
      expect(extractLegacyRelatedSection(seed.bodyMarkdown).state).toBe("ok");
      expect(post.sections.some((section) => section.heading === "Материалы по теме")).toBe(false);
      const sources = post.sections.find((section) => section.heading === "Источники");
      expect(JSON.stringify(sources)).toMatch(/https:\/\//);
      expect(post.wordCount).toBeGreaterThan(500);
      expect(post.readingTime).toMatch(/^\d+ мин$/);
      expect(post.author).toBe("QBit-Studio-Ai");
      expect(post.modifiedAt).toBe("2026-07-25");
      expect(post.modifiedAt >= post.publishedAt).toBe(true);
      expect(new Set(post.sections.map((section) => section.id)).size).toBe(post.sections.length);
      expect(canonicalMarkdown).not.toMatch(/\/examples|\/ai-assistant-for-business/);
    }
  });

  it("держит ровно одну целевую ссылку на продукт в legacy-секции сырого текста", () => {
    for (const post of blogPosts) {
      const target = TARGET_PRODUCT_LINKS[post.slug];
      expect(target, post.slug).toBeDefined();

      const markdown = seedArticle(post.slug).bodyMarkdown;
      const targetMatches = markdown.match(markdownLinkPattern(target.anchor, target.href)) ?? [];
      expect(targetMatches, post.slug).toHaveLength(1);

      const extraction = extractLegacyRelatedSection(markdown);
      if (extraction.state !== "ok") throw new Error(`${post.slug}: секция не распознана`);
      expect(markdown.slice(extraction.range.start, extraction.range.end), post.slug).toContain(
        `[${target.anchor}](${target.href})`,
      );
    }
  });

  it("не содержит битых внутренних ссылок на публичные статьи и продукты", () => {
    const blogSlugs = new Set(blogPosts.map((post) => post.slug));
    const productSlugs = new Set([
      "rag-ai-assistant",
      "ai-manager",
      "leads-to-crm",
      "crm-ai-assistant",
      "call-analysis",
      "hr-ai-assistant",
      "sales-analytics",
      "document-analysis",
      "meeting-protocol",
      "n8n-automation",
    ]);

    for (const post of blogPosts) {
      // Сырой текст, включая скрытую legacy-секцию: битая ссылка в ней — такой же дефект данных.
      const markdown = seedArticle(post.slug).bodyMarkdown;
      const links = [...markdown.matchAll(/\[[^\]]+\]\((\/[^)#?]+)\)/g)].map((match) => match[1]);

      for (const href of links) {
        if (!PUBLIC_INTERNAL_PREFIXES.some((prefix) => href.startsWith(prefix))) continue;
        if (href.startsWith("/blog/")) {
          expect(blogSlugs, `${post.slug}: ${href}`).toContain(href.slice("/blog/".length));
        }
        if (href.startsWith("/products/")) {
          expect(productSlugs, `${post.slug}: ${href}`).toContain(href.slice("/products/".length));
        }
      }
    }
  });

  it("сохраняет утверждённое описание статьи про CRM", () => {
    expect(findBlogPost(blogPosts, "sayt-crm-i-messendzhery")?.description).toBe(
      "Как объединить сайт, CRM и мессенджеры: передача заявок, нормализация данных, дедупликация, уведомления и контроль ошибок.",
    );
  });

  it("даёт навигацию по соседним статьям", () => {
    expect(findAdjacentBlogPosts(blogPosts, blogPosts[0])).toEqual({
      previous: undefined,
      next: blogPosts[1],
    });
    expect(findAdjacentBlogPosts(blogPosts, blogPosts.at(-1)!)).toEqual({
      previous: blogPosts.at(-2),
      next: undefined,
    });
  });

  it("даёт две связанные опубликованные статьи и один продукт, без ссылки на себя", () => {
    for (const post of blogPosts) {
      const articles = post.relatedMaterials.filter((material) => material.type === "article");
      expect(articles, post.slug).toHaveLength(2);
      expect(articles.map((material) => material.slug)).not.toContain(post.slug);
      for (const material of articles) {
        expect(findBlogPost(blogPosts, material.slug)?.draft, material.slug).toBe(false);
      }
      expect(post.relatedMaterials.map((material) => material.href)).toEqual([
        ...articles.map((material) => `/blog/${material.slug}`),
        TARGET_PRODUCT_LINKS[post.slug].href,
      ]);
    }
  });
});
