import { expect, test } from "@playwright/test";
import { getDepartments } from "../../content/departments";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getOfficeZones } from "../../content/office-zones";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

function sortedDepartments() {
  const departments = getDepartments();
  return getOfficeZones()
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((zone) => departments.find((d) => d.id === zone.departmentId)!);
}

function officeMap(page: import("@playwright/test").Page) {
  return page.getByRole("navigation", { name: "Отделы компании" });
}

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).tap();
}

async function expectNoDocumentOverflow(page: import("@playwright/test").Page) {
  const { scrollWidth, scrollHeight, innerWidth, innerHeight } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
}

test.describe("mobile touch flow (direct office selection)", () => {
  test("overview shows the office scene with five tappable zones and no carousel wizard controls", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);

    const departments = sortedDepartments();
    const map = officeMap(page);
    await expect(map).toBeVisible();
    await expect(map.getByRole("button")).toHaveCount(5);
    for (const department of departments) {
      await expect(map.getByRole("button", { name: department.overviewLabel })).toBeVisible();
    }

    await expect(page.getByRole("navigation", { name: "Карусель отделов" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Назад|Далее/ })).toHaveCount(0);

    await map.getByRole("button", { name: departments[3].overviewLabel }).tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[3].headline }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe(departments[3].id);
  });

  test("ACTIVATE_CTA hides hero and the interaction hint, and moves focus to the first scene zone", async ({
    page,
  }) => {
    await page.goto("/");
    const copy = getHomepageCopy();

    await activateCta(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(
      page.locator("[data-hero-grid]").getByRole("link", { name: copy.primaryCta }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toHaveCount(0);
    await expect(page.getByText(copy.interactionHint)).toBeHidden();

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe(`hotspot-${sortedDepartments()[0].id}`);
  });

  test("top mobile/tablet overview controls use actions first and instruction second", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    const widths = [390, 375, 360, 768];

    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
      await page.goto("/");
      await activateCta(page);

      const returnLink = page.getByRole("link", { name: copy.returnToOfficeLabel });
      const ctaLink = page.getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel });
      const instruction = page.getByText(copy.officeOverview.instruction);

      const [returnBox, ctaBox, instructionBox] = await Promise.all([
        returnLink.boundingBox(),
        ctaLink.boundingBox(),
        instruction.boundingBox(),
      ]);

      expect(returnBox).not.toBeNull();
      expect(ctaBox).not.toBeNull();
      expect(instructionBox).not.toBeNull();
      expect(Math.abs(returnBox!.y - ctaBox!.y)).toBeLessThanOrEqual(4);
      expect(returnBox!.x + returnBox!.width).toBeLessThan(ctaBox!.x);
      expect(instructionBox!.y).toBeGreaterThan(
        Math.max(returnBox!.y + returnBox!.height, ctaBox!.y + ctaBox!.height) - 1,
      );
      await expectNoDocumentOverflow(page);
    }
  });

  test("all five departments open with one tap on the office image zones", async ({ page }) => {
    await page.goto("/");
    await activateCta(page);

    for (const department of sortedDepartments()) {
      await officeMap(page).getByRole("button", { name: department.overviewLabel }).tap();
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("department")).toBe(department.id);
      await page.getByRole("button", { name: "Назад к офису" }).tap();
      await expect(officeMap(page)).toBeVisible();
    }
  });

  test("in the active department, Prev/Next still switch departments and update the URL", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });

    const departments = sortedDepartments();
    await officeMap(page).getByRole("button", { name: departments[0].overviewLabel }).tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[0].headline }),
    ).toBeVisible();

    const nextButton = () => page.getByRole("button", { name: /^Следующий отдел/ });
    for (let i = 1; i < departments.length; i++) {
      await nextButton().tap();
      await expect(
        page.getByRole("heading", { level: 2, name: departments[i].headline }),
      ).toBeVisible();
    }
    await nextButton().tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[0].headline }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe(departments[0].id);

    await page.getByRole("button", { name: /^Предыдущий отдел/ }).tap();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: departments[departments.length - 1].headline,
      }),
    ).toBeVisible();

    const markerSurvived = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
    );
    expect(markerSurvived).toBe(true);
  });

  test("Close returns to overview without restoring any intermediate mobile block", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();

    await officeMap(page).getByRole("button", { name: departments[2].overviewLabel }).tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[2].headline }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Назад к офису" }).tap();

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Карусель отделов" })).toHaveCount(0);
    await expect(officeMap(page)).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
  });

  test("closing a non-first department restores focus to that department zone", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();

    await officeMap(page).getByRole("button", { name: departments[2].overviewLabel }).tap();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe(`hotspot-${departments[2].id}`);
  });

  test("direct ?department=<id> on a mobile viewport opens that department immediately", async ({
    page,
  }) => {
    for (const department of getDepartments()) {
      await page.goto(`/?department=${department.id}`);
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
    }
  });

  test("interactive tap targets stay at least 44x44 CSS px", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const copy = getHomepageCopy();
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();

    const returnBox = await page
      .getByRole("link", { name: copy.returnToOfficeLabel })
      .boundingBox();
    const overviewCtaBox = await page
      .getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel })
      .boundingBox();
    expect(returnBox).not.toBeNull();
    expect(overviewCtaBox).not.toBeNull();
    expect(returnBox!.width).toBeGreaterThanOrEqual(44);
    expect(returnBox!.height).toBeGreaterThanOrEqual(44);
    expect(overviewCtaBox!.height).toBeGreaterThanOrEqual(44);

    for (const button of await officeMap(page).getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await officeMap(page).getByRole("button", { name: departments[0].overviewLabel }).tap();

    const closeBox = await page.getByRole("button", { name: "Назад к офису" }).boundingBox();
    const ctaBox = await page.getByRole("link", { name: departments[0].ctaLabel }).boundingBox();
    expect(closeBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    expect(ctaBox!.height).toBeGreaterThanOrEqual(44);

    for (const navButton of await page
      .getByRole("button", { name: /^(Предыдущий|Следующий) отдел/ })
      .all()) {
      const box = await navButton.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("no horizontal or full-document scroll at 375px across hero/overview/department-active", async ({
    page,
  }) => {
    await page.goto("/");
    await expectNoDocumentOverflow(page);
    await activateCta(page);
    await expectNoDocumentOverflow(page);
    await officeMap(page).getByRole("button").first().tap();
    await expectNoDocumentOverflow(page);
  });

  test("prefers-reduced-motion: open, switch, and close remain functional", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();

    await officeMap(page).getByRole("button", { name: departments[1].overviewLabel }).tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[1].headline }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Следующий отдел/ }).tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[2].headline }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  test("keyboard: Enter on a focused image zone opens that department", async ({ page }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const firstZone = officeMap(page).getByRole("button", { name: departments[0].overviewLabel });

    await firstZone.focus();
    await expect(firstZone).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { level: 2, name: departments[0].headline }),
    ).toBeVisible();
  });

  test("keyboard: in the active department, Tab order reaches accordion, CTA, Back, Prev, Next", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    await officeMap(page).getByRole("button", { name: departments[0].overviewLabel }).tap();

    await expect(
      page.getByRole("heading", { level: 2, name: departments[0].headline }),
    ).toBeFocused();

    const accordion = page.getByTestId("mobile-pain-gain-accordion");
    for (const point of departments[0].painPoints) {
      await page.keyboard.press("Tab");
      await expect(accordion.getByRole("button", { name: point.pain })).toBeFocused();
    }

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: departments[0].ctaLabel })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Назад к офису" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Предыдущий отдел/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Следующий отдел/ })).toBeFocused();
  });

  test("tapping a pain point in the mobile accordion expands its gain", async ({ page }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    await officeMap(page).getByRole("button", { name: departments[0].overviewLabel }).tap();

    const accordion = page.getByTestId("mobile-pain-gain-accordion");
    await expect(accordion.getByText(departments[0].painPoints[0].gain)).toBeVisible();

    const thirdPain = departments[0].painPoints[2];
    await accordion.getByRole("button", { name: thirdPain.pain }).tap();
    await expect(accordion.getByText(thirdPain.gain)).toBeVisible();
    await expect(accordion.getByText(departments[0].painPoints[0].gain)).toHaveCount(0);
  });

  test("no console/page errors across the full mobile flow", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));
    page.on("pageerror", (err) => messages.push(err.message));

    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    await officeMap(page).getByRole("button", { name: departments[1].overviewLabel }).tap();
    await page.getByRole("button", { name: /Следующий отдел/ }).tap();
    await page.keyboard.press("Escape");
    await page.goto("/?department=sales");
    await page.goto("/?department=does-not-exist");

    const suspicious = messages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });

  test("the 'return to office' link works on mobile: absent in hero, returns from overview to hero", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    await page.goto("/");
    await expect(page.getByRole("link", { name: copy.returnToOfficeLabel })).toHaveCount(0);
    await expect(page.getByText(copy.eyebrow)).toBeVisible();

    await activateCta(page);
    const returnLink = page.getByRole("link", { name: copy.returnToOfficeLabel });
    await expect(returnLink).toBeVisible();
    await returnLink.tap();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.headline);
    await expect(officeMap(page)).toHaveCount(0);
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("hero-heading");
  });
});

test.describe("mobile CTA reachability and no-horizontal-scroll at multiple widths", () => {
  test.use({ hasTouch: true, isMobile: true });

  const sizes = [
    { name: "typical Android", width: 390, height: 844 },
    { name: "iPhone SE", width: 375, height: 667 },
    { name: "narrow Android", width: 360, height: 740 },
    { name: "tablet portrait", width: 768, height: 1024 },
  ];

  for (const size of sizes) {
    test(`${size.name} (${size.width}x${size.height}): DepartmentCTA is reachable and no horizontal scroll`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await activateCta(page);
      const departments = sortedDepartments();
      await officeMap(page).getByRole("button", { name: departments[0].overviewLabel }).tap();

      const ctaButton = page.getByRole("link", { name: departments[0].ctaLabel });
      await ctaButton.scrollIntoViewIfNeeded();
      await expect(ctaButton).toBeVisible();
      const ctaBox = await ctaButton.boundingBox();
      expect(ctaBox).not.toBeNull();
      expect(ctaBox!.x).toBeGreaterThanOrEqual(0);
      expect(ctaBox!.x + ctaBox!.width).toBeLessThanOrEqual(size.width);

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  }
});
