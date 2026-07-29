import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3200";
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
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width <= 768,
      isMobile: viewport.width < 768,
      colorScheme: "light",
      reducedMotion: "no-preference",
      locale: "ru-RU",
    });
    const page = await context.newPage();
    const consoleErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(`${baseUrl}/?department=invalid`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.getByRole("navigation", { name: "Отделы компании" }).waitFor();
    await page.locator('[data-scene-crossfade="overview"] img').evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) =>
          image instanceof HTMLImageElement && !image.complete ? image.decode() : Promise.resolve(),
        ),
      );
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-scene-crossfade="overview"] img')].some(
        (image) =>
          image instanceof HTMLImageElement &&
          image.naturalWidth > 0 &&
          Number(getComputedStyle(image).opacity) > 0.99,
      ),
    );

    const metrics = await page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          x: Number(rect.x.toFixed(1)),
          y: Number(rect.y.toFixed(1)),
          width: Number(rect.width.toFixed(1)),
          height: Number(rect.height.toFixed(1)),
        };
      };
      const overflow = (selector) => {
        const element = document.querySelector(selector);
        return {
          vertical: element.scrollHeight - element.clientHeight,
          horizontal: element.scrollWidth - element.clientWidth,
        };
      };
      const stage = document
        .querySelector('[data-scene-crossfade="overview"]')
        .parentElement.getBoundingClientRect();
      const zones = [...document.querySelectorAll('nav[aria-label="Отделы компании"] button')].map(
        (zone) => {
          const rect = zone.getBoundingClientRect();
          return {
            label: zone.getAttribute("aria-label"),
            insideStage:
              rect.left >= stage.left - 1 &&
              rect.top >= stage.top - 1 &&
              rect.right <= stage.right + 1 &&
              rect.bottom <= stage.bottom + 1,
          };
        },
      );

      return {
        document: {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        },
        stage: box('[data-scene-crossfade="overview"]'),
        controls: box("[data-overview-controls]"),
        instruction: box("[data-overview-controls] p"),
        overflows: {
          office: overflow('[data-office-mode="overview"]'),
          stageRow: overflow('[data-stage-mode="overview"]'),
          officeCenter: overflow("[data-office-center]"),
          leftStory: overflow('[data-overview-slot="left"]'),
          rightStory: overflow('[data-overview-slot="right"]'),
        },
        storyColor: getComputedStyle(document.querySelector('[data-overview-slot="left"]')).color,
        zones,
      };
    });

    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      ...metrics,
      consoleErrors,
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

await writeFile(
  path.join(outputDirectory, "amendment-30-metrics.json"),
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(results, null, 2));
