import { expect, test, type Page } from "@playwright/test";
import {
  DESKTOPS,
  PHONE_LANDSCAPE,
  PHONE_PORTRAIT,
  PUBLIC_ROUTES,
  TABLETS,
  expectNoHorizontalOverflow,
  targetSize,
} from "./helpers/layout";

/**
 * Регрессии мобильного аудита 2026-07-28.
 *
 * Каждый блок ниже закрывает найденный и исправленный дефект (MOB-01…MOB-06) и, вторым тестом,
 * фиксирует НЕИЗМЕННОСТЬ desktop: все шесть правок сделаны под `pointer: coarse` или под мобильные
 * media query, и цена ошибки здесь — сломанный утверждённый desktop-дизайн, а не только мобильный.
 *
 * `hasTouch: true` в Playwright включает `pointer: coarse`, `hasTouch: false` — `pointer: fine`,
 * поэтому пара «мобильный/desktop» тестов проверяет ровно то условие, на котором висят правки.
 */

const MENU_BUTTON = 'button[aria-controls="site-navigation"]';
const ROUTE_DOTS = '[aria-label="Текущая локация"] button';

function menuButton(page: Page) {
  return page.locator(MENU_BUTTON);
}

// ── MOB-01: переход к локации «Как мы работаем» пальцем ──────────────────────────────────────────

test.describe("MOB-01 how-we-work: точки маршрута доступны пальцем", () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const size of [...PHONE_PORTRAIT.slice(0, 4), ...PHONE_LANDSCAPE.slice(1), ...TABLETS]) {
    test(`${size.name}: пять точек не меньше 44x44 и не перекрывают друг друга`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/how-we-work");

      const dots = page.locator(ROUTE_DOTS);
      await expect(dots).toHaveCount(5);

      const centres: number[] = [];
      for (const dot of await dots.all()) {
        const box = await dot.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        centres.push(box!.y + box!.height / 2);
      }

      // Шаг между центрами не меньше самой мишени — иначе соседние области попадания смыкаются
      // и промах по соседней сцене становится вероятным.
      centres.sort((a, b) => a - b);
      for (let i = 1; i < centres.length; i++) {
        expect(centres[i] - centres[i - 1]).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("тап по точке переключает сцену напрямую, а не по одной вперёд", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/how-we-work");

    const stage = page.locator("[data-active-scene]");
    await expect(stage).toHaveAttribute("data-active-scene", "0");

    /**
     * Между переключениями обязательна пауза, и это НЕ маскировка медленного интерфейса.
     *
     * `HowWeWorkPage.tsx` держит замок перехода (`scrollLockUntilRef`, `SCENE_TRANSITION_LOCK` =
     * 1120 мс): пока он не истёк, `goToSceneIndex` выходит сразу. Замок существует ради колеса и
     * свайпа — без него один жест проматывал бы несколько сцен подряд. Тап внутри окна замка
     * игнорируется по проекту, а не из-за дефекта.
     *
     * Ждём снятия `data-transitioning` (1050 мс) и добавляем 150 мс — ровно столько, чтобы перекрыть
     * остаток замка. Увеличивать таймауты ассертов вместо этого было бы именно тем сокрытием, от
     * которого предостерегает приёмка: ассерт ждал бы состояния, которое приложение осознанно
     * не собирается менять.
     */
    const waitOutTransitionLock = async () => {
      await expect(stage).not.toHaveAttribute("data-transitioning", "true");
      await page.waitForTimeout(150);
    };

    await page.locator(ROUTE_DOTS).nth(4).tap();
    await expect(stage).toHaveAttribute("data-active-scene", "4");
    await waitOutTransitionLock();

    await page.locator(ROUTE_DOTS).nth(1).tap();
    await expect(stage).toHaveAttribute("data-active-scene", "1");
  });
});

test.describe("MOB-01 how-we-work: desktop-вид точек не изменился", () => {
  test.use({ hasTouch: false, isMobile: false });

  for (const size of DESKTOPS) {
    test(`${size.name}: точки остаются 8x8`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/how-we-work");

      const dots = page.locator(ROUTE_DOTS);
      await expect(dots).toHaveCount(5);
      for (const dot of await dots.all()) {
        expect(await targetSize(dot)).toEqual({ width: 8, height: 8 });
      }
    });
  }
});

// ── MOB-02: меню помещается в экран ──────────────────────────────────────────────────────────────

