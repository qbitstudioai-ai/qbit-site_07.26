import type { BlogSection } from "./markdown";

/**
 * Тип статьи и чистые операции над списком статей.
 *
 * САМИХ СТАТЕЙ здесь больше нет: они хранятся в базе и создаются в админ-панели (`/admin/blog`).
 * Исходные шесть материалов переехали в `data/seed/articles.json`, а сборка `BlogPost` из записи
 * базы живёт в `src/server/content/articles.ts`.
 *
 * Модуль не серверный и не клиентский: его типы нужны и странице, и клиентскому `BlogExperience`,
 * поэтому доступа к базе здесь нет.
 */
export type BlogPost = {
  /** Порядковый номер в текущем списке (1, 2, 3…). Используется для нумерации и индикатора. */
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  description: string;
  category: string;
  tags: string[];
  publishedAt: string;
  publishedLabel: string;
  modifiedAt: string;
  modifiedLabel: string;
  author: string;
  readingTime: string;
  wordCount: number;
  draft: boolean;
  coverImage: string;
  coverAlt: string;
  /**
   * Заголовок и описание для поисковых систем. Редактируются отдельно от текста статьи.
   *
   * `seoTitle === null` — заголовок не задан, страница собирает его из `title`. Видимый заголовок
   * статьи от этого поля не зависит ни в каком состоянии.
   */
  seoTitle: string | null;
  seoDescription: string;
  sections: BlogSection[];
  relatedSlugs: string[];
};

export function findBlogPost(posts: readonly BlogPost[], slug?: string): BlogPost | undefined {
  return slug ? posts.find((post) => post.slug === slug) : undefined;
}

export function findRelatedBlogPosts(posts: readonly BlogPost[], post: BlogPost): BlogPost[] {
  return post.relatedSlugs
    .map((slug) => findBlogPost(posts, slug))
    .filter((candidate): candidate is BlogPost => Boolean(candidate));
}

export function findAdjacentBlogPosts(posts: readonly BlogPost[], post: BlogPost) {
  const index = posts.findIndex((candidate) => candidate.slug === post.slug);
  return {
    previous: index > 0 ? posts[index - 1] : undefined,
    next: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/**
 * "2026-07-25" → "25 июля 2026". Формат собирается вручную, а не через `Intl`: результат обязан
 * совпасть на сервере и на клиенте (иначе hydration mismatch) и не зависеть от локали хоста.
 */
export function formatRuDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  const monthName = MONTHS_GENITIVE[Number(month) - 1];
  if (!monthName) return isoDate;

  return `${Number(day)} ${monthName} ${year}`;
}

/** Слова текста без кода: по ним считается время чтения. */
export function countWords(markdown: string): number {
  return (
    markdown.replace(/```[\s\S]*?```/gu, " ").match(/[\p{L}\p{N}]+(?:[-–][\p{L}\p{N}]+)*/gu)
      ?.length ?? 0
  );
}

export function readingTimeLabel(wordCount: number): string {
  return `${Math.max(1, Math.ceil(wordCount / 180))} мин`;
}
