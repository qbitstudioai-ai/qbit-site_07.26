import { describe, expect, it, vi } from "vitest";
import { SOLUTION_PATH_BY_DEPARTMENT_ID } from "@/content/solutionPaths";
import { LEGACY_REDIRECTS } from "@/lib/legacyRedirects";
import { submitIndexNowCore } from "@/server/indexnow/core";
import {
  INDEXNOW_MAX_BATCH_URLS,
  isHttpsEndpoint,
  isXmlContentType,
  parseSitemapLocations,
  preflightIndexNow,
} from "@/server/indexnow/preflight";
import { absolute, productionSitemapUrls } from "@/tests/fixtures/sitemapSnapshot";

/**
 * Предполётные проверки IndexNow.
 *
 * Главное требование, ради которого написан весь файл: сторож обязан пропускать ЛЕГАЛЬНОЕ
 * изменение числа страниц (публикация и снятие материала через админ-панель) и падать на
 * действительно сломанной карте. Прежняя проверка `canonicalUrls.length === 23` не делала ни
 * первого, ни второго.
 */

const HOST = "allqbit.ru";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SOLUTION_PATHS = Object.values(SOLUTION_PATH_BY_DEPARTMENT_ID);
const LEGACY_SOURCES = LEGACY_REDIRECTS.map(({ source }) => source);

const run = (locations: readonly string[], overrides = {}) =>
  preflightIndexNow({
    locations,
    host: HOST,
    endpoint: ENDPOINT,
    solutionPaths: SOLUTION_PATHS,
    legacySources: LEGACY_SOURCES,
    ...overrides,
  });

/** Карта сайта без адреса, который в ней есть. Возвращает новый список, исходный не меняется. */
const without = (locations: readonly string[], path: string) =>
  locations.filter((url) => url !== absolute(path));

describe("IndexNow preflight — состав карты сайта", () => {
  it("пропускает production-снимок из 39 адресов", () => {
    const locations = productionSitemapUrls();
    expect(locations).toHaveLength(39);

    const result = run(locations);

    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.stats.canonicalCount).toBe(39);
    expect(result.stats.duplicatesDropped).toBe(0);
    expect(result.stats.legacyCount).toBe(LEGACY_SOURCES.length);
    expect(result.stats.urlCount).toBe(39 + LEGACY_SOURCES.length);
  });

  it("пропускает опубликованную статью без правки констант", () => {
    // Ровно тот сценарий, на котором ломался прежний сторож: редактор опубликовал материал,
    // адресов стало больше, кода никто не менял.
    const locations = [...productionSitemapUrls(), absolute("/blog/novaya-statya")];

    const result = run(locations);

    expect(result.ok).toBe(true);
    expect(result.stats.canonicalCount).toBe(40);
  });

  it("пропускает снятие одной статьи, пока раздел не пуст", () => {
    const locations = without(productionSitemapUrls(), "/blog/sayt-crm-i-messendzhery");

    const result = run(locations);

    expect(result.ok).toBe(true);
    expect(result.stats.canonicalCount).toBe(38);
  });

  it("отвергает пустую карту", () => {
    expect(run([])).toMatchObject({ ok: false, reason: "sitemap-empty" });
  });

  it("отвергает карту сверх разумной верхней границы", () => {
    const locations = Array.from({ length: 12 }, (_, index) => absolute(`/blog/post-${index}`));

    expect(run(locations, { maxSitemapUrls: 10 })).toMatchObject({
      ok: false,
      reason: "sitemap-too-large",
    });
  });

  it("отвергает пакет сверх ограничения IndexNow", () => {
    const result = run(productionSitemapUrls(), { maxBatchUrls: 10 });

    expect(result).toMatchObject({ ok: false, reason: "batch-too-large" });
    // Статистика при этом заполнена: понять, насколько превышен лимит, можно без второго запуска.
    expect(result.stats.urlCount).toBe(39 + LEGACY_SOURCES.length);
  });

  it("знает документированное ограничение IndexNow", () => {
    expect(INDEXNOW_MAX_BATCH_URLS).toBe(10_000);
  });
});