test.describe("MOB-02 мобильное меню помещается в экран", () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const size of [...PHONE_LANDSCAPE, ...PHONE_PORTRAIT.slice(0, 3), TABLETS[0]]) {
    test(`${size.name}: раскрытое меню не выходит за нижний край, все пункты достижимы`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/faq");

      const button = menuButton(page);
      if (!(await button.isVisible())) {
        test.skip(true, "на этой ширине работает desktop-навигация");
      }

      await button.tap();
      const navigation = page.locator("#site-navigation");
      await expect(navigation).toBeVisible();

      const box = await navigation.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);

      // Каждый пункт обязан выводиться в видимую часть — сам по себе или прокруткой списка.
      const unreachable = await navigation.evaluate((nav) =>
        [...nav.querySelectorAll("a, span")]
          .filter((item) => {
            item.scrollIntoView({ block: "nearest" });
            const rect = item.getBoundingClientRect();
            return rect.top < -1 || rect.bottom > window.innerHeight + 1;
          })
          .map((item) => item.textContent?.trim() ?? ""),
      );
      expect(unreachable).toEqual([]);
    });
  }
});

// ── MOB-03: подложка, закрытие мимо меню, удержание фокуса ───────────────────────────────────────

test.describe("MOB-03 мобильное меню: закрытие и фокус", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("подложка перекрывает страницу под меню и закрывает его по нажатию", async ({ page }) => {
    await page.goto("/faq");
    const button = menuButton(page);

    await expect(page.locator("[data-menu-backdrop]")).toHaveCount(0);
    await button.tap();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    const backdrop = page.locator("[data-menu-backdrop]");
    const box = await backdrop.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(0);
    expect(box!.width).toBe(390);

    await page.mouse.click(195, 700);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(backdrop).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("Tab не выходит за пределы раскрытого меню", async ({ page }) => {
    await page.goto("/faq");
    const button = menuButton(page);
    await button.tap();

    const links = page.locator("#site-navigation a[href]");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    await button.focus();
    for (let i = 0; i < count; i++) {
      await page.keyboard.press("Tab");
    }
    await expect(links.nth(count - 1)).toBeFocused();

    // С последнего пункта цикл замыкается на кнопке меню, а не уходит на страницу под подложкой.
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(links.nth(count - 1)).toBeFocused();
  });

  test("Escape закрывает меню и возвращает фокус на кнопку", async ({ page }) => {
    await page.goto("/faq");
    const button = menuButton(page);

    await button.tap();
    await page.keyboard.press("Escape");

    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(page.locator("[data-menu-backdrop]")).toHaveCount(0);
  });

  test("выбор пункта закрывает меню и уводит на страницу", async ({ page }) => {
    await page.goto("/faq");
    await menuButton(page).tap();
    await page.locator('#site-navigation a[href="/documents"]').tap();

    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.locator("[data-menu-backdrop]")).toHaveCount(0);
  });
});

test.describe("MOB-03 desktop: подложки и кнопки меню нет", () => {
  test.use({ hasTouch: false, isMobile: false });

  for (const size of DESKTOPS) {
    test(`${size.name}: навигация раскрыта, подложка не рендерится`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/faq");

      await expect(page.locator(MENU_BUTTON)).toBeHidden();
      await expect(page.locator("[data-menu-backdrop]")).toHaveCount(0);

      const navigation = page.locator("#site-navigation");
      await expect(navigation).toBeVisible();
      // Ограничение высоты и прокрутка — мобильные; на desktop список остаётся строкой.
      await expect(navigation).toHaveCSS("max-height", "none");
      await expect(navigation).toHaveCSS("overflow-y", "visible");
    });
  }
});

// ── MOB-04 / MOB-05: размеры мишеней ─────────────────────────────────────────────────────────────

test.describe("MOB-04 продукты: мишени при вводе пальцем", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("932x430: пункты списка продуктов не меньше 44px и открываются тапом", async ({ page }) => {
    await page.setViewportSize({ width: 932, height: 430 });
    await page.goto("/products/rag-ai-assistant");

    const navigation = page.getByRole("navigation", { name: "Все продукты" });
    await expect(navigation).toBeVisible();

    for (const link of await navigation.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await navigation.locator('a[href="/products/call-analysis"]').tap();
    await expect(page).toHaveURL(/\/products\/call-analysis$/);
  });

  test("390x844: у хлебных крошек есть увеличенная область попадания", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/products/rag-ai-assistant");

    const crumb = page
      .getByRole("navigation", { name: "Хлебные крошки" })
      .getByRole("link")
      .first();
    await expect(crumb).toHaveCSS("position", "relative");
    const hitArea = await crumb.evaluate((el) => getComputedStyle(el, "::after").insetBlockStart);
    expect(hitArea).toBe("-15px");
  });
});

