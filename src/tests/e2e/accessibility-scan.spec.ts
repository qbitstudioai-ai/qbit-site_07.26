import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

// Step 9 — автоматизированный axe-скан (owner назначен ещё в Step 3 Risks, подтверждён Step 4/Step 8
// Out of scope как «owner Step 9»). Заменяет ручной прогон axe DevTools, о котором Steps 3/4 писали
// «зафиксировать отсутствие серьёзных нарушений». Проверяются три ключевых состояния state machine
// (hero / overview / department-active) на desktop- и mobile-ширинах — на обеих сторонах порога
// 767/768px рендерится разный overview (карта офиса vs карусель), поэтому доступность их обоих
// проверяется отдельно.
async function activateCta(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
}

// axe присваивает нарушению impact minor|moderate|serious|critical. Порог acceptance — serious и
// выше: это ровно «серьёзные нарушения» из формулировки Step 3/Step 4 Manual checks. Отсекаемые
// moderate/minor (например, best-practice `page-has-heading-one` в overview, где hero-h1 намеренно
// скрыт по Step 7.2) не являются дефектами этого milestone и сознательно не заваливают приёмку.
const SERIOUS_OR_CRITICAL = new Set(["serious", "critical"]);

async function scanSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((violation) => SERIOUS_OR_CRITICAL.has(violation.impact ?? ""));
}

// Читаемое сообщение в assert: без него провал показал бы `[]` не равно длинному объекту без имён
// правил. С ним видно, какое именно правило и сколько узлов нарушено.
function summarize(violations: Awaited<ReturnType<typeof scanSeriousViolations>>) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes.length} узл. — ${violation.help}`,
    )
    .join("\n");
}

// Step 15 (AC4) добавил tablet 1024px. До этого шага скан покрывал только две стороны порога
// 767/768 и оставлял непроверенным весь диапазон 768–1279 — а он не «промежуточный»: там своя
// ширина рельса (20% против 14%, Step 7.5), своё безусловное раскрытие `.problem` без hover
// (DepartmentHotspot.module.css) и своя ширина колонки контента (88%, Step 15). Пробел был записан
// ещё в WORKLOG Step 9 («axe не покрывает tablet-ширину») и как Minor-1 milestone review Этапа 1;
// закрывается здесь.
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 375, height: 812 },
];

for (const viewport of viewports) {
  test.describe(`accessibility scan — ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("hero has no serious/critical axe violations", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const violations = await scanSeriousViolations(page);
      expect(violations, summarize(violations)).toEqual([]);
    });

    test("overview has no serious/critical axe violations", async ({ page }) => {
      await page.goto("/");
      await activateCta(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);

      const violations = await scanSeriousViolations(page);
      expect(violations, summarize(violations)).toEqual([]);
    });

    // Объявляется ТОЛЬКО для ширин >= 768px: на мобильном рельса скрыта (display:none), её роль
    // играет CarouselNavControls. Условие стоит на объявлении теста, а НЕ через test.skip() в теле
    // describe: последний скипнул бы весь блок целиком, включая мобильные axe-сканы, — то есть тихо
    // ослабил бы гейт (поймано прогоном: «4 skipped» вместо ожидаемых 4 passed).
    if (viewport.width >= 768) {
      test("активный отдел в рельсе объявляется скринридеру текстом, а не только формой", async ({
        page,
      }) => {
        await page.goto("/?department=sales");
        const sales = getDepartments().find((d) => d.id === "sales")!;
        await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

        // Сторож ставится на ДЕРЕВО ДОСТУПНОСТИ (aria-snapshot), а не на наличие атрибута в DOM, и это
        // не придирка: прежняя редакция полагалась на `aria-current` у <span> без роли, атрибутная
        // проверка была зелёной, а до дерева атрибут не доходил вовсе (skeptic Phase B Step 14).
        // Chromium не выводит `current` даже для listitem, поэтому единственный канал, который можно
        // проверить и на который можно положиться, — настоящий текст.
        const rail = page.getByRole("navigation", { name: "Панель отделов" });
        const snapshot = await rail.ariaSnapshot();
        expect(snapshot).toContain(`Текущий отдел: ${sales.overviewLabel}`);

        // И активный пункт по-прежнему НЕ кнопка — иначе он попал бы в Tab-порядок (Step 6 AC5).
        await expect(rail.getByRole("button", { name: sales.overviewLabel })).toHaveCount(0);
      });
    }

    test("department-active has no serious/critical axe violations", async ({ page }) => {
      await page.goto("/?department=sales");
      await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

      const violations = await scanSeriousViolations(page);
      expect(violations, summarize(violations)).toEqual([]);
    });
  });
}
