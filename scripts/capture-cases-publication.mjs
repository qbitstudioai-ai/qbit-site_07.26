// Съёмка раздела «Кейсы» ПОСЛЕ публикации: сокращённый текст первого кейса, ссылка в конце досье,
// обложка архива с настоящим вводным текстом и картотека из одного опубликованного дела.
//
// Отличие от `capture-cases-first-real-case.mjs`: тот снимал ещё не опубликованный кейс из восьми
// разделов и проверял, помещается ли длинный документ. Здесь проверяется обратное — стало ли
// заметно легче после сокращения до шести разделов, и виден ли на месте GEO-мостик под метрикой.
//
// Запуск (при поднятом сервере): `node scripts/capture-cases-publication.mjs`
// Адрес переопределяется переменной CAPTURE_BASE_URL, каталог — CAPTURE_OUT_DIR.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3100";
const outputDirectory = path.resolve(
  process.env.CAPTURE_OUT_DIR ?? "artifacts/cases-publication-ready",
);

const CASE_PATH = "/cases/analiz-zvonkov-otdela-prodazh";
const INDEX_PATH = "/cases";

const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const report = [];

function shot(viewport, name) {
  return path.join(outputDirectory, `${name}-${viewport.width}x${viewport.height}.png`);
}

/** Прокрутка к элементу: на desktop прокручивается область досье, на mobile — страница. */
function scrollTo(page, selector) {
  return page.evaluate((target) => {
    document.querySelector(target)?.scrollIntoView({ block: "center" });
    return true;
  }, selector);
}

/** Прокрутка документа до конца тем способом, который на этой раскладке работает. */
function scrollToEnd(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('article [role="region"]');
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
      scroller.scrollTop = scroller.scrollHeight;
      return { mode: "inner", top: Math.round(scroller.scrollTop) };
    }

    window.scrollTo(0, document.documentElement.scrollHeight);
    return { mode: "page", top: Math.round(window.scrollY) };
  });
}

try {
  for (const viewport of viewports) {
    const isMobile = viewport.width <= 430;
    const context = await browser.newContext({
      viewport,
      hasTouch: isMobile,
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

    // 1. Обложка архива с настоящим вводным текстом и картотекой из одного дела.
    await page.goto(`${baseUrl}${INDEX_PATH}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.screenshot({ path: shot(viewport, "index") });

    const indexMeasured = await page.evaluate(() => ({
      folders: document.querySelectorAll("[data-case-folder]").length,
      introParagraphs: document.querySelectorAll("article header p").length,
      hasPreviewPhrase: document.body.textContent.includes("Раздел готовится"),
    }));

    // 2. Первый экран кейса: печати ещё нет.
    const response = await page.goto(`${baseUrl}${CASE_PATH}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.screenshot({ path: shot(viewport, "case-top") });

    // 3. Тот же первый экран через две секунды — с поставленной печатью.
    await page.waitForFunction(
      () => document.querySelector('[data-case-stamp="struck"]') !== null,
      undefined,
      { timeout: 8000 },
    );
    await page.waitForTimeout(700);
    await page.screenshot({ path: shot(viewport, "case-after-stamp") });

    // 4. Раздел «Результат» с метрикой «до/после».
    await scrollTo(page, "#case-01-result");
    await page.waitForTimeout(150);
    await page.screenshot({ path: shot(viewport, "case-result") });

    // 5. GEO-мостик — абзац сразу под метрикой.
    await page.evaluate(() => {
      const section = document.querySelector("#case-01-result").parentElement;
      const paragraphs = section.querySelectorAll("p");
      paragraphs[paragraphs.length - 1].scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: shot(viewport, "case-geo-bridge") });

    // 6. Нижняя часть документа: последний раздел и ссылка в конце.
    const end = await scrollToEnd(page);
    await page.waitForTimeout(150);
    await page.screenshot({ path: shot(viewport, "case-end") });

    // 7. Отдельный кадр самой ссылки — с окружением, чтобы был виден её вес на листе.
    const ctaBox = await page.getByRole("link", { name: "Обсудить похожую задачу" }).boundingBox();
    if (ctaBox) {
      await page.screenshot({
        path: shot(viewport, "case-cta"),
        clip: {
          x: Math.max(0, ctaBox.x - 40),
          y: Math.max(0, ctaBox.y - 160),
          width: Math.min(viewport.width, ctaBox.width + 260),
          height: Math.min(viewport.height, ctaBox.height + 220),
        },
      });
    }

    const measured = await page.evaluate(() => {
      const sheet = document.querySelector("article > div").getBoundingClientRect();
      const scroller = document.querySelector('article [role="region"]');
      const view = scroller.getBoundingClientRect();
      const last = document.querySelector("#case-01-limitations").parentElement;
      const cta = [...document.querySelectorAll('a[href="/contacts"]')].pop();

      return {
        sheetHeight: Math.round(sheet.height),
        sheetWidth: Math.round(sheet.width),
        innerScroll: scroller.scrollHeight - scroller.clientHeight,
        pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        horizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        sections: document.querySelectorAll("article section").length,
        headings: document.querySelectorAll("article h2").length,
        lastSectionFullyVisible: last.getBoundingClientRect().bottom <= view.bottom + 2,
        ctaVisible: cta.getBoundingClientRect().bottom <= view.bottom + 2,
        bodyFontSize: getComputedStyle(document.querySelector("article section p")).fontSize,
      };
    });

    report.push({
      viewport: `${viewport.width}x${viewport.height}`,
      status: response?.status(),
      index: indexMeasured,
      end,
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
      ` разделов ${entry.sections} H2 ${entry.headings}` +
      ` внутр.прокрутка ${entry.innerScroll} стр.прокрутка ${entry.pageScroll}` +
      ` конец виден: ${entry.lastSectionFullyVisible} ссылка видна: ${entry.ctaVisible}` +
      ` кегль ${entry.bodyFontSize} overflow-x: ${entry.horizontalOverflow}` +
      ` папок в картотеке ${entry.index.folders} preview-фраза: ${entry.index.hasPreviewPhrase}` +
      ` ошибок консоли: ${entry.consoleErrors.length}`,
  );
}
