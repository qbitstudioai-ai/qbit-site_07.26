import { expect, test, type Page } from "@playwright/test";
import { getDepartments } from "../../content/departments";
import { getHomepageCopy } from "../../content/homepage-copy";

async function activateCta(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
}

const departments = getDepartments();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

// CLOSE_DURATION_MS в OfficeMachine.tsx — 700 мс. Пороги ниже намеренно оставляют широкий зазор с
// обеих сторон (500 / 650), чтобы тесты проверяли сам факт ветвления по предпочтению, а не точный
// тайминг медленной машины.
const CLOSE_BUDGET_REDUCED_MS = 500;
const CLOSE_FLOOR_FULL_MOTION_MS = 650;

test.describe("Step 8 — reduced motion collapses transition timers (AC 1)", () => {
  test("closing under prefers-reduced-motion returns overview and focus without waiting out the motion duration", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    const startedAt = Date.now();
    await page.getByRole("button", { name: "Закрыть" }).click();

    // Обе половины "функции сохраняются": контент вернулся в overview И focus вернулся на хотспот,
    // который открывал отдел (docs/11) — раньше и то и другое ждало 700 мс уже отработавшей анимации.
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.locator("#hotspot-sales")).toBeFocused();

    expect(Date.now() - startedAt).toBeLessThan(CLOSE_BUDGET_REDUCED_MS);
  });

  test("opening and switching under prefers-reduced-motion are not gated on motion either", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);

    const startedAt = Date.now();
    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: sales.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: hr.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();

    // Открытие (800) + переключение (600) = 1400 мс полной анимации; под reduce обе схлопнуты.
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  // Контрольный тест: без него предыдущие два прошли бы и в случае, если длительности схлопнуты
  // всегда (то есть motion просто сломан), а не по предпочтению пользователя.
  test("without the preference the close transition still takes its documented duration", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await activateCta(page);

    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: sales.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    const startedAt = Date.now();
    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(CLOSE_FLOOR_FULL_MOTION_MS);
  });
});

test.describe("Step 8 — visual (photo) layer failure does not block content (AC 2)", () => {
  // Блокируем весь фотослой на сетевом уровне — это и есть "ошибка визуального слоя" для DOM/фото
  // реализации (WORKPLAN.md Step 8: WebGL/Canvas не вводится, visual layer — это next/image).
  async function blockPhotoLayer(page: Page) {
    await page.route("**/*.webp", (route) => route.abort());
  }

  test("with the webp photo layer failing, the department still opens, switches and closes", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await blockPhotoLayer(page);
    await page.goto("/");
    await activateCta(page);

    // Коммерческий путь overview — 5 HTML-кнопок (docs/05 "error-fallback") — фото не содержит вовсе.
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button")).toHaveCount(5);

    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    const panel = page.getByRole("region", { name: sales.overviewLabel });
    await expect(panel.getByText(sales.problem)).toBeVisible();
    await expect(panel.getByRole("link", { name: sales.ctaLabel })).toBeVisible();

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();

    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);

    // Провал загрузки картинки — не исключение JS: необработанных ошибок страницы быть не должно.
    // Консольные net::ERR_FAILED здесь ожидаемы и сознательно не проверяются — их порождает сам
    // route.abort(), это артефакт теста, а не дефект продукта.
    expect(pageErrors).toEqual([]);
  });

  // Блокируется только *.webp. До Step 13 это роняло весь фотослой экрана отдела: и 5 миниатюр
  // рельса, и общий фон офиса были одноисточниковыми webp. Со Step 13 фон — это сцена отдела через
  // <picture> с AVIF-приоритетом, поэтому одной блокировки webp она переживает (ровно то же уже было
  // верно для сцены overview со Step 12). Полное падение фотослоя обоих форматов проверяется там,
  // где ему и место: overview-scene.spec.ts и department-scene.spec.ts (AC4).
  test("failed photos are replaced by placeholders, not left as broken images", async ({
    page,
  }) => {
    await blockPhotoLayer(page);
    await page.goto("/?department=sales");

    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    // Падают только 5 миниатюр рельса — они одноисточниковые webp.
    await expect(page.locator("[data-photo-fallback]")).toHaveCount(5);
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    // Селектор по src, а не по alt="": логотип в Header — тоже декоративный img[alt=""], но он
    // .svg, не часть фотослоя и блокировкой webp не затрагивается. Скоуп на рельс исключает
    // <img> сцены: его атрибут src указывает на webp-фолбэк, но реально браузер берёт AVIF из
    // <source>, то есть по одному лишь атрибуту нельзя судить, упала картинка или нет.
    await expect(rail.locator("img[src*='.webp']")).toHaveCount(0);

    // А сцена отдела осталась живой и ДЕКОДИРОВАННОЙ — не битым <img> и не плейсхолдером.
    // Проверка по naturalWidth, а не по видимости: битая картинка тоже «видима».
    const scene = page.locator("picture > img").first();
    await expect
      .poll(async () => scene.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("the same view renders real photos when the network is healthy (guards the test above)", async ({
    page,
  }) => {
    await page.goto("/?department=sales");
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();

    await expect(page.locator("[data-photo-fallback]")).toHaveCount(0);
    await expect(page.locator("img[src*='.webp']")).toHaveCount(6);
  });
});
