import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

// Step 16 — переход overview↔отдел как контролируемое приближение (docs/03 «Камера», docs/07
// «Уровень Transition») и crossfade между сценами, удерживающий предыдущий кадр.
//
// Здесь проверяется только то, что видно исключительно в браузере: реальные вычисленные анимации,
// поведение на медленном канале и доступность критического контента во время перехода.

const departments = getDepartments();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

const SCENE_FILES = /(overview|sales|support|executive|hr|logistics)-(768|1280|1536)\./;

/** Сколько слоёв сцены сейчас в DOM и сколько из них реально видно декодированными. */
const sceneLayers = (page: Page) =>
  page.evaluate(() => {
    const stack = document.querySelector("[data-scene-crossfade]");
    // Слои считаются по ДЕТЯМ стека, а не по <img>: упавший слой рендерится плейсхолдером
    // <span data-photo-fallback> (контракт Step 8), и подсчёт по <img> его бы не увидел — состояние
    // «чужой кадр + упавший слой» отчиталось бы как один слой и прошло бы (skeptic Phase B, NB-b).
    const images = [...document.querySelectorAll("[data-scene-crossfade] img")];
    return {
      layers: stack ? stack.children.length : 0,
      visible: images.filter(
        (image) =>
          (image as HTMLImageElement).naturalWidth > 0 &&
          Number(getComputedStyle(image).opacity) > 0.05,
      ).length,
    };
  });

const topLayerMotion = (page: Page) =>
  page
    .locator("[data-scene-crossfade] img")
    .last()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        name: style.animationName,
        durationMs: Number(style.animationDuration.replace("s", "")) * 1000,
        fill: style.animationFillMode,
        transform: style.transform,
      };
    });

