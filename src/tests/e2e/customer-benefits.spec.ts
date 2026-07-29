import { expect, test, type Page } from "@playwright/test";
import { getDepartments } from "../../content/departments";

// Amendment 31 — «Результат для бизнеса» в экране отдела (заменило BeforeAfterSequence).
// Проверяется то, что видно только в браузере: единый слот для всех отделов появляется через
// 10 секунд, ключевые фразы входят последовательно, CTA — последней, а при reduced-motion весь
// результат доступен сразу.

const sales = getDepartments().find((d) => d.id === "sales")!;
const support = getDepartments().find((d) => d.id === "support")!;

const HEADING = "Результат для бизнеса";
const region = (page: Page) => page.getByRole("region", { name: HEADING });

async function openDepartment(page: Page, headline: string, id: string) {
  await page.goto(`/?department=${id}`);
  await expect(page.getByRole("heading", { level: 2, name: headline })).toBeVisible();
}

test.describe("Amendment 31 — «Результат для бизнеса»", () => {
  test("появляется спустя ~10 секунд после открытия отдела (Продажи)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, sales.headline, sales.id);

    // Место под результат уже зарезервировано, но содержимое и CTA ещё не проявлены.
    await expect(page.getByRole("link", { name: sales.ctaLabel })).toHaveCount(0);
    await expect(region(page)).toHaveCount(0);

    // Появляется в течение 10-секундного окна (poll до 13 с покрывает 10 с + запас).
    await expect(region(page)).toBeVisible({ timeout: 13000 });
    await expect(region(page).getByRole("heading", { level: 3, name: HEADING })).toBeVisible();

    const highlightDelays = await region(page)
      .locator("li")
      .evaluateAll((items) =>
        items.map((item) => Number.parseFloat(getComputedStyle(item).animationDelay)),
      );
    expect(highlightDelays).toHaveLength(3);
    expect(highlightDelays[1]).toBeGreaterThan(highlightDelays[0]);
    expect(highlightDelays[2]).toBeGreaterThan(highlightDelays[1]);

    await expect(page.getByRole("link", { name: sales.ctaLabel })).toBeVisible({ timeout: 2000 });
  });

  test("окно единое: появляется и у другого отдела (Поддержка)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, support.headline, support.id);
    await expect(region(page)).toBeVisible({ timeout: 13000 });
  });

  // reduced-motion: окно доступно сразу, без 10-секундной паузы (короткий таймаут это и доказывает).
  test("prefers-reduced-motion: окно доступно сразу, без ожидания 10 секунд", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, sales.headline, sales.id);
    await expect(region(page)).toBeVisible({ timeout: 2000 });
  });

  // Отсчёт независим для каждого отдела: перешли в другой отдел — окно снова ждёт 10 секунд.
  test("при переходе в другой отдел отсчёт 10 секунд начинается заново", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, sales.headline, sales.id);
    await expect(region(page)).toBeVisible({ timeout: 13000 });

    // Переключаемся на другой отдел через рельс (в открытом отделе он называется «Панель отделов») —
    // DepartmentExperience перемонтируется (key), и отсчёт 10 секунд стартует заново.
    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: support.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: support.headline })).toBeVisible();
    // Сразу после переключения окна ещё нет — отсчёт пошёл заново.
    await expect(region(page)).toHaveCount(0);
    await expect(region(page)).toBeVisible({ timeout: 13000 });
  });

  // Принцип «одного окна»: экран отдела помещается без прокрутки, когда результат уже показан.
  test("экран отдела помещается без вертикальной прокрутки на 1440×900 (результат показан)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, sales.headline, sales.id);
    await expect(region(page)).toBeVisible({ timeout: 13000 });
    // Дать каскаду болей и появлению окна доиграть — самое высокое состояние колонки.
    await page.waitForTimeout(600);

    const column = page.getByRole("region", { name: sales.overviewLabel });
    const overflow = await column.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(
      overflow.scrollHeight,
      `колонка отдела прокручивается по вертикали: scrollHeight=${overflow.scrollHeight} > clientHeight=${overflow.clientHeight}`,
    ).toBeLessThanOrEqual(overflow.clientHeight + 1);

    // И нет горизонтальной прокрутки документа.
    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth + 1);
  });

  test("CTA появляется последней, а «Назад к офису» возвращает в overview", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, sales.headline, sales.id);
    await expect(region(page)).toBeVisible({ timeout: 13000 });

    await expect(page.getByRole("link", { name: sales.ctaLabel })).toBeVisible();
    await expect(page.getByRole("button", { name: "Закрыть" })).toHaveCount(0);
    await page.getByRole("button", { name: "Назад к офису" }).click();
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
  });
});
