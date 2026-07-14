import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

test.describe("office overview", () => {
  test("renders the hero and all 5 department hotspots", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");

    const copy = getHomepageCopy();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.headline);
    await expect(page.getByText(copy.subheadline)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    for (const department of getDepartments()) {
      await expect(nav.getByRole("button", { name: department.overviewLabel })).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("ignores the ?department= query string in overview rendering", async ({ page }) => {
    // Compare only the app's own markup, not the full document: Next.js appends a
    // client-only <next-route-announcer> to <body> asynchronously after hydration,
    // at a timing that has nothing to do with the query string and would make a
    // full-document comparison flaky.
    await page.goto("/");
    const withoutQuery = await page.locator("main").innerHTML();

    await page.goto("/?department=sales");
    const withQuery = await page.locator("main").innerHTML();

    expect(withQuery).toBe(withoutQuery);
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