test.describe("MOB-04 продукты: desktop не изменился", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 900 } });

  test("пункты списка сохраняют min-height 40px, у крошек нет накладки", async ({ page }) => {
    await page.goto("/products/rag-ai-assistant");

    const navLink = page
      .getByRole("navigation", { name: "Все продукты" })
      .getByRole("link")
      .first();
    await expect(navLink).toHaveCSS("min-height", "40px");

    const crumb = page
      .getByRole("navigation", { name: "Хлебные крошки" })
      .getByRole("link")
      .first();
    await expect(crumb).toHaveCSS("position", "static");
    const hitArea = await crumb.evaluate((el) => getComputedStyle(el, "::after").content);
    expect(hitArea).toBe("none");
  });
});

test.describe("MOB-05 документы: мишени при вводе пальцем", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("фильтры категорий и «Открыть полностью» не меньше 44px", async ({ page }) => {
    await page.goto("/documents");

    const filters = page.locator("button[aria-pressed]");
    expect(await filters.count()).toBeGreaterThan(0);
    for (const filter of await filters.all()) {
      const box = await filter.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.locator("li button").first().tap();
    const openFull = page.locator("[data-document-open]");
    await expect(openFull).toBeVisible();
    const box = await openFull.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Скачивание остаётся заметным действием и не теряется под увеличенными мишенями.
    const download = page.locator("[data-document-download]");
    await expect(download).toBeVisible();
    const downloadBox = await download.boundingBox();
    expect(downloadBox!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("MOB-05 документы: desktop не изменился", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 900 } });

  test("фильтры категорий сохраняют высоту 30px", async ({ page }) => {
    await page.goto("/documents");
    for (const filter of await page.locator("button[aria-pressed]").all()) {
      const box = await filter.boundingBox();
      expect(Math.round(box!.height)).toBe(30);
    }
  });
});

// ── MOB-06: читаемость оговорки о расчёте ────────────────────────────────────────────────────────

test.describe("MOB-06 главная: оговорка о расчёте читаема на телефоне", () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const size of [PHONE_PORTRAIT[0], PHONE_PORTRAIT[3], PHONE_PORTRAIT[6], TABLETS[0]]) {
    test(`${size.name}: размер шрифта оговорки не меньше 11px`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");

      const sizes = await page.evaluate(() =>
        [...document.querySelectorAll('[class*="effectLabel"]')].map((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        ),
      );
      expect(sizes.length).toBeGreaterThan(0);
      for (const fontSize of sizes) {
        expect(fontSize).toBeGreaterThanOrEqual(11);
      }
    });
  }
});

// ── Горизонтальное переполнение: вся матрица экранов ─────────────────────────────────────────────

for (const group of [
  { label: "телефон, портрет", sizes: PHONE_PORTRAIT, touch: true },
  { label: "телефон, альбом", sizes: PHONE_LANDSCAPE, touch: true },
  { label: "планшет", sizes: TABLETS, touch: true },
  { label: "desktop", sizes: DESKTOPS, touch: false },
]) {
  test.describe(`Нет горизонтальной прокрутки: ${group.label}`, () => {
    test.use({ hasTouch: group.touch, isMobile: group.touch });

    for (const size of group.sizes) {
      test(`${size.name}: ни один публичный адрес не уезжает вбок`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const route of PUBLIC_ROUTES) {
          await page.goto(route);
          await expectNoHorizontalOverflow(page, `${size.name} ${route}`);
        }
      });
    }
  });
}

// ── Поворот экрана ───────────────────────────────────────────────────────────────────────────────

test.describe("Поворот экрана не ломает активное состояние", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("открытый отдел переживает portrait → landscape → portrait", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?department=sales");

    const office = page.locator("[data-office-mode]");
    await expect(office).toHaveAttribute("data-office-mode", "section");

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(office).toHaveAttribute("data-office-mode", "section");
    await expectNoHorizontalOverflow(page, "844x390 ?department=sales");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(office).toHaveAttribute("data-office-mode", "section");
    await expectNoHorizontalOverflow(page, "390x844 ?department=sales");
  });

  test("расширение окна с открытым меню не оставляет подложку на desktop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/faq");
    await menuButton(page).tap();
    await expect(page.locator("[data-menu-backdrop]")).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator("[data-menu-backdrop]")).toBeHidden();
    await expect(page.locator("#site-navigation")).toBeVisible();
    await expectNoHorizontalOverflow(page, "1440x900 /faq после поворота");
  });
});

// ── Reduced motion ───────────────────────────────────────────────────────────────────────────────

test.describe("prefers-reduced-motion на мобильном", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("исправленные элементы остаются рабочими при отключённом движении", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/how-we-work");
    await page.locator(ROUTE_DOTS).nth(3).tap();
    await expect(page.locator("[data-active-scene]")).toHaveAttribute("data-active-scene", "3");

    await page.goto("/faq");
    const button = menuButton(page);
    await button.tap();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
