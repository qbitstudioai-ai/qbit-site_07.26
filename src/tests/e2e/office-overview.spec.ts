import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("button", { name: copy.primaryCta }).click();
}

async function activateCtaViaSecondary(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).click();
}

test.describe("office overview", () => {
  test("hero is visible immediately, but department hotspots are hidden (not in the a11y tree) until ACTIVATE_CTA", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");

    const copy = getHomepageCopy();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.headline);
    await expect(page.getByText(copy.subheadline)).toBeVisible();
    await expect(page.getByRole("button", { name: copy.primaryCta })).toBeVisible();

    // Скрытые хотспоты не должны попадать в дерево доступности вовсе (display:none), а не
    // просто визуально скрываться — см. Step 4 acceptance criterion 4.
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });

  test("clicking the primary CTA reveals all 5 department hotspots", async ({ page }) => {
    await page.goto("/");
    await activateCta(page);

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    for (const department of getDepartments()) {
      await expect(nav.getByRole("button", { name: department.overviewLabel })).toBeVisible();
    }
  });

  test("clicking the secondary CTA also reveals all 5 department hotspots (no native anchor jump)", async ({
    page,
  }) => {
    await page.goto("/");
    const copy = getHomepageCopy();
    await page.getByRole("link", { name: copy.secondaryCta }).click();

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button")).toHaveCount(5);
    // Предотвращён нативный переход по фрагменту — hash не должен появиться в URL.
    expect(new URL(page.url()).hash).toBe("");
  });

  test("no console errors or hydration-mismatch warnings when JS reveals/hides hotspots", async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => consoleMessages.push(msg.text()));
    page.on("pageerror", (err) => consoleMessages.push(err.message));

    await page.goto("/");
    await activateCta(page);

    const suspicious = consoleMessages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });

  test("?department=<id> at boot opens the department itself immediately, without a click (Step 5 — honest upgrade of the Step 4 'only skips hero' behavior; office map replaced by the Step 6 rail)", async ({
    page,
  }) => {
    await page.goto("/?department=sales");
    // Начиная со Step 6 карта офиса (5 хотспотов) не сосуществует с активным отделом — заменена
    // DepartmentNavigationRail (4 кнопки оставшихся отделов).
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await expect(rail.getByRole("button")).toHaveCount(4);

    const salesDepartment = getDepartments().find((d) => d.id === "sales")!;
    await expect(
      page.getByRole("heading", { level: 2, name: salesDepartment.headline }),
    ).toBeVisible();
  });

  test("?department=<invalid id> at boot still reveals overview, opens no department, and does not error (degrades gracefully)", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/?department=does-not-exist");
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button")).toHaveCount(5);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });

  test("without JavaScript, the initial state (overview or a directly-linked department) still renders correctly", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    // Без JavaScript класс .js никогда не появляется, поэтому правило
    // ":global(.js) .hiddenUntilRevealed { display: none; }" не срабатывает ни при каком значении
    // query string — визуально все 5 хотспотов видны сразу без параметра. Разметка при этом
    // законно отличается (data-revealed/hiddenUntilRevealed зависят от searchParams независимо от
    // JS — см. Step 4 acceptance criterion 5), поэтому сравнивается видимый результат, а не байты
    // HTML (в отличие от Step 3, где query string вообще не влиял на разметку).
    await page.goto("/");
    const navWithoutQuery = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(navWithoutQuery.getByRole("button")).toHaveCount(5);
    // Step 7.2: HeroCopy скрывается только `:global(.js)`-gated правилом — без JS оно не
    // срабатывает, hero и раскрытый офис по-прежнему рендерятся одновременно (docs/05 "## hero").
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // ?department=<id> вычисляет начальное состояние редьюсера (department-active) уже на сервере
    // (initOfficeMachineState вызывается синхронно при первом рендере) — SSR-разметка одинакова с
    // JS и без него; интерактивность (клик по rail) без JS не работает, но начальный рендер отдела
    // — работает (честное отличие от Step 5, где карта офиса оставалась рядом с временным блоком
    // всегда, независимо от JS — см. WORKPLAN.md Step 6 Out of scope).
    await page.goto("/?department=sales");
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await expect(rail.getByRole("button")).toHaveCount(4);
    const salesDepartment = getDepartments().find((d) => d.id === "sales")!;
    await expect(
      page.getByRole("heading", { level: 2, name: salesDepartment.headline }),
    ).toBeVisible();
    // Step 7.2 AC9: hero остаётся видимым и рядом с напрямую открытым отделом, не только рядом с
    // overview — тот же `:global(.js)`-gate, что и выше, не срабатывает без JS ни для одного view.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await context.close();
  });

  const desktopSizes = [
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  async function expectNoDocumentScroll(page: import("@playwright/test").Page) {
    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
  }

  for (const size of desktopSizes) {
    test(`fits within one screen without vertical scroll at ${size.width}x${size.height} in hero, overview, and department-active (docs/08, Step 5 AC13, Step 6 AC8 regression)`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto("/");
      // hero
      await expectNoDocumentScroll(page);

      await activateCta(page);
      // overview
      await expectNoDocumentScroll(page);

      const nav = page.getByRole("navigation", { name: "Отделы компании" });
      await nav.getByRole("button").first().click();
      // department-active (Step 6 10/90 shell)
      await expectNoDocumentScroll(page);
    });
  }

  test("low-height desktop (docs/08 'Низкий desktop'): heading/CTA never clipped in hero, hotspots keep a readable minimum size in overview, office panel scrolls internally instead of the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/");

    // Step 7.2: hero (заголовок, обе CTA) скрывается сразу после ACTIVATE_CTA — эти проверки
    // "не обрезаются" теперь имеют смысл только в состоянии hero, до раскрытия офиса.
    const heading = page.getByRole("heading", { level: 1 });
    const headingBox = await heading.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(headingBox!.y).toBeGreaterThanOrEqual(0);
    expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(500);

    const copy = getHomepageCopy();
    const primaryCta = page.getByRole("button", { name: copy.primaryCta });
    const primaryCtaBox = await primaryCta.boundingBox();
    expect(primaryCtaBox).not.toBeNull();
    expect(primaryCtaBox!.y + primaryCtaBox!.height).toBeLessThanOrEqual(500);

    await activateCta(page);

    // Документ по-прежнему не скроллится целиком — скроллится только панель офиса.
    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight);

    // Каждый хотспот, будучи прокручен в видимую область панели офиса, сохраняет читаемый
    // минимальный размер (не сжимается пропорционально нехватке высоты viewport).
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    const buttons = await nav.getByRole("button").all();
    expect(buttons.length).toBe(5);
    for (const button of buttons) {
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("Step 7.2: ACTIVATE_CTA removes the entire hero block from the a11y tree and hides the interaction hint in overview, and stays hidden after opening a department", async ({
    page,
  }) => {
    await page.goto("/");
    const copy = getHomepageCopy();

    await activateCta(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.primaryCta })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toHaveCount(0);
    // interactionHint остаётся в DOM (markup не удаляется, см. WORKPLAN.md Step 7.2, решение 3) —
    // toBeHidden(), а не toHaveCount(0), проверяет именно визуальное сокрытие через CSS.
    await expect(page.getByText(copy.interactionHint)).toBeHidden();

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button").first().click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.primaryCta })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toHaveCount(0);
    await expect(page.getByText(copy.interactionHint)).toBeHidden();
  });

  test("Step 7.2: focus moves to the first office hotspot immediately after ACTIVATE_CTA, without any Tab press", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button").first()).toBeFocused();
  });

  test("Step 7.2: the secondary CTA hides the hero block from the a11y tree and also moves focus to the first hotspot, without any Tab press (AC2/AC5 — same guarantee as the primary CTA)", async ({
    page,
  }) => {
    await page.goto("/");
    const copy = getHomepageCopy();

    await activateCtaViaSecondary(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.primaryCta })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toHaveCount(0);
    await expect(page.getByText(copy.interactionHint)).toBeHidden();

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button").first()).toBeFocused();
  });

  test("the header tagline is visible in every state (hero and overview)", async ({ page }) => {
    const copy = getHomepageCopy();
    await page.goto("/");
    await expect(page.getByText(copy.tagline)).toBeVisible();

    await activateCta(page);
    await expect(page.getByText(copy.tagline)).toBeVisible();
  });

  test("the 'return to office' button is absent in hero, appears after ACTIVATE_CTA, and sends the user back to hero with focus on the hero heading", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    await page.goto("/");
    await expect(page.getByRole("button", { name: copy.returnToOfficeLabel })).toHaveCount(0);

    await activateCta(page);
    const returnButton = page.getByRole("button", { name: copy.returnToOfficeLabel });
    await expect(returnButton).toBeVisible();
    await returnButton.click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.headline);
    await expect(page.getByRole("button", { name: copy.primaryCta })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.returnToOfficeLabel })).toHaveCount(0);
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("hero-heading");
  });

  test("the 'return to office' button lives only above the overview grid: absent while a department is open, reachable again after closing it", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    const salesDepartment = getDepartments().find((d) => d.id === "sales")!;
    await page.goto("/?department=sales");
    await expect(
      page.getByRole("heading", { level: 2, name: salesDepartment.headline }),
    ).toBeVisible();
    // Step 7.4 (правка): кнопка теперь живёт только над сеткой отделов в overview, не в Header —
    // из открытого отдела её нет, сначала нужно закрыть отдел существующей кнопкой «Закрыть».
    await expect(page.getByRole("button", { name: copy.returnToOfficeLabel })).toHaveCount(0);

    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);

    const returnButton = page.getByRole("button", { name: copy.returnToOfficeLabel });
    await expect(returnButton).toBeVisible();
    await returnButton.click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.headline);
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
  });
});
