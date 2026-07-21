import { expect, test, type Page } from "@playwright/test";
import { getDepartments } from "../../content/departments";

// Step 20 — последовательность «до/после» в экране отдела «Продажи» (docs/03 «BeforeAfterSequence»).
// Проверяется то, что видно только в браузере: оба состояния присутствуют и читаемы одновременно, на
// разных ширинах и в reduced-motion, и что критический контент отдела не зависит от этого блока.

const sales = getDepartments().find((d) => d.id === "sales")!;
const support = getDepartments().find((d) => d.id === "support")!;

async function openSales(page: Page) {
  await page.goto(`/?department=${sales.id}`);
  await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
}

const region = (page: Page) => page.getByRole("region", { name: "Как меняется работа" });

test.describe("Step 20 — до/после «Продаж»", () => {
  test("оба состояния и все их шаги видны одновременно (AC1)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);

    const area = region(page);
    await expect(area).toBeVisible();
    // Текстовые заголовки колонок — первичный (не цветовой) канал смысла «до»/«после».
    await expect(area.getByText("Сейчас", { exact: true })).toBeVisible();
    await expect(area.getByText("После автоматизации", { exact: true })).toBeVisible();

    // Каждый шаг из данных виден — оба состояния присутствуют в кадре одновременно.
    for (const step of [...sales.beforeSteps!, ...sales.automationSteps!]) {
      await expect(area.getByText(step.label, { exact: true })).toBeVisible();
    }
  });

  test("две упорядоченные колонки по числу шагов из данных", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);

    const lists = region(page).getByRole("list");
    await expect(lists).toHaveCount(2);
    await expect(lists.nth(0).getByRole("listitem")).toHaveCount(sales.beforeSteps!.length);
    await expect(lists.nth(1).getByRole("listitem")).toHaveCount(sales.automationSteps!.length);
  });

  // Смысл «до/после» не только цветом: даже без цвета (grayscale) оба заголовка колонок и статус-
  // маркеры-формы остаются на месте. Форма маркера и текст заголовка — нецветовые каналы.
  test("смысл передан не только цветом (AC3)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);

    const area = region(page);
    await expect(area.getByText("Сейчас", { exact: true })).toBeVisible();
    await expect(area.getByText("После автоматизации", { exact: true })).toBeVisible();
    // Маркеры-формы присутствуют (svg на каждый шаг), декоративны (aria-hidden).
    const svgCount = await area.locator("svg[aria-hidden='true']").count();
    expect(svgCount).toBeGreaterThanOrEqual(
      sales.beforeSteps!.length + sales.automationSteps!.length,
    );
  });

  // AC2: в reduced-motion блок функционален и оба состояния читаемы; коннектор не анимируется.
  test("prefers-reduced-motion: оба состояния читаемы, коннектор без анимации (AC2)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);

    const area = region(page);
    await expect(area.getByText("Сейчас", { exact: true })).toBeVisible();
    await expect(area.getByText("После автоматизации", { exact: true })).toBeVisible();
    for (const step of [...sales.beforeSteps!, ...sales.automationSteps!]) {
      await expect(area.getByText(step.label, { exact: true })).toBeVisible();
    }

    // Коннектор виден (базовый opacity), но анимации на нём нет.
    const connectorAnimated = await area.evaluate((root) => {
      const svgs = [...root.querySelectorAll("svg")];
      // Коннектор — самый крупный маркер; проверяем, что ни на одном svg нет РАБОТАЮЩЕЙ анимации.
      return svgs.some((svg) =>
        svg.getAnimations({ subtree: true }).some((a) => a.playState === "running"),
      );
    });
    expect(connectorAnimated, "в reduced-motion не должно быть работающих анимаций").toBe(false);
  });

  test("на мобильном оба состояния читаемы (колонки друг под другом)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSales(page);

    const area = region(page);
    await expect(area.getByText("Сейчас", { exact: true })).toBeVisible();
    await expect(area.getByText("После автоматизации", { exact: true })).toBeVisible();
    await expect(area.getByText(sales.beforeSteps![0].label, { exact: true })).toBeVisible();
    await expect(area.getByText(sales.automationSteps![0].label, { exact: true })).toBeVisible();
  });

  // Обобщаемость / изоляция: отдел без шагов процесса не показывает пустой блок «до/после».
  test("отдел без шагов процесса не рендерит блок «до/после»", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?department=${support.id}`);
    await expect(page.getByRole("heading", { level: 2, name: support.headline })).toBeVisible();
    await expect(region(page)).toHaveCount(0);
  });

  // Критический путь отдела не зависит от блока: CTA и «Закрыть» на месте и работают.
  test("CTA и «Закрыть» остаются достижимы при наличии блока «до/после»", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSales(page);

    await expect(page.getByRole("link", { name: sales.ctaLabel })).toBeVisible();
    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
  });
});
