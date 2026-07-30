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

interface RecordedSceneMotion {
  name: string;
  eventName: string;
  durationsMs: number[];
  fill: string;
  transform: string;
}

declare global {
  interface Window {
    __sceneAnimationStarts: RecordedSceneMotion[];
    __sceneMinCoverage: number;
    __sceneScales: number[];
    __sceneDurations: number[];
    __sceneRaf: number;
  }
}

/** Сколько слоёв сцены сейчас в DOM и сколько из них реально видно декодированными. */
const sceneLayers = (page: Page) =>
  page.evaluate(() => {
    const stack = document.querySelector("[data-scene-crossfade]");
    // Слои считаются по ФОТО-ДЕТЯМ стека, а не по <img>: упавший слой рендерится плейсхолдером
    // <span data-photo-fallback> (контракт Step 8), и подсчёт по <img> его бы не увидел — состояние
    // «чужой кадр + упавший слой» отчиталось бы как один слой и прошло бы (skeptic Phase B, NB-b).
    // Декоративный световой пробег (Amendment 15) — тоже ребёнок стека, но слоем сцены не является
    // и в счёт не идёт: иначе «лишних слоёв нет» означало бы разное до и после Amendment 15.
    const images = [...document.querySelectorAll("[data-scene-crossfade] img")];
    return {
      layers: stack
        ? stack.querySelectorAll(":scope > picture, :scope > [data-photo-fallback]").length
        : 0,
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
        // Со времени Amendment 15 треков ДВА (движение + проявление), и это не деталь реализации:
        // именно разные длительности отличают наезд камеры от одинарного crossfade.
        durationsMs: style.animationDuration
          .split(",")
          .map((value) => Number(value.trim().replace("s", "")) * 1000),
        fill: style.animationFillMode,
        transform: style.transform,
      };
    });

/**
 * Дождаться, пока сцена ПОЛНОСТЬЮ встала: один слой, непрозрачный, без работающих анимаций.
 *
 * Без этого ожидания замер укрытости врёт, и это стоило одного ложного диагноза: первая редакция
 * теста начинала запись сразу после того, как сцена стала видимой (opacity > 0.05), то есть прямо
 * посреди её стартового появления при загрузке страницы. Минимум по кадрам получался 0.209 и
 * выглядел как провал перехода, хотя переход ещё даже не начинался. Стартовое появление — не
 * переход: закрывать собой ему нечего.
 */
async function installSceneAnimationRecorder(page: Page) {
  await page.addInitScript(() => {
    window.__sceneAnimationStarts = [];
    document.addEventListener(
      "animationstart",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;
        if (!target.matches("[data-office-scene]")) return;

        const style = getComputedStyle(target);
        window.__sceneAnimationStarts.push({
          name: style.animationName,
          eventName: event.animationName,
          durationsMs: style.animationDuration
            .split(",")
            .map((value) => Number(value.trim().replace("s", "")) * 1000),
          fill: style.animationFillMode,
          transform: style.transform,
        });
      },
      true,
    );
  });
}

async function waitForRecordedSceneMotion(page: Page) {
  const handle = await page.waitForFunction(
    () =>
      window.__sceneAnimationStarts.find(
        (motion) =>
          motion.name !== "none" &&
          motion.durationsMs.some((duration) => duration >= 650 && duration <= 1000),
      ),
    null,
    { timeout: 20000 },
  );
  const motion = await handle.jsonValue();
  expect(motion).toBeDefined();
  return motion as RecordedSceneMotion;
}

async function waitForSettledScene(page: Page) {
  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll("[data-scene-crossfade] img")];
      if (images.length !== 1) return false;
      const image = images[0] as HTMLImageElement;
      if (image.naturalWidth === 0) return false;
      if (Number(getComputedStyle(image).opacity) < 0.999) return false;
      return image.getAnimations().every((animation) => animation.playState !== "running");
    },
    null,
    { timeout: 20000 },
  );
}

