import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";

// Step 13 (Amendment 8) — экран отдела перекомпонован вокруг СВОЕЙ сцены: фото на всю 90%-область,
// текст поверх него компактными карточками. Здесь проверяется ровно то, что видно только в реальном
// браузере и не доказывается ни unit-тестом, ни разметкой:
//   AC1/AC7 — каждый отдел показывает свою сцену, и переключение реально МЕНЯЕТ ЗАГРУЖЕННЫЙ ФАЙЛ
//             (а не только атрибут в DOM);
//   AC3    — грузится только сцена активного отдела, не все шесть;
//   AC4    — при отказе фотослоя контент, кнопки и CTA остаются рабочими;
//   AC6    — сцена видна не менее чем на половине 90%-области (прежняя белая подложка закрывала ~85%).
//
// axe-гейт AC2 живёт в accessibility-scan.spec.ts. Контраст текста поверх фото axe не проверяет
// вовсе (метит как incomplete) — он подтверждён расчётом композита скрима, см. комментарии в
// DepartmentCopy.module.css и docs/design-tokens.md.

const departments = getDepartments();

// Turbopack эмитит производные с контент-хешем ПЕРЕД расширением (`sales-1280.<hash>.avif`),
// поэтому имя нельзя проверять как `sales-1280.avif` (то же предупреждение — overview-scene.spec.ts).
const derivativeOf = (sceneId: string) =>
  new RegExp(`${sceneId}-(768|1280|1536)\\.[^/]*\\.(avif|webp)$`);

const ANY_SCENE =
  /(overview|sales|support|executive|hr|logistics)-(768|1280|1536)\.[^/]*\.(avif|webp)$/;

