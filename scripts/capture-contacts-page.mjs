// Съёмка страницы /contacts: восемь размеров экрана и шесть состояний формы.
//
// Скрипт НИКОГДА не дёргает настоящий n8n: `/api/contact` перехватывается и отвечает заглушкой,
// поэтому персональные данные не уходят наружу даже с тестовыми значениями.
//
// Запуск (сервер production-сборки должен быть поднят):
//   npm run build && npm run start:e2e
//   node scripts/capture-contacts-page.mjs

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3200";
const outputDirectory = path.resolve("artifacts/contacts-page");

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

const VALID = {
  name: "Павел",
  phone: "+7 900 000-00-00",
  process: "Менеджеры вручную переносят заявки из Telegram в CRM и готовят отчёты руками.",
};

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const findings = [];

async function newPage(viewport) {
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width <= 768,
    isMobile: viewport.width < 768,
    colorScheme: "light",
    locale: "ru-RU",
  });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleMessages.push(`pageerror: ${error.message}`));
  return { context, page, consoleMessages };
}

const shot = (page, name) =>
  page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: false });

try {
  // ── Обычное состояние на всех размерах ──────────────────────────────────────────────────────
  for (const viewport of viewports) {
    const { context, page, consoleMessages } = await newPage(viewport);
    const response = await page.goto(`${baseUrl}/contacts`, { waitUntil: "networkidle" });
    const size = `${viewport.width}x${viewport.height}`;

    await shot(page, `idle-${size}`);

    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      panelTop: document.querySelector("form")?.closest("div")?.getBoundingClientRect().top ?? null,
    }));

    findings.push({
      size,
      status: response?.status(),
      horizontalOverflow: geometry.scrollWidth > geometry.clientWidth,
      documentScroll: geometry.scrollHeight > geometry.clientHeight + 1,
      console: consoleMessages,
    });

    await context.close();
  }

  // ── Состояния формы на 1440×900 и 390×844 ───────────────────────────────────────────────────
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`;

    // focus
    {
      const { context, page } = await newPage(viewport);
      await page.goto(`${baseUrl}/contacts`, { waitUntil: "networkidle" });
      await page.getByLabel("Ваше имя").focus();
      await shot(page, `focus-${size}`);
      await context.close();
    }

    // validation error — отправка пустой формы
    {
      const { context, page } = await newPage(viewport);
      await page.goto(`${baseUrl}/contacts`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Отправить заявку" }).click();
      await page.waitForTimeout(200);
      await shot(page, `validation-error-${size}`);
      await context.close();
    }

    // sending / success / error
    for (const [state, handler] of [
      [
        "sending",
        async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          await route.fulfill({ status: 200, json: { ok: true } });
        },
      ],
      ["success", async (route) => route.fulfill({ status: 200, json: { ok: true } })],
      ["error", async (route) => route.fulfill({ status: 502, json: { ok: false, reason: "x" } })],
    ]) {
      const { context, page } = await newPage(viewport);
      await page.route("**/api/contact", handler);
      await page.goto(`${baseUrl}/contacts`, { waitUntil: "networkidle" });

      await page.getByLabel("Ваше имя").fill(VALID.name);
      await page.getByLabel("Телефон").fill(VALID.phone);
      await page.getByLabel("Какой процесс хотите автоматизировать").fill(VALID.process);
      // Форма отбрасывает отправку быстрее трёх секунд — ждём, как ждал бы человек.
      await page.waitForTimeout(3200);
      await page.getByRole("button", { name: /Отправить заявку|Отправляем/ }).click();

      if (state === "sending") {
        await page.waitForTimeout(600);
      } else {
        await page.waitForTimeout(900);
      }
      await shot(page, `${state}-${size}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(findings, null, 2));
