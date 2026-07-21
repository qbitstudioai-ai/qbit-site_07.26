import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

// Step 15 — адаптивное кадрирование сцен и safe-areas. Здесь проверяется только то, что зависит от
// РАЗМЕРА вьюпорта и видно исключительно в браузере: какой производной расплачивается узкий экран,
// держат ли зоны тап-таргет на мелком кадре, стоят ли они там же, куда их кладут проценты
// office-zones.json, и остаётся ли сцена отдела видимой на планшете.
//
// Что намеренно НЕ здесь:
//   • axe на tablet-ширине — в accessibility-scan.spec.ts (AC4), туда добавлен вьюпорт 1024px;
//   • контраст подписей поверх фото — axe его не измеряет вовсе (метит incomplete), он подтверждён
//     расчётом композита скрима (docs/design-tokens.md, --scrim-strong: 6.80:1 на худшем участке);
//   • тап-таргеты рельса/CTA на планшете — уже покрыты tablet-touch-flow.spec.ts AC7.

const departments = getDepartments();
const zones = getOfficeZones();
const sales = departments.find((d) => d.id === "sales")!;

// Turbopack эмитит производные с контент-хешем ПЕРЕД расширением (`overview-1280.<hash>.avif`) —
// то же предупреждение, что в overview-scene.spec.ts.
const SCENE_DERIVATIVE =
  /(overview|sales|support|executive|hr|logistics)-(768|1280|1536)\.[^/]*\.(avif|webp)$/;

