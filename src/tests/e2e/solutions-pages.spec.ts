import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getDepartments } from "../../content/departments";
import { getHomepageCopy } from "../../content/homepage-copy";
import { SOLUTION_TITLE_SUBJECT } from "../../features/solutions/solutionsSeo";
import { SITE_NAME } from "../../lib/seo";

/**
 * Страницы отделов `/solutions/<slug>` (DEPT-SEO.2A).
 *
 * Что здесь проверяется и почему именно так:
 *
 * — ПОЛНОТА ПЕРВОГО ОТВЕТА. Главная проверка файла. Весь текст отдела обязан приходить в HTML от
 *   сервера, до всякого JavaScript. Измеряется прямым HTTP-запросом (`request.get`), а НЕ через
 *   DOM: в DOM текст окажется и в случае, если он подгружен после монтирования, — то есть проверка
 *   по DOM прошла бы ровно при том дефекте, ради которого делался шаг. Замер 2026-09-16 по
 *   `/?department=sales` на production: 5 болей в HTML, но лишь 1 выгода из 5, 0 из 4 результатов и
 *   ни одного CTA;
 * — ОТСУТСТВИЕ ОЖИДАНИЯ. Текст не должен появляться по таймеру. Проверяется тем, что HTML полон
 *   ещё до браузера, и отдельно — что в DOM всё на месте сразу после загрузки, без ожиданий;
 * — АДРЕСА. Все пять — 200, чужой сегмент — 404, canonical указывает сам на себя, UTM его не
 *   меняет. Это условие SEO/GEO, и сломать его легче всего;
 * — РЕГРЕССИЯ ГЛАВНОЙ. Отдельный блок в конце. Шаг не имеет права изменить ни поведение офиса, ни
 *   canonical главной, ни механику `history.replaceState` (решение OQ-B).
 *
 * Список отделов берётся из источника данных, а не переписывается сюда.
 */

const departments = getDepartments();
const copy = getHomepageCopy();

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

// Порог acceptance тот же, что у остальных сканов проекта: serious и выше.
const SERIOUS_OR_CRITICAL = new Set(["serious", "critical"]);

async function scanSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((violation) => SERIOUS_OR_CRITICAL.has(violation.impact ?? ""));
}