describe("IndexNow preflight — структура адресов", () => {
  it.each([
    ["чужой host", "https://example.com/blog", "url-foreign-host"],
    ["не https", "http://allqbit.ru/blog", "url-not-https"],
    ["параметры запроса", "https://allqbit.ru/blog?utm_source=mail", "url-has-query"],
    ["фрагмент", "https://allqbit.ru/blog#top", "url-has-fragment"],
    ["явный порт", "https://allqbit.ru:8443/blog", "url-has-port"],
    ["не адрес", "не адрес вовсе", "url-unparsable"],
  ])("отвергает %s", (_label, badUrl, reason) => {
    expect(run([...productionSitemapUrls(), badUrl])).toMatchObject({ ok: false, reason });
  });

  it.each([
    ["/admin"],
    ["/admin/articles"],
    ["/api"],
    ["/api/files/doc.pdf"],
    ["/login"],
    ["/departments/sales"],
    ["/solutions"],
    ["/solutions/executive"],
  ])("отвергает запрещённый адрес %s", (path) => {
    const result = run([...productionSitemapUrls(), absolute(path)]);

    expect(result).toMatchObject({ ok: false, reason: "url-forbidden-path" });
    expect(result.details.join(" ")).toContain(path);
  });

  it("не считает `/apiary` частью служебного `/api`", () => {
    // Запрет работает по сегментам адреса, а не по подстроке: префикс не должен задевать
    // посторонние адреса, которые лишь начинаются теми же буквами.
    expect(run([...productionSitemapUrls(), absolute("/apiary")]).ok).toBe(true);
  });

  it("дедуплицирует повторы и сообщает их число, не считая отказом", () => {
    const locations = [...productionSitemapUrls(), absolute("/blog"), absolute("/blog")];

    const result = run(locations);

    expect(result.ok).toBe(true);
    expect(result.stats.duplicatesDropped).toBe(2);
    expect(result.stats.canonicalCount).toBe(39);
    expect(new Set(result.urls).size).toBe(result.urls.length);
  });
});

describe("IndexNow preflight — обязательный состав", () => {
  it.each(SOLUTION_PATHS)("отвергает карту без обязательного отдела %s", (path) => {
    const result = run(without(productionSitemapUrls(), path));

    expect(result).toMatchObject({ ok: false, reason: "missing-required-url" });
    expect(result.details.join(" ")).toContain(path);
  });

  it("берёт список отделов из единственного источника истины", () => {
    // Если таблица адресов когда-нибудь разойдётся со схемой контента, упадёт этот тест, а не
    // production-запуск.
    expect(SOLUTION_PATHS).toHaveLength(5);
    expect(SOLUTION_PATHS).toContain("/solutions/management");
    expect(SOLUTION_PATHS).not.toContain("/solutions/executive");
  });

  it.each(["/", "/products", "/documents", "/how-we-work", "/faq", "/contacts", "/blog", "/cases"])(
    "отвергает карту без код-роута %s",
    (path) => {
      const locations = productionSitemapUrls().filter(
        (url) => new URL(url).pathname.replace(/(.)\/$/, "$1") !== path,
      );

      expect(run(locations)).toMatchObject({ ok: false, reason: "missing-required-url" });
    },
  );

  it.each([
    ["продуктов", "/products/"],
    ["статей", "/blog/"],
    ["кейсов", "/cases/"],
  ])("отвергает карту без единого материала раздела %s", (_label, prefix) => {
    // Самый правдоподобный отказ: источник контента вернул пустой список, карта осталась
    // структурно безупречной. Прежний сторож по числу адресов его не ловил вовсе.
    const locations = productionSitemapUrls().filter(
      (url) => !new URL(url).pathname.startsWith(prefix),
    );

    const result = run(locations);

    expect(result).toMatchObject({ ok: false, reason: "section-empty" });
    expect(result.details.join(" ")).toContain(prefix);
  });

  it("отвергает источник legacy-редиректа внутри карты сайта", () => {
    const result = run([...productionSitemapUrls(), absolute(LEGACY_SOURCES[0])]);

    expect(result).toMatchObject({ ok: false, reason: "legacy-in-sitemap" });
    expect(result.details.join(" ")).toContain(LEGACY_SOURCES[0]);
  });

  it("добавляет к пакету все источники legacy-редиректов", () => {
    const result = run(productionSitemapUrls());

    for (const source of LEGACY_SOURCES) {
      expect(result.urls).toContain(absolute(source));
    }
  });
});

