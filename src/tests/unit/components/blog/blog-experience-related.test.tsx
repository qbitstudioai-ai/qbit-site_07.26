import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost, PublicRelatedMaterial } from "@/features/blog/posts";

/**
 * Единый блок «Материалы по теме» и переход без перезагрузки (Amendment 61 / REL-02F.2).
 *
 * `BlogExperience` не запрашивает связи заново: при клике он меняет открытую статью внутри уже
 * полученного `posts` и лишь затем сообщает адрес роутеру. Поэтому материалы новой статьи обязаны
 * уже лежать в её элементе `posts[]`. Статья открывается переходом без перезагрузки, продукт и кейс —
 * обычная ссылка без перехвата.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { BlogExperience } from "@/features/blog/BlogExperience";

const article = (id: number): PublicRelatedMaterial => ({
  type: "article",
  id: `uuid-${id}`,
  slug: `statya-${id}`,
  title: `Статья номер ${id}`,
  href: `/blog/statya-${id}`,
});

const PRODUCT: PublicRelatedMaterial = {
  type: "product",
  id: "product-03",
  slug: "leads-to-crm",
  title: "Единый сбор заявок в CRM",
  href: "/products/leads-to-crm",
};

const CASE: PublicRelatedMaterial = {
  type: "case",
  id: "case-sales-call-analysis",
  slug: "analiz-zvonkov-otdela-prodazh",
  title: "AI-анализ звонков отдела продаж",
  href: "/cases/analiz-zvonkov-otdela-prodazh",
};

/** Статья, которой нет в списке `posts` (например, другой раздел в старом кэше клиента). */
const MISSING_ARTICLE: PublicRelatedMaterial = {
  type: "article",
  id: "uuid-missing",
  slug: "statya-ne-v-spiske",
  title: "Статья не из списка",
  href: "/blog/statya-ne-v-spiske",
};

function post(id: number, relatedMaterials: PublicRelatedMaterial[]): BlogPost {
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
    sections: [
      { id: "razdel", heading: "Раздел", blocks: [{ type: "paragraph", markdown: "Текст." }] },
    ],
    relatedMaterials,
  };
}

const POSTS: BlogPost[] = [
  post(1, [article(2), PRODUCT, CASE, MISSING_ARTICLE]),
  post(2, [article(3), article(1)]),
  post(3, []),
];

const PAGE_COPY = {
  eyebrow: "Блог",
  headline: "Блог QBit-Studio-Ai",
  railTitle: "Статьи",
  seoDescription: "Описание блога",
};

function block() {
  return screen.getByRole("complementary", { name: "Материалы по теме" });
}

function materialHrefs(): string[] {
  return within(block())
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

function expectOpenArticle(title: string): void {
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
}

describe("BlogExperience: единый блок «Материалы по теме»", () => {
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

  it("один блок «Материалы по теме», без «Связанные статьи», в сохранённом смешанном порядке", () => {
    render(experience("statya-1"));

    expect(screen.getAllByRole("heading", { level: 2, name: "Материалы по теме" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Связанные статьи" })).not.toBeInTheDocument();
    expect(screen.queryByText("Связанные статьи")).not.toBeInTheDocument();
    expect(materialHrefs()).toEqual([
      "/blog/statya-2",
      "/products/leads-to-crm",
      "/cases/analiz-zvonkov-otdela-prodazh",
      "/blog/statya-ne-v-spiske",
    ]);

    // Подпись типа — текстом, а не только оформлением.
    const links = within(block()).getAllByRole("link");
    expect(links[0]).toHaveTextContent("Статья · Процессы");
    expect(links[0]).toHaveTextContent("Статья номер 2");
    expect(links[1]).toHaveTextContent("Продукт");
    expect(links[1]).toHaveTextContent("Единый сбор заявок в CRM");
    expect(links[2]).toHaveTextContent("Кейс");
    expect(links[3]).toHaveTextContent("Статья");
  });

  /**
   * Порядок событий повторяет приложение. Клик: статья уходит, по таймеру открывается целевая и
   * вызывается `router.push`. Проверка сразу после этого — окно ДО ответа сервера, где материалы
   * могут взяться только из уже полученного `posts[]`. Затем ответ роутера имитируется тем, что он
   * реально меняет: `initialSlug`. Массив `posts` остаётся тем же объектом.
   */
  it("статья открывается без перезагрузки, и блок показывает материалы ЦЕЛЕВОЙ статьи", () => {
    const { rerender } = render(experience("statya-1"));

    const hops = [
      { title: "Статья номер 2", slug: "statya-2", hrefs: ["/blog/statya-3", "/blog/statya-1"] },
    ];

    for (const hop of hops) {
      fireEvent.click(within(block()).getByRole("link", { name: new RegExp(hop.title) }));

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(push).toHaveBeenLastCalledWith(`/blog/${hop.slug}`, { scroll: false });
      expectOpenArticle(hop.title);
      expect(materialHrefs()).toEqual(hop.hrefs);

      rerender(experience(hop.slug));
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expectOpenArticle(hop.title);
      expect(materialHrefs()).toEqual(hop.hrefs);
    }

    // Третья статья без материалов: блок не рендерится вовсе.
    fireEvent.click(within(block()).getByRole("link", { name: /Статья номер 3/ }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expectOpenArticle("Статья номер 3");
    expect(screen.queryByRole("complementary", { name: "Материалы по теме" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Материалы по теме" })).toBeNull();
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["средняя кнопка", { button: 1 }],
  ])("%s-клик по статье не перехватывается", (_label, init) => {
    render(experience("statya-1"));

    const link = within(block()).getByRole("link", { name: /Статья номер 2/ });
    const notPrevented = fireEvent.click(link, init);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(notPrevented).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expectOpenArticle("Статья номер 1");
  });

  it.each([
    ["продукт", "Единый сбор заявок в CRM", "/products/leads-to-crm"],
    ["кейс", "AI-анализ звонков отдела продаж", "/cases/analiz-zvonkov-otdela-prodazh"],
    ["статья не из списка", "Статья не из списка", "/blog/statya-ne-v-spiske"],
  ])("%s — обычная ссылка без перехода внутри блога", (_label, title, href) => {
    render(experience("statya-1"));

    const link = within(block()).getByRole("link", { name: new RegExp(title) });
    expect(link).toHaveAttribute("href", href);

    fireEvent.click(link);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(push).not.toHaveBeenCalled();
    expectOpenArticle("Статья номер 1");
  });

  it("пустой список материалов — блока нет", () => {
    render(experience("statya-3"));

    expectOpenArticle("Статья номер 3");
    expect(screen.queryByRole("complementary", { name: "Материалы по теме" })).toBeNull();
    expect(screen.queryByText("Продолжить чтение")).toBeNull();
  });
});
