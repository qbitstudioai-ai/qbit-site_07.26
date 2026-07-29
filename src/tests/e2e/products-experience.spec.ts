import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedProductLocations as products } from "../fixtures/seedContent";

test.describe("products laboratory", () => {
  test("keeps the site header and overview introduction vertically compact", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/products");

      const header = await page.locator("header").boundingBox();
      const phone = await page.locator("[data-header-phone]").boundingBox();
      const controls = await page.locator("[data-products-controls]").boundingBox();
      const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
      const back = await page.getByRole("link", { name: "На главную" }).boundingBox();
      const action = await page
        .getByRole("link", { name: "Получить бесплатный разбор" })
        .boundingBox();

      expect(header).not.toBeNull();
      expect(phone).not.toBeNull();
      expect(controls).not.toBeNull();
      expect(heading).not.toBeNull();
      expect(back).not.toBeNull();
      expect(action).not.toBeNull();
      expect(header!.height).toBeGreaterThanOrEqual(60);
      expect(header!.height).toBeLessThanOrEqual(64);
      expect(phone!.height).toBeGreaterThanOrEqual(40);
      expect(phone!.height).toBeLessThanOrEqual(44);
      expect(controls!.height).toBeLessThanOrEqual(
        viewport.width < 768 ? 160 : viewport.width <= 1024 ? 104 : 80,
      );
      if (viewport.width >= 768) {
        expect(back!.x + back!.width).toBeLessThanOrEqual(heading!.x);
        expect(heading!.x + heading!.width).toBeLessThanOrEqual(action!.x);
      }

      const documentSize = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));
      expect(documentSize.scrollWidth).toBeLessThanOrEqual(documentSize.clientWidth);
      if (viewport.width >= 768) {
        expect(documentSize.scrollHeight).toBeLessThanOrEqual(documentSize.clientHeight);
      }
    }
  });

  test("overview exposes ten real hotspot links aligned inside the laboratory frame", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto("/products");
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle("Продукты и стоимость — QBit-Studio-Ai");
    await expect(page.getByText("Выберите продукт", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Продукты для автоматизации бизнеса" }),
    ).toHaveCount(1);
    await expect(
      page.getByText(
        "10 решений QBit-Studio-Ai для автоматизации продаж, клиентской поддержки, HR, работы с документами и внутренних бизнес-процессов.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Основная навигация" })
        .getByRole("link", { name: "Продукт и Стоимость" }),
    ).toHaveAttribute("href", "/products");

    const map = page.getByRole("navigation", { name: "Продукты на фотографии лаборатории" });
    const links = map.getByRole("link");
    await expect(links).toHaveCount(10);

    const frame = await page.locator("[data-lab-frame]").boundingBox();
    expect(frame).not.toBeNull();

    for (const product of products) {
      const link = map.getByRole("link", { name: `Открыть ${product.fullTitle}` });
      await expect(link).toHaveAttribute("href", `/products/${product.slug}`);
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(frame!.x - 1);
      expect(box!.y).toBeGreaterThanOrEqual(frame!.y - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
    }
  });

  test("enters a product, switches in place, and browser Back restores the previous product", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products");

    await page
      .getByRole("navigation", { name: "Продукты на фотографии лаборатории" })
      .getByRole("link", { name: `Открыть ${products[6].fullTitle}` })
      .click();
    await expect(page).toHaveURL(new RegExp(`/products/${products[6].slug}$`));
    await expect(
      page
        .getByRole("navigation", { name: "Все продукты" })
        .getByRole("link", { name: products[6].menuTitle, exact: true }),
    ).toHaveAttribute("aria-current", "page", { timeout: 3_000 });
    await expect(page.getByAltText(products[6].images.alt)).toBeVisible();

    await page
      .getByRole("navigation", { name: "Все продукты" })
      .getByRole("link", { name: products[7].menuTitle, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/products/${products[7].slug}$`));
    await expect(
      page
        .getByRole("navigation", { name: "Все продукты" })
        .getByRole("link", { name: products[7].menuTitle, exact: true }),
    ).toHaveAttribute("aria-current", "page", { timeout: 3_000 });

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/products/${products[6].slug}$`));
    await expect(
      page
        .getByRole("navigation", { name: "Все продукты" })
        .getByRole("link", { name: products[6].menuTitle, exact: true }),
    ).toHaveAttribute("aria-current", "page", { timeout: 3_000 });
  });

  test("all ten direct product URLs render the matching active item and photograph", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const product of products) {
      const response = await page.goto(`/products/${product.slug}`);
      expect(response?.status()).toBe(200);
      const activeLink = page
        .getByRole("navigation", { name: "Все продукты" })
        .getByRole("link", { name: product.menuTitle, exact: true });
      await expect(activeLink).toHaveAttribute("aria-current", "page");
      await expect(page.getByAltText(product.images.alt)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: product.fullTitle })).toHaveCount(1);
      await expect(page.getByText(product.content.summary, { exact: true })).toBeAttached();
      await expect(
        page.locator("[data-overview-price]").getByText(product.content.prices[0].value, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://allqbit.ru/products/${product.slug}`,
      );
      const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
      const schemas = JSON.parse(jsonLd ?? "[]") as Array<{
        "@type": string;
        offers?: Array<{
          priceCurrency: string;
          priceSpecification: {
            "@type": string;
            minPrice: number;
            priceCurrency: string;
          };
          description: string;
        }>;
      }>;
      const service = schemas.find((schema) => schema["@type"] === "Service");
      expect(service?.offers).toEqual(
        product.content.prices.map((price) => ({
          "@type": "Offer",
          name: price.label,
          priceCurrency: "RUB",
          priceSpecification: {
            "@type": "PriceSpecification",
            minPrice: price.amount,
            priceCurrency: "RUB",
          },
          description: expect.any(String),
          url: `https://allqbit.ru/products/${product.slug}`,
        })),
      );
      expect(schemas.some((schema) => schema["@type"] === "BreadcrumbList")).toBe(true);
      expect(schemas.some((schema) => schema["@type"] === "Organization")).toBe(true);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        product.seo.title,
      );
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
        "content",
        product.seo.description,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        `https://allqbit.ru/products/${product.slug}`,
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        `https://allqbit.ru${product.images.detail.fallbackSrc}`,
      );

      await page.reload();
      await expect(activeLink).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1, name: product.fullTitle })).toHaveCount(1);
    }
  });

  test("without JavaScript all four product sections remain visible in server HTML", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/products/${products[0].slug}`);

    for (const heading of [
      "Обзор",
      "Где применяется",
      "Примеры применения",
      "Стоимость",
      "Выгода для клиента",
    ]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("tablist")).toBeHidden();
    await context.close();
  });

  test("all ten overview hotspots open the matching URL, menu item, photo, heading and price", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    for (const product of products) {
      await page.goto("/products");
      await page
        .getByRole("navigation", { name: "Продукты на фотографии лаборатории" })
        .getByRole("link", { name: `Открыть ${product.fullTitle}` })
        .click();
      await expect(page).toHaveURL(new RegExp(`/products/${product.slug}$`));
      await expect(page.locator(`[data-product-link="${product.id}"]`)).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByAltText(product.images.alt)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: product.fullTitle })).toHaveCount(1);
      await expect(page.getByText(product.content.summary, { exact: true })).toBeAttached();
      await expect(
        page.locator("[data-overview-price]").getByText(product.content.prices[0].value, {
          exact: true,
        }),
      ).toBeVisible();
    }

    expect(runtimeErrors).toEqual([]);
  });

  test("tabs expose all copy in HTML and support Arrow, Home and End keys", async ({ page }) => {
    const product = products[0];
    await page.goto(`/products/${product.slug}`);

    const tabs = page.getByRole("tab");
    await tabs.nth(0).focus();
    await tabs.nth(0).press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(1).press("End");
    await expect(tabs.nth(3)).toBeFocused();
    await tabs.nth(3).press("Home");
    await expect(tabs.nth(0)).toBeFocused();

    for (const text of [
      product.content.summary,
      product.content.applies,
      ...product.content.examples,
      ...product.content.prices.flatMap((price) => [price.label, price.value]),
      product.content.benefit,
    ]) {
      await expect(page.getByText(text, { exact: true }).first()).toBeAttached();
    }
  });

  test("all ten compact markers stay separate and expose one starting price on hover and focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products");

    const markerBoxes = [];
    for (const product of products) {
      const hotspot = page.locator(`[data-product-hotspot="${product.id}"]`);
      const marker = hotspot.locator("[data-hotspot-label]");
      await expect(marker).toBeVisible();
      await expect(marker).toContainText(product.menuTitle);
      markerBoxes.push((await marker.boundingBox())!);
      await expect(hotspot).toHaveAttribute(
        "aria-label",
        new RegExp(product.content.prices[0].value.replace(/[+]/g, "\\+")),
      );
      await expect(hotspot).toHaveCSS("border-top-width", "0px");
      await expect(hotspot.locator("[class*='corner']").first()).toHaveCSS("opacity", "0");

      await hotspot.hover();
      await expect(hotspot.locator("[class*='corner']").first()).toHaveCSS("opacity", "1");
      await expect(hotspot.locator("[data-hotspot-price]")).toBeVisible();
      await expect(hotspot.locator("[data-hotspot-price]")).toContainText(
        product.content.prices[0].value,
      );

      await hotspot.focus();
      await expect(hotspot.locator("[data-hotspot-price]")).toBeVisible();
    }

    for (let first = 0; first < markerBoxes.length; first += 1) {
      for (let second = first + 1; second < markerBoxes.length; second += 1) {
        const a = markerBoxes[first];
        const b = markerBoxes[second];
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlap, `markers ${first + 1} and ${second + 1} overlap`).toBe(false);
      }
    }
  });

  test("expanded markers stay inside the photograph and clear of every other marker", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/products");
      const frame = (await page.locator("[data-lab-frame]").boundingBox())!;

      for (const product of products) {
        const hotspot = page.locator(`[data-product-hotspot="${product.id}"]`);
        await hotspot.hover();
        await expect(hotspot.locator("[data-hotspot-price]")).toBeVisible();

        const activeMarker = (await hotspot.locator("[data-hotspot-label]").boundingBox())!;
        expect(activeMarker.x).toBeGreaterThanOrEqual(frame.x - 1);
        expect(activeMarker.y).toBeGreaterThanOrEqual(frame.y - 1);
        expect(activeMarker.x + activeMarker.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
        expect(activeMarker.y + activeMarker.height).toBeLessThanOrEqual(
          frame.y + frame.height + 1,
        );

        for (const other of products) {
          if (other.id === product.id) continue;
          const otherMarker = (await page
            .locator(`[data-product-hotspot="${other.id}"] [data-hotspot-label]`)
            .boundingBox())!;
          const overlap =
            activeMarker.x < otherMarker.x + otherMarker.width &&
            activeMarker.x + activeMarker.width > otherMarker.x &&
            activeMarker.y < otherMarker.y + otherMarker.height &&
            activeMarker.y + activeMarker.height > otherMarker.y;
          expect(
            overlap,
            `${viewport.width}×${viewport.height}: expanded ${product.id} overlaps ${other.id}`,
          ).toBe(false);
        }
      }
    }
  });

  test("desktop product card is enlarged, readable, stable and uses configured placement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const product of products) {
      await page.goto(`/products/${product.slug}`);
      const panel = page.locator("[data-product-panel]");
      const article = page.locator("[data-product-article]");
      const panelBox = await panel.boundingBox();
      expect(panelBox).not.toBeNull();
      expect(panelBox!.width).toBeGreaterThanOrEqual(460);
      expect(panelBox!.width).toBeLessThanOrEqual(560);
      await expect(panel).toHaveAttribute("data-panel-position", product.layout.panelPosition);
      await expect(panel).toHaveAttribute("data-panel-vertical", product.layout.panelVertical);

      const typography = await article.evaluate((element) => {
        const heading = element.querySelector("h1")!;
        const summary = element.querySelector("[role='tabpanel'] header > p:last-of-type")!;
        const style = getComputedStyle(element);
        return {
          paddingLeft: Number.parseFloat(style.paddingLeft),
          heading: Number.parseFloat(getComputedStyle(heading).fontSize),
          summary: Number.parseFloat(getComputedStyle(summary).fontSize),
        };
      });
      expect(typography.paddingLeft).toBeGreaterThanOrEqual(24);
      expect(typography.heading).toBeGreaterThanOrEqual(32);
      expect(typography.heading).toBeLessThanOrEqual(42);
      expect(typography.summary).toBeGreaterThanOrEqual(16);

      for (const tab of await page.getByRole("tab").all()) {
        expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }

      await expect(
        page.locator("[data-overview-price]").getByText(product.content.prices[0].value, {
          exact: true,
        }),
      ).toBeVisible();
    }

    const panel = page.locator("[data-product-panel]");
    const initialHeight = (await panel.boundingBox())!.height;
    await page.locator("[data-price-shortcut]").click();
    await expect(page.getByRole("tab", { name: /Стоимость/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(Math.abs((await panel.boundingBox())!.height - initialHeight)).toBeLessThanOrEqual(8);
  });

  test("overview ItemList, legacy redirects and sitemap expose all canonical product URLs", async ({
    page,
    request,
  }) => {
    await page.goto("/products");
    const overviewJson = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]",
    ) as Array<{ "@type": string; itemListElement?: unknown[] }>;
    expect(
      overviewJson.find((schema) => schema["@type"] === "ItemList")?.itemListElement,
    ).toHaveLength(10);

    for (const product of products) {
      const legacyResponse = await request.get(`/products/${product.id}`, { maxRedirects: 0 });
      expect(legacyResponse.status()).toBe(308);
      expect(legacyResponse.headers().location).toBe(`/products/${product.slug}`);
    }

    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const product of products) {
      expect(sitemap).toContain(`https://allqbit.ru/products/${product.slug}`);
    }
    expect(sitemap).toContain("https://allqbit.ru/how-we-work");
  });

  test("keyboard focus follows the selected product and returns to its hotspot", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products");

    const hotspot = page.getByRole("link", { name: `Открыть ${products[4].fullTitle}` });
    await hotspot.focus();
    await hotspot.press("Enter");

    const activeProduct = page
      .getByRole("navigation", { name: "Все продукты" })
      .getByRole("link", { name: products[4].menuTitle, exact: true });
    await expect(activeProduct).toBeFocused({ timeout: 3_000 });

    const back = page.getByRole("link", { name: "Назад в лабораторию" });
    await back.focus();
    await back.press("Enter");
    await expect(hotspot).toBeFocused({ timeout: 3_000 });
  });

  test("mobile uses a compact products disclosure without horizontal page overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/products");

    const activeHotspots = page.locator('[data-product-hotspot][data-mobile-active="true"]');
    await expect(activeHotspots).toHaveCount(1);
    await expect(activeHotspots.locator("[data-hotspot-label]")).toContainText(
      products[0].menuTitle,
    );

    const mobileProduct = products[9];
    await page
      .getByRole("navigation", { name: "Список продуктов" })
      .locator(`a[href="/products/${mobileProduct.slug}"]`)
      .click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.locator(`[data-product-hotspot="${mobileProduct.id}"]`)).toHaveAttribute(
      "data-mobile-active",
      "true",
    );
    const pricePreview = page.locator("[data-mobile-price-preview]");
    await expect(pricePreview).toBeVisible();
    await expect(pricePreview).toContainText(mobileProduct.fullTitle);
    await expect(pricePreview.locator("[data-mobile-preview-price]")).toHaveCount(1);
    await expect(pricePreview).toContainText(mobileProduct.content.prices[0].value);
    await pricePreview.getByRole("link", { name: "Подробнее →" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${mobileProduct.slug}$`));

    await page.goto(`/products/${products[3].slug}`);

    const menuButton = page.getByRole("button", { name: "Продукты", exact: true });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Все продукты" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      contentScrollHeight:
        document.querySelector<HTMLElement>("[data-products-view]")?.scrollHeight,
      contentClientHeight:
        document.querySelector<HTMLElement>("[data-products-view]")?.clientHeight,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(dimensions.contentScrollHeight).toBeGreaterThan(dimensions.contentClientHeight ?? 0);
  });

  test("tablet hotspots remain direct product links", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/products");

    const product = products[5];
    await page.locator(`[data-product-hotspot="${product.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/products/${product.slug}$`));
    await expect(page.getByAltText(product.images.alt)).toBeVisible();
  });

  test("reduced motion replaces the camera move with a quick crossfade", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products");

    const startedAt = Date.now();
    await page
      .getByRole("navigation", { name: "Продукты на фотографии лаборатории" })
      .getByRole("link", { name: `Открыть ${products[0].fullTitle}` })
      .click();
    await expect(
      page
        .getByRole("navigation", { name: "Все продукты" })
        .getByRole("link", { name: products[0].menuTitle, exact: true }),
    ).toHaveAttribute("aria-current", "page", { timeout: 1_000 });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  test("a direct product URL does not preload the hidden laboratory overview", async ({ page }) => {
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") imageRequests.push(request.url());
    });

    await page.goto(`/products/${products[5].slug}`);
    await expect(page.getByAltText(products[5].images.alt)).toBeVisible();
    await page.waitForTimeout(500);

    expect(imageRequests.some((url) => url.includes("automation-lab-main"))).toBe(false);
  });

  test("overview and product view have no serious or critical accessibility violations", async ({
    page,
  }) => {
    for (const path of ["/products", `/products/${products[2].slug}`]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
    }
  });
});
