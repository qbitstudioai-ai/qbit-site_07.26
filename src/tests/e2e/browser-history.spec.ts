import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

// DEPT-SEO.2D — история браузера на главной (DECISIONS.md 2026-09-17, пересмотр OQ-B).
//
// Прежняя редакция этого файла (Step 9) сознательно фиксировала модель «только replaceState»: весь
// визит главной занимал одну запись истории. Production-проверка 17.09.2026 показала цену — «назад»
// из офиса уводил посетителя с сайта. Утверждённая модель: не больше двух логических записей
//
//   внешняя страница → HERO → OFFICE
//
// где HERO → OFFICE — единственный pushState, а выбор/переключение/закрытие раздела заменяют
// текущую OFFICE-запись. Прямая ссылка на раздел искусственной HERO-записи перед собой не получает.

const copy = getHomepageCopy();
const departments = getDepartments();
const byId = (id: string) => departments.find((d) => d.id === id)!;
const sales = byId("sales");
const hr = byId("hr");
const SWITCH_ORDER = ["logistics", "sales", "support", "executive", "hr"].map(byId);

const EXTERNAL_URL = "https://external.example/source";
const OFFICE_STATE_KEY = "__allqbitOfficeHistory";

/** Предыдущий «чужой» сайт: страница отдаётся локально, в сеть запрос не уходит. */
async function openFromExternal(page: Page, path: string) {
  await page.route("https://external.example/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>external</h1>" }),
  );
  await page.goto(EXTERNAL_URL);
  await page.goto(path);
}

const historyLength = (page: Page) => page.evaluate(() => window.history.length);
const search = (page: Page) => new URL(page.url()).search;
const departmentParam = (page: Page) => new URL(page.url()).searchParams.get("department");

/** Заголовки 90%-области (отделы и «Ваша задача»); у HERO есть собственный H2, он сюда не входит. */
const SECTION_HEADLINES = [...departments.map((d) => d.headline), copy.taskSection.headline];

async function expectNoSectionOpen(page: Page) {
  for (const headline of SECTION_HEADLINES) {
    await expect(page.getByRole("heading", { level: 2, name: headline })).toHaveCount(0);
  }
}

async function expectHero(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSectionOpen(page);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).searchParams.get("department")).toBeNull();
  expect(new URL(page.url()).searchParams.get("section")).toBeNull();
}