async function openOverview(page: Page) {
  await page.getByRole("link", { name: getHomepageCopy().secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

/** Ширина производной, которую браузер РЕАЛЬНО выбрал (currentSrc), а не та, что лежит в srcset. */
async function servedWidth(page: Page): Promise<number> {
  // Верхний слой crossfade — текущая сцена (Step 16, см. department-scene.spec.ts).
  const img = page.locator("picture > img").last();
  await expect(img).toBeVisible();
  await expect
    .poll(async () => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThan(0);
  const currentSrc = await img.evaluate((i: HTMLImageElement) => i.currentSrc);
  const match = currentSrc.match(SCENE_DERIVATIVE);
  expect(match, `currentSrc не похож на производную сцены: ${currentSrc}`).not.toBeNull();
  return Number(match![2]);
}

// Ширины, на которых кадрирование действительно меняется: обе стороны порога 767/768, характерный
// планшет, верхний край планшетного диапазона. 1279/1280 уже разведены tablet-touch-flow.spec.ts.
const framingWidths = [
  { name: "mobile 320 (крайняя узкая)", width: 320, height: 690 },
  { name: "mobile 375", width: 375, height: 812 },
  { name: "tablet 768 портрет", width: 768, height: 1024 },
  { name: "tablet 1024 альбом", width: 1024, height: 768 },
  { name: "tablet 1279 (верхний край)", width: 1279, height: 800 },
  // Низкий desktop: кадр ограничен ВЫСОТОЙ, а не шириной, — тот случай, на котором Step 12 потерял
  // пол 44px (skeptic Phase B, finding 2). Ширина здесь desktop-ная сознательно.
  { name: "низкий desktop 1280x400", width: 1280, height: 400 },
  // Телефон в ЛАНДШАФТЕ. Добавлен по skeptic Phase B (BLOCKING-1): весь остальной мобильный набор
  // здесь и в mobile-touch-flow.spec.ts — портретный, и из-за этого первая редакция Step 15 не
  // заметила, что кадр без потолка высоты вырастает до 619×413 на 667×375 и уходит за нижний край
  // вместе с зонами «Продажи» и HR. docs/08 «Учитывать» называет ориентацию прямо.
  { name: "телефон ландшафт 667x375", width: 667, height: 375 },
  { name: "телефон ландшафт 640x360", width: 640, height: 360 },
];

// Подмножество, на котором дополнительно требуется, чтобы КАДР ЦЕЛИКОМ помещался в вьюпорт без
// внутренней прокрутки. Не весь набор: на 1280×400 переполнение по высоте — законный «низкий
// desktop» (docs/08), там кадр и так ограничен высотой панели.
const mobileSizes = framingWidths.filter((s) => s.width <= 767);

test.describe("Step 15 — кадрирование overview-сцены по брейкпоинтам", () => {
  for (const size of framingWidths) {
    test(`${size.name}: каждая зона держит тап-таргет 44x44 и её подпись не обрезана`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await openOverview(page);

      const map = page.getByRole("navigation", { name: "Отделы компании" });

      for (const department of departments) {
        const hotspot = map.getByRole("button", { name: department.overviewLabel });
        const box = await hotspot.boundingBox();
        expect(box, `${department.id} не отрисован`).not.toBeNull();

        // Пол 44px (DepartmentHotspot.module.css). Без него измерено 105x36 на 1280x400 и 114x39 на
        // 375px — оба ниже порога CLAUDE.md Accessibility rules.
        expect(box!.width, `${department.id} width @ ${size.name}`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${department.id} height @ ${size.name}`).toBeGreaterThanOrEqual(44);

        // Подпись обязана помещаться целиком: `overflow: hidden` у .hotspot срезает не влезший текст
        // МОЛЧА, без визуального признака.
        //
        // Меряется, вылезает ли прямоугольник подписи за padding-box хотспота — то есть ровно то,
        // что обрезает `overflow: hidden` (исправлено по skeptic Phase B, NON-BLOCKING-1).
        // Отвергнуты два более простых способа, оба дают ложный ответ:
        //   • scrollWidth/clientWidth у самой подписи — подпись переносит строки и не переполняет
        //     себя НИКОГДА (замерено: значения совпадали до пикселя во всех 15 случаях), страж был
        //     бы зелёным по построению;
        //   • scrollWidth/clientWidth у хотспота — при `align-items: center` переполнение уходит в
        //     обе стороны, а scrollWidth в LTR считает только правую, давая ненулевую разницу даже
        //     там, где подпись видна целиком.
        const clip = await hotspot.evaluate((el) => {
          const label = el.querySelector("span")!.getBoundingClientRect();
          const style = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const padBox = {
            left: r.left + parseFloat(style.borderLeftWidth),
            right: r.right - parseFloat(style.borderRightWidth),
            top: r.top + parseFloat(style.borderTopWidth),
            bottom: r.bottom - parseFloat(style.borderBottomWidth),
          };
          return Math.max(
            padBox.left - label.left,
            label.right - padBox.right,
            padBox.top - label.top,
            label.bottom - padBox.bottom,
          );
        });
        expect(
          clip,
          `подпись ${department.id} срезана на ${clip.toFixed(1)}px @ ${size.name}`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  // Расширение позиционного теста overview-scene.spec.ts на брейкпоинты (Step 12, skeptic Phase B,
  // finding 3: проценты зон держатся на пропорции кадра 3:2, но проверялись только на дефолтном
  // вьюпорте — любое изменение aspect-ratio/object-fit молча сдвинуло бы все пять зон на другую
  // мебель).
  for (const size of framingWidths) {
    test(`${size.name}: зоны стоят там, куда их кладёт office-zones.json — пропорция кадра 3:2 сохранена`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await openOverview(page);

      const scene = page.locator("picture").first().locator("..");
      const sceneBox = (await scene.boundingBox())!;

      // Сам кадр: 3:2 при любой ширине. Допуск 1% — субпиксельное округление, но не смена пропорции.
      expect(
        Math.abs(sceneBox.width / sceneBox.height - 1.5),
        `пропорция кадра @ ${size.name} = ${(sceneBox.width / sceneBox.height).toFixed(3)}`,
      ).toBeLessThanOrEqual(0.015);

      for (const zone of zones) {
        const box = (await page.locator(`#hotspot-${zone.departmentId}`).boundingBox())!;

        // Допуск считается от кадра, а не абсолютный: на 320px кадр ~272px, и фиксированные
        // «2px» были бы там строже, чем на desktop, без всякой причины. 2.5% (против 1.5% в
        // overview-scene.spec.ts) — потому что пол 44px СОЗНАТЕЛЬНО сдвигает мелкие зоны: на
        // мелком кадре зона растягивается до тап-таргета и её левый/верхний угол смещается.
        const toleranceX = sceneBox.width * 0.025;
        const toleranceY = sceneBox.height * 0.025;

        expect(
          Math.abs(box.x - sceneBox.x - (zone.x / 100) * sceneBox.width),
          `${zone.departmentId} x @ ${size.name}`,
        ).toBeLessThanOrEqual(toleranceX);
        expect(
          Math.abs(box.y - sceneBox.y - (zone.y / 100) * sceneBox.height),
          `${zone.departmentId} y @ ${size.name}`,
        ).toBeLessThanOrEqual(toleranceY);
      }
    });
  }

  // Пол 44px растягивает мелкие зоны и потому может их СБЛИЗИТЬ вплоть до наложения (измерено:
  // support/executive перекрываются на 52×3px на 375 и 44×10px на 320). Комментарий в
  // DepartmentHotspot.module.css называет эту цену приемлемой — но приемлема она ровно до тех пор,
  // пока тап по зоне попадает в НЕЁ, а не в соседнюю. Инвариант проверяется hit-тестом, а не
  // геометрией непересечения: пересечение рамок допустимо, промах тапа — нет
  // (добавлено по skeptic Phase B, NON-BLOCKING-4).
  for (const size of framingWidths) {
    test(`${size.name}: тап в центр каждой зоны попадает именно в неё, несмотря на пол 44px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await openOverview(page);

      for (const zone of zones) {
        const hitId = await page.locator(`#hotspot-${zone.departmentId}`).evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit?.closest("[id^='hotspot-']")?.id ?? null;
        });
        expect(hitId, `центр зоны ${zone.departmentId} @ ${size.name}`).toBe(
          `hotspot-${zone.departmentId}`,
        );
      }
    });
  }

  // Регресс на BLOCKING-1: кадр обязан помещаться в вьюпорт целиком на всех мобильных размерах,
  // включая ландшафт. Без потолка высоты (`min(100%, calc(45dvh * 3 / 2))`) на 667×375 кадр уходил
  // на 224px за нижний край.
  for (const size of mobileSizes) {
    test(`${size.name}: кадр сцены помещается в вьюпорт целиком — ни одна зона не за фолдом`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await openOverview(page);

      const sceneBox = (await page.locator("picture").first().locator("..").boundingBox())!;
      expect(
        sceneBox.y + sceneBox.height,
        `нижний край кадра ${(sceneBox.y + sceneBox.height).toFixed(0)}px при высоте вьюпорта ${size.height}px`,
      ).toBeLessThanOrEqual(size.height);

      for (const zone of zones) {
        const box = (await page.locator(`#hotspot-${zone.departmentId}`).boundingBox())!;
        expect(
          box.y + box.height,
          `зона ${zone.departmentId} за нижним краем @ ${size.name}`,
        ).toBeLessThanOrEqual(size.height);
      }

      // Пропорция 3:2 обязана пережить потолок: если бы он был задан через max-height при заданной
      // ширине, кадр сплющился бы, cover начал бы обрезать фото и зоны указали бы на другую мебель.
      expect(
        Math.abs(sceneBox.width / sceneBox.height - 1.5),
        `пропорция кадра после потолка высоты @ ${size.name}`,
      ).toBeLessThanOrEqual(0.015);
    });
  }
});

