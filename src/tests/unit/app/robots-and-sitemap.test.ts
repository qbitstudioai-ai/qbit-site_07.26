import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/seo";
import { seedBlogPosts, seedProductLocations } from "@/tests/fixtures/seedContent";

/**
 * `robots.txt` и `sitemap.xml` — единственные два файла, которые поисковая система читает раньше
 * страниц. Ошибка в них не видна ни на одной странице сайта, поэтому проверяется отдельно.
 *
 * Модули читают базу, поэтому источники контента подменяются исходным seed-содержимым: проверять
 * нужно СОСТАВ карты сайта, а не наличие запущенной базы.
 */

vi.mock("@/server/content/articles", () => ({
  getPublishedArticles: () => seedBlogPosts.filter((post) => !post.draft),
}));

vi.mock("@/server/content/products", () => ({
  getProducts: () => seedProductLocations,
}));

/**
 * Даты изменения подменяются заведомо известными значениями.
 *
 * Так проверяется само требование: `lastmod` берётся из слоя данных, а не из часов в момент
 * отрисовки. Прежняя проверка «дата не равна сегодняшней» это требование лишь имитировала и
 * оказалась неверной по существу — страница, отредактированная сегодня, ОБЯЗАНА иметь сегодняшнюю
 * дату. Она и упала 2026-07-29 на `/documents`, у которого `updated_at` был настоящим и сегодняшним.
 *
 * `latestDate` оставлен настоящим: он чистый и участвует в вычислении даты раздела «Блог».
 */
const STUB_DATES = {
  homepage: new Date("2026-07-01T10:00:00.000Z"),
  productsIndex: new Date("2026-07-02T10:00:00.000Z"),
  documents: new Date("2026-07-03T10:00:00.000Z"),
  contacts: new Date("2026-07-04T10:00:00.000Z"),
  blogPage: new Date("2026-07-05T10:00:00.000Z"),
  product: new Date("2026-07-06T10:00:00.000Z"),
};

vi.mock("@/server/content/lastModified", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/content/lastModified")>();
  return {
    latestDate: actual.latestDate,
    homepageLastModified: () => STUB_DATES.homepage,
    productsIndexLastModified: () => STUB_DATES.productsIndex,
    documentsLastModified: () => STUB_DATES.documents,
    contactsLastModified: () => STUB_DATES.contacts,
    blogIndexPageContentLastModified: () => STUB_DATES.blogPage,
    productLastModifiedBySlug: () =>
      new Map(seedProductLocations.map((product) => [product.slug, STUB_DATES.product])),
  };
});

const { default: robots } = await import("@/app/robots");
const { default: sitemap } = await import("@/app/sitemap");

describe("robots.txt", () => {
  const rules = robots();
  const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;
  const disallow = [rule?.disallow ?? []].flat();

  it("разрешает обход публичного сайта", () => {
    expect(rule?.userAgent).toBe("*");
    expect([rule?.allow ?? []].flat()).toContain("/");
  });

  it("закрывает служебные разделы", () => {
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/login");
  });

  it("закрывает САМ адрес /admin, а не только вложенные страницы", () => {
    // Регрессия: правило `/admin/` не покрывает `/admin` — директива работает как префикс.
    expect(disallow).toContain("/admin");
    expect(disallow).not.toContain("/admin/");
  });

  it("не закрывает ресурсы, нужные для отрисовки страницы", () => {
    for (const path of disallow) {
      expect(path).not.toMatch(/\.(css|js|png|jpe?g|webp|avif|svg)$/i);
      expect(path).not.toBe("/_next/");
    }
  });

  it("указывает абсолютный адрес карты сайта на основном домене", () => {
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  it("содержит только абсолютные https-адреса основного домена", () => {
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/allqbit\.ru(\/|$)/);
    }
  });

  it("не содержит дублей", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("не содержит служебных, закрытых и параметризованных адресов", () => {
    for (const url of urls) {
      expect(url).not.toMatch(/\/admin(\/|$)/);
      expect(url).not.toMatch(/\/login(\/|$)/);
      expect(url).not.toMatch(/\/api\//);
      // Состояния главной (`?department=…`) — не отдельные документы: их canonical ведёт на «/».
      expect(url).not.toContain("?");
      expect(url).not.toContain("#");
    }
  });

  it("включает главную, все опубликованные статьи и все продукты", () => {
    expect(urls).toContain(SITE_URL);
    for (const post of seedBlogPosts.filter((item) => !item.draft)) {
      expect(urls).toContain(`${SITE_URL}/blog/${post.slug}`);
    }
    for (const product of seedProductLocations) {
      expect(urls).toContain(`${SITE_URL}/products/${product.slug}`);
    }
  });

  it("не включает неопубликованные статьи", () => {
    for (const draft of seedBlogPosts.filter((item) => item.draft)) {
      expect(urls).not.toContain(`${SITE_URL}/blog/${draft.slug}`);
    }
  });

  /** Календарный день из значения любого допустимого вида: `Date`, ISO-строка, `"2026-07-26"`. */
  const day = (value: string | Date) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

  const entryFor = (url: string) => entries.find((entry) => entry.url === url);

  it("берёт lastModified из слоя данных, а не из часов в момент отрисовки", () => {
    expect(day(entryFor(SITE_URL)!.lastModified!)).toBe("2026-07-01");
    expect(day(entryFor(`${SITE_URL}/products`)!.lastModified!)).toBe("2026-07-02");
    expect(day(entryFor(`${SITE_URL}/documents`)!.lastModified!)).toBe("2026-07-03");
    expect(day(entryFor(`${SITE_URL}/contacts`)!.lastModified!)).toBe("2026-07-04");

    for (const product of seedProductLocations) {
      expect(
        day(entryFor(`${SITE_URL}/products/${product.slug}`)!.lastModified!),
        product.slug,
      ).toBe("2026-07-06");
    }
  });

  it("у раздела «Блог» берёт позднейшую из даты раздела и дат статей", () => {
    // Прежнее `blogPosts[0]?.modifiedAt` брало первую строку списка, а список отсортирован по
    // `sort_order`: правка старого материала не двигала дату раздела вовсе.
    const published = seedBlogPosts.filter((post) => !post.draft);
    const newest = published
      .map((post) => day(post.modifiedAt))
      .sort()
      .at(-1)!;
    const expected = ["2026-07-05", newest].sort().at(-1)!;

    expect(day(entryFor(`${SITE_URL}/blog`)!.lastModified!)).toBe(expected);
  });

  it("оставляет без lastModified страницу, у которой настоящей даты нет", () => {
    // `/how-we-work` целиком лежит в коде, в базе у неё нет ни строки. Дата сборки или «сегодня»
    // на её месте были бы выдумкой, поэтому поля не должно быть вовсе.
    expect(entryFor(`${SITE_URL}/how-we-work`)!.lastModified).toBeUndefined();
    expect(entries.filter((entry) => entry.lastModified).length).toBeLessThan(entries.length);
  });

  it("проставляет только разбираемые календарные даты", () => {
    for (const entry of entries.filter((item) => item.lastModified)) {
      const value = day(entry.lastModified!);
      expect(value, `${entry.url}: не календарная дата`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(value).getTime()), `${entry.url}: дата не разбирается`).toBe(
        false,
      );
    }
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
