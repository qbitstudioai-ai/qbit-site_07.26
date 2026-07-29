import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { seedContactChannels as contactChannels } from "../fixtures/seedContent";
import { CONTACT_MIN_FILL_MS } from "../../features/contacts/contactSchema";

const CANONICAL = "https://allqbit.ru/contacts";
const PAGE_TITLE = "Контакты QBit-Studio-Ai — обсудить AI-автоматизацию";
const PAGE_DESCRIPTION =
  "Свяжитесь с QBit-Studio-Ai в Telegram, по телефону или email и отправьте заявку на автоматизацию бизнес-процесса.";

const VALID_PROCESS =
  "Менеджеры вручную переносят заявки из Telegram в CRM и тратят время на отчёты.";

/** Заявка в тестах уходит на заглушку, а не в настоящий n8n. */
async function mockContactApi(
  page: Page,
  outcome: { status: number; delayMs?: number } = { status: 200 },
) {
  const requests: unknown[] = [];
  await page.route("**/api/contact", async (route) => {
    requests.push(JSON.parse(route.request().postData() ?? "null"));
    if (outcome.delayMs) await new Promise((resolve) => setTimeout(resolve, outcome.delayMs));
    await route.fulfill({
      status: outcome.status,
      contentType: "application/json",
      body: JSON.stringify(outcome.status === 200 ? { ok: true } : { ok: false }),
    });
  });
  return requests;
}

async function fillValidForm(page: Page, overrides: Partial<Record<string, string>> = {}) {
  await page.getByLabel("Ваше имя").fill(overrides.name ?? "Павел");
  if (overrides.phone !== undefined) await page.getByLabel("Телефон").fill(overrides.phone);
  if (overrides.telegram !== undefined)
    await page.getByLabel("Telegram", { exact: true }).fill(overrides.telegram);
  await page
    .getByLabel("Какой процесс хотите автоматизировать")
    .fill(overrides.process ?? VALID_PROCESS);
}

const submitButton = (page: Page) => page.getByRole("button", { name: /Отправить заявку/ });

test.describe("/contacts — страница и содержание", () => {
  test("отдаёт 200, метаданные для индексации и весь текст в серверном HTML", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto("/contacts");
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(PAGE_TITLE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      PAGE_DESCRIPTION,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", CANONICAL);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", CANONICAL);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", PAGE_TITLE);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[name="keywords"]')).toHaveCount(0);

    // Индексация открыта.
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    expect((await request.get("/contacts")).headers()["x-robots-tag"] ?? "").not.toContain(
      "noindex",
    );

    // Один <main>, один H1, и он же первый заголовок документа.
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("h1, h2, h3, h4, h5, h6").first()).toHaveText("Обсудим вашу задачу");

    // Текст верхнего блока — в серверном HTML, а не собран клиентом.
    const html = await (await request.get("/contacts")).text();
    for (const text of [
      "КОНТАКТЫ",
      "Обсудим вашу задачу",
      "Перейдём в переговорную? Переговоры бесплатны, а хороший разговор порой бесценен.",
      "Свяжитесь с нами удобным способом или коротко опишите процесс, который хотите автоматизировать.",
      "Связаться напрямую",
      "Оставить заявку",
    ]) {
      expect(html, `нет в серверном HTML: ${text}`).toContain(text);
    }
  });

  test("все четыре контакта — настоящие ссылки внутри <address>", async ({ page, request }) => {
    await page.goto("/contacts");
    const html = await (await request.get("/contacts")).text();

    const address = page.locator("address");
    await expect(address).toHaveCount(1);
    // Курсив <address> по умолчанию снят: это интерфейс страницы, а не цитата.
    expect(await address.evaluate((node) => getComputedStyle(node).fontStyle)).toBe("normal");

    expect(contactChannels).toHaveLength(4);
    for (const channel of contactChannels) {
      // Контакт присутствует в серверном HTML обычным текстом, а не только в атрибуте ссылки.
      expect(html, `нет значения ${channel.value}`).toContain(channel.value);

      const link = address.locator(`a[href="${channel.href}"]`);
      await expect(link, `нет ссылки на ${channel.href}`).toHaveCount(1);
      await expect(link).toContainText(channel.value);

      if (channel.external) {
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
        await expect(link).toHaveAttribute("rel", /noreferrer/);
      } else {
        await expect(link).not.toHaveAttribute("target", "_blank");
      }

      // Клавиатурная достижимость каждого контакта.
      await link.focus();
      expect(await link.evaluate((node) => node === document.activeElement)).toBe(true);
    }

    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(page.locator('a[href=""]')).toHaveCount(0);
  });

  test("пункт «Контакты» в общем Header отмечен как текущая страница", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/contacts");

    const navigation = page.getByRole("navigation", { name: "Основная навигация" });
    const contacts = navigation.getByRole("link", { name: "Контакты" });
    await expect(contacts).toHaveAttribute("href", "/contacts");
    await expect(contacts).toHaveAttribute("aria-current", "page");
    // Отмечен ровно один пункт.
    await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1);
  });

  test("на других страницах общий Header не получил текущего пункта", async ({ page }) => {
    for (const route of ["/", "/faq", "/products", "/how-we-work"]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await expect(
        page.getByRole("navigation", { name: "Основная навигация" }).locator("a[aria-current]"),
        `aria-current появился на ${route}`,
      ).toHaveCount(0);
    }
  });

  test("/contacts присутствует в sitemap ровно один раз и совпадает с canonical", async ({
    request,
  }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap.match(new RegExp(`<loc>${CANONICAL}</loc>`, "g"))).toHaveLength(1);
    expect(sitemap).not.toContain(`${CANONICAL}/</loc>`);

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).not.toMatch(/Disallow:\s*\/contacts/);
    expect(robots).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});

