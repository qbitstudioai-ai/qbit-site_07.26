import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).click();
}

const departments = getDepartments();
const officeZones = getOfficeZones();
const sales = departments.find((d) => d.id === "sales")!;
const hr = departments.find((d) => d.id === "hr")!;

// Тот же порядок, что и в OfficeExperience.tsx/OfficeSemanticMap.tsx (сортировка зон по y, затем
// x) — используется, чтобы предсказать Tab-порядок оставшихся 4 элементов rail.
const otherDepartmentsInRailOrder = officeZones
  .slice()
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .map((zone) => departments.find((d) => d.id === zone.departmentId)!)
  .filter((department) => department.id !== "sales");

test.describe("desktop 10/90 shell (Step 6)", () => {
  test("active department occupies the majority of the width, the rail a minority, rail visually to the left (docs/03 'Левая панель 10–14%')", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const railBox = await page.getByRole("navigation", { name: "Панель отделов" }).boundingBox();
    // Со Step 13 (Amendment 8) меряется ИМЕННО КОЛОНКА СЕТКИ (.mainArea — родитель панели отдела), а
    // не сама панель. Раньше это было одно и то же: панель растягивалась на всю колонку. Теперь
    // панель — компактная колонка карточек ≤46% ширины, а остальное занимает открытая сцена отдела,
    // поэтому измерение по панели проверяло бы не раскладку 10/90, а ширину карточек.
    // Сам инвариант 10/90 не изменился и проверяется здесь по-прежнему.
    const mainBox = await page
      .getByRole("region", { name: sales.overviewLabel })
      .locator("..")
      .boundingBox();
    expect(railBox).not.toBeNull();
    expect(mainBox).not.toBeNull();

    const totalWidth = railBox!.width + mainBox!.width;
    expect(railBox!.width / totalWidth).toBeGreaterThan(0.05);
    expect(railBox!.width / totalWidth).toBeLessThan(0.2);
    expect(mainBox!.width / totalWidth).toBeGreaterThan(0.75);
    expect(railBox!.x).toBeLessThan(mainBox!.x);
  });

  test("switching via the rail keeps the 10/90 shell: no full reload, URL updates, overview is never shown in between", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();

    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe("hr");
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);
  });

  test("Tab order while a department is active: 5 pain points, delayed CTA, Back, then rail items", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
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

  test("clicking a pain point in PainGainPanel shows its gain, defaulting to the first pain point on open (Step 7.3, OQ-P2)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const panel = page.getByTestId("pain-gain-panel");
    // Amendment 12: пояснение состоит из двух слоёв (видимые глифы + доступная копия), поэтому
    // getByText нашёл бы два узла. Целимся в видимый слой и сверяем текст целиком — это строже
    // прежнего «узел с таким текстом виден».
    const gainText = panel.locator("p[aria-live] [data-typed-visual]");
    await expect(gainText).toBeVisible();
    await expect(gainText).toHaveText(sales.painPoints[0].gain);

    const thirdPain = sales.painPoints[2];
    await panel.getByRole("button", { name: thirdPain.pain }).click();
    await expect(gainText).toHaveText(thirdPain.gain);
    // И прежнее пояснение действительно ушло, а не осталось рядом.
    await expect(gainText).not.toHaveText(sales.painPoints[0].gain);
  });

  test("switching departments via the rail resets the pain/gain selection back to the first pain point (Step 7.3, OQ-P2/OQ-P3)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const panel = page.getByTestId("pain-gain-panel");
    // Видимый слой пояснения (Amendment 12) — см. пояснение в тесте выше.
    const gainText = panel.locator("p[aria-live] [data-typed-visual]");
    await panel.getByRole("button", { name: sales.painPoints[2].pain }).click();
    await expect(gainText).toHaveText(sales.painPoints[2].gain);

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();

    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    await expect(gainText).toHaveText(hr.painPoints[0].gain);
  });

  test("the active department is marked in the rail not only by color: aria-current is present in the live DOM", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const current = page.locator('[aria-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(sales.overviewLabel);
  });

  test("required minimum desktop keeps heading and Back visible without document scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const heading = page.getByRole("heading", { level: 2, name: sales.headline });
    const headingBox = await heading.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(headingBox!.y).toBeGreaterThanOrEqual(0);
    expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(768);

    const backButton = page.getByRole("button", { name: "Назад к офису" });
    const backBox = await backButton.boundingBox();
    expect(backBox).not.toBeNull();
    expect(backBox!.y).toBeGreaterThanOrEqual(0);
    expect(backBox!.y + backBox!.height).toBeLessThanOrEqual(768);

    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
  });

  test("prefers-reduced-motion: rail switching stays functional, geometry regression", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();

    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();

    const railBox = await page.getByRole("navigation", { name: "Панель отделов" }).boundingBox();
    const mainBox = await page.getByRole("region", { name: hr.overviewLabel }).boundingBox();
    expect(railBox!.width).toBeLessThan(mainBox!.width);
  });

  test("breakpoint boundary 767/768px: accordion active at 767px, side-by-side panel active at 768px (Step 7.3, OQ-P6)", async ({
    page,
  }) => {
    await page.goto("/?department=sales");

    await page.setViewportSize({ width: 767, height: 800 });
    await expect(page.getByTestId("mobile-pain-gain-accordion")).toBeVisible();
    await expect(page.getByTestId("pain-gain-panel")).toBeHidden();

    await page.setViewportSize({ width: 768, height: 800 });
    await expect(page.getByTestId("pain-gain-panel")).toBeVisible();
    await expect(page.getByTestId("mobile-pain-gain-accordion")).toBeHidden();
  });

  test("no console/hydration-mismatch errors across open/switch/close/direct-URL with the 10/90 shell (production build)", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));
    page.on("pageerror", (err) => messages.push(err.message));

    await page.goto("/");
    await activateCta(page);
    const nav = page.getByRole("navigation", { name: "Отделы компании" });
    await nav.getByRole("button", { name: sales.overviewLabel }).click();
    const rail = page.getByRole("navigation", { name: "Панель отделов" });
    await rail.getByRole("button", { name: hr.overviewLabel }).click();
    await page.getByRole("button", { name: "Назад к офису" }).click();
    await page.goto("/?department=logistics");

    const suspicious = messages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });
});
