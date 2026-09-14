import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/features/blog/posts";

/**
 * Связанные статьи при переходе без перезагрузки (Amendment 60 / REL-02E.2).
 *
 * `BlogExperience` не запрашивает связи заново: при клике он меняет открытую статью внутри уже
 * полученного `posts` и лишь затем сообщает адрес роутеру. Поэтому связанные статьи новой статьи
 * обязаны уже лежать в её элементе `posts[]`. Тест проверяет ровно это: пропсы не перерисовываются, а
 * блок после перехода показывает связи целевой статьи.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { BlogExperience } from "@/features/blog/BlogExperience";

function post(id: number, relatedSlugs: string[]): BlogPost {
  return {
    id,
    slug: `statya-${id}`,
    title: `Статья номер ${id}`,
    excerpt: `Анонс ${id}`,
    description: `Описание ${id}`,
    category: "Процессы",
    tags: [],
    publishedAt: "2026-09-01",
    publishedLabel: "1 сентября 2026",
    modifiedAt: "2026-09-01",
    modifiedLabel: "1 сентября 2026",
    author: "QBit-Studio-Ai",
    readingTime: "1 мин",
    wordCount: 10,
    draft: false,
    coverImage: "",
    coverAlt: "",
    seoTitle: null,
    seoDescription: "",
    sections: [],
    relatedSlugs,
  };
}

const POSTS: BlogPost[] = [post(1, ["statya-2"]), post(2, ["statya-3", "statya-1"]), post(3, [])];

const PAGE_COPY = {
  eyebrow: "Блог",
  headline: "Блог QBit-Studio-Ai",
  railTitle: "Статьи",
  seoDescription: "Описание блога",
};

function relatedHrefs(): string[] {
  const block = screen.getByRole("complementary", { name: "Связанные статьи" });
  return within(block)
    .queryAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "");
}

function experience(initialSlug: string) {
  return (
    <BlogExperience
      posts={POSTS}
      pageCopy={PAGE_COPY}
      initialSlug={initialSlug}
      ctaLabel="Получить разбор"
      ctaHref="https://example.com"
      ctaText="Текст"
    />
  );
}

function expectOpenArticle(title: string, hrefs: string[]): void {
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  expect(relatedHrefs()).toEqual(hrefs);
}

describe("BlogExperience: связанные статьи после перехода без перезагрузки", () => {
  const originalScrollTo = Element.prototype.scrollTo;

  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    // jsdom не реализует прокрутку элементов; переход прокручивает статью к началу. Заглушка живёт в
    // этом файле, а не в продуктовом коде: в браузере `scrollTo` есть всегда.
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
  });

  afterEach(() => {
    vi.useRealTimers();
    Element.prototype.scrollTo = originalScrollTo;
  });

  /**
   * Порядок событий повторяет приложение. Клик: статья уходит, по таймеру открывается целевая и
   * вызывается `router.push`. Проверка сразу после этого — окно ДО ответа сервера, где связанные
   * статьи могут взяться только из уже полученного `posts[]`. Затем ответ роутера имитируется тем, что
   * он реально меняет: `initialSlug`. Массив `posts` остаётся тем же объектом — новых данных о связях
   * компонент не получает.
   */
  it("показывает связи целевой статьи из уже полученного posts[]", () => {
    const { rerender } = render(experience("statya-1"));
    expectOpenArticle("Статья номер 1", ["/blog/statya-2"]);

    const hops = [
      { title: "Статья номер 2", slug: "statya-2", hrefs: ["/blog/statya-3", "/blog/statya-1"] },
      { title: "Статья номер 3", slug: "statya-3", hrefs: [] },
    ];

    for (const hop of hops) {
      const block = screen.getByRole("complementary", { name: "Связанные статьи" });
      fireEvent.click(within(block).getByRole("link", { name: new RegExp(hop.title) }));

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(push).toHaveBeenLastCalledWith(`/blog/${hop.slug}`, { scroll: false });
      expectOpenArticle(hop.title, hop.hrefs);

      rerender(experience(hop.slug));
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expectOpenArticle(hop.title, hop.hrefs);
    }
  });
});