async function expectDepartment(page: Page, department: { id: string; headline: string }) {
  await expect(page.getByRole("heading", { level: 2, name: department.headline })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect.poll(() => departmentParam(page)).toBe(department.id);
}

async function expectOverview(page: Page) {
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expectNoSectionOpen(page);
  expect(search(page)).toBe("");
}

async function enterOffice(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: copy.secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

async function openFromMap(page: Page, overviewLabel: string) {
  await page
    .getByRole("navigation", { name: "Отделы компании" })
    .getByRole("link", { name: overviewLabel })
    .click();
}

async function openFromRail(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Панель отделов" })
    .getByRole("button", { name: label })
    .click();
}

test.describe("DEPT-SEO.2D — browser history: HERO → OFFICE", () => {
  test("A–D: one entry for the office, switching replaces it, Back → HERO, Forward → last department", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    await expectHero(page);
    const initial = await historyLength(page);

    // Маркер документа: Back/Forward внутри главной — переходы в том же документе, без перезагрузки.
    await page.evaluate(() => {
      (window as unknown as { __sameDocument?: boolean }).__sameDocument = true;
    });
    const sameDocument = () =>
      page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument);

    // A. HERO → OFFICE — ровно одна новая запись.
    await enterOffice(page);
    expect(search(page)).toBe("");
    expect(await historyLength(page)).toBe(initial + 1);

    // B. Пять переключений не добавляют записей.
    await openFromMap(page, SWITCH_ORDER[0].overviewLabel);
    await expectDepartment(page, SWITCH_ORDER[0]);
    for (const department of SWITCH_ORDER.slice(1)) {
      await openFromRail(page, department.overviewLabel);
      await expectDepartment(page, department);
      expect(await historyLength(page)).toBe(initial + 1);
    }

    // C. Back → HERO, сайт не покинут.
    await page.goBack();
    await expectHero(page);
    expect(new URL(page.url()).origin).not.toBe("https://external.example");
    expect(await historyLength(page)).toBe(initial + 1);

    // D. Forward → последнее OFFICE-состояние (HR).
    await page.goForward();
    await expectDepartment(page, hr);
    expect(await historyLength(page)).toBe(initial + 1);
    expect(await sameDocument()).toBe(true);

    // Следующие два Back: HERO, затем внешняя страница.
    await page.goBack();
    await expectHero(page);
    await page.goBack();
    await expect.poll(() => page.url()).toBe(EXTERNAL_URL);
  });

  test("E: «Назад к офису» replaces the OFFICE entry with overview; Back → HERO, Forward → overview", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    const initial = await historyLength(page);
    await enterOffice(page);
    await openFromMap(page, sales.overviewLabel);
    await expectDepartment(page, sales);

    await page.getByRole("button", { name: "Назад к офису" }).click();
    await expectOverview(page);
    expect(await historyLength(page)).toBe(initial + 1);

    await page.goBack();
    await expectHero(page);
    await page.goForward();
    await expectOverview(page);
    expect(await historyLength(page)).toBe(initial + 1);
  });

  test("Back and Forward during a department transition settle on the target entry", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    const initial = await historyLength(page);
    await enterOffice(page);

    // Назад посреди открытия отдела: таймер opening не должен вернуть отдел поверх HERO.
    await openFromMap(page, sales.overviewLabel);
    await page.goBack();
    await expectHero(page);
    await page.waitForTimeout(1200);
    await expectHero(page);

    // Вперёд возвращает запись, в которой к моменту ухода уже стоял sales.
    await page.goForward();
    await expectDepartment(page, sales);

    // Назад посреди переключения.
    await openFromRail(page, hr.overviewLabel);
    await page.goBack();
    await expectHero(page);
    await page.waitForTimeout(1000);
    await expectHero(page);
    await page.goForward();
    await expectDepartment(page, hr);
    expect(await historyLength(page)).toBe(initial + 1);
  });

  test("history.state keeps foreign and Next.js fields next to the office entry", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => Boolean(window.history.state?.[key]), OFFICE_STATE_KEY))
      .toBe(true);
    await page.evaluate(() =>
      window.history.replaceState({ ...window.history.state, foreignProbe: "keep" }, ""),
    );

    await enterOffice(page);
    await openFromMap(page, sales.overviewLabel);
    await expectDepartment(page, sales);
    const officeState = await page.evaluate(() => window.history.state);
    expect(officeState[OFFICE_STATE_KEY]).toEqual({ layer: "office", pushedFromHero: true });
    expect(officeState.__NA).toBe(true);

    await page.goBack();
    await expectHero(page);
    const heroState = await page.evaluate(() => window.history.state);
    expect(heroState[OFFICE_STATE_KEY]).toEqual({ layer: "hero", pushedFromHero: false });
    expect(heroState.foreignProbe).toBe("keep");
    expect(heroState.__NA).toBe(true);
  });

  test("foreign query params survive switching and Back/Forward", async ({ page }) => {
    await openFromExternal(page, "/?utm_source=test");
    await enterOffice(page);
    await openFromMap(page, sales.overviewLabel);
    await expectDepartment(page, sales);
    expect(search(page)).toBe("?utm_source=test&department=sales");

    await page.goBack();
    await expectHero(page);
    expect(search(page)).toBe("?utm_source=test");
    await page.goForward();
    await expectDepartment(page, sales);
    expect(search(page)).toBe("?utm_source=test&department=sales");
  });
});

