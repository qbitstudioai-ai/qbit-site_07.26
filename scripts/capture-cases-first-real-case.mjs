// Съёмка ПЕРВОГО РЕАЛЬНОГО кейса раздела «Кейсы» для визуальной приёмки.
//
// Отличие от `capture-cases-visual.mjs`: тот снимал раздел на временных заготовках и проверял
// геометрию сцены. Здесь проверяется другое — как в утверждённом дизайне ведёт себя НАСТОЯЩИЙ
// длинный документ: верх листа, середина, раздел «Результат» с метрикой, конец досье и печать.
// Длина не имитируется размножением разделов: содержимое настоящее.
//
// Запуск (при поднятом сервере): `node scripts/capture-cases-first-real-case.mjs`
// Адрес переопределяется переменной CAPTURE_BASE_URL, каталог — CAPTURE_OUT_DIR.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3100";
const outputDirectory = path.resolve(
  process.env.CAPTURE_OUT_DIR ?? "artifacts/cases-first-real-case",
);

const CASE_PATH = "/cases/analiz-zvonkov-otdela-prodazh";
const SECOND_CASE_PATH = "/cases/case-02";

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const report = [];

function shot(viewport, name) {
  return path.join(outputDirectory, `case-01-${name}-${viewport.width}x${viewport.height}.png`);
}

/** Прокрутка документа: на desktop прокручивается область досье, на mobile — страница. */
function scrollDocument(page, ratio) {
  return page.evaluate((share) => {
    const scroller = document.querySelector('article [role="region"]');
    const inner = scroller && scroller.scrollHeight > scroller.clientHeight + 1;
    if (inner) {
      scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * share;
      return { mode: "inner", top: Math.round(scroller.scrollTop) };
    }

    const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    window.scrollTo(0, max * share);
    return { mode: "page", top: Math.round(window.scrollY) };
  }, ratio);
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

    const response = await page.goto(`${baseUrl}${CASE_PATH}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.getByRole("heading", { level: 1 }).first().waitFor();

    // 1. Верх документа: служебная шапка, H1 и начало «Краткого итога». Печати ещё нет.
    await page.screenshot({ path: shot(viewport, "top") });

    // 2. Документ с поставленной печатью — тот же верх, но через две секунды.
    await page.waitForFunction(
      () => document.querySelector('[data-case-stamp="struck"]') !== null,
      undefined,
      { timeout: 8000 },
    );
    await page.waitForTimeout(700);
    await page.screenshot({ path: shot(viewport, "after-stamp") });

    // 3. Середина документа.
    const middle = await scrollDocument(page, 0.5);
    await page.screenshot({ path: shot(viewport, "middle") });

    // 4. Раздел «Результат» с метрикой «до/после».
    await page.evaluate(() => {
      document.querySelector("#case-01-result")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: shot(viewport, "result") });

    // 5. Конец документа: последний раздел «Об измеримом результате».
    const end = await scrollDocument(page, 1);
    await page.screenshot({ path: shot(viewport, "end") });

    const measured = await page.evaluate(() => {
      const sheet = document.querySelector("article > div").getBoundingClientRect();
      const scroller = document.querySelector('article [role="region"]');
      const stamp = document.querySelector("[data-case-stamp]").getBoundingClientRect();
      const last = document
        .querySelector("#case-01-limitations")
        .parentElement.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      const folderTitle = document.querySelector(
        '[aria-current="page"][data-case-folder] span > span:nth-child(2)',
      );
      const titleStyle = getComputedStyle(folderTitle);

      return {
        sheetHeight: Math.round(sheet.height),
        sheetWidth: Math.round(sheet.width),
        innerScroll: scroller.scrollHeight - scroller.clientHeight,
        pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        horizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        stampBottomOffset: Math.round(sheet.bottom - stamp.bottom),
        lastSectionFullyVisible: last.bottom <= view.bottom + 2,
        folderTitleText: folderTitle.textContent,
        folderTitleLines: Math.round(
          folderTitle.getBoundingClientRect().height / parseFloat(titleStyle.lineHeight),
        ),
        bodyFontSize: getComputedStyle(document.querySelector("article section p")).fontSize,
      };
    });

    // 6. Перелистывание на соседний кейс и обратно: длинный документ не ломает переход, а новый
    //    кейс открывается сверху.
    await page.goto(`${baseUrl}${SECOND_CASE_PATH}`, { waitUntil: "networkidle" });
    await page.locator('[data-case-folder="analiz-zvonkov-otdela-prodazh"]').click();
    await page.waitForTimeout(120);
    await page.screenshot({ path: shot(viewport, "page-turn") });
    await page.waitForTimeout(500);
    const reopened = await page.evaluate(() => {
      const scroller = document.querySelector('article [role="region"]');
      return { scrollTop: scroller.scrollTop, pageScrollY: Math.round(window.scrollY) };
    });

    report.push({
      viewport: `${viewport.width}x${viewport.height}`,
      status: response?.status(),
      middle,
      end,
      reopened,
      ...measured,
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
    `${entry.viewport} — ${entry.status} лист ${entry.sheetWidth}x${entry.sheetHeight}` +
      ` внутр.прокрутка ${entry.innerScroll} стр.прокрутка ${entry.pageScroll}` +
      ` печать от низа ${entry.stampBottomOffset} конец виден: ${entry.lastSectionFullyVisible}` +
      ` папка «${entry.folderTitleText}» строк: ${entry.folderTitleLines}` +
      ` кегль ${entry.bodyFontSize} overflow-x: ${entry.horizontalOverflow}` +
      ` открыт сверху: ${entry.reopened.scrollTop === 0} ошибок консоли: ${entry.consoleErrors.length}`,
  );
}
