import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";

// Step 9 — автоматизированный axe-скан (owner назначен ещё в Step 3 Risks, подтверждён Step 4/Step 8
// Out of scope как «owner Step 9»). Заменяет ручной прогон axe DevTools, о котором Steps 3/4 писали
// «зафиксировать отсутствие серьёзных нарушений». Проверяются три ключевых состояния state machine
// (hero / overview / department-active) на desktop- и mobile-ширинах — на обеих сторонах порога
// 767/768px рендерится разный overview (карта офиса vs карусель), поэтому доступность их обоих
// проверяется отдельно.
async function activateCta(page: Page) {
  await page.getByRole("button", { name: getHomepageCopy().primaryCta }).click();
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

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
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

    test("department-active has no serious/critical axe violations", async ({ page }) => {
      await page.goto("/?department=sales");
      await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

      const violations = await scanSeriousViolations(page);
      expect(violations, summarize(violations)).toEqual([]);
    });
  });
}
