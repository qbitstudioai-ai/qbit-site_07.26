import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const viewports = [
  { width: 1920, height: 920 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

const outputDirectory = resolve("test-results/hero-scenarios");
const baseUrl = process.env.HERO_CAPTURE_URL ?? "http://127.0.0.1:3200";
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__heroCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__heroCls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(outputDirectory, `final-${viewport.width}x${viewport.height}.png`),
    animations: "disabled",
  });

  if (viewport.width <= 768) {
    await page.screenshot({
      path: resolve(outputDirectory, `final-${viewport.width}x${viewport.height}-full.png`),
      animations: "disabled",
      fullPage: true,
    });
  }

  const metrics = await page.evaluate(() => {
    const primary = Array.from(document.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Получить бесплатный разбор процессов"),
    );
    const secondary = Array.from(document.querySelectorAll("a")).find(
      (link) => link.textContent?.trim() === "Найти потери в своём отделе",
    );
    const header = Array.from(document.querySelectorAll("a")).find(
      (link) => link.textContent?.trim() === "Обсудить автоматизацию",
    );
    const scenarios = Array.from(document.querySelectorAll("[data-project-scenario]"));
    const scenarioPanel = document.querySelector("[data-project-scenarios]");
    const postscript = document.querySelector("[data-project-postscript]");
    const heroImage = document.querySelector('img[alt*="переход от ручного хаоса"]');
    const scenarioStyles = scenarios.map((scenario) => {
      const style = getComputedStyle(scenario);
      const bounds = scenario.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        backdropFilter: style.backdropFilter,
      };
    });

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      internalOverflow: [scenarioPanel, ...scenarios]
        .filter(Boolean)
        .some(
          (node) => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth,
        ),
      removedTextPresent: [
        "Заявки теряются",
        "Данные переносят вручную",
        "Отчёты собирают вручную",
        "Как работает автоматизация",
        "задача сотруднику",
      ].some((text) => document.body.innerText.includes(text)),
      heroImageDecoded: heroImage instanceof HTMLImageElement && heroImage.naturalWidth > 0,
      cls: window.__heroCls,
      primaryHref: primary instanceof HTMLAnchorElement ? primary.href : null,
      secondaryHref: secondary instanceof HTMLAnchorElement ? secondary.getAttribute("href") : null,
      headerHref: header instanceof HTMLAnchorElement ? header.href : null,
      postscriptHref: postscript instanceof HTMLAnchorElement ? postscript.href : null,
      scenarioCount: scenarios.length,
      scenarios: scenarioStyles,
    };
  });

  results.push({ viewport, ...metrics });
  if (viewport.width <= 1199) {
    await page
      .getByRole("heading", { level: 2, name: "ПРОЕКТНЫЕ СЦЕНАРИИ" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(outputDirectory, `final-${viewport.width}x${viewport.height}-scenarios.png`),
      animations: "disabled",
    });
    await page
      .getByRole("link", { name: "Обсудить решение под процессы компании" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(outputDirectory, `final-${viewport.width}x${viewport.height}-postscript.png`),
      animations: "disabled",
    });
  }

  if (viewport.width === 390) {
    await page.getByRole("img", { name: /переход от ручного хаоса/i }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(outputDirectory, "final-390x844-visual.png"),
      animations: "disabled",
    });
  }
  await context.close();
}

const interactionContext = await browser.newContext({ viewport: viewports[0] });
const interactionPage = await interactionContext.newPage();
await interactionPage.goto(baseUrl, { waitUntil: "networkidle" });
await interactionPage.getByRole("link", { name: "Найти потери в своём отделе" }).click();
const officeNavigation = interactionPage.getByRole("navigation", { name: "Отделы компании" });
const officeNavigationVisible = await officeNavigation
  .waitFor({ state: "visible", timeout: 5_000 })
  .then(() => true)
  .catch(() => false);
await interactionContext.close();

await browser.close();
console.log(JSON.stringify({ officeNavigationVisible, results }, null, 2));
