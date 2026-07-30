import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";

const copy = getHomepageCopy();

test.describe("Amendment 28 — кейсы в hero", () => {
  test("desktop 1920×920: оффер, visual, сценарии и P.S. образуют один слой без прокрутки", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 920 });
    await page.goto("/");

    await expect(page.getByText(copy.eyebrow)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: copy.headline })).toBeVisible();
    await expect(page.getByRole("link", { name: copy.primaryCta })).toBeVisible();
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: copy.heroInfoPanel.title }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: copy.heroInfoPanel.postscript.ariaLabel }),
    ).toBeVisible();
    const heroImage = page.getByRole("img", { name: /переход от ручного хаоса/i });
    await expect
      .poll(() => heroImage.evaluate((image: HTMLImageElement) => image.currentSrc))
      .toMatch(/hero-chaos-office-1536\./);

    const headline = page.getByRole("heading", { level: 1, name: copy.headline });
    const headlineBox = (await headline.boundingBox())!;
    const imageBox = (await heroImage.boundingBox())!;
    const scenarioPanel = page.locator("[data-project-scenarios]");
    const scenarioPanelBox = (await scenarioPanel.boundingBox())!;
    const postscriptBox = (await page.locator("[data-project-postscript]").boundingBox())!;
    const headlineLines = await headline.evaluate((node) => {
      const style = getComputedStyle(node);
      return node.getBoundingClientRect().height / Number.parseFloat(style.lineHeight);
    });

    expect(headlineLines).toBeLessThanOrEqual(4.05);
    expect(headlineBox.x + headlineBox.width - imageBox.x).toBeGreaterThan(50);
    expect(scenarioPanelBox.x).toBeLessThan(imageBox.x + imageBox.width);
    expect(scenarioPanelBox.y).toBeGreaterThan(imageBox.y);
    expect(postscriptBox.y + postscriptBox.height).toBeLessThan(imageBox.y + imageBox.height);

    const visualTreatment = await heroImage.locator("..").evaluate((picture) => ({
      maskImage: getComputedStyle(picture).maskImage,
      webkitMaskImage: getComputedStyle(picture).webkitMaskImage,
    }));
    expect(visualTreatment.maskImage !== "none" || visualTreatment.webkitMaskImage !== "none").toBe(
      true,
    );

    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      internalOverflow: Array.from(
        document.querySelectorAll("[data-project-scenarios], [data-project-scenario]"),
      ).some(
        (node) => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth,
      ),
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.innerHeight);
    expect(geometry.internalOverflow).toBe(false);
  });

  test("all three cases are visible and explicitly marked as anonymized results", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 2, name: "РЕАЛЬНЫЕ КЕЙСЫ" })).toBeVisible();
    await expect(page.getByText("Обезличенные результаты внедрений")).toBeVisible();
    for (const scenario of copy.heroInfoPanel.scenarios) {
      await expect(page.getByRole("heading", { level: 3, name: scenario.title })).toBeVisible();
      await expect(page.getByText(scenario.metric, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByText(copy.heroInfoPanel.scenarios[0].effectLabel, { exact: true }),
    ).toHaveCount(3);
    await expect(page.getByText("рост продаж", { exact: true })).toBeVisible();
    await expect(page.getByText("раньше занимал ручной анализ", { exact: true })).toBeVisible();

    for (const removed of [
      "ПРОЕКТНЫЕ СЦЕНАРИИ",
      "расчётный бизнес-эффект",
      "РАСЧЁТНЫЙ ЭФФЕКТ ДЛЯ РУКОВОДИТЕЛЯ",
      "потенциальной выручки",
      "РАСЧЁТНЫЙ ПОТЕНЦИАЛ НА ОСНОВЕ ДАННЫХ CRM",
      "примерно за 15 минут в неделю",
    ]) {
      await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
    }
  });

  test("P.S. is a lightweight editorial Telegram link with an inline arrow", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 920 });
    await page.goto("/");

    const postscript = page.locator("[data-project-postscript]");
    const arrow = postscript.getByText("→", { exact: true });
    const treatment = await postscript.evaluate((node) => {
      const style = getComputedStyle(node);
      const line = getComputedStyle(node, "::before");
      const bounds = node.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        borderWidths: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ],
        whiteSpace: style.whiteSpace,
        width: bounds.width,
        lineWidth: line.width,
        lineBackground: line.backgroundColor,
      };
    });

    expect(treatment.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(treatment.backgroundImage).toBe("none");
    expect(treatment.boxShadow).toBe("none");
    expect(treatment.borderWidths).toEqual(["0px", "0px", "0px", "0px"]);
    expect(treatment.whiteSpace).toBe("normal");
    expect(treatment.width).toBeLessThan(810);
    expect(treatment.lineWidth).toBe("2px");
    expect(treatment.lineBackground).not.toBe("rgba(0, 0, 0, 0)");
    await expect(arrow).toBeVisible();
    await expect(postscript).not.toContainText("↗");

    await postscript.hover();
    expect(await arrow.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");

    await postscript.focus();
    expect(await postscript.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
  });

  test("problem markers и нижняя flow-панель полностью удалены из DOM", async ({ page }) => {
    await page.goto("/");

    for (const removedMarker of [
      "Заявки теряются",
      "Данные переносят вручную",
      "Отчёты собирают вручную",
    ]) {
      await expect(page.getByText(removedMarker)).toHaveCount(0);
    }
    await expect(page.getByText("Как работает автоматизация")).toHaveCount(0);
    await expect(page.getByText("задача сотруднику")).toHaveCount(0);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    test(`${viewport.width}px: порядок copy → visual → scenarios и отсутствие горизонтального scroll`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const headingBox = await page.getByRole("heading", { level: 1 }).boundingBox();
      const imageBox = await page
        .getByRole("img", { name: /переход от ручного хаоса/i })
        .boundingBox();
      const panelBox = await page.locator("[data-project-scenarios]").boundingBox();

      expect(headingBox).not.toBeNull();
      expect(imageBox).not.toBeNull();
      expect(panelBox).not.toBeNull();

      if (viewport.width < 1200) {
        expect(headingBox!.y).toBeLessThan(imageBox!.y);
        expect(imageBox!.y).toBeLessThan(panelBox!.y);
      }

      const horizontal = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(horizontal.scrollWidth).toBeLessThanOrEqual(horizontal.innerWidth);
    });
  }

  test("mobile: all benefits precede the primary and secondary CTAs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const primary = (await page.getByRole("link", { name: copy.primaryCta }).boundingBox())!;
    const secondary = (await page.getByRole("link", { name: copy.secondaryCta }).boundingBox())!;
    const lastBenefit = (await page.getByText(copy.valuePoints.at(-1)!).boundingBox())!;

    expect(lastBenefit.y + lastBenefit.height).toBeLessThan(primary.y);
    expect(primary.y).toBeLessThan(secondary.y);
  });

  test("карта процессов использует существующий переход в офис, коммерческие CTA — Telegram", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: copy.primaryCta })).toHaveAttribute(
      "href",
      copy.contactHref,
    );
    const headerPhone = page.getByRole("link", { name: copy.headerPhoneAccessibleLabel });
    await expect(headerPhone).toHaveAttribute("href", copy.headerPhoneHref);
    await expect(headerPhone).toHaveText(copy.headerPhone);
    await expect(
      page.getByRole("link", { name: copy.heroInfoPanel.postscript.ariaLabel }),
    ).toHaveAttribute("href", copy.contactHref);

    await page.getByRole("link", { name: copy.secondaryCta }).click();
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
  });

  test("prefers-reduced-motion keeps the hero image, scenarios and P.S. static", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const animatedDecorations = await page
      .locator(
        "figure picture, [data-project-scenarios], [data-project-scenario], [data-project-postscript]",
      )
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
    expect(animatedDecorations.every((name) => name === "none")).toBe(true);

    const postscript = page.locator("[data-project-postscript]");
    await postscript.hover();
    const postscriptMotion = await postscript.evaluate((node) => ({
      durations: [
        getComputedStyle(node).transitionDuration,
        getComputedStyle(node, "::before").transitionDuration,
        getComputedStyle(node.querySelector("[aria-hidden='true']")!).transitionDuration,
      ],
      lineTransform: getComputedStyle(node, "::before").transform,
      arrowTransform: getComputedStyle(node.querySelector("[aria-hidden='true']")!).transform,
    }));
    expect(
      postscriptMotion.durations.every((duration) => Number.parseFloat(duration) <= 0.000001),
    ).toBe(true);
    expect(postscriptMotion.lineTransform).toBe("none");
    expect(postscriptMotion.arrowTransform).toBe("none");
  });
});
