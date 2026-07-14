import { expect, test } from "@playwright/test";

test("homepage renders the Allqbit placeholder", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Allqbit" })).toBeVisible();
});