test.describe("DEPT-SEO.2D — direct links, reload, internal return to HERO", () => {
  test("F: direct /?department=sales adds no synthetic HERO entry; Back leaves to the real source", async ({
    page,
  }) => {
    await openFromExternal(page, "/?department=sales");
    await expectDepartment(page, sales);
    const initial = await historyLength(page);

    await openFromRail(page, hr.overviewLabel);
    await expectDepartment(page, hr);
    expect(await historyLength(page)).toBe(initial);

    await page.goBack();
    await expect.poll(() => page.url()).toBe(EXTERNAL_URL);
  });

  test("F: direct /?section=task adds no synthetic HERO entry", async ({ page }) => {
    await openFromExternal(page, "/?section=task");
    await expect(
      page.getByRole("heading", { level: 2, name: copy.taskSection.headline }),
    ).toBeVisible();
    const initial = await historyLength(page);

    await openFromRail(page, sales.overviewLabel);
    await expectDepartment(page, sales);
    expect(await historyLength(page)).toBe(initial);

    await page.goBack();
    await expect.poll(() => page.url()).toBe(EXTERNAL_URL);
  });

  test("G: reload keeps the department and the HERO entry behind it", async ({ page }) => {
    await openFromExternal(page, "/");
    const initial = await historyLength(page);
    await enterOffice(page);
    await openFromMap(page, sales.overviewLabel);
    await expectDepartment(page, sales);

    await page.reload();
    await expectDepartment(page, sales);
    expect(await historyLength(page)).toBe(initial + 1);
    await expect
      .poll(() => page.evaluate((key) => window.history.state?.[key], OFFICE_STATE_KEY))
      .toEqual({ layer: "office", pushedFromHero: true });

    await page.goBack();
    await expectHero(page);
    expect(await historyLength(page)).toBe(initial + 1);
  });

  test("H: logo from a session-created OFFICE entry returns to the existing HERO entry", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    const initial = await historyLength(page);
    await enterOffice(page);
    await openFromMap(page, sales.overviewLabel);
    await expectDepartment(page, sales);

    await page.getByRole("button", { name: "QBit-Studio-Ai" }).click();
    await expectHero(page);
    await expect.poll(() => search(page)).toBe("");
    // Двойной HERO-записи нет: следующий Back сразу уходит на внешнюю страницу.
    expect(await historyLength(page)).toBe(initial + 1);
    await page.goBack();
    await expect.poll(() => page.url()).toBe(EXTERNAL_URL);
  });

  test("H: overview «На главную» from a session-created OFFICE entry behaves the same", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    await enterOffice(page);

    await page.getByRole("link", { name: copy.returnToOfficeLabel }).click();
    await expectHero(page);
    await page.goBack();
    await expect.poll(() => page.url()).toBe(EXTERNAL_URL);
  });

  test("H: logo from a direct deep link shows HERO in place and never leaves the site", async ({
    page,
  }) => {
    await openFromExternal(page, "/?department=sales");
    await expectDepartment(page, sales);
    const initial = await historyLength(page);

    await page.getByRole("button", { name: "QBit-Studio-Ai" }).click();
    await expectHero(page);
    await page.waitForTimeout(500);
    await expectHero(page);
    expect(new URL(page.url()).origin).not.toBe("https://external.example");
    expect(await historyLength(page)).toBe(initial);

    // Из этой HERO снова в офис — обычный pushState, Back возвращает HERO.
    await enterOffice(page);
    expect(await historyLength(page)).toBe(initial + 1);
    await page.goBack();
    await expectHero(page);
  });

  test("leaving to another site page and pressing Back returns to the same OFFICE state, not a second HERO", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    const initial = await historyLength(page);
    await enterOffice(page);
    await openFromMap(page, hr.overviewLabel);
    await expectDepartment(page, hr);

    // Обычная клиентская навигация Next.js на другую страницу сайта.
    await page.locator('header a[href="/blog"]').first().click();
    await page.waitForURL("**/blog");
    expect(await historyLength(page)).toBe(initial + 2);

    // Next.js восстанавливает закэшированное дерево `/`; запись офиса не должна превратиться в HERO.
    await page.goBack();
    await expectDepartment(page, hr);
    await page.goBack();
    await expectHero(page);
    await page.goBack();
    await expect.poll(() => page.url()).toBe(EXTERNAL_URL);
  });

  test("G: reload of the OFFICE overview keeps the overview (same URL `/` as HERO)", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    const initial = await historyLength(page);
    await enterOffice(page);

    await page.reload();
    await expectOverview(page);
    expect(await historyLength(page)).toBe(initial + 1);
    await page.goBack();
    await expectHero(page);
  });

  test("Back from an external site onto the OFFICE overview entry restores the overview", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    await enterOffice(page);
    await page.goto(`${EXTERNAL_URL}?next`);
    await page.goBack();
    await expectOverview(page);
    await page.goBack();
    await expectHero(page);
  });

  test("a fresh navigation to `/` from the OFFICE overview shows HERO, not the stale office entry", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    await enterOffice(page);
    await page.goto("/");
    await expectHero(page);
    await page.waitForTimeout(500);
    await expectHero(page);
  });

  test("I: invalid department still falls back to the overview with a clean URL", async ({
    page,
  }) => {
    await openFromExternal(page, "/?department=unknown");
    const initial = await historyLength(page);
    await expectOverview(page);
    expect(await historyLength(page)).toBe(initial);
  });

  test("J: a plain hotspot click stays on the homepage and never opens /solutions/*", async ({
    page,
  }) => {
    await openFromExternal(page, "/");
    await enterOffice(page);
    await openFromMap(page, sales.overviewLabel);
    await expectDepartment(page, sales);
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
