import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seedArticles from "../../../../../data/seed/articles.json";
import { findAdjacentBlogPosts, findBlogPost, findRelatedBlogPosts } from "@/features/blog/posts";
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

function sectionMarkdown(post: (typeof blogPosts)[number]): string {
  return post.sections
    .flatMap((section) =>
      section.blocks.map((block) => {
        if (block.type === "paragraph") return block.markdown;
        if (block.type === "code") return block.value;
        return block.items.join("\n");
      }),
    )
    .join("\n");
}

/**
 * Проверки исходного набора статей.
 *
 * После переезда контента в базу сами статьи живут там, а `data/seed/articles.json` — то, чем базу
 * заполняют при установке. Поэтому проверяется именно seed: он обязан совпадать с каноническими
 * Markdown-файлами в `src/content/blog` и сохранять все требования к материалу (источники, связи,
 * объём, автор).
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
      expect(post.sections.some((section) => section.heading === "Материалы по теме")).toBe(true);
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

  it("добавляет ровно одну целевую ссылку на продукт в существующий блок материалов по теме", () => {
    for (const post of blogPosts) {
      const target = TARGET_PRODUCT_LINKS[post.slug];
      expect(target, post.slug).toBeDefined();

      const markdown = sectionMarkdown(post);
      const targetMatches = markdown.match(markdownLinkPattern(target.anchor, target.href)) ?? [];
      expect(targetMatches, post.slug).toHaveLength(1);

      const relatedSection = post.sections.find(
        (section) => section.heading === "Материалы по теме",
      );
      const relatedMarkdown = relatedSection?.blocks
        .map((block) =>
          "items" in block
            ? block.items.join("\n")
            : block.type === "code"
              ? block.value
              : block.markdown,
        )
        .join("\n");
      expect(relatedMarkdown, post.slug).toContain(`[${target.anchor}](${target.href})`);
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
      const markdown = sectionMarkdown(post);
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

  it("даёт две связанные опубликованные статьи без ссылки на себя", () => {
    for (const post of blogPosts) {
      const related = findRelatedBlogPosts(blogPosts, post);
      expect(related).toHaveLength(2);
      expect(related).not.toContain(post);
      expect(related.every((candidate) => candidate.draft === false)).toBe(true);
    }
  });
});
