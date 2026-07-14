import { expect, test } from "@playwright/test";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

function expectedTabOrderLabels() {
  const departments = getDepartments();
  return getOfficeZones()
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((zone) => departments.find((d) => d.id === zone.departmentId)?.overviewLabel);
}

test("Tab visits all 5 department hotspots in the expected order with visible focus", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const buttons = await nav.getByRole("button").all();
  expect(buttons).toHaveLength(5);

  const expectedOrder = expectedTabOrderLabels();

  // The hero's own primaryCta/secondaryCta are focusable and come before the office
  // map in DOM order, so Tab through the page (bounded) until focus reaches the
  // first hotspot, then verify the remaining 4 follow in the expected order.
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

test("Enter/Space on a hotspot is a no-op (no navigation, no console error)", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const firstButton = nav.getByRole("button").first();
  await firstButton.focus();

  const urlBefore = page.url();
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");

  expect(page.url()).toBe(urlBefore);
  expect(consoleErrors).toEqual([]);
});

test("prefers-reduced-motion zeroes hotspot transition durations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  const button = nav.getByRole("button").first();
  const duration = await button.evaluate((el) => getComputedStyle(el).transitionDuration);

  for (const value of duration.split(",")) {
    expect(parseFloat(value)).toBeLessThanOrEqual(0.001);
  }
});

test("works with JavaScript disabled (progressive enhancement)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Отделы компании" });
  await expect(nav.getByRole("button")).toHaveCount(5);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await context.close();
});
