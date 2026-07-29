import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seedArticles from "../../../../../data/seed/articles.json";
import { findAdjacentBlogPosts, findBlogPost, findRelatedBlogPosts } from "@/features/blog/posts";
import { seedBlogPosts as blogPosts } from "@/tests/fixtures/seedContent";

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
