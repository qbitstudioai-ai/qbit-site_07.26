import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("button", { name: copy.primaryCta }).click();
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

  test("?department=<id> at boot skips hero-only state and reveals overview immediately, without a click", async ({
    page,
  }) => {
    await page.goto("/?department=sales");
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button")).toHaveCount(5);
  });

  test("?department=<invalid id> at boot still reveals overview and does not error (degrades gracefully)", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/?department=does-not-exist");
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button")).toHaveCount(5);
    expect(consoleErrors).toEqual([]);
  });

  test("without JavaScript, all 5 hotspots are present immediately regardless of ?department=", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    // Без JavaScript класс .js никогда не появляется, поэтому правило
    // ":global(.js) .hiddenUntilRevealed { display: none; }" не срабатывает ни при каком значении
    // query string — визуально все 5 хотспотов видны сразу в обоих случаях. Разметка при этом
    // законно отличается (data-revealed/hiddenUntilRevealed зависят от searchParams независимо от
    // JS — см. Step 4 acceptance criterion 5), поэтому сравнивается видимый результат, а не байты
    // HTML (в отличие от Step 3, где query string вообще не влиял на разметку).
    await page.goto("/");
    const navWithoutQuery = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(navWithoutQuery.getByRole("button")).toHaveCount(5);

    await page.goto("/?department=sales");
    const navWithQuery = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(navWithQuery.getByRole("button")).toHaveCount(5);

    await context.close();
  });

  const desktopSizes = [
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  for (const size of desktopSizes) {
    test(`fits within one screen without vertical scroll at ${size.width}x${size.height} (docs/08)`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto("/");
      await activateCta(page);
      const { scrollHeight, innerHeight } = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
    });
  }

  test("low-height desktop (docs/08 'Низкий desktop'): heading/CTA never clipped, hotspots keep a readable minimum size, office panel scrolls internally instead of the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/");
    await activateCta(page);

    // Заголовок, основная и вторичная CTA не обрезаются (docs/08: "Заголовок, навигация и CTA не
    // обрезаются") — полностью в пределах viewport.
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
});
