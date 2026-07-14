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
});
