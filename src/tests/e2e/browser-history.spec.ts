import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

// Step 9 — acceptance-фиксация поведения кнопок «назад»/«вперёд» браузера (owner назначен ещё в
// Step 5 Out of scope, подтверждён Step 8 как «owner Step 9»). Шаг НЕ реализует SPA-историю
// отделов — это сознательное ограничение по решению OQ-B (url-sync.ts использует replaceState, не
// pushState, DECISIONS.md 2026-07-15). Эти тесты фиксируют текущее детерминированное поведение,
// чтобы будущая реализация popstate (если появится) сделала это явным изменением, а не тихо.
const departments = getDepartments();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

async function activateCta(page: Page) {
  await page.getByRole("button", { name: getHomepageCopy().primaryCta }).click();
}

test.describe("Step 9 — browser history behaviour (deliberate replaceState design, OQ-B)", () => {
  test("in-app open/switch/close keep the URL in sync but add no browser-history entries (replaceState, not pushState)", async ({
    page,
  }) => {
    await page.goto("/");
    const initialLength = await page.evaluate(() => window.history.length);

    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    // URL синхронизирован — прямая перезагрузка/закладка сохранит именно этот отдел (положительная
    // цель replaceState: адрес всегда отражает состояние).
    expect(new URL(page.url()).searchParams.get("department")).toBe("sales");

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("hr");

    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();

    // Ключевой инвариант: смена отдела ЗАМЕНЯЕТ текущую запись истории, а не добавляет новую —
    // поэтому длина стека не выросла ни на одну запись за три перехода. Прямое следствие: браузерный
    // «назад» не шагает по фантомным состояниям отделов (это и есть неподдержка popstate как
    // осознанный выбор, а не забытый регресс).
    expect(await page.evaluate(() => window.history.length)).toBe(initialLength);
  });

  test("real navigations to directly-linked departments still support normal browser back/forward", async ({
    page,
  }) => {
    // Прямые ссылки на отделы — настоящие адреса (SSR-инициализация из searchParams), поэтому между
    // полноценными навигациями «назад»/«вперёд» работают штатно. replaceState подавляет только
    // внутренние (SPA) записи, но не реальные переходы между загрузками страницы.
    await page.goto("/?department=sales");
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await page.goto("/?department=hr");
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("sales");

    await page.goForward();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("hr");
  });
});
