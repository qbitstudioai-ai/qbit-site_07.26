import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

// Tablet 768–1279px (WORKPLAN.md Step 7.5) — в отличие от Mobile (карусель), здесь сохраняется та же
// пространственная карта офиса и та же 10/90-подобная раскладка, что на Desktop, только с более
// широким rail. Интерактивность до касания обозначают название, chevron и угловые маркеры:
// пояснение не обязано быть постоянно раскрыто. hasTouch без isMobile: диапазон определяется CSS-шириной
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
  test("AC1: overview renders the spatial office map, not the removed mobile carousel", async ({
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
    await expect(page.getByRole("navigation", { name: "Карусель отделов" })).toHaveCount(0);
  });

  // Оба края диапазона, а не только 1024: правило CSS общее для 768–1279, но "общее по построению"
  // — это допущение, а проверка обязана быть измерением (WORKPLAN.md Step 7.5, Risks).
  for (const width of [768, 1279]) {
    test(`AC2: at ${width}px, every hotspot exposes its name, chevron, corner markers and accessible description without relying on hover`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1024 });
      await page.goto("/");
      await activateCta(page);

      const map = page.getByRole("navigation", { name: "Отделы компании" });
      for (const department of departments) {
        const hotspot = map.getByRole("button", { name: department.overviewLabel });
        const problem = map.locator(`#department-problem-${department.id}`);
        await expect(problem).toContainText(department.hoverDescription);
        await expect(hotspot.locator("[data-corner-marker]")).toHaveCount(4);
        await expect(hotspot.getByText("›")).toBeVisible();
        await expect(hotspot).toHaveAttribute(
          "aria-describedby",
          `department-problem-${department.id}`,
        );

        // Touch открывает отдел одним нажатием; пояснение остаётся в доступном описании, но
        // визуально не превращает карту в пять постоянно раскрытых карточек.
        const opacity = await problem.evaluate((el) => Number(getComputedStyle(el).opacity));
        expect(opacity, `${department.id} opacity at ${width}px`).toBe(0);
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
    // Колонка сетки (.mainArea), а не панель отдела внутри неё — см. пояснение в
    // desktop-10x90-shell.spec.ts: со Step 13 панель занимает лишь часть колонки, остальное — сцена.
    const mainBox = await page
      .getByRole("region", { name: sales.overviewLabel })
      .locator("..")
      .boundingBox();
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
    // Колонка сетки, а не панель внутри неё (Step 13) — доля рельса считается от раскладки 10/90.
    // По панели доля была бы завышена: на ≥1280px панель ограничена 46% колонки (Amendment 8), и
    // сравнение «планшет шире desktop» сравнивало бы ширину карточек, а не ширину рельса.
    const mainLocator = page.getByRole("region", { name: sales.overviewLabel }).locator("..");

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

    // 767px — Mobile: со Step 15 / Amendment 13 это единственная ширина, где видимы ОБА обзора —
    // сцена с зонами и карусель под ней (мобильный путь docs/03 «обзор, карусель…»). Прежняя
    // редакция требовала здесь `map` toBeHidden(); утверждение изменено вслед за поведением, а не
    // ослаблено — карусель по-прежнему обязана быть видимой ровно на этой стороне порога.
    await page.setViewportSize({ width: 767, height: 800 });
    await page.goto("/");
    await activateCta(page);
    await expect(map).toBeVisible();
    await expect(carousel).toHaveCount(0);

    // 768px — Tablet: карта, карусель скрыта.
    await page.setViewportSize({ width: 768, height: 800 });
    await expect(map).toBeVisible();
    await expect(carousel).toHaveCount(0);

    // 1279px — всё ещё Tablet.
    await page.setViewportSize({ width: 1279, height: 800 });
    await expect(map).toBeVisible();
    await expect(carousel).toHaveCount(0);

    // 1280px — Desktop: карта остаётся; пояснение так же раскрывается только при hover/focus.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(map).toBeVisible();
    await expect(carousel).toHaveCount(0);
    const problem = map.locator(`#department-problem-${sales.id}`);
    const settledOpacity = () => problem.evaluate((el) => Number(getComputedStyle(el).opacity));
    await expect.poll(settledOpacity).toBe(0);

    // 1279px — Tablet: пояснение тоже спокойно скрыто; интерактивность несут chevron и углы.
    await page.setViewportSize({ width: 1279, height: 800 });
    await expect.poll(settledOpacity).toBe(0);
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

    await page.getByRole("button", { name: "Назад к офису" }).tap();
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

  test("AC9: keyboard — Tab order is [5 pain points, CTA, Back, rail items]", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    await expect(page.getByRole("button", { name: "Назад к офису" })).toBeFocused();

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
    await page.getByRole("button", { name: "Назад к офису" }).tap();
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
      await page.emulateMedia({ reducedMotion: "reduce" });
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

      const closeBox = await page.getByRole("button", { name: "Назад к офису" }).boundingBox();
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
