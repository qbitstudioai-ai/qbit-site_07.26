import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3100";
const outputDirectory = path.resolve("artifacts/office-overview");
const viewports = [
  { width: 1920, height: 920 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();

try {
  for (const viewport of viewports) {
    const touchViewport = viewport.width <= 768;
    const context = await browser.newContext({
      viewport,
      hasTouch: touchViewport,
      isMobile: viewport.width < 768,
      colorScheme: "light",
      reducedMotion: "no-preference",
      locale: "ru-RU",
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?department=invalid`, { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Отделы компании" }).waitFor();
    await page.locator('[data-scene-crossfade="overview"] img').evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) =>
          image instanceof HTMLImageElement && !image.complete ? image.decode() : Promise.resolve(),
        ),
      );
    });

    await page.screenshot({
      path: path.join(outputDirectory, `office-overview-${viewport.width}x${viewport.height}.png`),
    });

    if (viewport.width === 1440) {
      await page.getByRole("button", { name: "Продажи" }).hover();
      await page.waitForTimeout(260);
      await page.screenshot({
        path: path.join(outputDirectory, "office-overview-1440x900-hover-sales.png"),
      });
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`Office overview screenshots saved to ${outputDirectory}`);