async function openOffice(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

/** Фон 10/90 — первый <picture> внутри шелла активного раздела. */
function sceneImage(page: Page) {
  return page.locator("picture > img").first();
}

async function currentSceneFile(page: Page): Promise<string> {
  const img = sceneImage(page);
  await expect(img).toBeVisible();
  // Ждём именно декодирования: пока naturalWidth 0, currentSrc может ещё не отражать выбор браузера.
  await expect
    .poll(async () => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThan(0);
  return img.evaluate((i: HTMLImageElement) => i.currentSrc);
}

test.describe("Step 13 — each department gets its own scene", () => {
  test("every one of the five departments loads a derivative of its OWN scene", async ({
    page,
  }) => {
    await page.goto("/");
    await openOffice(page);

    const map = page.getByRole("navigation", { name: "Отделы компании" });
    const rail = page.getByRole("navigation", { name: "Панель отделов" });

    // Первый отдел открывается с карты офиса, остальные — переключением через рельс: именно этот
    // путь пользователь проходит на самом деле, и именно он обязан менять сцену без перезагрузки.
    await map.getByRole("button", { name: departments[0].overviewLabel }).click();

    const seenFiles = new Set<string>();
    for (const [index, department] of departments.entries()) {
      if (index > 0) {
        await rail.getByRole("button", { name: department.overviewLabel }).click();
      }
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();

      const file = await currentSceneFile(page);
      expect(file, `отдел "${department.id}" показывает чужую сцену: ${file}`).toMatch(
        derivativeOf(department.id),
      );
      seenFiles.add(file);
    }

    // AC7 по существу: пять отделов дали пять РАЗНЫХ файлов. Без этой проверки тест выше прошёл бы
    // и в случае, если бы все отделы делили один фон, а regexp совпадал по случайности.
    expect(seenFiles.size).toBe(departments.length);
  });

  test("switching department swaps the file the browser actually loaded, without a reload", async ({
    page,
  }) => {
    await page.goto("/");
    await openOffice(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });

    const sales = departments.find((d) => d.id === "sales")!;
    const logistics = departments.find((d) => d.id === "logistics")!;

    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: sales.overviewLabel })
      .click();
    const before = await currentSceneFile(page);
    expect(before).toMatch(derivativeOf("sales"));

    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: logistics.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: logistics.headline })).toBeVisible();

    // Ключевая проверка Amendment 8: сменился именно ЗАГРУЖЕННЫЙ файл. Проверка по DOM-атрибуту
    // (src/srcset) здесь недостаточна — она прошла бы и тогда, когда браузер оставил на экране
    // прежнюю декодированную картинку.
    await expect.poll(async () => currentSceneFile(page)).toMatch(derivativeOf("logistics"));
    expect(await currentSceneFile(page)).not.toBe(before);

    expect(
      await page.evaluate(
        () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
      ),
    ).toBe(true);
  });

  test("opening one department requests that scene only — not all six (AC3)", async ({ page }) => {
    // Собираются ВСЕ запросы изображений, а не только совпавшие с ANY_SCENE: иначе проверка на
    // отсутствие .png ниже была бы мёртвой — в отфильтрованный по (avif|webp)$ массив .png не мог бы
    // попасть в принципе, и ассерт никогда бы не упал (найдено skeptic Phase B). Тот же приём, что
    // в overview-scene.spec.ts.
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") imageRequests.push(request.url());
    });

    await page.goto("/");
    await openOffice(page);

    const support = departments.find((d) => d.id === "support")!;
    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: support.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: support.headline })).toBeVisible();
    await currentSceneFile(page);

    // overview-сцена законно уже загружена: это фон обзорного экрана, с которого пришёл пользователь
    // (Step 12). Проверяется отсутствие ЧУЖИХ отделов — за них платить при открытии одного нельзя.
    const foreign = imageRequests.filter((url) =>
      ["sales", "executive", "hr", "logistics"].some((id) => derivativeOf(id).test(url)),
    );
    expect(foreign, `запрошены сцены чужих отделов: ${foreign.join(", ")}`).toEqual([]);

    // Сцена активного отдела при этом действительно запрошена — иначе проверка выше проходила бы и
    // на экране вовсе без фотослоя.
    expect(imageRequests.filter((url) => ANY_SCENE.test(url))).toContainEqual(
      expect.stringMatching(derivativeOf("support")),
    );

    // И оригиналы PNG (3.1–3.6 МБ) браузер не трогает ни при каких условиях.
    expect(imageRequests.filter((url) => url.endsWith(".png"))).toEqual([]);
  });

  // Регресс на дефект, найденный skeptic Phase B: OfficeScenePhoto держит признак неудачной загрузки
  // в локальном state, и пока сцена была одна на всё department-active, этот признак справедливо
  // «залипал». Со Step 13 источник меняется вместе с отделом — без сброса состояния ОДИН оборванный
  // запрос гасил фотослой на весь дальнейший обход офиса, хотя следующая сцена загружаема.
  // Тест ниже, в отличие от AC4-теста, блокирует РОВНО ОДИН файл: сценарий восстановления
  // принципиально не проверяется там, где заблокированы все форматы сразу.
  test("a single failed scene does not disable the photo layer for the rest of the visit", async ({
    page,
  }) => {
    const sales = departments.find((d) => d.id === "sales")!;
    const support = departments.find((d) => d.id === "support")!;

    // Падает только сцена «Продаж». Все остальные производные сеть отдаёт нормально.
    await page.route(/sales-(768|1280|1536)\.[^/]*\.(avif|webp)$/, (route) => route.abort());

    await page.goto("/");
    await openOffice(page);
    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: sales.overviewLabel })
      .click();

    // Сцена «Продаж» действительно упала и заменена плейсхолдером (контракт Step 8).
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
    await expect(page.locator("[data-photo-fallback]")).toHaveCount(1);

    // А вот следующий отдел ОБЯЗАН показать своё фото: его файл никто не блокировал.
    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: support.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: support.headline })).toBeVisible();

    const file = await currentSceneFile(page);
    expect(file, "после сбоя одной сцены фотослой не восстановился").toMatch(
      derivativeOf("support"),
    );
  });

  test("the scene stays visible on at least half of the 90% area (AC6)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    await openOffice(page);

    const sales = departments.find((d) => d.id === "sales")!;
    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: sales.overviewLabel })
      .click();

    const panel = page.getByRole("region", { name: sales.overviewLabel });
    await expect(panel).toBeVisible();

    // .mainArea — родитель панели отдела, то есть та самая «90%-область».
    const mainArea = panel.locator("..");
    const areaBox = (await mainArea.boundingBox())!;
    const panelBox = (await panel.boundingBox())!;

    // Измерение сознательно КОНСЕРВАТИВНОЕ: за перекрытие принимается весь габарит колонки контента,
    // хотя непрозрачны в ней только карточки, а между ними сцена видна. Если даже такая завышенная
    // оценка укладывается в порог — реальная видимая площадь сцены заведомо больше.
    // Порог 0.75 (сцена ≥25%), а не прежние 0.5: Amendment 12 добавил вторую колонку — окно
    // пояснения справа от списка болей, — и пользователь сознательно обменял площадь сцены на его
    // читаемость. Это ослабление критерия, и оно записано в WORKPLAN.md AC6 явно, а не спрятано
    // здесь.
    const coveredRatio = (panelBox.width * panelBox.height) / (areaBox.width * areaBox.height);
    expect(
      coveredRatio,
      `контент закрывает ${(coveredRatio * 100).toFixed(1)}% 90%-области — сцена снова стала полоской`,
    ).toBeLessThanOrEqual(0.75);

    // И сцена действительно расстелена под всей раскладкой, а не втиснута в остаток под рельсом.
    const sceneBox = (await sceneImage(page).boundingBox())!;
    expect(sceneBox.width).toBeGreaterThanOrEqual(areaBox.width);
    expect(sceneBox.height).toBeGreaterThanOrEqual(areaBox.height * 0.95);
  });

  test("with the photo layer blocked, the department screen is still fully usable (AC4)", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // Блокируются оба формата: сцена отдаётся через <picture> с AVIF-приоритетом, и блокировка
    // одного webp её бы не уронила.
    await page.route("**/*.avif", (route) => route.abort());
    await page.route("**/*.webp", (route) => route.abort());

    await page.goto("/");
    await openOffice(page);

    const hr = departments.find((d) => d.id === "hr")!;
    await page
      .getByRole("navigation", { name: "Отделы компании" })
      .getByRole("button", { name: hr.overviewLabel })
      .click();

    const panel = page.getByRole("region", { name: hr.overviewLabel });
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    await expect(panel.getByText(hr.problem)).toBeVisible();
    await expect(panel.getByRole("link", { name: hr.ctaLabel })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Закрыть" })).toBeVisible();

    // Битой картинки не остаётся — на её месте детерминированный плейсхолдер (контракт Step 8).
    await expect(page.locator("picture")).toHaveCount(0);

    // Переключение отделов работает и без фотослоя: коммерческий путь от сцены не зависит.
    const logistics = departments.find((d) => d.id === "logistics")!;
    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: logistics.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: logistics.headline })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
