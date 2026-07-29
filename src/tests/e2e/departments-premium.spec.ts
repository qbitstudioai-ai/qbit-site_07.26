import { expect, test } from "@playwright/test";
import { getDepartments } from "../../content/departments";

const departments = getDepartments();
const desktopViewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1763, height: 864 },
  { width: 1920, height: 1080 },
];

test.describe("Amendment 31 — premium one-screen departments", () => {
  for (const viewport of desktopViewports) {
    test(`final state has no page or internal scroll at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize(viewport);

      for (const department of departments) {
        await page.goto(`/?department=${department.id}`);
        await expect(page.locator('[data-reveal-stage="complete"]')).toBeVisible();

        const metrics = await page.evaluate(() => {
          const root = document.documentElement;
          const internalOverflow = [...document.querySelectorAll('[data-office-mode="section"] *')]
            .map((element) => {
              const style = getComputedStyle(element);
              return {
                className: element.className?.toString() ?? "",
                overflowX: style.overflowX,
                overflowY: style.overflowY,
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
              };
            })
            .filter(
              (item) =>
                !item.className.includes("accessibleText") &&
                !item.className.includes("statusText") &&
                (item.scrollWidth > item.clientWidth + 1 ||
                  item.scrollHeight > item.clientHeight + 3),
            );

          const cta = document.querySelector<HTMLElement>("[data-customer-benefits] a");
          const ctaRect = cta?.getBoundingClientRect();

          return {
            innerHeight: window.innerHeight,
            clientHeight: root.clientHeight,
            scrollHeight: root.scrollHeight,
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            ctaBottom: ctaRect?.bottom ?? Number.POSITIVE_INFINITY,
            internalOverflow,
          };
        });

        expect(metrics.scrollHeight, department.id).toBe(metrics.clientHeight);
        expect(metrics.scrollWidth, department.id).toBe(metrics.clientWidth);
        expect(metrics.clientHeight, department.id).toBe(metrics.innerHeight);
        expect(metrics.ctaBottom, department.id).toBeLessThanOrEqual(metrics.innerHeight);
        expect(metrics.internalOverflow, department.id).toEqual([]);
      }
    });
  }

  test("all departments and pain→solution pairs stay isolated during fast switching", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1763, height: 864 });
    await page.goto(`/?department=${departments[0].id}`);

    for (const [index, department] of departments.entries()) {
      if (index > 0) {
        await page
          .getByRole("navigation", { name: "Панель отделов" })
          .getByRole("button", { name: department.overviewLabel })
          .click();
      }
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Назад к офису" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Закрыть" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Результат для бизнеса" })).toBeVisible();
      await expect(page.getByRole("link", { name: department.ctaLabel })).toBeVisible();
      await expect(page.locator("[data-customer-benefits]")).toContainText(
        department.customerBenefits[0],
      );
      for (const result of department.customerBenefits) {
        await expect(page.locator("[data-customer-benefits]")).toContainText(result);
      }

      const activeThumbnailScale = await page
        .locator('[aria-current="true"] img')
        .evaluate(
          (image) => new DOMMatrixReadOnly(getComputedStyle(image.parentElement!).transform).a,
        );
      expect(activeThumbnailScale).toBeCloseTo(1.03, 2);

      const panel = page.getByTestId("pain-gain-panel");
      for (const point of department.painPoints) {
        await panel.getByRole("button", { name: point.pain }).click();
        await expect(panel.locator("[data-gain-panel]")).toContainText(point.gain);
        if (point.howItWorks) {
          await expect(panel.locator("[data-gain-panel]")).toContainText("Как работает");
          await expect(panel.locator("[data-gain-panel]")).toContainText(point.howItWorks);
        } else {
          await expect(panel.locator("[data-gain-panel]")).not.toContainText("Как работает");
        }
      }
    }
  });

  test("pain→solution impulse is measured, interruptible, resize-aware and precedes typing", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1763, height: 864 });
    const department = departments.find((candidate) => candidate.id === "sales")!;
    await page.goto(`/?department=${department.id}`);
    const panel = page.getByTestId("pain-gain-panel");
    await expect(panel).toBeVisible();
    await page.waitForTimeout(2200);

    const gain = panel.locator("[data-gain-panel]");
    const painCard = panel.locator("section").first();
    const boxesBefore = {
      panel: (await panel.boundingBox())!,
      pain: (await painCard.boundingBox())!,
      gain: (await gain.boundingBox())!,
    };

    const second = panel.getByRole("button", { name: department.painPoints[1].pain });
    await second.click();
    const firstImpulse = panel.locator("[data-pain-solution-impulse]");
    await expect(firstImpulse).toHaveCount(1);
    await expect(firstImpulse).toHaveAttribute("data-impulse-source", "1");
    const firstRun = Number(await firstImpulse.getAttribute("data-impulse-run"));
    const firstImpulseHandle = await firstImpulse.elementHandle();

    const visibleGlyphs = () =>
      panel
        .locator("[data-typed-visual] > span")
        .evaluateAll(
          (nodes) => nodes.filter((node) => Number(getComputedStyle(node).opacity) > 0.5).length,
        );
    await page.waitForTimeout(520);
    expect(await visibleGlyphs()).toBe(0);
    await expect(panel).toHaveAttribute("data-impulse-state", "arrived");
    await expect.poll(visibleGlyphs, { timeout: 1800 }).toBeGreaterThan(0);

    await panel.getByRole("button", { name: department.painPoints[2].pain }).click();
    await page.waitForTimeout(40);
    await panel.getByRole("button", { name: department.painPoints[4].pain }).click();
    const latestImpulse = panel.locator("[data-pain-solution-impulse]");
    await expect(latestImpulse).toHaveCount(1);
    await expect(latestImpulse).toHaveAttribute("data-impulse-source", "4");
    const latestRun = Number(await latestImpulse.getAttribute("data-impulse-run"));
    expect(latestRun).toBeGreaterThan(firstRun);
    expect(await firstImpulseHandle!.evaluate((node) => node.isConnected)).toBe(false);
    const latestAnimationTimes = await latestImpulse.evaluate((node) =>
      node.getAnimations({ subtree: true }).map((animation) => Number(animation.currentTime)),
    );
    expect(latestAnimationTimes.length).toBeGreaterThan(0);
    expect(Math.max(...latestAnimationTimes)).toBeLessThan(220);

    await panel.getByRole("button", { name: department.painPoints[4].pain }).click();
    await expect(latestImpulse).toHaveAttribute("data-impulse-run", String(latestRun));

    const latestPathBeforeResize = await latestImpulse.locator("path").getAttribute("d");
    await page.setViewportSize({ width: 1600, height: 864 });
    await expect
      .poll(async () => latestImpulse.locator("path").getAttribute("d"))
      .not.toBe(latestPathBeforeResize);

    await expect(panel).toHaveAttribute("data-impulse-state", "idle", { timeout: 2500 });
    await expect(panel.locator("[data-pain-solution-impulse]")).toHaveCount(0);
    await expect(panel.locator("[data-typed-accessible]")).toHaveText(
      department.painPoints[4].gain,
    );

    // Сравниваем геометрию на исходном viewport: новый дословный контент переносится на разное
    // число строк при 1763px и 1600px, поэтому responsive-reflow при resize сам по себе не является
    // layout shift от выбора сценария.
    await page.setViewportSize({ width: 1763, height: 864 });
    await expect
      .poll(async () => (await panel.boundingBox())?.width)
      .toBeCloseTo(boxesBefore.panel.width, 0);

    const boxesAfter = {
      panel: (await panel.boundingBox())!,
      pain: (await painCard.boundingBox())!,
      gain: (await gain.boundingBox())!,
    };
    for (const key of ["height", "y"] as const) {
      expect(Math.abs(boxesAfter.panel[key] - boxesBefore.panel[key])).toBeLessThanOrEqual(4);
      expect(Math.abs(boxesAfter.pain[key] - boxesBefore.pain[key])).toBeLessThanOrEqual(4);
      expect(Math.abs(boxesAfter.gain[key] - boxesBefore.gain[key])).toBeLessThanOrEqual(4);
    }
  });

  test("every department pain transition launches the measured impulse from its own row", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1763, height: 864 });
    await page.goto(`/?department=${departments[0].id}`);

    for (const [departmentIndex, department] of departments.entries()) {
      if (departmentIndex > 0) {
        await page
          .getByRole("navigation")
          .getByRole("button", { name: department.overviewLabel })
          .click();
      }

      const panel = page.getByTestId("pain-gain-panel");
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute("data-impulse-state", "idle", { timeout: 3000 });

      for (let painIndex = 1; painIndex < department.painPoints.length; painIndex += 1) {
        await panel.getByRole("button", { name: department.painPoints[painIndex].pain }).click();
        const impulse = panel.locator("[data-pain-solution-impulse]");
        await expect(impulse).toHaveCount(1);
        await expect(impulse).toHaveAttribute("data-impulse-source", String(painIndex));
      }

      await expect(panel).toHaveAttribute("data-impulse-state", "idle", { timeout: 3000 });
      await expect(panel.locator("[data-typed-accessible]")).toHaveText(
        department.painPoints.at(-1)!.gain,
      );
    }
  });

  test("the shared rail indicator moves to the newly selected department", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1763, height: 864 });
    await page.goto(`/?department=${departments[0].id}`);

    const indicator = page.locator("[data-active-indicator]");
    await expect(indicator).toHaveAttribute("data-ready", "true");
    const initialTransform = await indicator.evaluate((node) => getComputedStyle(node).transform);
    const transitionDuration = await indicator.evaluate(
      (node) => getComputedStyle(node).transitionDuration,
    );
    expect(transitionDuration).toContain("0.42s");

    await page
      .getByRole("navigation")
      .getByRole("button", { name: departments[3].overviewLabel })
      .click();

    await expect
      .poll(async () => indicator.evaluate((node) => getComputedStyle(node).transform))
      .not.toBe(initialTransform);
    await expect(
      page.locator('li[aria-current="true"]', { hasText: departments[3].overviewLabel }),
    ).toBeVisible();
  });

  test("surface hierarchy, result typography and task affordance stay subtle and stable", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/?department=${departments[0].id}`);
    await expect(page.locator('[data-reveal-stage="complete"]')).toBeVisible();

    const heading = page.getByRole("heading", {
      level: 2,
      name: departments[0].headline,
    });
    const copy = heading.locator("..");
    const panel = page.getByTestId("pain-gain-panel");
    const pain = panel.locator("section").first();
    const gain = panel.locator("[data-gain-panel]");
    const result = page.locator("[data-customer-benefits] > div");
    const primary = result.locator("h3 + p");
    const highlights = result.locator("ul");
    const task = page.locator('nav li[class*="taskItem"] button');
    const activeDepartment = page.locator('nav li[aria-current="true"] > span');

    const surfaceBackgrounds = await Promise.all(
      [copy, pain, gain, result].map((locator) =>
        locator.evaluate((node) => getComputedStyle(node).backgroundImage),
      ),
    );
    expect(new Set(surfaceBackgrounds).size).toBe(4);

    await expect(primary).toHaveCSS("font-size", "12px");
    await expect(highlights).toHaveCSS("font-size", "11px");
    await expect(task).toHaveCSS("min-height", "44px");
    await expect(page.getByRole("button", { name: "Ваша задача", exact: true })).toHaveCount(1);

    const taskState = await task.evaluate((node) => {
      const style = getComputedStyle(node);
      const arrow = getComputedStyle(node, "::after");
      return {
        borderAlpha: Number(style.borderColor.match(/[\d.]+(?=\))/)?.[0] ?? 1),
        arrowContent: arrow.content,
        arrowWidth: arrow.width,
        arrowTransform: arrow.transform,
        arrowX: new DOMMatrixReadOnly(arrow.transform).m41,
      };
    });
    const activeBorderAlpha = await activeDepartment.evaluate((node) =>
      Number(getComputedStyle(node).borderColor.match(/[\d.]+(?=\))/)?.[0] ?? 1),
    );
    expect(taskState.arrowContent).toBe('""');
    expect(taskState.arrowWidth).toBe("14px");
    expect(taskState.borderAlpha).toBeLessThan(activeBorderAlpha);

    const taskBoxBefore = (await task.boundingBox())!;
    const arrowXBefore = taskState.arrowX;
    await task.hover();
    const taskBoxAfter = (await task.boundingBox())!;
    const arrowXAfter = await task.evaluate(
      (node) => new DOMMatrixReadOnly(getComputedStyle(node, "::after").transform).m41,
    );
    expect(Math.abs(taskBoxAfter.x - taskBoxBefore.x)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(taskBoxAfter.width - taskBoxBefore.width)).toBeLessThanOrEqual(0.1);
    expect(arrowXAfter - arrowXBefore).toBeCloseTo(2, 1);

    await expect(result).toHaveCSS("height", "120px");
  });

  test("reduced motion removes the directed impulse and typing sequence", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1763, height: 864 });
    const department = departments.find((candidate) => candidate.id === "sales")!;
    await page.goto(`/?department=${department.id}`);
    const panel = page.getByTestId("pain-gain-panel");
    const target = department.painPoints[2];
    await panel.getByRole("button", { name: target.pain }).click();

    await expect(panel.locator("[data-pain-solution-impulse]")).toHaveCount(0);
    await expect(panel.locator("[data-gain-panel] p")).toHaveText(target.gain);
    await expect(panel.locator("[data-typed-visual], [data-typed-accessible]")).toHaveCount(0);
  });
});
