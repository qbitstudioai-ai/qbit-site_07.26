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

      /**
       * Главная не должна СССЫЛАТЬСЯ на новый раздел — это задача DEPT-SEO.2B, а не этого шага.
       * Проверяется отрисованный документ, а не весь ответ: `solutionPath` каждого отдела
       * приезжает в RSC-payload как обычное поле данных, и приезжал он там ЗАДОЛГО до этого шага
       * — измерено на production origin/master 2026-09-16: 5 вхождений `/solutions/` внутри
       * `<script>` и ноль в разметке. Требовать отсутствия подстроки во всём ответе значило бы
       * проверять устройство payload, а не поведение страницы.
       */
      const rendered = renderedHtml(html);
      expect(rendered, path).not.toContain("/solutions/");
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
    await map.getByRole("button", { name: sales.overviewLabel }).click();
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

  test("зоны офиса остались кнопками — преобразование в ссылки это DEPT-SEO.2B", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/?section=office");

    const map = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(map.getByRole("button")).toHaveCount(departments.length);
    await expect(map.locator("a[href]")).toHaveCount(0);
  });
});
