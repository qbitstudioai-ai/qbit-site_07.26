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

  it("проставляет lastModified только там, где есть настоящая дата изменения", () => {
    // Проверка против соблазна поставить `new Date()` каждой строке: тогда карта сообщала бы, что
    // весь сайт меняется при каждой сборке, и сигнал обесценился бы целиком.
    const today = new Date().toISOString().slice(0, 10);
    const stamped = entries.filter((entry) => entry.lastModified);

    expect(stamped.length).toBeLessThan(entries.length);
    for (const entry of stamped) {
      const value = String(entry.lastModified);
      expect(value).not.toBe(today);
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