test.describe("/contacts — форма заявки", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("у каждого поля есть настоящий label, а способы связи — в fieldset", async ({ page }) => {
    await page.goto("/contacts");

    for (const label of [
      "Ваше имя",
      "Телефон",
      "Telegram",
      "Какой процесс хотите автоматизировать",
    ]) {
      await expect(page.getByLabel(label, { exact: true }), `нет поля «${label}»`).toHaveCount(1);
    }

    const fieldset = page.locator("form fieldset");
    await expect(fieldset).toHaveCount(1);
    await expect(fieldset.locator("legend")).toHaveText("Как с вами связаться");
    await expect(
      page.getByText("Укажите телефон или Telegram — достаточно одного контакта."),
    ).toBeVisible();
    await expect(submitButton(page)).toHaveAttribute("type", "submit");
  });

  test("пустая форма не отправляется: ошибки, фокус на первом поле, запроса нет", async ({
    page,
  }) => {
    const requests = await mockContactApi(page);
    await page.goto("/contacts");

    await submitButton(page).click();

    await expect(page.getByText("Укажите ваше имя.")).toBeVisible();
    await expect(page.getByText("Укажите телефон или Telegram.")).toBeVisible();
    await expect(page.getByText("Коротко опишите процесс или задачу.")).toBeVisible();

    const name = page.getByLabel("Ваше имя");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAttribute("aria-describedby", /.+/);
    expect(await name.evaluate((node) => node === document.activeElement)).toBe(true);

    expect(requests).toHaveLength(0);
  });

  test("телефон без Telegram принимается", async ({ page }) => {
    const requests = await mockContactApi(page);
    await page.goto("/contacts");

    await fillValidForm(page, { phone: "+7 900 000-00-00" });
    await submitButton(page).click();

    await expect(page.getByText("Спасибо! Заявка отправлена.", { exact: false })).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test("Telegram без телефона принимается", async ({ page }) => {
    const requests = await mockContactApi(page);
    await page.goto("/contacts");

    await fillValidForm(page, { telegram: "Promt_Pavel" });
    await submitButton(page).click();

    await expect(page.getByText("Спасибо! Заявка отправлена.", { exact: false })).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test("неверный Telegram и неверный телефон отклоняются с понятным текстом", async ({ page }) => {
    const requests = await mockContactApi(page);
    await page.goto("/contacts");

    await fillValidForm(page, { telegram: "https://t.me/Promt_Pavel" });
    await submitButton(page).click();
    await expect(page.getByText("Укажите Telegram в формате @username.")).toBeVisible();

    await page.getByLabel("Telegram", { exact: true }).fill("");
    await page.getByLabel("Телефон").fill("12345");
    await submitButton(page).click();
    await expect(page.getByText("Проверьте формат телефона.")).toBeVisible();

    expect(requests).toHaveLength(0);
  });

  test("во время отправки кнопка заблокирована и повторное нажатие не создаёт второй заявки", async ({
    page,
  }) => {
    const requests = await mockContactApi(page, { status: 200, delayMs: 1500 });
    await page.goto("/contacts");

    await fillValidForm(page, { phone: "+7 900 000-00-00" });
    await submitButton(page).click();

    const sending = page.getByRole("button", { name: "Отправляем…" });
    await expect(sending).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
    // Значения не очищаются до подтверждённого успеха.
    await expect(page.getByLabel("Ваше имя")).toHaveValue("Павел");

    await sending.click({ force: true }).catch(() => {});
    await expect(page.getByText("Спасибо! Заявка отправлена.", { exact: false })).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test("успешная отправка очищает поля, сохраняет сообщение и переводит на него фокус", async ({
    page,
  }) => {
    await mockContactApi(page);
    await page.goto("/contacts");

    await fillValidForm(page, { phone: "+7 900 000-00-00", telegram: "Promt_Pavel" });
    await submitButton(page).click();

    const success = page.getByText(
      "Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному контакту.",
    );
    await expect(success).toBeVisible();
    expect(await success.evaluate((node) => node === document.activeElement)).toBe(true);
    await expect(page.locator('form [role="status"]')).toContainText("Спасибо!");

    for (const label of [
      "Ваше имя",
      "Телефон",
      "Telegram",
      "Какой процесс хотите автоматизировать",
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
    }
    // Redirect не выполняется — человек остаётся на странице.
    expect(new URL(page.url()).pathname).toBe("/contacts");
  });

  test("ошибка доставки показывает нейтральное сообщение, сохраняет данные и даёт прямые контакты", async ({
    page,
  }) => {
    await mockContactApi(page, { status: 502 });
    await page.goto("/contacts");

    await fillValidForm(page, { phone: "+7 900 000-00-00" });
    await submitButton(page).click();

    // role="alert" есть и у route announcer Next — берём live-регион самой формы.
    const alert = page.locator('form [role="alert"]');
    await expect(alert).toContainText(
      "Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами напрямую.",
    );
    // Внутренние детали наружу не попадают.
    await expect(alert).not.toContainText(/502|n8n|webhook|reason/i);
    await expect(alert.getByRole("link", { name: /Promt_Pavel/ })).toBeVisible();

    await expect(page.getByLabel("Ваше имя")).toHaveValue("Павел");
    await expect(page.getByLabel("Какой процесс хотите автоматизировать")).toHaveValue(
      VALID_PROCESS,
    );
    await expect(submitButton(page)).toBeEnabled();
  });

  test("форма заполняется и отправляется с клавиатуры", async ({ page }) => {
    const requests = await mockContactApi(page);
    await page.goto("/contacts");

    await page.getByLabel("Ваше имя").focus();
    await page.keyboard.type("Павел");
    await page.keyboard.press("Tab");
    await page.keyboard.type("+7 900 000-00-00");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type(VALID_PROCESS);
    await page.keyboard.press("Tab");
    await expect(submitButton(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Спасибо! Заявка отправлена.", { exact: false })).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test("браузер отправляет заявку только на собственный роут и не знает адреса n8n", async ({
    page,
  }) => {
    const external: string[] = [];
    const ownHost = new URL(test.info().project.use.baseURL ?? "http://localhost:3200").host;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.host !== ownHost) external.push(url.href);
    });

    const requests = await mockContactApi(page);
    await page.goto("/contacts");
    await fillValidForm(page, { phone: "+7 900 000-00-00" });
    await submitButton(page).click();
    await expect(page.getByText("Спасибо! Заявка отправлена.", { exact: false })).toBeVisible();

    expect(external).toEqual([]);
    expect(requests).toHaveLength(1);

    // Клиент шлёт honeypot пустым и служебное время заполнения; персональные данные — как введены.
    const payload = requests[0] as Record<string, unknown>;
    expect(payload.name).toBe("Павел");
    expect(payload.company).toBe("");
    expect(typeof payload.elapsedMs).toBe("number");
  });

  test("ни webhook-адрес, ни секрет не попадают в клиентский код и HTML", async ({
    page,
    request,
  }) => {
    const scripts: string[] = [];
    page.on("response", (response) => {
      if (response.url().endsWith(".js")) scripts.push(response.url());
    });

    await page.goto("/contacts", { waitUntil: "networkidle" });
    const html = await (await request.get("/contacts")).text();

    const forbidden = [
      "N8N_CONTACT_WEBHOOK_URL",
      "N8N_CONTACT_WEBHOOK_SECRET",
      "X-QBit-Webhook-Secret",
    ];
    for (const needle of forbidden) {
      expect(html, `${needle} утёк в HTML`).not.toContain(needle);
    }

    expect(scripts.length).toBeGreaterThan(0);
    for (const url of scripts) {
      const body = await (await request.get(url)).text();
      for (const needle of forbidden) {
        expect(body, `${needle} утёк в ${url}`).not.toContain(needle);
      }
    }
  });
});

test.describe("/contacts — серверная проверка заявки", () => {
  /**
   * Прямые обращения к роуту в обход формы. Настоящий n8n при этом не вызывается: переменная
   * окружения на тестовом сервере не задана, поэтому корректная заявка честно получает 503, а
   * неверная отсекается валидацией ещё раньше.
   */
  const valid = {
    name: "Павел",
    phone: "+7 900 000-00-00",
    telegram: "",
    process: VALID_PROCESS,
    elapsedMs: CONTACT_MIN_FILL_MS + 5000,
  };

  test("отвергает запрос не в JSON", async ({ request }) => {
    const response = await request.post("/api/contact", {
      headers: { "content-type": "text/plain" },
      data: JSON.stringify(valid),
    });
    expect(response.status()).toBe(415);
  });

  test("повторно валидирует данные независимо от формы", async ({ request }) => {
    for (const body of [
      { ...valid, phone: "", telegram: "" },
      { ...valid, name: " " },
      { ...valid, process: "коротко" },
      { ...valid, phone: "", telegram: "https://t.me/x" },
      { ...valid, phone: "12345" },
    ]) {
      const response = await request.post("/api/contact", { data: body });
      expect(response.status(), JSON.stringify(body)).toBe(400);
    }
  });

  test("без настроенного webhook честно отвечает 503 и не раскрывает конфигурацию", async ({
    request,
  }) => {
    const response = await request.post("/api/contact", { data: valid });
    expect(response.status()).toBe(503);
    const body = await response.text();
    expect(body).toContain("not-configured");
    expect(body).not.toContain("http");
  });
});

test.describe("/contacts — раскладка и доступность", () => {
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.width}×${viewport.height}: без горизонтального overflow, ключевые элементы на месте`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/contacts");

      // Геометрия измеряется ПОСЛЕ появления панели: во время анимации выхода (420 мс) она сдвинута
      // на 14 px, и замер в этот момент описывал бы не итоговую раскладку, а промежуточный кадр.
      await expect(submitButton(page)).toBeVisible();
      await page.waitForFunction(
        () =>
          document.getAnimations().every((animation) => animation.playState !== "running") &&
          document.fonts.status === "loaded",
      );

      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);

      const isDesktopScene = viewport.width > 900 && viewport.width / viewport.height > 1.2;
      if (isDesktopScene) {
        // Десктоп: один экран без общей вертикальной прокрутки.
        expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
      }

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Перейдём в переговорную?", { exact: false })).toBeVisible();
      await expect(submitButton(page)).toBeVisible();

      // Кнопка отправки и контакты не выходят за пределы экрана по ширине.
      for (const locator of [submitButton(page), page.locator("address a").last()]) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("на мобильном форма идёт раньше прямых контактов и работает обычная прокрутка документа", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contacts");

    const formTop = (await page.locator("form").boundingBox())!.y;
    const contactsTop = (await page.locator("address").boundingBox())!.y;
    expect(formTop).toBeLessThan(contactsTop);

    // Прокрутка именно документа, без вложенного scroll-контейнера.
    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return window.scrollY;
    });
    expect(scrolled).toBeGreaterThan(0);

    // Последний контакт достижим после прокрутки.
    await expect(page.locator("address a").last()).toBeInViewport();
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`Axe без serious и critical на ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/contacts");

      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
    });

    test(`Axe без serious и critical при показанных ошибках формы на ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/contacts");
      await submitButton(page).click();
      await expect(page.getByText("Укажите ваше имя.")).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
    });
  }

  test("prefers-reduced-motion: панель появляется без анимации", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/contacts");

    // Панель — общий родитель секции контактов и секции формы.
    const panel = page.locator("main section:has(address)").locator("xpath=..");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await panel.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");

    await context.close();
  });
});
