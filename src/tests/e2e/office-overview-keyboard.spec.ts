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

test("hidden hotspots are not reachable by Tab before ACTIVATE_CTA; Tab visits all 5 in the expected order with visible focus after reveal", async ({
  page,
}) => {
  await page.goto("/");

  // До раскрытия хотспоты скрыты через display:none — не в Tab-последовательности вовсе.
  const navBeforeReveal = page.getByRole("navigation", { name: "Отделы компании" });
  await expect(navBeforeReveal).toHaveCount(0);

  await activateCta(page);

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const buttons = await nav.getByRole("button").all();
  expect(buttons).toHaveLength(5);

  const expectedOrder = expectedTabOrderLabels();

  // primaryCta/secondaryCta по-прежнему предшествуют карте офиса в DOM-порядке, поэтому
  // таб(аем) ограниченное число раз, пока фокус не достигнет первого хотспота.
  let focusedLabel: string | null = null;
  for (let i = 0; i < 20 && focusedLabel !== expectedOrder[0]; i++) {
    await page.keyboard.press("Tab");
    focusedLabel = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? null,
    );
  }
  expect(focusedLabel).toBe(expectedOrder[0]);

  for (const expectedLabel of expectedOrder) {
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("aria-label", expectedLabel as string);
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Tab");
  }
});

test("Enter/Space on a hotspot is a no-op (no navigation, no console error) — department selection is not part of Step 4", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  await activateCta(page);

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const firstButton = nav.getByRole("button").first();
  await firstButton.focus();

  const urlBefore = page.url();
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");

  expect(page.url()).toBe(urlBefore);
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
