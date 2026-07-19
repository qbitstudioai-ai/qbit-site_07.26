import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { getDepartments } from "../../content/departments";
import { getOfficeZones } from "../../content/office-zones";

// Mobile ≤767px (WORKPLAN.md Step 7) — карусель, а не пространственная карта/список. hasTouch +
// isMobile соответствуют реальному touch-вводу (page.tap()), а не эмуляции клика мышью.
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

function sortedDepartments() {
  const departments = getDepartments();
  return getOfficeZones()
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((zone) => departments.find((d) => d.id === zone.departmentId)!);
}

async function activateCta(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).tap();
}

async function activateCtaViaSecondary(page: import("@playwright/test").Page) {
  const copy = getHomepageCopy();
  await page.getByRole("link", { name: copy.secondaryCta }).tap();
}

test.describe("mobile touch flow (≤767px, Step 7)", () => {
  test("overview renders the carousel (one card), not the spatial office map (not in the a11y tree)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);

    // На ≤767px OfficeSemanticMap скрыта через display:none — реально убрана из дерева
    // доступности (не просто визуально), см. OfficeSemanticMap.module.css.
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toHaveCount(0);

    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await expect(
      carousel.getByRole("button", { name: departments[0].overviewLabel }),
    ).toBeVisible();
  });

  test("Step 7.2: ACTIVATE_CTA hides hero and the interaction hint, and moves focus straight to the carousel card, without any Tab press", async ({
    page,
  }) => {
    await page.goto("/");
    const copy = getHomepageCopy();

    await activateCta(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.primaryCta })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toHaveCount(0);
    // interactionHint остаётся в DOM (markup не удаляется, см. WORKPLAN.md Step 7.2, решение 3) —
    // toBeHidden(), а не toHaveCount(0), проверяет именно визуальное сокрытие через CSS.
    await expect(page.getByText(copy.interactionHint)).toBeHidden();

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("mobile-department-carousel-card");
  });

  test("Step 7.2: the secondary CTA also hides hero on mobile and moves focus to the carousel card (AC2/AC5 — same guarantee as the primary CTA)", async ({
    page,
  }) => {
    await page.goto("/");
    const copy = getHomepageCopy();

    await activateCtaViaSecondary(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.primaryCta })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.secondaryCta })).toHaveCount(0);
    await expect(page.getByText(copy.interactionHint)).toBeHidden();

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("mobile-department-carousel-card");
  });

  test("Next/Previous browse the carousel locally: URL and machine state stay in overview (no SELECT_DEPARTMENT)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });

    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await expect(
      carousel.getByRole("button", { name: departments[1].overviewLabel }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);

    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await expect(
      carousel.getByRole("button", { name: departments[2].overviewLabel }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
  });

  test("tapping the current card opens exactly the department shown, not the first one by default", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });

    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: departments[2].overviewLabel }).tap();

    await expect(
      page.getByRole("heading", { level: 2, name: departments[2].headline }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe(departments[2].id);
  });

  test("in the active department, Prev/Next dispatch a real SWITCH_DEPARTMENT (URL updates, no full reload), wrap-around at both ends", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button", { name: departments[0].overviewLabel }).tap();
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
    // Wrap-around: Next from the last department goes back to the first.
    await nextButton().tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[0].headline }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("department")).toBe(departments[0].id);

    // Wrap-around: Prev from the first department goes to the last.
    const prevButton = () => page.getByRole("button", { name: /^Предыдущий отдел/ });
    await prevButton().tap();
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

  test("the explicit Close button returns to overview, and the carousel resets to the first department (AC 17 — not a saved position)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: departments[1].overviewLabel }).tap();
    await expect(
      page.getByRole("heading", { level: 2, name: departments[1].headline }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Закрыть" }).tap();

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("department")).toBeNull();
    await expect(
      carousel.getByRole("button", { name: departments[0].overviewLabel }),
    ).toBeVisible();
  });

  test("closing a non-first department restores focus to a visible element, not silently to <body> (AC 6 — mobile-specific focus-restoration fallback in OfficeMachine.tsx)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: departments[2].overviewLabel }).tap();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("mobile-department-carousel-card");
  });

  test("direct ?department=<id> on a mobile viewport opens that department immediately, for all 5 ids", async ({
    page,
  }) => {
    for (const department of getDepartments()) {
      await page.goto(`/?department=${department.id}`);
      await expect(
        page.getByRole("heading", { level: 2, name: department.headline }),
      ).toBeVisible();
    }
  });

  test("all interactive tap targets (card, Prev/Next, CTA, Close, return-to-office) are at least 44x44 CSS px", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });

    const returnBox = await page
      .getByRole("button", { name: copy.returnToOfficeLabel })
      .boundingBox();
    expect(returnBox).not.toBeNull();
    expect(returnBox!.width).toBeGreaterThanOrEqual(44);
    expect(returnBox!.height).toBeGreaterThanOrEqual(44);

    for (const button of await carousel.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await carousel.getByRole("button", { name: departments[0].overviewLabel }).tap();

    const closeBox = await page.getByRole("button", { name: "Закрыть" }).boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);

    const ctaBox = await page.getByRole("link", { name: departments[0].ctaLabel }).boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox!.height).toBeGreaterThanOrEqual(44);

    // Step 7.3: кнопки пунктов боли в мобильном аккордеоне — тоже тап-таргеты.
    const accordion = page.getByTestId("mobile-pain-gain-accordion");
    for (const button of await accordion.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    for (const navButton of await page
      .getByRole("button", { name: /^(Предыдущий|Следующий) отдел/ })
      .all()) {
      const box = await navButton.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("no horizontal or full-document scroll at 375px width, across hero/overview/department-active", async ({
    page,
  }) => {
    async function expectNoScroll() {
      const { scrollWidth, scrollHeight, innerWidth, innerHeight } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
    }

    await page.goto("/");
    await expectNoScroll();
    await activateCta(page);
    await expectNoScroll();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button").first().tap();
    await expectNoScroll();
  });

  test("prefers-reduced-motion: the full mobile flow (browse, open, switch, close) remains functional", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });

    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: departments[1].overviewLabel }).tap();
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

  test("keyboard: Tab order is [card, Prev, Next] in overview, and Enter opens the currently-focused card", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    const card = carousel.getByRole("button", { name: departments[0].overviewLabel });

    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(carousel.getByRole("button", { name: /Предыдущий отдел/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(carousel.getByRole("button", { name: /Следующий отдел/ })).toBeFocused();

    await card.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 2, name: departments[0].headline }),
    ).toBeVisible();
  });

  test("keyboard: in the active department, Tab order is [5 pain points, CTA, Close, Prev, Next] (AC 13 — mobile equivalent of the desktop rail Tab order; Step 7.3 accordion)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button", { name: departments[0].overviewLabel }).tap();

    // Заголовок получает программный focus сразу после открытия (docs/05 department-opening) —
    // тот же инвариант, что уже проверен для Desktop в desktop-10x90-shell.spec.ts.
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
    await expect(page.getByRole("button", { name: "Закрыть" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Предыдущий отдел/ })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Следующий отдел/ })).toBeFocused();
  });

  test("tapping a pain point in the mobile accordion expands its gain, defaulting to the first pain point on open (Step 7.3, OQ-P2/OQ-P6)", async ({
    page,
  }) => {
    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button", { name: departments[0].overviewLabel }).tap();

    const accordion = page.getByTestId("mobile-pain-gain-accordion");
    await expect(accordion.getByText(departments[0].painPoints[0].gain)).toBeVisible();

    const thirdPain = departments[0].painPoints[2];
    await accordion.getByRole("button", { name: thirdPain.pain }).tap();
    await expect(accordion.getByText(thirdPain.gain)).toBeVisible();
    await expect(accordion.getByText(departments[0].painPoints[0].gain)).toHaveCount(0);
  });

  test("no console/page errors across the full mobile flow (production build)", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));
    page.on("pageerror", (err) => messages.push(err.message));

    await page.goto("/");
    await activateCta(page);
    const departments = sortedDepartments();
    const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
    await carousel.getByRole("button", { name: /Следующий отдел/ }).tap();
    await carousel.getByRole("button", { name: departments[1].overviewLabel }).tap();
    await page.getByRole("button", { name: /Следующий отдел/ }).tap();
    await page.keyboard.press("Escape");
    await page.goto("/?department=sales");
    await page.goto("/?department=does-not-exist");

    const suspicious = messages.filter((text) => /error|hydrat/i.test(text));
    expect(suspicious).toEqual([]);
  });

  test("the 'return to office' button works on mobile: absent in hero, returns from the carousel to hero", async ({
    page,
  }) => {
    const copy = getHomepageCopy();
    await page.goto("/");
    await expect(page.getByRole("button", { name: copy.returnToOfficeLabel })).toHaveCount(0);
    await expect(page.getByText(copy.tagline)).toBeVisible();

    await activateCta(page);
    const returnButton = page.getByRole("button", { name: copy.returnToOfficeLabel });
    await expect(returnButton).toBeVisible();
    await returnButton.tap();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.headline);
    await expect(page.getByRole("navigation", { name: "Карусель отделов" })).toHaveCount(0);
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("hero-heading");
  });
});