function summarize(violations: Awaited<ReturnType<typeof scanSeriousViolations>>) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes.length} узл. — ${violation.help}`,
    )
    .join("\n");
}

/**
 * Разметка без содержимого `<script>`.
 *
 * Всё, что лежит внутри `<script>`, — это RSC-payload, а не содержимое документа: там оказываются и
 * пропы клиентских компонентов, и адрес запроса со строкой запроса. Ни поисковая система, ни
 * читатель этого не видят, поэтому любая проверка «что показывает страница» обязана идти по
 * разметке без скриптов. Ровно на этом различии построены измерения шага.
 */
function renderedHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

/** Видимый текст страницы: разметка без скриптов и без самих тегов. */
function renderedText(html: string): string {
  return renderedHtml(html).replace(/<[^>]+>/g, " ");
}

/** JSON-LD страницы, разобранный из первого серверного HTML. */
function structuredData(html: string): Record<string, unknown>[] {
  const match = html.match(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
  ) as RegExpMatchArray | null;
  expect(match, "на странице нет блока JSON-LD").not.toBeNull();
  return JSON.parse(match![1]) as Record<string, unknown>[];
}

test.describe("страницы отделов /solutions/<slug>", () => {
  test("источник данных отдаёт пять отделов с адресами вида /solutions/<slug>", () => {
    expect(departments).toHaveLength(5);
    for (const department of departments) {
      expect(department.solutionPath, department.id).toMatch(/^\/solutions\/[a-z-]+$/);
    }
  });

  for (const department of departments) {
    test.describe(`${department.id} (${department.solutionPath})`, () => {
      test("отвечает 200 и содержит ВЕСЬ текст отдела в первом ответе сервера", async ({
        request,
      }) => {
        const response = await request.get(department.solutionPath);
        expect(response.status()).toBe(200);

        const text = renderedText(await response.text());

        expect(text, "нет названия отдела").toContain(department.name);
        expect(text, "нет headline").toContain(department.headline);
        expect(text, "нет problem").toContain(department.problem);

        for (const point of department.painPoints) {
          expect(text, `нет боли: ${point.pain}`).toContain(point.pain);
          expect(text, `нет выгоды: ${point.gain}`).toContain(point.gain);
          if (point.howItWorks) {
            expect(text, `нет howItWorks: ${point.howItWorks}`).toContain(point.howItWorks);
          }
        }

        for (const benefit of department.customerBenefits) {
          expect(text, `нет результата: ${benefit}`).toContain(benefit);
        }

        expect(text, "нет CTA").toContain(department.ctaLabel);
      });

      test("объявляет собственные title, description, canonical и index/follow", async ({
        request,
      }) => {
        const html = await (await request.get(department.solutionPath)).text();

        expect(html).toContain(
          `<title>${department.name}: ${SOLUTION_TITLE_SUBJECT} — ${SITE_NAME}</title>`,
        );
        expect(html).toContain(
          `<link rel="canonical" href="https://allqbit.ru${department.solutionPath}"/>`,
        );

        const robots = html.match(/<meta name="robots" content="([^"]*)"/);
        expect(robots?.[1]).toContain("index");
        expect(robots?.[1]).not.toContain("noindex");

        const description = html.match(/<meta name="description" content="([^"]*)"/);
        expect(description?.[1]).toBeTruthy();
      });

      test("не меняет canonical из-за UTM-меток", async ({ request }) => {
        const html = await (
          await request.get(
            `${department.solutionPath}?utm_source=test&utm_medium=cpc&fbclid=abc123`,
          )
        ).text();

        expect(html).toContain(
          `<link rel="canonical" href="https://allqbit.ru${department.solutionPath}"/>`,
        );

        /**
         * Проверяется САМ canonical, а не весь документ. Адрес запроса вместе со строкой запроса
         * попадает в RSC-payload — это устройство Next.js, а не ссылка на странице, и требовать от
         * всего HTML отсутствия подстроки `utm_source` значило бы проверять не то. Важно ровно
         * одно: в объявленном canonical метки нет, поэтому второго документа они не создают.
         */
        const canonical = html.match(/<link rel="canonical" href="([^"]*)"/);
        expect(canonical?.[1]).toBe(`https://allqbit.ru${department.solutionPath}`);
        expect(canonical?.[1]).not.toContain("?");
      });

      test("несёт ровно BreadcrumbList, WebPage и Organization без выдуманных фактов", async ({
        request,
      }) => {
        const html = await (await request.get(department.solutionPath)).text();
        const nodes = structuredData(html);

        expect(nodes.map((node) => node["@type"])).toEqual([
          "BreadcrumbList",
          "WebPage",
          "Organization",
        ]);

        const url = `https://allqbit.ru${department.solutionPath}`;
        expect(nodes[1]).toMatchObject({ url, "@id": `${url}#webpage` });

        const serialized = JSON.stringify(nodes);
        for (const forbidden of [
          "Service",
          "Offer",
          "FAQPage",
          "HowTo",
          "Review",
          "AggregateRating",
          "datePublished",
          "dateModified",
        ]) {
          expect(serialized, forbidden).not.toContain(forbidden);
        }
      });

      test("в браузере: один H1, текст на месте сразу, консоль чистая", async ({ page }) => {
        const noise: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") noise.push(`error: ${message.text()}`);
        });
        page.on("pageerror", (error) => noise.push(`pageerror: ${error.message}`));

        await page.setViewportSize(DESKTOP);
        await page.goto(department.solutionPath);

        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(department.name);

        /**
         * Никаких `waitFor` и `findBy` — всё обязано быть на месте уже сейчас. Проверяется
         * последняя по каскаду главной величина (CTA) и последняя выгода: именно они на главной
         * появляются через 10 с и 10,76 с соответственно.
         */
        const lastPoint = department.painPoints[department.painPoints.length - 1];
        const lastBenefit = department.customerBenefits[department.customerBenefits.length - 1];

        expect(await page.getByText(lastPoint.gain, { exact: true }).count()).toBe(1);
        expect(await page.getByText(lastBenefit, { exact: true }).count()).toBe(1);
        expect(await page.getByRole("link", { name: department.ctaLabel }).count()).toBe(1);

        await expect(page.getByRole("link", { name: department.ctaLabel })).toHaveAttribute(
          "href",
          copy.contactHref,
        );

        expect(noise.join("\n")).toBe("");
      });

      for (const [label, viewport] of [
        ["mobile 390", MOBILE],
        ["desktop 1440", DESKTOP],
      ] as const) {
        test(`${label}: без горизонтальной прокрутки и без serious/critical нарушений axe`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
          await page.goto(department.solutionPath);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

          const geometry = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);

          const violations = await scanSeriousViolations(page);
          expect(summarize(violations)).toBe("");
        });
      }
    });
  }

  test("несуществующий сегмент отвечает 404", async ({ request }) => {
    // `executive` — системный идентификатор отдела, но НЕ сегмент его адреса (им является
    // `management`). Адреса `/solutions/executive` не существует, и он обязан быть 404, а не
    // вторым адресом того же документа.
    for (const path of [
      "/solutions/executive",
      "/solutions/unknown",
      "/solutions/task",
      "/solutions",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);

      /**
       * Проверяется ФАКТИЧЕСКИЙ вывод, а не константа `NOT_FOUND_ROBOTS`.
       *
       * `generateMetadata` возвращает её раньше, чем страница успевает вызвать `notFound()`, но до
       * ответа доезжает собственный `noindex` Next.js — именно он и важен: несуществующий адрес не
       * должен попасть в индекс. Проверка константы в unit-тесте этого не доказывает, поэтому
       * поведение закрепляется здесь.
       */
      expect(await response.text(), path).toContain("noindex");
    }
  });

  test("параллельного пространства /departments/* не существует", async ({ request }) => {
    for (const path of ["/departments", "/departments/sales", "/departments/management"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  /**
   * Карта сайта заодно СВЕРЯЕТ набор отделов с тестируемым сервером.
   *
   * Список `departments` выше читается из локальной базы в процессе самого раннера — тот же приём,
   * что в `browser-history.spec.ts` и `cases-experience.spec.ts`. Приём удобен, но у него есть
   * слепое пятно: разойдись база раннера с той, на которой работает сервер, — спека молча
   * проверила бы другой набор отделов и всё равно позеленела. Поэтому здесь сравниваются МНОЖЕСТВА,
   * а не только наличие каждого адреса: лишний или пропавший отдел на сервере роняет проверку.
   */
  test("карта сайта содержит ровно те пять адресов отделов, что и источник", async ({
    request,
  }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();

    const fromServer = [
      ...sitemap.matchAll(/<loc>https:\/\/allqbit\.ru(\/solutions\/[^<]+)<\/loc>/g),
    ]
      .map((match) => match[1])
      .sort();
    const expected = departments.map((department) => department.solutionPath).sort();

    expect(fromServer).toEqual(expected);
    expect(fromServer).toHaveLength(5);

    expect(sitemap).not.toContain("/departments/");
    // Состояния главной отдельными документами не являются и в карте их быть не должно.
    expect(sitemap).not.toContain("?department=");
  });
});

/**
 * РЕГРЕССИЯ ГЛАВНОЙ.
 *
 * Шаг не имеет права изменить главную. Здесь проверяется не «похоже, работает», а именно те три
 * свойства, которые новый раздел мог бы задеть: canonical главной, вход в отдел по параметру и
 * механика истории (`replaceState`, решение OQ-B — открытие, переключение и закрытие отдела не
 * добавляют записей в историю браузера).
 */
test.describe("главная не изменилась", () => {
  const sales = departments.find((department) => department.id === "sales")!;
  const hr = departments.find((department) => department.id === "hr")!;

  test("canonical главной и её состояния с параметром остаётся https://allqbit.ru", async ({
    request,
  }) => {
    for (const path of ["/", "/?department=sales", "/?section=task"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toContain('<link rel="canonical" href="https://allqbit.ru"/>');
    }
  });

  test("?department=<id> по-прежнему открывает отдел на сцене офиса", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/?department=sales");

    // Заголовок отдела на главной — H2, а H1 остаётся общим заголовком hero. Новая страница отдела
    // этого не изменила.
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("sales");
  });

  test("открытие, переключение и закрытие отдела не добавляют записей в историю", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    const initialLength = await page.evaluate(() => window.history.length);

    await page.getByRole("link", { name: copy.secondaryCta }).click();

    const map = page.getByRole("navigation", { name: "Отделы компании" });
    await map.getByRole("link", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("sales");

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("hr");

    await page.getByRole("button", { name: "Назад к офису" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();

    // Тот же инвариант, что и в browser-history.spec.ts: `replaceState`, а не `pushState`.
    expect(await page.evaluate(() => window.history.length)).toBe(initialLength);
  });

  test("зоны офиса — crawlable ссылки на страницы отделов (DEPT-SEO.2B), а не кнопки", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/?section=office");

    const map = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(map.getByRole("link")).toHaveCount(departments.length);
    await expect(map.getByRole("button")).toHaveCount(0);
    const hrefs = await map
      .locator("a[href]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
    expect(hrefs.sort()).toEqual(departments.map((department) => department.solutionPath).sort());
  });
});

/**
 * DEPT-SEO.2B — ребро обхода `/` → `/solutions/<slug>`.
 *
 * Зоны офиса стали настоящими `<a href>`: ссылка существует в первом HTML и работает без
 * JavaScript. С JavaScript обычная активация (клик, Enter, Space) по-прежнему открывает отдел на
 * сцене главной без перехода и без записи в историю, а клик с модификатором остаётся нативным.
 */
test.describe("DEPT-SEO.2B: зоны офиса — crawlable ссылки", () => {
  const EXPECTED_PATHS: Record<string, string> = {
    sales: "/solutions/sales",
    support: "/solutions/support",
    executive: "/solutions/management",
    hr: "/solutions/hr",
    logistics: "/solutions/logistics",
  };

  /** Все `<a href="/solutions/…">` отрисованной разметки (без RSC-payload в `<script>`). */
  function solutionAnchors(html: string): { id: string | null; href: string }[] {
    return [...renderedHtml(html).matchAll(/<a\b[^>]*>/g)]
      .map((match) => ({
        href: match[0].match(/\bhref="([^"]*)"/)?.[1] ?? "",
        id: match[0].match(/\bid="([^"]*)"/)?.[1] ?? null,
      }))
      .filter((anchor) => anchor.href.startsWith("/solutions/"));
  }

  /**
   * Записывает вызовы Метрики вместо реального счётчика. Запросы к mc.yandex.ru получают пустой
   * ответ, а не обрыв: обрыв сам печатает в консоль `net::ERR_FAILED` и ломал бы проверку консоли.
   */
  async function recordMetrika(page: Page) {
    await page.route(/mc\.yandex\.ru/, (route) =>
      route.fulfill({ status: 204, contentType: "application/javascript", body: "" }),
    );
    await page.addInitScript(() => {
      const calls: unknown[][] = [];
      const target = window as unknown as {
        __ymCalls: unknown[][];
        ym: (...args: unknown[]) => void;
      };
      target.__ymCalls = calls;
      target.ym = (...args) => {
        calls.push(args);
      };
    });
  }

  function collectConsoleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    return errors;
  }

  test("источник: пять solutionPath, executive → /solutions/management", () => {
    expect(
      Object.fromEntries(departments.map((department) => [department.id, department.solutionPath])),
    ).toEqual(EXPECTED_PATHS);
  });

  test("SSR главной содержит ровно 5 ссылок-зон на страницы отделов, canonical прежний", async ({
    request,
  }) => {
    const html = await (await request.get("/")).text();
    const anchors = solutionAnchors(html);
    expect(anchors).toHaveLength(5);
    expect(Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor.href]))).toEqual(
      Object.fromEntries(
        Object.entries(EXPECTED_PATHS).map(([id, path]) => [`hotspot-${id}`, path]),
      ),
    );
    expect(anchors.map((anchor) => anchor.href)).not.toContain("/solutions/executive");
    expect(renderedHtml(html)).not.toContain("/departments/");
    expect(html).toContain('<link rel="canonical" href="https://allqbit.ru"/>');
  });

  for (const department of departments) {
    test(`обычный клик по «${department.overviewLabel}» открывает отдел на главной, без перехода`, async ({
      page,
    }) => {
      const consoleErrors = collectConsoleErrors(page);
      await recordMetrika(page);
      const solutionRequests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/solutions/")) {
          solutionRequests.push(request.url());
        }
      });

      await page.setViewportSize(DESKTOP);
      await page.goto("/?section=office");
      const map = page.getByRole("navigation", { name: "Отделы компании" });
      await expect(map).toBeVisible();
      const initialLength = await page.evaluate(() => window.history.length);

      await map.getByRole("link", { name: department.overviewLabel }).click();

      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
      const url = new URL(page.url());
      expect(url.pathname).toBe("/");
      expect(url.searchParams.get("department")).toBe(department.id);
      expect(await page.evaluate(() => window.history.length)).toBe(initialLength);
      expect(solutionRequests).toEqual([]);

      const ymCalls = await page.evaluate(
        () => (window as unknown as { __ymCalls: unknown[][] }).__ymCalls,
      );
      // Запись действительно работает: счётчик главной уже вызвал init/hit через записывающий ym.
      // Без этого пустой массив прошёл бы проверки ниже и при сломанной записи.
      expect(ymCalls.length).toBeGreaterThan(0);
      expect(ymCalls.filter((call) => call[1] === "reachGoal")).toEqual([]);
      expect(ymCalls.filter((call) => JSON.stringify(call).includes("/solutions/"))).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }

  for (const key of ["Enter", "Space"] as const) {
    test(`${key} на сфокусированной зоне открывает отдел ровно один раз, без перехода`, async ({
      page,
    }) => {
      const consoleErrors = collectConsoleErrors(page);
      await page.setViewportSize(DESKTOP);
      await page.goto("/?section=office");
      const sales = departments.find((department) => department.id === "sales")!;
      const map = page.getByRole("navigation", { name: "Отделы компании" });
      const initialLength = await page.evaluate(() => window.history.length);

      await map.getByRole("link", { name: sales.overviewLabel }).focus();
      await page.keyboard.press(key);

      const heading = page.getByRole("heading", { level: 2, name: sales.headline });
      await expect(heading).toBeVisible();
      // Фокус переносится на заголовок открытого отдела — тот же контракт, что был у кнопки.
      await expect(heading).toBeFocused();
      const url = new URL(page.url());
      expect(url.pathname).toBe("/");
      expect(url.searchParams.get("department")).toBe("sales");
      expect(await page.evaluate(() => window.history.length)).toBe(initialLength);
      expect(consoleErrors).toEqual([]);
    });
  }

  test("Ctrl/Cmd-клик остаётся нативным: новая вкладка на /solutions/<slug>, главная не меняется", async ({
    page,
    context,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/?section=office");
    const executive = departments.find((department) => department.id === "executive")!;
    const map = page.getByRole("navigation", { name: "Отделы компании" });

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      map
        .getByRole("link", { name: executive.overviewLabel })
        .click({ modifiers: ["ControlOrMeta"] }),
    ]);
    await popup.waitForURL("**/solutions/management");
    expect(new URL(popup.url()).pathname).toBe("/solutions/management");
    await expect(popup.getByRole("heading", { level: 1 })).toHaveCount(1);
    await popup.close();

    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(map).toBeVisible();
  });

  test("Back/Forward вокруг главной с выбранным через ссылку-зону отделом", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/blog");
    await page.goto("/?section=office");
    const map = page.getByRole("navigation", { name: "Отделы компании" });
    const sales = departments.find((department) => department.id === "sales")!;
    await map.getByRole("link", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await page.goBack();
    await page.waitForURL("**/blog");
    await page.goForward();
    await page.waitForURL((url) => url.pathname === "/");
    expect(new URL(page.url()).searchParams.get("department")).toBe("sales");
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
  });

  test("без JavaScript: 5 ссылок видимы и ведут на страницы отделов", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto("/");

    const map = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(map.getByRole("link")).toHaveCount(5);
    for (const department of departments) {
      const link = map.getByRole("link", { name: department.overviewLabel });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", department.solutionPath);
    }

    for (const department of departments) {
      await page.goto("/");
      const response = page.waitForResponse(
        (candidate) => new URL(candidate.url()).pathname === department.solutionPath,
      );
      await page
        .getByRole("navigation", { name: "Отделы компании" })
        .getByRole("link", { name: department.overviewLabel })
        .click();
      expect((await response).status()).toBe(200);
      await page.waitForURL(`**${department.solutionPath}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    }

    await context.close();
  });

  test("панель отделов и карусель остаются кнопками", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/?department=sales");
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await expect(rail.getByRole("button")).toHaveCount(departments.length);
    await expect(rail.getByRole("link")).toHaveCount(0);

    await page.setViewportSize(MOBILE);
    await page.goto("/?department=sales");
    const carouselControls = page.getByRole("button", { name: /^(Предыдущий|Следующий) отдел/ });
    await expect(carouselControls.first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^(Предыдущий|Следующий) отдел/ })).toHaveCount(0);
  });

  for (const [label, viewport] of [
    ["desktop", DESKTOP],
    ["mobile", MOBILE],
  ] as const) {
    test(`${label}: overview со ссылками-зонами без serious/critical нарушений axe`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/?section=office");
      await expect(
        page.getByRole("navigation", { name: "Отделы компании" }).getByRole("link"),
      ).toHaveCount(5);
      const violations = await scanSeriousViolations(page);
      expect(violations, summarize(violations)).toEqual([]);
    });
  }
});