async function openOffice(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

test.describe("Step 16 — переход между сценами", () => {
  test("сцена отдела появляется контролируемым приближением, а не подменой кадра (AC1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?department=${sales.id}`);

    const motion = await topLayerMotion(page);

    // Анимация есть, и она доигрывает до конца (fill both удерживает конечное состояние).
    expect(motion.name, "у сцены нет анимации — это подмена кадра, а не переход").not.toBe("none");
    expect(motion.fill).toBe("both");

    // Длительность в диапазоне docs/07 для overview→department (650–1000 мс). Диапазон, а не точное
    // значение: docs/07 задаёт именно вилку, и прибивать её к одному числу значило бы придумать
    // требование, которого в документе нет.
    expect(
      motion.durationMs,
      `длительность ${motion.durationMs}мс вне диапазона docs/07 650–1000мс`,
    ).toBeGreaterThanOrEqual(650);
    expect(
      motion.durationMs,
      `длительность ${motion.durationMs}мс вне диапазона docs/07 650–1000мс`,
    ).toBeLessThanOrEqual(1000);

    // И приближение ЗАКАНЧИВАЕТСЯ в масштабе 1: кадр не остаётся увеличенным навсегда.
    await page.waitForTimeout(motion.durationMs + 200);
    const settled = await topLayerMotion(page);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(settled.transform);
  });

  // Главный вход этого шага (Step 13, skeptic Phase B): при переключении отдела прежняя сцена
  // размонтировалась немедленно, и на медленном канале переход шёл ЧЕРЕЗ ПУСТОТУ — измерено 26 из
  // 45 выборок без декодированной сцены. Здесь проверяется, что окна больше нет.
  test("при переключении отдела предыдущая сцена удерживается до готовности следующей (AC1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Сцены отдаются с задержкой — без неё окно закрывается само и тест ничего не доказывает.
    await page.route(SCENE_FILES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.goto(`/?department=${sales.id}`);
    await expect.poll(async () => (await sceneLayers(page)).visible, { timeout: 20000 }).toBe(1);

    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: hr.overviewLabel })
      .click();

    // Опрос в течение всего перехода: сцена обязана быть видима в КАЖДОЙ выборке.
    let samplesWithoutScene = 0;
    for (let index = 0; index < 20; index++) {
      await page.waitForTimeout(60);
      if ((await sceneLayers(page)).visible === 0) samplesWithoutScene++;
    }
    expect(
      samplesWithoutScene,
      `${samplesWithoutScene} из 20 выборок без видимой сцены — переход идёт через пустоту`,
    ).toBe(0);

    // В ПОКОЕ остаётся ровно один слой. Формулировка намеренно про покой, а не про весь переход:
    // при нескольких быстрых переключениях подряд, пока ни одна сцена не догрузилась, в стеке
    // временно живёт до 5 слоёв (замерено skeptic Phase B). Это ограничено сверху шестью — больше
    // сцен просто не существует, а повтор id схлопывает стек, — и визуального дефекта не даёт:
    // нижний декодированный кадр виден сквозь ещё пустые верхние.
    await expect.poll(async () => (await sceneLayers(page)).layers, { timeout: 20000 }).toBe(1);
  });

  test("быстрое переключение отделов не оставляет лишних слоёв и заканчивается верной сценой", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?department=${sales.id}`);
    const rail = page.getByRole("navigation", { name: "Панель отделов" });

    const others = departments.filter((department) => department.id !== sales.id);
    for (const department of others) {
      await rail.getByRole("button", { name: department.overviewLabel }).click();
      await page.waitForTimeout(120);
    }

    const last = others[others.length - 1];
    await expect(page.getByRole("heading", { level: 2, name: last.headline })).toBeVisible();
    await expect.poll(async () => (await sceneLayers(page)).layers, { timeout: 20000 }).toBe(1);
    expect(await page.locator("[data-scene-crossfade]").getAttribute("data-scene-crossfade")).toBe(
      last.id,
    );
  });

  // Путь, который прежний тест «быстрое переключение» не покрывал: он идёт только вперёд по РАЗНЫМ
  // сценам, а пользователь может передумать — открыть отдел и вернуться к прежнему до того, как
  // новая сцена загрузилась. Здесь стек оставался из двух слоёв НАВСЕГДА: `onReady` срабатывает не
  // чаще одного раза за монтирование, поэтому повторно поднятый наверх слой сигнала уже не шлёт
  // (skeptic Phase B, NB-1). Визуального дефекта не было, но лишний декодированный кадр висел в
  // памяти, а `picture > img`.first() навсегда указывал на чужой отдел.
  test("возврат к прежнему отделу до загрузки нового не оставляет лишних слоёв", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(SCENE_FILES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.goto(`/?department=${sales.id}`);
    await expect.poll(async () => (await sceneLayers(page)).visible, { timeout: 20000 }).toBe(1);

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    // Уходим в HR и, не дожидаясь его сцены, возвращаемся в Sales.
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await page.waitForTimeout(150);
    await rail.getByRole("button", { name: sales.overviewLabel }).click();

    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    await expect.poll(async () => (await sceneLayers(page)).layers, { timeout: 20000 }).toBe(1);
    expect(await page.locator("[data-scene-crossfade]").getAttribute("data-scene-crossfade")).toBe(
      sales.id,
    );
  });

  test("prefers-reduced-motion: приближения нет, функции целы (AC2)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?department=${sales.id}`);

    const motion = await topLayerMotion(page);

    // Приближение заменено коротким fade: масштабирующих кейфреймов нет вовсе. Это не косметика —
    // глобальное правило reduced-motion схлопывает ДЛИТЕЛЬНОСТЬ, но не убирает сам transform, и без
    // отдельной ветки пользователь получил бы не отсутствие движения, а его рывок.
    expect(motion.name).toContain("scene-fade");
    expect(motion.durationMs).toBeLessThan(50);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(motion.transform);

    // Функции целы: переключение и закрытие работают.
    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: hr.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  // AC3 + совокупный бюджет со Step 15.5: каскад блоков (0/1/2/3 с) проигрывается заново на каждом
  // переключении ПОВЕРХ этого перехода, поэтому CTA становится ВИДИМЫМ примерно через 3.4 с. Всё это
  // время он обязан оставаться ДОСТУПНЫМ — иначе motion начинает удерживать коммерческий путь.
  test("критический контент доступен во время перехода, не дожидаясь его конца (AC3)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?department=${sales.id}`);
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();

    // Сразу после переключения, пока играет и переход сцены, и каскад блоков.
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    await expect(page.getByRole("link", { name: hr.ctaLabel })).toHaveAttribute("href", /.+/);

    // Контрол не просто в разметке — он верхний в своей точке, то есть сцена его не перекрывает.
    const closeIsTopmost = await page
      .getByRole("button", { name: "Закрыть" })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return element === hit || element.contains(hit);
      });
    expect(closeIsTopmost).toBe(true);

    // И действительно срабатывает, не дожидаясь конца анимаций.
    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  test("переход не роняет консоль и не ломает возврат в overview", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (message) => messages.push(message.text()));
    page.on("pageerror", (error) => messages.push(error.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await openOffice(page);
    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: sales.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();

    expect(messages.filter((text) => /error|hydrat/i.test(text))).toEqual([]);
  });
});