// AC 7/AC 9 at multiple characteristic mobile sizes (WORKPLAN.md Step 7 Manual checks: iPhone SE
// 375×667, typical Android 393×851, 320px extreme). These are automated Chromium checks at the
// exact same dimensions, not a live Chrome DevTools device-toolbar pass — recorded honestly as such
// (see WORKLOG.md Entry 8 correction), since no interactive DevTools session was run this round.
test.describe("mobile CTA reachability and no-horizontal-scroll at multiple characteristic sizes (AC 7, AC 9)", () => {
  test.use({ hasTouch: true, isMobile: true });

  const sizes = [
    { name: "iPhone SE", width: 375, height: 667 },
    { name: "typical Android", width: 393, height: 851 },
    { name: "320px extreme", width: 320, height: 690 },
  ];

  for (const size of sizes) {
    test(`${size.name} (${size.width}x${size.height}): DepartmentCTA is reachable and not clipped, no horizontal scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await activateCta(page);
      const departments = sortedDepartments();
      const carousel = page.getByRole("navigation", { name: "Карусель отделов" });
      await carousel.getByRole("button", { name: departments[0].overviewLabel }).tap();

      const ctaButton = page.getByRole("link", { name: departments[0].ctaLabel });
      // Панель отдела может скроллиться внутренне на низких высотах (docs/08) — "достижима" значит
      // доступна после прокрутки самой панели, не обязательно видна без скролла сразу.
      await ctaButton.scrollIntoViewIfNeeded();
      await expect(ctaButton).toBeVisible();
      const ctaBox = await ctaButton.boundingBox();
      expect(ctaBox).not.toBeNull();
      expect(ctaBox!.x).toBeGreaterThanOrEqual(0);
      expect(ctaBox!.x + ctaBox!.width).toBeLessThanOrEqual(size.width);
      expect(ctaBox!.y).toBeGreaterThanOrEqual(0);
      expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(size.height);

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  }
});
