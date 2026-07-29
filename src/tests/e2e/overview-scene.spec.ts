import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getOfficeZones } from "../../content/office-zones";

// Step 12 — overview стал настоящей сценой офиса (OQ-A2-1 = (a)): мастер-фото фоном, пять отделов
// поверх него как зоны. Проверяется то, что видно только в реальном браузере: какой файл он выбрал
// из <picture>, что оригинал PNG не запрашивается вовсе, что при отказе фотослоя overview остаётся
// пятью рабочими кнопками, и что зоны стоят там, где их положили данные.
//
// axe-гейт этого шага (AC2) живёт в accessibility-scan.spec.ts — там overview уже сканируется на
// desktop и mobile; дублировать скан здесь незачем.

async function openOverview(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

// Turbopack эмитит производные с контент-хешем ПЕРЕД расширением
// (`overview-1280.1vzf_gdye1c_h.avif`), поэтому имя файла нельзя проверять как `overview-1280.avif`.
const SCENE_DERIVATIVE = /overview-(768|1280|1536)\.[^/]*\.(avif|webp)$/;

test.describe("Step 12 — overview renders the master office scene", () => {
  test("the browser loads a generated derivative of the master scene, never the 3.7 MB original", async ({
    page,
  }) => {
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") imageRequests.push(request.url());
    });

    await page.goto("/");
    await openOverview(page);

    // Верхний слой: на обзорном экране слой всегда один, но адресоваться к «текущей сцене»
    // единообразно надёжнее — crossfade Step 16 живёт в ветке department-active.
    const sceneImage = page.locator("[data-scene-crossfade] picture > img").last();
    await expect(sceneImage).toBeVisible();

    // Картинка не просто в DOM — она реально декодирована браузером (битая дала бы naturalWidth 0).
    await expect
      .poll(async () => sceneImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Выбран один из предгенерированных производных мастер-сцены (Step 10), а не что-то иное.
    const chosen = await sceneImage.evaluate((img: HTMLImageElement) => img.currentSrc);
    expect(chosen).toMatch(SCENE_DERIVATIVE);

    // AC5: оригинал references/office-overview/01-company-overview.png (3.7 МБ) браузер не
    // запрашивает ни при каких условиях — ни как изображение, ни через /_next/image.
    expect(imageRequests.filter((url) => url.endsWith(".png"))).toEqual([]);
    expect(imageRequests.filter((url) => url.includes("company-overview"))).toEqual([]);
  });

  test("the served scene stays inside the performance budget of docs/10", async ({ page }) => {
    // Слушатель ставится ДО goto: сцена приходит в SSR-разметке и запрашивается уже при разборе
    // HTML, а не по нажатию CTA (overview до раскрытия лишь скрыт через display:none, что загрузку
    // изображений не откладывает). Ожидание ответа после goto просто не дождалось бы его.
    const sceneResponse = page.waitForResponse((response) => SCENE_DERIVATIVE.test(response.url()));
    await page.goto("/");
    const response = await sceneResponse;

    const body = await response.body();

    // Пороги — ровно те же значения в БАЙТАХ, что в таблице docs/10-performance-budget.md и в
    // BUDGET_BYTES скрипта генерации: и по ширине, и по формату. Единый потолок «по 1536px» был бы
    // слабее документа — отданная на узком вьюпорте производная 768/1280 прошла бы проверку, даже
    // выйдя за свой собственный порог.
    const BUDGET_BYTES: Record<string, Record<string, number>> = {
      webp: { "768": 140_000, "1280": 280_000, "1536": 350_000 },
      avif: { "768": 100_000, "1280": 200_000, "1536": 250_000 },
    };
    const [, width, format] = response.url().match(SCENE_DERIVATIVE)!;
    expect(body.byteLength).toBeLessThanOrEqual(BUDGET_BYTES[format][width]);
  });

  test("with the whole photo layer blocked, overview is still five working buttons", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // Блокируются ОБА формата: сцена отдаётся через <picture> с AVIF-приоритетом, поэтому блокировка
    // одного лишь webp (как в reduced-motion-and-fallback.spec.ts, где фотослой ещё был webp-only)
    // сцену бы не уронила и тест ничего бы не проверял.
    await page.route("**/*.avif", (route) => route.abort());
    await page.route("**/*.webp", (route) => route.abort());

    await page.goto("/");
    await openOverview(page);

    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(nav.getByRole("button")).toHaveCount(5);

    // Битой картинки не остаётся — на её месте детерминированный плейсхолдер (контракт Step 8).
    // Со Step 18 плейсхолдер ищется в СЛОЕ СЦЕНЫ, а не внутри nav: кадр держит общий сцен-слой,
    // живущий через оба состояния офиса, и карта отвечает только за зоны поверх него. Проверяемое
    // требование то же — «вместо битой картинки ровно один детерминированный плейсхолдер», — и
    // область поиска по-прежнему точечная (стопка слоёв), а не «где-нибудь на странице».
    await expect(page.locator("[data-scene-crossfade] picture")).toHaveCount(0);
    await expect(page.locator("[data-scene-crossfade] [data-photo-fallback]")).toHaveCount(1);

    // Отдел по-прежнему открывается: коммерческий путь не зависит от фотослоя.
    await nav.getByRole("button").first().click();
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("hotspots sit where office-zones.json puts them, inside the scene frame", async ({
    page,
  }) => {
    await page.goto("/");
    await openOverview(page);

    const scene = page.locator("[data-scene-crossfade]");
    const sceneBox = (await scene.boundingBox())!;

    for (const zone of getOfficeZones()) {
      const hotspot = page.locator(`#hotspot-${zone.departmentId}`);
      const box = (await hotspot.boundingBox())!;

      // Координаты — проценты от кадра сцены. Допуск 1.5% кадра покрывает границы/скругления и
      // субпиксельное округление, но не пропустит зону, уехавшую на другой участок офиса.
      const toleranceX = sceneBox.width * 0.015;
      const toleranceY = sceneBox.height * 0.015;

      expect(Math.abs(box.x - sceneBox.x - (zone.x / 100) * sceneBox.width)).toBeLessThanOrEqual(
        toleranceX,
      );
      expect(Math.abs(box.y - sceneBox.y - (zone.y / 100) * sceneBox.height)).toBeLessThanOrEqual(
        toleranceY,
      );

      // И зона целиком лежит внутри кадра — иначе часть отдела оказалась бы за краем сцены.
      expect(box.x).toBeGreaterThanOrEqual(sceneBox.x - toleranceX);
      expect(box.y).toBeGreaterThanOrEqual(sceneBox.y - toleranceY);
      expect(box.x + box.width).toBeLessThanOrEqual(sceneBox.x + sceneBox.width + toleranceX);
      expect(box.y + box.height).toBeLessThanOrEqual(sceneBox.y + sceneBox.height + toleranceY);
    }
  });

  test("hover and keyboard focus reveal the department problem over the photo", async ({
    page,
  }) => {
    await page.goto("/");
    await openOverview(page);

    const problem = page.locator("#department-problem-sales");

    await page.locator("#hotspot-sales").hover();
    await expect(problem).toBeVisible();

    // Фокус берётся настоящим Tab, а не .focus(): описание раскрывается по :focus-visible, который
    // при программном переносе фокуса не ставится (см. следующий тест — это и был баг).
    await page.mouse.move(0, 0);
    await expect(problem).toBeHidden();

    await page.keyboard.press("Tab");
    // Куда именно уводит Tab — зависит от порядка зон в office-zones.json (сортировка по y, затем x),
    // поэтому отдел не захардкожен: берём тот, что реально получил фокус, и проверяем его описание.
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(focusedId).toMatch(/^hotspot-/);
    const focusedDepartment = focusedId.replace("hotspot-", "");
    await expect(page.locator(`#department-problem-${focusedDepartment}`)).toBeVisible();
  });

  // Регресс на дефект, найденный пользователем при визуальной проверке: сразу после раскрытия офиса
  // у «Поддержки» сама собой появлялась подпись, без курсора и без видимой рамки фокуса. Причина —
  // фокус переносится на первый хотспот программно (OfficeMachine.tsx, Step 7.2), браузер ставит
  // :focus, но не :focus-visible, а описание раскрывалось по :focus.
  test("no department problem is revealed right after the office opens, without hover", async ({
    page,
  }) => {
    await page.goto("/");
    await openOverview(page);

    // Курсор физически остаётся там, где кликнул по CTA, и после смены раскладки может оказаться
    // над одной из зон — тогда подпись раскроется по hover, законно. Проверяем сценарий «курсора на
    // отделе нет», поэтому мышь уводится в угол.
    await page.mouse.move(0, 0);

    // Фокус действительно на первом хотспоте — иначе тест проверял бы не тот сценарий.
    await expect(page.locator("#hotspot-support")).toBeFocused();

    for (const zone of getOfficeZones()) {
      await expect(page.locator(`#department-problem-${zone.departmentId}`)).toBeHidden();
    }
  });
});