test.describe("Step 15 — узкий вьюпорт не платит за desktop-производную (AC3)", () => {
  // Пары «вьюпорт → максимальная допустимая ширина производной». Порог — не точное равенство:
  // выбор внутри srcset остаётся за браузером (DPR, эвристики), и прибивать его гвоздём значило бы
  // тестировать Chromium, а не наш `sizes`. Проверяется то, что и требует AC3: узкий экран получает
  // МЕНЬШУЮ производную, чем desktop.
  const cases = [
    { name: "mobile 375", width: 375, height: 812, maxServed: 768 },
    { name: "tablet 768", width: 768, height: 1024, maxServed: 768 },
    // Step 18: ширина ИЗ ПОЛОСЫ РАСХОЖДЕНИЯ долей `sizes`. Прежние три точки (375/768/1024) лежат
    // там, где 97vw и 100vw дают одну и ту же производную, поэтому подмена доли на 100vw прошла бы
    // мимо них незамеченной — что и случилось: первая редакция Step 18 свела `sizes` к 100vw, и на
    // 769…791 браузер начал брать 1280 вместо 768 (39 226 → 94 144 байт на кадр), то есть ровно
    // тот дефект, против которого писался AC3. Найдено skeptic-ревью, а не этим набором.
    // 780 выбрана внутри полосы: 97vw → 757 → производная 768; 100vw → 780 → производная 1280.
    { name: "планшет 780 (полоса расхождения sizes)", width: 780, height: 1024, maxServed: 768 },
    { name: "tablet 1024", width: 1024, height: 768, maxServed: 1280 },
  ];

  for (const scene of ["overview", "department"] as const) {
    for (const c of cases) {
      test(`${scene} @ ${c.name}: браузер берёт производную не шире ${c.maxServed}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: c.width, height: c.height });
        await page.goto(scene === "overview" ? "/" : `/?department=${sales.id}`);
        if (scene === "overview") await openOverview(page);

        expect(await servedWidth(page)).toBeLessThanOrEqual(c.maxServed);
      });
    }
  }

  // Контрольная точка сверху: без неё проверки выше прошли бы и в вырожденном случае, когда сайт
  // ВСЕГДА отдаёт 768 (тогда «узкий платит меньше» верно, но адаптивности нет). Desktop обязан
  // получать самую широкую производную — только вместе эти два утверждения доказывают srcset.
  test("desktop 1440 получает самую широкую производную — иначе «узкий платит меньше» ничего не значит", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await openOverview(page);
    expect(await servedWidth(page)).toBe(1536);
  });
});

test.describe("Step 15 — сцена отдела на планшете видима, CTA достижима (AC1, AC2)", () => {
  test("tablet 1024: колонка контента не закрывает 90%-область целиком — сцена читается полосой", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`/?department=${sales.id}`);

    const panel = page.getByRole("region", { name: sales.overviewLabel });
    await expect(panel).toBeVisible();

    const areaBox = (await panel.locator("..").boundingBox())!;
    const panelBox = (await panel.boundingBox())!;

    // До Step 15 здесь было ровно 1.0: `max-width` у .experience был scoped на ≥1280px, поэтому на
    // планшете сцена просматривалась только сквозь 10% прозрачности скрима (Step 13, skeptic
    // Phase B, finding 4). Порог 0.92, а не 0.88: 88% — само правило CSS, и проверять его же
    // значение означало бы проверять, что CSS применился, а не что сцена видна.
    const coveredRatio = panelBox.width / areaBox.width;
    expect(
      coveredRatio,
      `контент закрывает ${(coveredRatio * 100).toFixed(1)}% ширины 90%-области`,
    ).toBeLessThanOrEqual(0.92);
  });

  for (const size of [
    { name: "mobile 375", width: 375, height: 812 },
    { name: "tablet 768 портрет", width: 768, height: 1024 },
    { name: "tablet 1024 альбом", width: 1024, height: 768 },
  ]) {
    test(`${size.name}: CTA и «Закрыть» достижимы и не перекрыты сценой`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`/?department=${sales.id}`);

      for (const control of [
        page.getByRole("link", { name: sales.ctaLabel }),
        page.getByRole("button", { name: "Закрыть" }),
      ]) {
        // Панель может скроллиться внутренне на низких высотах (docs/08) — «достижима» значит
        // доступна после прокрутки самой панели, тот же критерий, что в mobile-touch-flow.spec.ts.
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeVisible();

        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        expect(box.height).toBeGreaterThanOrEqual(44);

        // Не просто «видима по CSS», а реально верхний элемент в своей точке: сцена лежит под
        // раскладкой с z-index 0, и перекрытие фотослоем было бы дефектом, который toBeVisible()
        // не поймал бы.
        const topmostIsControl = await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return el.contains(hit) || el === hit;
        });
        expect(topmostIsControl).toBe(true);
      }
    });
  }
});
