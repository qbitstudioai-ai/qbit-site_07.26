import { beforeEach, describe, expect, it, vi } from "vitest";
import seedDepartments from "../../../../data/departments.json";
import type { Department } from "@/content/types";
import { SITE_URL } from "@/lib/seo";
import { CASE_SALES_CALL_ANALYSIS } from "@/tests/fixtures/firstCase";
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
 * Кейсы тоже читаются из базы. Подменяется весь источник — тем самым единственным кейсом, который
 * миграция переносит в таблицу: проверять нужно СОСТАВ карты сайта, а не наличие запущенной базы.
 */
vi.mock("@/server/content/cases", () => ({
  getPublishedCases: () => [CASE_SALES_CALL_ANALYSIS],
}));

/**
 * Отделы тоже читаются из базы. Источник подменяется исходным seed-содержимым, из которого ОДИН
 * отдел убран намеренно.
 *
 * Это не упрощение фикстуры, а проверка требования: `getDepartments()` отдаёт только опубликованные
 * отделы, поэтому отдел, снятый с публикации в админ-панели, обязан исчезать и из карты сайта —
 * ровно так же, как исчезает его страница, начинающая отвечать 404. Отсутствие отдела в подменённом
 * источнике и означает «снят с публикации».
 */
const UNPUBLISHED_DEPARTMENT_ID = "logistics";

// `vi.hoisted`, а не обычная константа: `vi.mock` поднимается выше импортов, и фабрика не может
// опираться на значение, объявленное ниже по файлу.
const { sitemapDepartments } = vi.hoisted(() => ({ sitemapDepartments: [] as Department[] }));
sitemapDepartments.push(
  ...(seedDepartments as unknown as Department[]).filter(
    (department) => department.id !== UNPUBLISHED_DEPARTMENT_ID,
  ),
);

vi.mock("@/server/content/departments", () => ({
  getDepartments: () => sitemapDepartments,
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
  department: new Date("2026-07-07T10:00:00.000Z"),
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
    // Карта дат отделов подменяется тем же способом и с той же целью: проверяется, что `lastmod`
    // страницы отдела берётся из слоя данных (`departments.updated_at`), а не из часов.
    departmentLastModifiedById: () =>
      new Map(sitemapDepartments.map((department) => [department.id, STUB_DATES.department])),
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

  it("сохраняет состав из 29 публичных URL", () => {
    // Было 23; 2026-08-11 добавились раздел «Кейсы» и первый опубликованный кейс (25).
    // 2026-09-16 (DEPT-SEO.2A) добавились страницы отделов — здесь их четыре, потому что пятый
    // отдел в подменённом источнике снят с публикации.
    expect(urls).toHaveLength(25 + sitemapDepartments.length);
    expect(sitemapDepartments).toHaveLength(4);
  });

  /**
   * Кейсы попадают в карту сайта из того же источника, что и сам раздел (`getPublishedCases`), а не
   * перечисляются в этом файле строками. Отсюда главное свойство: кейс, опубликованный в
   * админ-панели, окажется в карте сайта без единой правки кода, а удалённый — исчезнет из неё.
   */
  it("включает раздел «Кейсы» и ровно те кейсы, что отдаёт источник", () => {
    expect(urls).toContain(`${SITE_URL}/cases`);
    expect(urls).toContain(`${SITE_URL}/cases/analiz-zvonkov-otdela-prodazh`);

    // Заготовок дел 02–07 больше не существует нигде: раздел хранится в базе, и черновиков в нём
    // нет. Их прежние адреса не должны воскреснуть в карте сайта.
    for (const removed of [
      "case-01",
      "case-02",
      "case-03",
      "case-04",
      "case-05",
      "case-06",
      "case-07",
    ]) {
      expect(urls, `${removed} попал в карту сайта`).not.toContain(`${SITE_URL}/cases/${removed}`);
    }
  });

  /**
   * Страницы отделов (DEPT-SEO.2A). Источник тот же, что у самих страниц и у главной, а адрес —
   * собственный `solutionPath` отдела. Отсюда оба свойства: отдел, снятый с публикации, исчезает из
   * карты сам, а адрес в карте не может разойтись с адресом страницы и её canonical.
   */
  it("включает ровно те страницы отделов, что отдаёт источник", () => {
    for (const department of sitemapDepartments) {
      expect(urls, department.id).toContain(`${SITE_URL}${department.solutionPath}`);
    }
  });

  it("не включает отдел, снятый с публикации", () => {
    expect(urls).not.toContain(`${SITE_URL}/solutions/${UNPUBLISHED_DEPARTMENT_ID}`);
    // Отделы адресуются ТОЛЬКО через `/solutions/*`. Параллельного пространства `/departments/*`
    // в проекте нет и не должно появиться молча — это был бы второй адрес того же документа.
    for (const url of urls) {
      expect(url).not.toContain("/departments/");
    }
  });

  it("берёт lastModified отдела из его даты изменения, а не из часов", () => {
    for (const department of sitemapDepartments) {
      const entry = entries.find((item) => item.url === `${SITE_URL}${department.solutionPath}`);
      expect(entry?.lastModified, department.id).toBe(STUB_DATES.department);
    }
  });

  it("не проставляет кейсам выдуманную дату изменения", () => {
    // Подтверждённой даты публикации у кейса нет — значит и `lastmod` быть не должно.
    const study = entries.find((entry) => entry.url.startsWith(`${SITE_URL}/cases/`));
    expect(study?.lastModified).toBeUndefined();
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
