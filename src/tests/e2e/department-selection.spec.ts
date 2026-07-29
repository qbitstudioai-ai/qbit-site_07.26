import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).click();
}

const departments = getDepartments();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

test.describe("department selection state machine (Step 5, switching UI upgraded to the Step 6 rail)", () => {
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
    // Step 7.3: ровно 5 пунктов боли, выгода первого показана по умолчанию (OQ-P2) — на Desktop
    // видима раскладка PainGainPanel (20/80), не мобильный аккордеон (оба в DOM, CSS переключает).
    for (const point of sales.painPoints) {
      await expect(panel.getByRole("button", { name: point.pain }).first()).toBeVisible();
    }
    await expect(panel.getByText(sales.painPoints[0].gain).first()).toBeVisible();
    await expect(panel.getByRole("link", { name: sales.ctaLabel })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Назад к офису" })).toBeVisible();

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

    // Переключение на второй отдел — уже через DepartmentNavigationRail (Step 6), а не через карту
    // офиса: карта больше не рендерится одновременно с активным отделом (см. WORKPLAN.md Step 6).
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
  });

  test("switching between two departments via the rail does not pass through overview and does not fully reload (docs/05 department-switching)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();

    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("hr");
    const markerSurvived = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
    );
    expect(markerSurvived).toBe(true);
  });

  test("the active department has no clickable affordance to reopen itself: it appears in the rail only as a non-interactive, aria-current marker (Step 6; no-op guard itself is covered at the reducer level, src/tests/unit/features/office-machine/reducer.test.ts)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await expect(rail.getByRole("button", { name: sales.overviewLabel })).toHaveCount(0);
    // 4 неактивных отдела + пункт «Ваша задача» (Step 12.7).
    await expect(rail.getByRole("button")).toHaveCount(5);
    const currentMarker = rail.locator('[aria-current="true"]');
    await expect(currentMarker).toHaveText(new RegExp(sales.overviewLabel));
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

  test("the explicit Back-to-office button produces the same result as Escape", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    const hotspot = nav.getByRole("button", { name: sales.overviewLabel });
    await hotspot.click();

    await page.getByRole("button", { name: "Назад к офису" }).click();

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

  test("prefers-reduced-motion: opening, switching via the rail, and closing all remain functional without animation", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });

    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
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
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await page.keyboard.press("Escape");
    await page.goto("/?department=sales");
    await page.goto("/?department=does-not-exist");

    const suspicious = messages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });
});