/**
 * Покадровая запись масштабов и длительностей анимации на слоях сцены за время действия.
 *
 * Нужна для проверки reduced motion: оба утверждения («приближения нет», «длительность схлопнута»)
 * проверяемы только покадрово и только ОТРИЦАТЕЛЬНО — сам трек живёт 1 мс и может не попасть ни в
 * одну выборку, тогда как нарушение (реальный зум, длинный трек) живёт десятки кадров и пропустить
 * его невозможно.
 */
async function recordSceneMotion(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    window.__sceneScales = [];
    window.__sceneDurations = [];
    const tick = () => {
      for (const image of document.querySelectorAll("[data-scene-crossfade] img")) {
        const style = getComputedStyle(image);
        // "none" — это отсутствие трансформации, то есть масштаб 1; DOMMatrix её не разбирает.
        window.__sceneScales.push(
          style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).a,
        );
        for (const value of style.animationDuration.split(",")) {
          window.__sceneDurations.push(Number(value.trim().replace("s", "")) * 1000);
        }
      }
      window.__sceneRaf = requestAnimationFrame(tick);
    };
    tick();
  });

  await action();
  await page.waitForTimeout(1800);

  return page.evaluate(() => {
    cancelAnimationFrame(window.__sceneRaf);
    return { scales: window.__sceneScales, durations: window.__sceneDurations };
  });
}

/**
 * Минимальная «укрытость» кадра за весь переход: в каждом кадре берётся самый непрозрачный из
 * ДЕКОДИРОВАННЫХ слоёв, и по всем кадрам берётся минимум. 1 означает, что экран ни разу не остался
 * без полностью непрозрачной сцены.
 *
 * Это главный сторож Amendment 15. Прежняя редакция снимала уходящий слой по событию загрузки, а
 * анимацию приходящего вела от монтирования, и на быстрой загрузке уходящий исчезал, пока приходящий
 * был ещё прозрачным. Замерено до правки: при задержке 0 мс укрытость падала до 0.00, при 120 мс —
 * до 0.48, при 250 мс — до 0.77. Тесты этого не видели, потому что единственный тест перехода ставил
 * задержку 900 мс — то есть щупал единственный режим, в котором дефекта нет.
 *
 * Замер обязан начинаться с УЖЕ ВСТАВШЕЙ сцены (см. waitForSettledScene): иначе он захватывает
 * стартовое появление и врёт.
 */
async function minSceneCoverage(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    window.__sceneMinCoverage = 1;
    const tick = () => {
      const images = [...document.querySelectorAll("[data-scene-crossfade] img")];
      const decoded = images
        .filter((image) => (image as HTMLImageElement).naturalWidth > 0)
        .map((image) => Number(getComputedStyle(image).opacity));
      const covered = decoded.length > 0 ? Math.max(...decoded) : 0;
      window.__sceneMinCoverage = Math.min(window.__sceneMinCoverage, covered);
      window.__sceneRaf = requestAnimationFrame(tick);
    };
    tick();
  });

  await action();
  await page.waitForTimeout(1800);

  return page.evaluate(() => {
    cancelAnimationFrame(window.__sceneRaf);
    return window.__sceneMinCoverage;
  });
}

/**
 * То же, что {@link minSceneCoverage}, но по ЛЮБОМУ кадру сцены офиса, а не только по слоям
 * контейнера перехода (Step 18).
 *
 * Разница не техническая. Все три сторожа укрытости Amendment 15 входят через `?department=<id>` и
 * переключаются рельсом, то есть щупают только путь отдел→отдел, где обе сцены рендерит один и тот
 * же контейнер. На пути overview→отдел кадр меняет ХОЗЯИНА: до нажатия его рисует карта офиса, после
 * — контейнер перехода. Селектор по контейнеру в этот момент не видит ничего и отчитался бы об
 * укрытости 0 ещё до всякого дефекта, поэтому дефект этого пути не мог быть пойман ни одним из них
 * ПО ПОСТРОЕНИЮ — именно поэтому он и дожил до конца этапа.
 *
 * `img[data-office-scene]` описывает требование напрямую: «на экране есть непрозрачный кадр сцены»,
 * безотносительно того, кто его сейчас держит.
 */
