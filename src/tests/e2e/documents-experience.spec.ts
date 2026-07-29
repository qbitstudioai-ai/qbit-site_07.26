import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { selectPublishedDocuments } from "../../features/documents/documents";
import { seedDocumentItems } from "../fixtures/seedContent";

// Каталог, которым заполняется база при установке: e2e проверяет именно исходное состояние сайта.
const documents = selectPublishedDocuments(seedDocumentItems);

const pageGeometry = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));

test.describe("раздел «Документы»", () => {
  test("открывается из шапки и помечает пункт активным", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products");

    const navigation = page.getByRole("navigation", { name: "Основная навигация" });
    const link = navigation.getByRole("link", { name: "Документы" });
    await expect(link).toHaveAttribute("href", "/documents");
    await link.click();

    await page.waitForURL("**/documents");
    await expect(page.getByRole("heading", { level: 1, name: "Документы" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Основная навигация" })
        .getByRole("link", { name: "Документы" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("кнопка «Назад» возвращает на главную", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const back = page.getByRole("link", { name: "Назад на главную" });
    await expect(back).toHaveAttribute("href", "/");
    await back.click();
    await page.waitForURL((url) => url.pathname === "/");
  });

  test("фотография архива доступна по адресу /dox/dox.png и лежит фоном", async ({
    page,
    request,
  }) => {
    const original = await request.get("/dox/dox.png");
    expect(original.status()).toBe(200);
    for (const derivative of ["/dox/dox-1600.avif", "/dox/dox-960.webp"]) {
      expect((await request.get(derivative)).status(), derivative).toBe(200);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const background = page.locator("[data-documents-background]");
    await expect(background).toHaveAttribute("src", "/dox/dox.png");
    const fit = await background.evaluate((node) => getComputedStyle(node).objectFit);
    expect(fit).toBe("cover");
    // Фон закрывает всю рабочую область экрана.
    const box = await background.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box!.height).toBeGreaterThan(viewport.height * 0.85);
  });

  test("десктоп: две колонки, активен первый документ, предпросмотр занимает 55–65% высоты", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const list = page.locator("[data-documents-list]");
    await expect(list.locator("button")).toHaveCount(documents.length);
    await expect(list.locator("button").first()).toHaveAttribute("aria-current", "true");
    await expect(page.locator(`[data-document-preview="${documents[0].id}"]`)).toBeVisible();

    const catalog = await list.boundingBox();
    const preview = await page.locator("[data-document-preview]").boundingBox();
    expect(catalog!.x + catalog!.width).toBeLessThanOrEqual(preview!.x + 1);

    const workspace = await page.locator('[data-documents-status="ready"]').boundingBox();
    // ~55–65% рабочей области под предпросмотр; замер идёт от внешней панели, поэтому её
    // собственные отступы съедают несколько процентов — отсюда границы 0,5…0,68.
    const share = preview!.height / workspace!.height;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.68);
  });

  test("смена активного документа обновляет предпросмотр, метаданные и ссылку скачивания", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const target = documents[3];
    await page.locator(`[data-document-item="${target.id}"]`).click();

    await expect(page.locator(`[data-document-preview="${target.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-document-item="${target.id}"]`)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("heading", { level: 2, name: target.title })).toBeVisible();
    // Точный адрес файла заранее неизвестен: имя в хранилище генерируется при загрузке, чтобы
    // одинаковые имена не затирали друг друга. Проверяется форма ссылки — она обязана вести в
    // объектное хранилище, а не в public.
    await expect(page.locator("[data-document-download]")).toHaveAttribute(
      "href",
      /^\/api\/files\/documents\/[\w-]+\.\w+$/,
    );
  });

  test("кнопка скачивания отдаёт реальный файл", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const download = page.locator("[data-document-download]");
    await expect(download).toHaveAttribute("download", "");

    const href = await download.getAttribute("href");
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  });

  test("документ без previewUrl показывает заглушку формата", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const withoutPreview = documents.find((item) => !item.previewUrl)!;
    await page.locator(`[data-document-item="${withoutPreview.id}"]`).click();

    const fallback = page.locator("[data-document-fallback]");
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText(withoutPreview.fileType.toUpperCase());
    await expect(fallback).toContainText("Предпросмотр недоступен");
  });

  test("категории фильтруют список", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    await page.getByRole("button", { name: "Юридические" }).click();
    const expected = documents.filter((item) => item.category === "legal");
    await expect(page.locator("[data-documents-list] button")).toHaveCount(expected.length);

    await page.getByRole("button", { name: "Все" }).click();
    await expect(page.locator("[data-documents-list] button")).toHaveCount(documents.length);
  });

  test("страница остаётся одним экраном на десктопе, планшете и мобильном", async ({ page }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 740 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/documents");
      await expect(page.getByRole("heading", { level: 1, name: "Документы" })).toBeVisible();

      const geometry = await pageGeometry(page);
      expect(
        geometry.scrollWidth,
        `горизонтальная прокрутка на ${viewport.width}`,
      ).toBeLessThanOrEqual(geometry.clientWidth);
      expect(
        geometry.scrollHeight,
        `вертикальная прокрутка на ${viewport.width}`,
      ).toBeLessThanOrEqual(geometry.clientHeight + 1);
    }
  });

  test("длинный каталог прокручивает только список, а не страницу", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");

    const list = page.locator("[data-documents-list]");
    expect(await list.evaluate((node) => getComputedStyle(node).overflowY)).toBe("auto");

    // Каталог из 20 записей: строки клонируются в DOM, чтобы проверить именно инвариант вёрстки,
    // не подменяя данные страницы.
    await list.evaluate((node) => {
      const template = node.querySelector("li")!;
      while (node.querySelectorAll("li").length < 20) {
        node.appendChild(template.cloneNode(true));
      }
    });
    await expect(list.locator("li")).toHaveCount(20);

    const scroll = await list.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }));
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);

    const geometry = await pageGeometry(page);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  });

  test("мобильный: сначала список, затем выбранный документ и возврат назад", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/documents");

    const list = page.locator("[data-documents-list]");
    await expect(list).toBeVisible();
    await expect(page.locator("[data-document-meta]")).toBeHidden();

    await page.locator(`[data-document-item="${documents[1].id}"]`).click();
    await expect(list).toBeHidden();
    await expect(page.locator("[data-document-meta]")).toBeVisible();
    const download = await page.locator("[data-document-download]").boundingBox();
    expect(download!.height).toBeGreaterThanOrEqual(44);
    expect(download!.y + download!.height).toBeLessThanOrEqual(844);

    const back = page.getByRole("button", { name: "Назад к документам" });
    await expect(back).toBeFocused();
    await back.click();
    await expect(list).toBeVisible();

    const geometry = await pageGeometry(page);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  });

  test("клавиатура: список проходится табом, Enter выбирает, Escape возвращает к списку", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/documents");

    const second = page.locator(`[data-document-item="${documents[1].id}"]`);
    await second.focus();
    await expect(second).toBeFocused();
    await second.press("Enter");

    await expect(page.locator(`[data-document-preview="${documents[1].id}"]`)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-documents-list]")).toBeVisible();
  });

  test("нет ошибок в консоли и нет serious/critical нарушений axe", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/documents");
    await expect(page.locator("[data-document-preview]")).toBeVisible();
    await page.locator(`[data-document-item="${documents[2].id}"]`).click();
    await expect(page.locator(`[data-document-preview="${documents[2].id}"]`)).toBeVisible();

    expect(errors).toEqual([]);

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });

  test("мобильный axe-скан раздела", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/documents");

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
});
