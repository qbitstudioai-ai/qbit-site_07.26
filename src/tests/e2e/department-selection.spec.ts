import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("button", { name: copy.primaryCta }).click();
}

const departments = getDepartments();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

test.describe("department selection state machine (Step 5)", () => {
  test("clicking a hotspot opens the department: content visible, URL updated, no full page reload", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    // Скоуп на сам панель отдела (aria-label=overviewLabel даёт ARIA-роль "region") — некоторые
    // outcomes текстуально совпадают с valuePoints hero (например, "Меньше ручной работы"), которые
    // остаются на странице одновременно, поэтому проверка по всей странице была бы неоднозначной.
    const panel = page.getByRole("region", { name: sales.overviewLabel });
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    await expect(panel.getByText(sales.problem)).toBeVisible();
    for (const outcome of sales.outcomes) {
      await expect(panel.getByText(outcome)).toBeVisible();
    }
    await expect(panel.getByRole("button", { name: sales.ctaLabel })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Закрыть" })).toBeVisible();

    expect(new URL(page.url()).searchParams.get("department")).toBe("sales");
    const markerSurvived = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
    );
    expect(markerSurvived).toBe(true);
  });

  test("at most one department is active at a time (docs/05 invariant)", async ({ page }) => {
    await page.goto("/");
    await activateCta(page);

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);

    await nav.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
  });

  test("switching between two departments does not pass through overview and does not fully reload (docs/05 department-switching)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await nav.getByRole("button", { name: hr.overviewLabel }).click();

    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("hr");
    const markerSurvived = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
    );
    expect(markerSurvived).toBe(true);
  });

  test("clicking the hotspot of the already-active department is a no-op (does not reopen itself)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    const hotspot = nav.getByRole("button", { name: sales.overviewLabel });
    await hotspot.click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await hotspot.click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
  });

  test("Space on a focused hotspot also opens the department (pointer/keyboard parity, docs/05 invariant)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    const hotspot = nav.getByRole("button", { name: sales.overviewLabel });
    await hotspot.focus();

    await page.keyboard.press(" ");

    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
  });

  test("opening a department moves focus to its heading (docs/05 department-opening, docs/11)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeFocused();
  });

  test("Escape closes the active department, returns to overview, and returns focus to the originating hotspot (docs/11)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    const hotspot = nav.getByRole("button", { name: sales.overviewLabel });
    await hotspot.click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
    await expect(hotspot).toBeFocused();
  });

  test("the explicit Close button produces the same result as Escape", async ({ page }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    const hotspot = nav.getByRole("button", { name: sales.overviewLabel });
    await hotspot.click();

    await page.getByRole("button", { name: "Закрыть" }).click();

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
    await expect(hotspot).toBeFocused();
  });

  test("direct URL with a valid ?department=<id> opens that department immediately, for all 5 ids", async ({
    page,
  }) => {
    for (const department of departments) {
      await page.goto(`/?department=${department.id}`);
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
    }
  });

  test("prefers-reduced-motion: opening, switching, and closing all remain functional without animation", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });

    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await nav.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  test("no console/hydration-mismatch errors across the full selection flow (production build)", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));
    page.on("pageerror", (err) => messages.push(err.message));

    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await nav.getByRole("button", { name: hr.overviewLabel }).click();
    await page.keyboard.press("Escape");
    await page.goto("/?department=sales");
    await page.goto("/?department=does-not-exist");

    const suspicious = messages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });
});
