import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

// Tablet 768–1279px (WORKPLAN.md Step 7.5) — в отличие от Mobile (карусель), здесь сохраняется та же
// пространственная карта офиса и та же 10/90-подобная раскладка, что на Desktop, только с более
// широким rail и без hover-gating. hasTouch без isMobile: диапазон определяется CSS-шириной
// viewport, а не meta viewport (тот же принцип, что в Steps 3–7).
test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

const departments = getDepartments();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

// Тот же порядок, что в OfficeExperience.tsx/OfficeSemanticMap.tsx (сортировка зон по y, затем x).
const sortedDepartments = getOfficeZones()
  .slice()
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .map((zone) => departments.find((d) => d.id === zone.departmentId)!);

const otherDepartmentsInRailOrder = sortedDepartments.filter((d) => d.id !== sales.id);

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).tap();
}

async function openSalesFromMap(page: import("@playwright/test").Page) {
  const map = page.getByRole("navigation", { name: "Отделы компании" });
  await map.getByRole("button", { name: sales.overviewLabel }).tap();
  await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeVisible();
}

test.describe("tablet touch flow (768–1279px, Step 7.5)", () => {
  test("AC1: overview renders the spatial office map, not the mobile carousel (which is out of the a11y tree)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);

    const map = page.getByRole("navigation", { name: "Отделы компании" });
    await expect(map).toBeVisible();
    for (const department of departments) {
      await expect(map.getByRole("button", { name: department.overviewLabel })).toBeVisible();
    }

    // Карусель скрыта через display:none на ≥768px — реально убрана из дерева доступности.
    await expect(page.getByRole("navigation", { name: "Карусель отделов" })).toBeHidden();
  });

  // Оба края диапазона, а не только 1024: правило CSS общее для 768–1279, но "общее по построению"
  // — это допущение, а проверка обязана быть измерением (WORKPLAN.md Step 7.5, Risks).
  for (const width of [768, 1279]) {
    test(`AC2: at ${width}px, overviewProblem is visible and fully readable for every hotspot without hover or focus (touch does not guarantee hover)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1024 });
      await page.goto("/");
      await activateCta(page);

      const map = page.getByRole("navigation", { name: "Отделы компании" });
      for (const department of departments) {
        const problem = map.locator(`#department-problem-${department.id}`);
        await expect(problem).toHaveText(department.overviewProblem);
        await expect(problem).toBeVisible();

        // opacity/max-height — тот самый механизм hover-gating (Step 3), снятый этим шагом.
        const opacity = await problem.evaluate((el) => Number(getComputedStyle(el).opacity));
        expect(opacity, `${department.id} opacity at ${width}px`).toBe(1);

        // max-height: 4rem + overflow: hidden у .hotspot — раскрытый текст обязан помещаться
        // целиком, а не быть молча обрезанным на узком портретном планшете.
        const clipped = await problem.evaluate((el) => el.scrollHeight > el.clientHeight);
        expect(clipped, `${department.id} problem text clipped at ${width}px`).toBe(false);
      }
    });
  }

  test("AC12: the interaction hint is not visible on tablet (unconditional rule from Step 7.2, Amendment 5)", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    await page.goto("/");
    await activateCta(page);

    await expect(page.getByText(copy.interactionHint)).toBeHidden();
  });

  test("AC3: tapping a hotspot opens the department and keeps both columns (main + rail), not a single column like mobile", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await openSalesFromMap(page);

    const railBox = await page.getByRole("navigation", { name: "Панель отделов" }).boundingBox();
    const mainBox = await page.getByRole("region", { name: sales.overviewLabel }).boundingBox();
    expect(railBox).not.toBeNull();
    expect(mainBox).not.toBeNull();

    // Обе колонки присутствуют, rail визуально слева от main (grid-template-areas "rail main").
    expect(railBox!.x).toBeLessThan(mainBox!.x);
    const totalWidth = railBox!.width + mainBox!.width;
    expect(mainBox!.width / totalWidth).toBeGreaterThan(0.7);
  });

  test("AC4/AC11: the rail column is measurably wider on tablet than on desktop — at 1279px vs 1280px (adjacent widths, absolute px) and as a share of the shell", async ({
    page,
  }) => {
    const railLocator = page.getByRole("navigation", { name: "Панель отделов" });
    const mainLocator = page.getByRole("region", { name: sales.overviewLabel });

    async function measureAt(width: number) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/?department=${sales.id}`);
      const railBox = await railLocator.boundingBox();
      const mainBox = await mainLocator.boundingBox();
      expect(railBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      return {
        rail: railBox!.width,
        share: railBox!.width / (railBox!.width + mainBox!.width),
      };
    }

    // 1279 vs 1280 — соседние ширины, поэтому разница в абсолютных px не может объясняться
    // разницей самого viewport: она доказывает именно смену правила grid-template-columns.
    const tabletEdge = await measureAt(1279);
    const desktopEdge = await measureAt(1280);
    expect(tabletEdge.rail).toBeGreaterThan(desktopEdge.rail);
    expect(tabletEdge.share).toBeGreaterThan(desktopEdge.share);

    // 768px — противоположный край диапазона: rail шире desktop-доли и не уже floor 180px.
    const tabletNarrow = await measureAt(768);
    expect(tabletNarrow.share).toBeGreaterThan(desktopEdge.share);
    expect(tabletNarrow.rail).toBeGreaterThanOrEqual(180);
  });

  test("AC11: boundary widths 767/768/1279/1280 each activate exactly one layout — no gap, no overlap", async ({
    page,
  }) => {
    const map = page.getByRole("navigation", { name: "Отделы компании" });
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });

    // 767px — Mobile: карусель, карта скрыта.
    await page.setViewportSize({ width: 767, height: 800 });
    await page.goto("/");
    await activateCta(page);
    await expect(carousel).toBeVisible();
    await expect(map).toBeHidden();

    // 768px — Tablet: карта, карусель скрыта.
    await page.setViewportSize({ width: 768, height: 800 });
    await expect(map).toBeVisible();
    await expect(carousel).toBeHidden();

    // 1279px — всё ещё Tablet.
    await page.setViewportSize({ width: 1279, height: 800 });
    await expect(map).toBeVisible();
    await expect(carousel).toBeHidden();

    // 1280px — Desktop: карта остаётся, hover-gating .problem возвращается (в отличие от Tablet).
    // expect.poll, а не единичное чтение: у .problem есть transition opacity 0.15s (Step 3), поэтому
    // сразу после resize computed-значение застаётся на полпути (измерено: 0.887) — опрашивается
    // именно осевшее состояние, ослабления проверки здесь нет.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(map).toBeVisible();
    await expect(carousel).toBeHidden();
    const problem = map.locator(`#department-problem-${sales.id}`);
    const settledOpacity = () => problem.evaluate((el) => Number(getComputedStyle(el).opacity));
    await expect.poll(settledOpacity).toBe(0);

    // 1279px — та же подсказка раскрыта без hover: правило действительно ограничено диапазоном.
    await page.setViewportSize({ width: 1279, height: 800 });
    await expect.poll(settledOpacity).toBe(1);
  });

  test("AC5: tapping a rail item switches the department directly — no intermediate overview, no full reload", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await openSalesFromMap(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).tap();

    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe(hr.id);
    // Overview (карта) не показывался между двумя отделами.
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);

    const markerSurvived = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
    );
    expect(markerSurvived).toBe(true);
  });

  test("AC6: the explicit Close button returns to overview; Escape has an identical effect", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await openSalesFromMap(page);

    await page.getByRole("button", { name: "Закрыть" }).tap();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();

    await openSalesFromMap(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
  });

  test("direct ?department=<id> opens that department immediately on a tablet viewport, for all 5 ids", async ({
    page,
  }) => {
    for (const department of departments) {
      await page.goto(`/?department=${department.id}`);
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Панель отделов" })).toBeVisible();
    }
  });

  test("AC9: keyboard — Tab order is [5 pain points, CTA, Close, 4 rail items], identical to desktop, confirmed at tablet width", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await openSalesFromMap(page);
    // Заголовок получает программный focus сразу после открытия (docs/05 department-opening).
    await expect(page.getByRole("heading", { level: 2, name: sales.headline })).toBeFocused();

    const panel = page.getByTestId("pain-gain-panel");
    for (const point of sales.painPoints) {
      await page.keyboard.press("Tab");
      await expect(panel.getByRole("button", { name: point.pain })).toBeFocused();
    }

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: sales.ctaLabel })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Закрыть" })).toBeFocused();

    for (const department of otherDepartmentsInRailOrder) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: department.overviewLabel })).toBeFocused();
    }
  });

  test("AC10: prefers-reduced-motion — the full tablet flow (open, switch, close) stays functional", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    await openSalesFromMap(page);

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).tap();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();

    const railBox = await rail.boundingBox();
    const mainBox = await page.getByRole("region", { name: hr.overviewLabel }).boundingBox();
    expect(railBox!.width).toBeLessThan(mainBox!.width);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  test("AC16: no console/hydration-mismatch errors across the full tablet flow (production build)", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));
    page.on("pageerror", (err) => messages.push(err.message));

    await page.goto("/");
    await activateCta(page);
    await openSalesFromMap(page);
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).tap();
    await page.getByRole("button", { name: "Закрыть" }).tap();
    await page.goto("/?department=logistics");
    await page.goto("/?department=does-not-exist");

    const suspicious = messages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });
});

