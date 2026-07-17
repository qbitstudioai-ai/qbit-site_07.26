import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

function expectedTabOrderLabels() {
  const departments = getDepartments();
  return getOfficeZones()
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((zone) => departments.find((d) => d.id === zone.departmentId)?.overviewLabel);
}

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("button", { name: copy.primaryCta }).click();
}

test("hidden hotspots are not reachable by Tab before ACTIVATE_CTA; focus lands on the first hotspot immediately after reveal (Step 7.2), then Tab visits the remaining 4 in the expected order with visible focus", async ({
  page,
}) => {
  await page.goto("/");

  // До раскрытия хотспоты скрыты через display:none — не в Tab-последовательности вовсе.
  const navBeforeReveal = page.getByRole("navigation", { name: "Отделы компании" });
  await expect(navBeforeReveal).toHaveCount(0);

  // Активируем CTA клавиатурой (Tab + Enter), а не кликом мышью — этот файл проверяет именно
  // клавиатурный путь, а :focus-visible (globals.css) в Chromium показывает ring для
  // программного .focus() только если последнее взаимодействие пользователя было клавиатурным
  // (см. WORKPLAN.md Step 7.2, решение 2 — сам факт переноса focus не зависит от модальности
  // ввода, но видимость ring — зависит, это поведение браузера, не этого кода).
  const copy = getHomepageCopy();
  await page.getByRole("button", { name: copy.primaryCta }).focus();
  await page.keyboard.press("Enter");

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const buttons = await nav.getByRole("button").all();
  expect(buttons).toHaveLength(5);

  const expectedOrder = expectedTabOrderLabels();

  // Step 7.2: hero скрывается вместе с ACTIVATE_CTA и focus программно переводится на первый
  // хотспот сразу (OfficeMachine.tsx focus-management useEffect) — без единого Tab, в отличие от
  // прежнего поведения, где primaryCta/secondaryCta предшествовали карте в Tab-порядке.
  const focusedLabelAfterReveal = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") ?? null,
  );
  expect(focusedLabelAfterReveal).toBe(expectedOrder[0]);

  for (const expectedLabel of expectedOrder) {
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("aria-label", expectedLabel as string);
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Tab");
  }
});

test("Enter on a focused hotspot opens the department — honest inversion of the old Step 3/4 no-op test (Step 5 implements SELECT_DEPARTMENT)", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  await activateCta(page);

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const departments = getDepartments();
  const firstZoneOverviewLabel = expectedTabOrderLabels()[0];
  const firstDepartment = departments.find((d) => d.overviewLabel === firstZoneOverviewLabel);
  const firstButton = nav.getByRole("button", { name: firstDepartment?.overviewLabel });
  await firstButton.focus();

  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { level: 2, name: firstDepartment?.headline }),
  ).toBeVisible();
  // Полной навигации/перезагрузки документа не произошло — только URL (?department=<id>) обновился.
  expect(new URL(page.url()).searchParams.get("department")).toBe(firstDepartment?.id);
  expect(consoleErrors).toEqual([]);
});

test("prefers-reduced-motion: hero-to-overview reveal is still immediate/functional", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await activateCta(page);

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  await expect(nav.getByRole("button")).toHaveCount(5);

  const button = nav.getByRole("button").first();
  const duration = await button.evaluate((el) => getComputedStyle(el).transitionDuration);
  for (const value of duration.split(",")) {
    expect(parseFloat(value)).toBeLessThanOrEqual(0.001);
  }
});

test("works with JavaScript disabled (progressive enhancement) — all 5 hotspots visible immediately, no CTA click needed", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  await expect(nav.getByRole("button")).toHaveCount(5);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await context.close();
});