async function minSceneCoverageAnywhere(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    window.__sceneMinCoverage = 1;
    const tick = () => {
      const images = [...document.querySelectorAll("img[data-office-scene]")];
      const decoded = images
        .filter((image) => (image as HTMLImageElement).naturalWidth > 0)
        // Кадр в схлопнутом контейнере (display: none) физически не показан, каким бы ни был его
        // opacity: без этой отбраковки ветка, которую сняли с экрана, засчитывалась бы за укрытие.
        .filter((image) => (image as HTMLElement).offsetParent !== null)
        .map((image) => Number(getComputedStyle(image).opacity));
      const covered = decoded.length > 0 ? Math.max(...decoded) : 0;
      window.__sceneMinCoverage = Math.min(window.__sceneMinCoverage, covered);
      window.__sceneRaf = requestAnimationFrame(tick);
    };
    tick();
  });

  await action();
  await page.waitForTimeout(1800);

  return page.evaluate(() => {
    cancelAnimationFrame(window.__sceneRaf);
    return window.__sceneMinCoverage;
  });
}

/** Дождаться вставшего кадра — по тому же расширенному селектору, что и замер выше. */
async function waitForSettledSceneAnywhere(page: Page) {
  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll("img[data-office-scene]")].filter(
        (image) => (image as HTMLElement).offsetParent !== null,
      );
      if (images.length !== 1) return false;
      const image = images[0] as HTMLImageElement;
      if (image.naturalWidth === 0) return false;
      if (Number(getComputedStyle(image).opacity) < 0.999) return false;
      return image.getAnimations().every((animation) => animation.playState !== "running");
    },
    null,
    { timeout: 20000 },
  );
}