describe("IndexNow preflight — endpoint и тип содержимого", () => {
  it.each([
    ["http://api.indexnow.org/indexnow"],
    ["ftp://api.indexnow.org"],
    ["api.indexnow.org/indexnow"],
    [""],
  ])("отвергает endpoint %s до сборки пакета", (endpoint) => {
    expect(run(productionSitemapUrls(), { endpoint })).toMatchObject({
      ok: false,
      reason: "endpoint-not-https",
    });
  });

  it("принимает https-endpoint", () => {
    expect(isHttpsEndpoint(ENDPOINT)).toBe(true);
  });

  it.each([
    ["application/xml", true],
    ["text/xml; charset=utf-8", true],
    ["application/rss+xml", true],
    ["text/html; charset=utf-8", false],
    ["application/json", false],
    [null, false],
    [undefined, false],
  ])("определяет тип содержимого %s", (value, expected) => {
    expect(isXmlContentType(value)).toBe(expected);
  });
});

describe("IndexNow preflight — разбор карты сайта", () => {
  it("читает адреса и раскрывает сущности", () => {
    const xml =
      "<urlset><url><loc>https://allqbit.ru/blog</loc></url>" +
      "<url><loc>https://allqbit.ru/a&amp;b</loc></url></urlset>";

    expect(parseSitemapLocations(xml)).toEqual([
      "https://allqbit.ru/blog",
      "https://allqbit.ru/a&b",
    ]);
  });

  it("возвращает пустой список для HTML-страницы ошибки", () => {
    // Такой ответ обязан привести к отказу `sitemap-empty`, а не к «просто другому числу».
    expect(parseSitemapLocations("<html><body>502 Bad Gateway</body></html>")).toEqual([]);
    expect(run(parseSitemapLocations("<html></html>"))).toMatchObject({
      ok: false,
      reason: "sitemap-empty",
    });
  });
});

describe("IndexNow отправка пакета", () => {
  const silentLogger = { info: vi.fn(), error: vi.fn() };
  const noDelay = async () => {};

  const withEnv = async (callback: () => Promise<void>) => {
    vi.stubEnv("INDEXNOW_KEY", "a".repeat(32));
    vi.stubEnv("INDEXNOW_HOST", HOST);
    vi.stubEnv("INDEXNOW_ENDPOINT", ENDPOINT);
    try {
      await callback();
    } finally {
      vi.unstubAllEnvs();
    }
  };

  it.each([200, 202])("считает HTTP %s успехом", async (status) => {
    await withEnv(async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status }));
      const result = await submitIndexNowCore(run(productionSitemapUrls()).urls, {
        fetchImpl,
        logger: silentLogger,
        sleep: noDelay,
      });

      expect(result).toMatchObject({ ok: true, status });
      expect(result.urlCount).toBe(39 + LEGACY_SOURCES.length);
    });
  });

  it("сообщает отказ endpoint без повторов на постоянной ошибке", async () => {
    await withEnv(async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
      const result = await submitIndexNowCore(run(productionSitemapUrls()).urls, {
        fetchImpl,
        logger: silentLogger,
        sleep: noDelay,
      });

      expect(result).toMatchObject({ ok: false, status: 403, reason: "request-failed" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });
});
