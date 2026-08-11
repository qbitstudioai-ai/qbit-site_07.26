// Съёмка раздела «Кейсы» для визуальной приёмки первого этапа.
//
// Снимает восемь ширин из задания и все требуемые моменты: основной экран, активный кейс,
// середину перелистывания, документ до печати, документ после печати и мобильный вид.
//
// Запуск (при поднятом сервере): `node scripts/capture-cases-visual.mjs`
// Адрес переопределяется переменной CAPTURE_BASE_URL.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3100";
// Каталог переопределяется переменной: у каждой ревизии визуала своя папка, и прежние кадры
// остаются на месте для сравнения «до/после».
const outputDirectory = path.resolve(process.env.CAPTURE_OUT_DIR ?? "artifacts/cases-visual");

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const report = [];

function shot(viewport, name) {
  return path.join(outputDirectory, `cases-${name}-${viewport.width}x${viewport.height}.png`);
}

try {
  for (const viewport of viewports) {
    const isMobile = viewport.width <= 430;
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width <= 768,
      isMobile,
      colorScheme: "light",
      locale: "ru-RU",
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    // 1. Основной экран раздела.
    const indexResponse = await page.goto(`${baseUrl}/cases`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.screenshot({ path: shot(viewport, "index") });

    // 2. Середина перелистывания: снимок через ~150 мс после клика по второй папке.
    const secondFolder = page.locator("[data-case-folder]").nth(1);
    await secondFolder.scrollIntoViewIfNeeded();
    await secondFolder.click();
    await page.waitForTimeout(90);
    await page.screenshot({ path: shot(viewport, "page-turn") });

    // 3. Документ открыт, печати ещё нет (задержка 2000 мс).
    await page.waitForTimeout(500);
    const stampBefore = await page.locator("[data-case-stamp]").getAttribute("data-case-stamp");
    await page.screenshot({ path: shot(viewport, "before-stamp") });

    // 4. Документ с поставленной печатью.
    await page.waitForFunction(
      () => document.querySelector('[data-case-stamp="struck"]') !== null,
      undefined,
      { timeout: 8000 },
    );
    await page.waitForTimeout(700);
    const stampAfter = await page.locator("[data-case-stamp]").getAttribute("data-case-stamp");
    await page.screenshot({ path: shot(viewport, "after-stamp") });

    const geometry = await page.evaluate(() => {
      const sheet = document.querySelector("article > div")?.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        stamps: document.querySelectorAll("[data-case-stamp]").length,
        sheets: document.querySelectorAll("[data-case-sheet]").length,
        folders: document.querySelectorAll("[data-case-folder]").length,
        sheetTop: sheet ? Math.round(sheet.top) : null,
        sheetHeight: sheet ? Math.round(sheet.height) : null,
      };
    });

    /**
     * 5. Внутренняя прокрутка документа. Длина имитируется размножением уже отрисованных разделов:
     * временные кейсы короткие, а проверить нужно ровно то, что при длинном содержимом лист НЕ
     * растёт, а прокручивается внутри себя. Кадр снимается после прокрутки в самый низ.
     */
    const innerScroll = await page.evaluate(() => {
      const sections = document.querySelector("article section")?.parentElement;
      if (!sections) return null;
      for (let copy = 0; copy < 12; copy += 1) {
        sections.appendChild(sections.firstElementChild.cloneNode(true));
      }
      const scroller = document.querySelector('article [role="region"]');
      if (!scroller) return null;
      scroller.scrollTop = scroller.scrollHeight;
      return {
        scrollable: scroller.scrollHeight - scroller.clientHeight,
        sheetHeight: Math.round(
          document.querySelector("article > div").getBoundingClientRect().height,
        ),
      };
    });
    await page.screenshot({ path: shot(viewport, "inner-scroll") });

    report.push({
      viewport: `${viewport.width}x${viewport.height}`,
      status: indexResponse?.status(),
      url: page.url(),
      stampBefore,
      stampAfter,
      geometry,
      innerScroll,
      horizontalOverflow: geometry.scrollWidth > geometry.clientWidth,
      consoleErrors,
    });

    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

for (const entry of report) {
  console.log(
    `${entry.viewport} — ${entry.status} печать: ${entry.stampBefore} → ${entry.stampAfter}` +
      ` папок: ${entry.geometry.folders} лист: верх ${entry.geometry.sheetTop} высота ${entry.geometry.sheetHeight}` +
      ` внутр.прокрутка ${entry.innerScroll?.scrollable ?? "—"} (лист не вырос: ${
        entry.innerScroll ? entry.innerScroll.sheetHeight === entry.geometry.sheetHeight : "—"
      })` +
      ` overflow-x: ${entry.horizontalOverflow} ошибок консоли: ${entry.consoleErrors.length}`,
  );
}