// AC7/AC8 на характерных Tablet-размерах (WORKPLAN.md Step 7.5 Manual checks: iPad портрет 768×1024,
// iPad альбом 1024×768, крайняя узкая 768px, узко-низкая 1024×600). Это автоматизированные
// Chromium-проверки на тех же размерах, а не живой проход в Chrome DevTools device toolbar —
// фиксируется честно как таковое (тот же прецедент, что Step 7).
test.describe("tablet tap targets and no-document-scroll at characteristic sizes (AC7, AC8)", () => {
  test.use({ hasTouch: true });

  const sizes = [
    { name: "iPad portrait", width: 768, height: 1024 },
    { name: "iPad landscape", width: 1024, height: 768 },
    { name: "wide tablet edge", width: 1279, height: 800 },
  ];

  for (const size of sizes) {
    test(`AC7: ${size.name} (${size.width}x${size.height}) — hotspots, rail items, CTA and Close are all at least 44x44 CSS px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await activateCta(page);

      const map = page.getByRole("navigation", { name: "Отделы компании" });
      for (const department of departments) {
        const box = await map.getByRole("button", { name: department.overviewLabel }).boundingBox();
        expect(box, `hotspot ${department.id}`).not.toBeNull();
        expect(box!.width, `hotspot ${department.id} width`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `hotspot ${department.id} height`).toBeGreaterThanOrEqual(44);
      }

      await openSalesFromMap(page);

      const rail = page.getByRole("navigation", { name: "Панель отделов" });
      for (const button of await rail.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      const ctaBox = await page.getByRole("link", { name: sales.ctaLabel }).boundingBox();
      expect(ctaBox).not.toBeNull();
      expect(ctaBox!.width).toBeGreaterThanOrEqual(44);
      expect(ctaBox!.height).toBeGreaterThanOrEqual(44);

      const closeBox = await page.getByRole("button", { name: "Закрыть" }).boundingBox();
      expect(closeBox).not.toBeNull();
      expect(closeBox!.width).toBeGreaterThanOrEqual(44);
      expect(closeBox!.height).toBeGreaterThanOrEqual(44);

      // Пункты боли в PainGainPanel — тоже тап-таргеты на touch-планшете.
      const panel = page.getByTestId("pain-gain-panel");
      for (const button of await panel.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }

  const scrollSizes = [
    { name: "iPad portrait", width: 768, height: 1024 },
    { name: "iPad landscape", width: 1024, height: 768 },
    // Узко-низкая комбинация: переполнение обязано уходить во внутренний скролл панели, а не в
    // скролл документа (инвариант .shell overflow:hidden, Steps 3–6).
    { name: "narrow and low", width: 1024, height: 600 },
  ];

  for (const size of scrollSizes) {
    test(`AC8: ${size.name} (${size.width}x${size.height}) — no document scroll across hero/overview/department-active`, async ({
      page,
    }) => {
      async function expectNoDocumentScroll() {
        const { scrollWidth, scrollHeight, innerWidth, innerHeight } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
        expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
      }

      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await expectNoDocumentScroll();
      await activateCta(page);
      await expectNoDocumentScroll();
      await openSalesFromMap(page);
      await expectNoDocumentScroll();
    });
  }
});