async function openOffice(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

test.describe("Step 16 — переход между сценами", () => {
  test("сцена отдела появляется контролируемым приближением, а не подменой кадра (AC1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installSceneAnimationRecorder(page);
    // Задержка обязательна: со времени Amendment 15 показ начинается по готовности картинки К
    // ОТРИСОВКЕ, а не по монтированию, поэтому на мгновенной загрузке анимация успела бы доиграть
    // до первого замера и тест ловил бы уже покой.
    await page.route(SCENE_FILES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await page.goto(`/?department=${sales.id}`);

    // Ждём НАЧАЛА показа, а не конца загрузки.
    const motion = await waitForRecordedSceneMotion(page);
    expect(motion.name).not.toBe("none");
    expect(motion.eventName).not.toBe("none");
    // Анимация доигрывает до конца (fill both удерживает конечное состояние).
    expect(motion.fill).toContain("both");

    // Движение — в диапазоне docs/07 для overview→department (650–1000 мс). Диапазон, а не точное
    // значение: docs/07 задаёт именно вилку, и прибивать её к одному числу значило бы придумать
    // требование, которого в документе нет.
    const dollyMs = Math.max(...motion.durationsMs);
    expect(
      dollyMs,
      `движение ${dollyMs}мс вне диапазона docs/07 650–1000мс`,
    ).toBeGreaterThanOrEqual(650);
    expect(dollyMs, `движение ${dollyMs}мс вне диапазона docs/07 650–1000мс`).toBeLessThanOrEqual(
      1000,
    );

    // Проявление ЗАМЕТНО короче движения. Это и есть разница между наездом камеры и обычным
    // crossfade: кадр становится непрозрачным задолго до того, как перестаёт двигаться, поэтому
    // большую часть перехода зритель видит уже чистую картинку. Равные длительности означали бы
    // возврат к тому «дешёвому» фейду, из-за которого Amendment 15 и появился.
    const dissolveMs = Math.min(...motion.durationsMs);
    expect(
      dissolveMs,
      `проявление ${dissolveMs}мс не короче движения ${dollyMs}мс — это одинарный фейд`,
    ).toBeLessThan(dollyMs * 0.75);

    // И приближение ЗАКАНЧИВАЕТСЯ в масштабе 1: кадр не остаётся увеличенным навсегда.
    await page.waitForTimeout(dollyMs + 400);
    const settled = await topLayerMotion(page);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(settled.transform);
  });

  // ГЛАВНЫЙ СТОРОЖ Amendment 15. Проверяется именно БЫСТРЫЙ путь, который прежде не проверял никто:
  // задержка 0 мс — это картинка из кэша, то есть обычное состояние при повторных переключениях
  // отделов. Замерено до правки: укрытость падала до 0.00 (экран оставался без сцены вовсе).
  for (const delayMs of [0, 150, 300]) {
    test(`переключение отдела не обнажает экран при задержке ${delayMs}мс (Amendment 15)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      if (delayMs > 0) {
        await page.route(SCENE_FILES, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          await route.continue();
        });
      }

      await page.goto(`/?department=${sales.id}`);
      await waitForSettledScene(page);

      const rail = page.getByRole("navigation", { name: "Панель отделов" });
      const coverage = await minSceneCoverage(page, async () => {
        await rail.getByRole("button", { name: hr.overviewLabel }).click();
      });

      expect(
        coverage,
        `минимальная укрытость кадра ${coverage} при задержке ${delayMs}мс — переход обнажает экран`,
      ).toBeGreaterThan(0.99);
    });
  }

  // Световой пробег — часть эффекта, а не украшение «на всякий случай»: без него переход снова
  // читается как подмена картинки. Проверяется и то, что он ЖИВЁТ РОВНО ОДИН ПЕРЕХОД: первая
  // редакция оставляла его в DOM навсегда (замерено: 2 ребёнка стека в покое вместо одного).
  test("световой пробег проигрывается на переключении и не остаётся в DOM (Amendment 15)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(SCENE_FILES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });
    await page.goto(`/?department=${sales.id}`);
    await expect.poll(async () => (await sceneLayers(page)).visible, { timeout: 20000 }).toBe(1);

    const gleam = page.locator("[data-scene-gleam]");
    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: hr.overviewLabel })
      .click();

    await expect(gleam).toHaveCount(1, { timeout: 20000 });
    // Он декоративный: не перехватывает курсор и скрыт от screen reader.
    await expect(gleam).toHaveAttribute("aria-hidden", "true");
    expect(await gleam.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

    // И снимается по окончании перехода.
    await expect(gleam).toHaveCount(0, { timeout: 20000 });
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
    await page.route(SCENE_FILES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await page.goto(`/?department=${sales.id}`);
    await waitForSettledScene(page);

    // Проверяется САМО ТРЕБОВАНИЕ («приближения нет»), а не имя анимации: в reduced motion трек
    // длится 1 мс и класс перехода снимается по его окончании, поэтому поймать анимацию опросом
    // нельзя в принципе — тест на имя ловил бы уже покой и был бы зелёным при любой реализации.
    // Вместо этого записывается КАЖДЫЙ кадр перехода: масштаб не должен отклоняться от 1 нигде.
    // Это важно не косметически — глобальное правило reduced-motion схлопывает ДЛИТЕЛЬНОСТЬ, но не
    // убирает сам transform, и без отдельной ветки пользователь получил бы не отсутствие движения,
    // а его рывок.
    const { scales, durations } = await recordSceneMotion(page, async () => {
      await page
        .getByRole("navigation", { name: "Панель отделов" })
        .getByRole("button", { name: hr.overviewLabel })
        .click();
    });

    expect(scales.length, "не записано ни одного кадра — замер не состоялся").toBeGreaterThan(10);
    const worst = scales.reduce((a, b) => (Math.abs(b - 1) > Math.abs(a - 1) ? b : a));
    expect(
      worst,
      `в reduced motion наблюдался масштаб ${worst} — это движение, а не его отсутствие`,
    ).toBeCloseTo(1, 3);

    // Длительность на слоях сцены схлопнута — вторая половина требования AC2 «короткий fade».
    //
    // Короткой её удерживают ДВА независимых механизма: глобальное `animation-duration: 0.001ms
    // !important` в globals.css (селектор `*`) и собственная reduced-motion-ветка модуля
    // (`scene-fade 1ms`). Я снимал глобальное правило и пересобирал — тест остался зелёным, и
    // сначала счёл это признаком вырожденной проверки. Это была ошибка рассуждения: утверждение
    // проверяет НАБЛЮДАЕМОЕ требование, а требование выполнено, пока держится хотя бы один из
    // механизмов, — значит зелёный там и есть правильный ответ. Вырожденной была бы проверка,
    // не способная упасть ни при каком дефекте; эта падает, если снять оба места, задать в модуле
    // длинную длительность с `!important` или сузить глобальный селектор.
    //
    // Утверждение намеренно ОТРИЦАТЕЛЬНОЕ («ни в одном кадре не было длинного трека»), а не
    // «поймали короткий»: в reduced motion трек живёт 1 мс и может не попасть ни в одну выборку.
    // Положительная формулировка требовала бы поймать это окно и была бы флейки, отрицательная —
    // надёжна, потому что длинный трек живёт десятки кадров и пропустить его невозможно.
    const worstDuration = Math.max(...durations);
    expect(
      worstDuration,
      `в reduced motion наблюдался трек длительностью ${worstDuration}мс — длительность не схлопнута`,
    ).toBeLessThan(50);

    // И световой пробег в reduced motion не показывается — движущийся блик противоречил бы самой
    // просьбе «меньше движения». toBeHidden, а не toHaveCount(0): он гасится правилом display:none,
    // то есть может присутствовать в разметке, но виден быть не должен ни при каком раскладе.
    await expect(page.locator("[data-scene-gleam]")).toBeHidden();

    // Функции целы: переключение доехало до конца и закрытие работает.
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
    await expect(page.getByRole("button", { name: "Назад к офису" })).toBeVisible();

    // Контрол не просто в разметке — он верхний в своей точке, то есть сцена его не перекрывает.
    const closeIsTopmost = await page
      .getByRole("button", { name: "Назад к офису" })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return element === hit || element.contains(hit);
      });
    expect(closeIsTopmost).toBe(true);

    // И действительно срабатывает, не дожидаясь конца анимаций.
    await page.getByRole("button", { name: "Назад к офису" }).click();
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

/**
 * Step 18, AC1 — второй конец того же дефекта, ради которого делался Amendment 15.
 *
 * Контейнер перехода жил ВНУТРИ ветки активного раздела и при открытии отдела монтировался заново,
 * поэтому удерживать ему было нечего: кадр карты офиса уходил вместе со своей веткой, а кадр отдела
 * ещё не был готов к отрисовке. Измерено до правки: 89–138 мс белого экрана на localhost, 378/759/
 * 1444 мс при задержках 300/600/1200 мс и 863 мс на мобильном Fast 3G. То есть на настоящем канале
 * пользователь видел не переход, а провал — ровно то, что Amendment 15 уже закрыл для пути
 * отдел→отдел.
 */
test.describe("Step 18 — путь overview→отдел", () => {
  for (const delayMs of [0, 300, 900]) {
    test(`открытие отдела с карты офиса не обнажает экран при задержке ${delayMs}мс (AC1)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      if (delayMs > 0) {
        await page.route(SCENE_FILES, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          await route.continue();
        });
      }

      await page.goto("/");
      await openOffice(page);
      await waitForSettledSceneAnywhere(page);

      const map = page.getByRole("navigation", { name: "Отделы компании" });
      const coverage = await minSceneCoverageAnywhere(page, async () => {
        await map.getByRole("button", { name: sales.overviewLabel }).click();
      });

      // Отдел действительно открылся — иначе замер укрытости описывал бы неподвижную картинку.
      await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
      expect(
        coverage,
        `минимальная укрытость кадра ${coverage} при задержке ${delayMs}мс — открытие отдела обнажает экран`,
      ).toBeGreaterThan(0.99);
    });
  }

  // Обратный путь держится тем же слоем, поэтому проверяется здесь же: если подъём слоя сделан
  // только «в одну сторону», закрытие отдела снова размонтирует кадр и вернёт ту же дыру.
  test("закрытие отдела не обнажает экран (AC1)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(SCENE_FILES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await page.goto(`/?department=${sales.id}`);
    await waitForSettledSceneAnywhere(page);

    const coverage = await minSceneCoverageAnywhere(page, async () => {
      await page.getByRole("button", { name: "Назад к офису" }).click();
    });

    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
    expect(
      coverage,
      `минимальная укрытость кадра ${coverage} при закрытии отдела — возврат обнажает экран`,
    ).toBeGreaterThan(0.99);
  });
});
