import { expect, test } from "@playwright/test";
import { getDepartments } from "../../content/departments";
import { getHomepageCopy } from "../../content/homepage-copy";

const copy = getHomepageCopy();

async function openOverview(page: import("@playwright/test").Page) {
  await page.goto("/?department=invalid");
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

test.describe("office overview redesign", () => {
  test("keeps the full homepage header in overview and department states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOverview(page);

    const mainNavigation = page.getByRole("navigation", { name: "Основная навигация" });
    await expect(mainNavigation).toBeVisible();
    expect(await mainNavigation.locator("a").allTextContents()).toEqual(
      copy.heroLinks.map((link) => link.label),
    );
    for (const link of copy.heroLinks) {
      await expect(mainNavigation.getByRole("link", { name: link.label })).toBeVisible();
    }
    const headerPhone = page.getByRole("link", { name: copy.headerPhoneAccessibleLabel });
    await expect(headerPhone).toHaveAttribute("href", copy.headerPhoneHref);
    await expect(headerPhone).toHaveText(copy.headerPhone);

    const sales = getDepartments().find((department) => department.id === "sales")!;
    await page.getByRole("button", { name: sales.overviewLabel }).click();
    await expect(page.getByRole("heading", { name: sales.headline })).toBeVisible();
    await expect(mainNavigation).toBeVisible();
    await expect(headerPhone).toBeVisible();
  });

  test("keeps the phone visible and exposes all seven links in the mobile menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const phone = page.getByRole("link", { name: copy.headerPhoneAccessibleLabel });
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute("href", copy.headerPhoneHref);
    const phoneBox = await phone.boundingBox();
    expect(phoneBox).not.toBeNull();
    expect(phoneBox!.height).toBeGreaterThanOrEqual(44);

    const navigation = page.getByRole("navigation", { name: "Основная навигация" });
    await expect(navigation).toBeHidden();

    const menuButton = page.locator('button[aria-controls="site-navigation"]');
    await expect(menuButton).toHaveAccessibleName("Открыть меню");
    await menuButton.click();
    await expect(navigation).toBeVisible();
    expect(await navigation.locator("a").allTextContents()).toEqual(
      copy.heroLinks.map((link) => link.label),
    );
    for (const link of copy.heroLinks) {
      const linkElement = navigation.getByRole("link", { name: link.label });
      await expect(linkElement).toBeVisible();
      const box = await linkElement.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // Раньше здесь проверялся пункт-заглушка с href="#": Enter по нему не должен был закрывать
    // меню. Заглушек в меню больше нет — «Контакты» ведут на существующий /contacts, — поэтому
    // проверяется то, что осталось осмысленным: каждый пункт достигается Tab по порядку меню.
    // Навигация по Enter на /contacts закреплена отдельно в public-routes.spec.ts.
    expect(copy.heroLinks.filter((link) => link.href === "#")).toEqual([]);
    const contacts = copy.heroLinks.find((link) => link.label === "Контакты")!;
    await menuButton.focus();
    for (let index = 0; index <= copy.heroLinks.indexOf(contacts); index += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(navigation.getByRole("link", { name: contacts.label })).toBeFocused();
    await expect(navigation.getByRole("link", { name: contacts.label })).toHaveAttribute(
      "href",
      "/contacts",
    );

    await page.keyboard.press("Escape");
    await expect(navigation).toBeHidden();
    await expect(page.getByRole("button", { name: "Открыть меню" })).toBeFocused();

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test("Главная returns an open homepage department to hero and works from an inner page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?department=sales");
    const sales = getDepartments().find((department) => department.id === "sales")!;
    await expect(page.getByRole("heading", { name: sales.headline })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Главная" })
      .click();
    await expect(page.getByRole("heading", { name: copy.headline })).toBeVisible();
    await expect(page).toHaveURL("/");

    await page.goto("/how-we-work");
    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Главная" })
      .click();
    await expect(page).toHaveURL("/");
  });

  test("the seven-link desktop header does not overflow at intermediate widths", async ({
    page,
  }) => {
    await page.goto("/");

    for (const width of [901, 1024, 1180, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await page.getByRole("banner").evaluate((header) => ({
        clientWidth: header.clientWidth,
        scrollWidth: header.scrollWidth,
      }));

      expect(geometry.scrollWidth, `header overflow at ${width}px`).toBeLessThanOrEqual(
        geometry.clientWidth,
      );
    }
  });

  test("keeps the same header contract in the task state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?section=task");
    await expect(page.getByRole("heading", { name: copy.taskSection.headline })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Основная навигация" });
    await expect(navigation).toBeVisible();
    expect(await navigation.locator("a").allTextContents()).toEqual(
      copy.heroLinks.map((link) => link.label),
    );
    await expect(page.getByRole("link", { name: copy.headerPhoneAccessibleLabel })).toHaveAttribute(
      "href",
      copy.headerPhoneHref,
    );
  });

  test("renders the approved editorial stories and direct Telegram action", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOverview(page);

    await expect(page.getByText(copy.officeOverview.leftStory.title)).toBeVisible();
    await expect(page.getByText(copy.officeOverview.rightStory.title)).toBeVisible();
    for (const paragraph of [
      ...copy.officeOverview.leftStory.paragraphs,
      ...copy.officeOverview.rightStory.paragraphs,
    ]) {
      await expect(page.getByText(paragraph)).toBeVisible();
    }

    const action = page.getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel });
    await expect(action).toHaveText(copy.taskSection.overviewCtaLabel);
    await expect(action).toHaveAttribute("href", copy.contactHref);
    await expect(action).toHaveAttribute("target", "_blank");
  });

  test("uses one calm control group in the exact return, instruction, CTA order", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOverview(page);

    const controls = page.locator("[data-overview-controls]");
    const instruction = controls.getByText(copy.officeOverview.instruction, { exact: true });
    const action = controls.getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel });
    await expect(controls.locator(":scope > *")).toHaveCount(3);
    expect(
      await controls.locator(":scope > *").evaluateAll((elements) =>
        elements.map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim(),
        })),
      ),
    ).toEqual([
      { tag: "A", text: copy.returnToOfficeLabel },
      { tag: "P", text: copy.officeOverview.instruction },
      { tag: "A", text: copy.taskSection.overviewCtaLabel },
    ]);
    await expect(page.getByText("Наведи курсор на область офиса")).toHaveCount(0);

    const [controlsBox, returnBox, instructionBox, actionBox] = await Promise.all([
      controls.boundingBox(),
      controls.getByRole("link", { name: copy.returnToOfficeLabel }).boundingBox(),
      instruction.boundingBox(),
      action.boundingBox(),
    ]);
    for (const box of [controlsBox, returnBox, instructionBox, actionBox]) {
      expect(box).not.toBeNull();
    }
    const centerY = (box: NonNullable<typeof controlsBox>) => box.y + box.height / 2;
    // Half-pixel font/button rounding can produce a 1.5px center delta despite grid alignment.
    expect(Math.abs(centerY(returnBox!) - centerY(instructionBox!))).toBeLessThanOrEqual(2);
    expect(Math.abs(centerY(actionBox!) - centerY(instructionBox!))).toBeLessThanOrEqual(2);
    expect(
      Math.abs(
        instructionBox!.x + instructionBox!.width / 2 - (controlsBox!.x + controlsBox!.width / 2),
      ),
    ).toBeLessThanOrEqual(1);

    expect(
      await instruction.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
        };
      }),
    ).toEqual({
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: "0px",
      boxShadow: "none",
    });
  });

  test("gives the office more desktop height without clipping stories or scrolling the document", async ({
    page,
  }) => {
    const desktopViewports = [
      { width: 1920, height: 920, previousStageHeight: 679.3, minimumGain: 10 },
      { width: 1440, height: 900, previousStageHeight: 532.6, minimumGain: 35 },
      { width: 1280, height: 800, previousStageHeight: 471.3, minimumGain: 30 },
    ];

    for (const viewport of desktopViewports) {
      await page.setViewportSize(viewport);
      await openOverview(page);

      const stage = page.locator('[data-scene-crossfade="overview"]').locator("..");
      const stageBox = await stage.boundingBox();
      expect(stageBox, `${viewport.width}×${viewport.height}: stage exists`).not.toBeNull();
      expect(stageBox!.height).toBeGreaterThanOrEqual(
        viewport.previousStageHeight + viewport.minimumGain,
      );
      expect(stageBox!.width / stageBox!.height).toBeCloseTo(1.5, 2);

      const overflow = await page.evaluate(() => {
        const selectors = [
          '[data-office-mode="overview"]',
          '[data-stage-mode="overview"]',
          "[data-office-center]",
          '[data-overview-slot="left"]',
          '[data-overview-slot="right"]',
        ];
        return selectors.map((selector) => {
          const element = document.querySelector<HTMLElement>(selector)!;
          return {
            selector,
            vertical: element.scrollHeight - element.clientHeight,
            horizontal: element.scrollWidth - element.clientWidth,
          };
        });
      });
      for (const item of overflow) {
        expect(
          item.vertical,
          `${viewport.width}×${viewport.height}: ${item.selector} vertical overflow`,
        ).toBeLessThanOrEqual(1);
        expect(
          item.horizontal,
          `${viewport.width}×${viewport.height}: ${item.selector} horizontal overflow`,
        ).toBeLessThanOrEqual(1);
      }

      const pageGeometry = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(pageGeometry.scrollHeight - pageGeometry.clientHeight).toBeLessThanOrEqual(1);
      expect(pageGeometry.scrollWidth - pageGeometry.clientWidth).toBeLessThanOrEqual(1);
    }
  });

  test("uses four corner markers and reveals the short department description on hover and focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOverview(page);

    const sales = getDepartments().find((department) => department.id === "sales")!;
    const hotspot = page.getByRole("button", { name: sales.overviewLabel });
    await expect(hotspot.locator("[data-corner-marker]")).toHaveCount(4);
    expect(await hotspot.evaluate((element) => getComputedStyle(element).borderStyle)).toBe("none");

    const description = page.locator(`#department-problem-${sales.id}`);
    expect(Number(await description.evaluate((element) => getComputedStyle(element).opacity))).toBe(
      0,
    );

    await hotspot.hover();
    await expect
      .poll(() => description.evaluate((element) => Number(getComputedStyle(element).opacity)))
      .toBeGreaterThan(0.9);
    await expect(description).toContainText(`${sales.hoverDescription}→`);

    await page.mouse.move(0, 0);
    await hotspot.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() => description.evaluate((element) => Number(getComputedStyle(element).opacity)))
      .toBeGreaterThan(0.9);
  });

  test("stacks the controls, office and both stories without horizontal overflow on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openOverview(page);

    const stage = page.locator('[data-scene-crossfade="overview"]');
    const controls = page.locator("[data-overview-controls]");
    const returnLink = page.getByRole("link", { name: copy.returnToOfficeLabel });
    const ctaLink = page.getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel });
    const instruction = controls.getByText(copy.officeOverview.instruction, { exact: true });
    const leftStory = page.getByText(copy.officeOverview.leftStory.title);
    const rightStory = page.getByText(copy.officeOverview.rightStory.title);

    const [controlsBox, returnBox, ctaBox, instructionBox, stageBox, leftBox, rightBox] =
      await Promise.all([
        controls.boundingBox(),
        returnLink.boundingBox(),
        ctaLink.boundingBox(),
        instruction.boundingBox(),
        stage.boundingBox(),
        leftStory.boundingBox(),
        rightStory.boundingBox(),
      ]);
    expect(controlsBox).not.toBeNull();
    expect(returnBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(instructionBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();
    expect(Math.abs(returnBox!.y - ctaBox!.y)).toBeLessThanOrEqual(4);
    expect(returnBox!.x + returnBox!.width).toBeLessThan(ctaBox!.x);
    expect(
      Math.abs(
        instructionBox!.x + instructionBox!.width / 2 - (controlsBox!.x + controlsBox!.width / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(instructionBox!.x + instructionBox!.width / 2 - (stageBox!.x + stageBox!.width / 2)),
    ).toBeLessThanOrEqual(1);
    expect(instructionBox!.y).toBeGreaterThan(
      Math.max(returnBox!.y + returnBox!.height, ctaBox!.y + ctaBox!.height) - 1,
    );
    expect(stageBox!.y).toBeGreaterThanOrEqual(instructionBox!.y + instructionBox!.height);
    expect(leftBox!.y).toBeGreaterThan(stageBox!.y);
    expect(rightBox!.y).toBeGreaterThan(leftBox!.y);
    await expect(page.getByRole("navigation", { name: "Карусель отделов" })).toHaveCount(0);

    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
  });
});
