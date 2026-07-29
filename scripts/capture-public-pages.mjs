import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3200";
const outputDirectory = path.resolve("artifacts/public-pages");
const routes = [
  { path: "/contacts", name: "contacts", heading: "Контакты" },
  { path: "/login", name: "login", heading: "Вход" },
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const results = [];

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width <= 768,
        isMobile: viewport.width < 768,
        colorScheme: "light",
        locale: "ru-RU",
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));

      const response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.getByRole("heading", { level: 1, name: route.heading }).waitFor();

      results.push({
        route: route.path,
        viewport: `${viewport.width}x${viewport.height}`,
        status: response?.status(),
        title: await page.title(),
        document: await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        })),
        consoleErrors,
      });

      await page.screenshot({
        path: path.join(outputDirectory, `${route.name}-${viewport.width}x${viewport.height}.png`),
      });

      if (route.path === "/contacts" && viewport.width === 390) {
        await page.locator('button[aria-controls="site-navigation"]').click();
        await page.waitForTimeout(220);
        await page.screenshot({
          path: path.join(outputDirectory, "contacts-390x844-menu.png"),
        });
      }

      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, "metrics.json"),
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(results, null, 2));
