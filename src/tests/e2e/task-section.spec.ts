import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";

// Step 12.7 — раздел «Ваша задача». Настоящая доставка в Telegram здесь НЕ проверяется: она требует
// токена бота, которого в тестовом окружении нет и быть не должно. Вместо этого /api/contact
// перехватывается, и проверяется то, что относится к фронтенду: что контактная форма отправляет
// введённую заявку, показывает результат и при ошибке не рапортует об успехе.
const copy = getHomepageCopy();
const task = copy.taskSection;
const CONTACT_NAME = "Павел";
const CONTACT_TELEGRAM = "@pavel_test";
const CONTACT_PROCESS = "Менеджеры вручную переносят заявки из Telegram в CRM и теряют часть обращений.";

async function fillContactForm(page: Page) {
  await page.getByRole("textbox", { name: "Ваше имя" }).fill(CONTACT_NAME);
  await page.getByRole("textbox", { name: "Telegram" }).fill(CONTACT_TELEGRAM);
  await page
    .getByRole("textbox", { name: "Какой процесс хотите автоматизировать" })
    .fill(CONTACT_PROCESS);
}

async function openOverview(page: Page) {
  await page.getByRole("link", { name: copy.secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

async function waitForTaskClientHandlers(page: Page) {
  const closeButton = page.getByRole("button", { name: "Закрыть" });
  await expect
    .poll(
      () =>
        closeButton.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { message: "task controls should be hydrated before testing a window keydown listener" },
    )
    .toBe(true);
  await closeButton.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test.describe("Step 12.7 — раздел «Ваша задача»", () => {
  test("CTA обзорного экрана ведёт напрямую в Telegram и не открывает форму", async ({ page }) => {
    await page.goto("/");
    await openOverview(page);

    const cta = page.getByRole("link", { name: copy.officeOverview.ctaAccessibleLabel });
    await expect(cta).toHaveAttribute("href", copy.contactHref);
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toHaveCount(0);
  });

  test("доступен по прямому адресу ?section=task и закрывается по Escape", async ({ page }) => {
    await page.goto("/?section=task");
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toBeVisible();
    await waitForTaskClientHandlers(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toHaveCount(0);
  });

  // Step 17: возврат фокуса после закрытия «Вашей задачи». До правки этого НЕ проверял никто —
  // тест выше утверждал, что раздел закрылся, но не куда делся фокус. Измерено на milestone review:
  // на desktop и tablet фокус уходил на <body> (машина искала `hotspot-task`, которого не
  // существует), а на мобильном попадал на карусель, то есть «работал» по совпадению.
  // Нарушение docs/11 прожило до конца этапа именно из-за этого пробела.
  for (const { name, width, height } of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 1024, height: 768 },
    { name: "mobile", width: 375, height: 812 },
  ]) {
    test(`${name}: закрытие «Вашей задачи» возвращает фокус на открывший контрол (Step 17)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/?section=task");
      await expect(page.getByRole("heading", { level: 2, name: task.headline })).toBeVisible();
      await waitForTaskClientHandlers(page);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { level: 2, name: task.headline })).toHaveCount(0);

      // Фокус обязан вернуться на контрол, который раздел открыл, а не на <body>.
      const focused = await page.evaluate(() => ({
        tag: document.activeElement?.tagName ?? "",
        id: document.activeElement?.id ?? "",
      }));
      expect(
        focused.tag,
        `фокус ушёл на ${focused.tag} — пользователь потерял место (docs/11)`,
      ).not.toBe("BODY");
      expect(focused.id).toBe("task-entry-button");
    });
  }

  test("доступен из рельса при открытом отделе, и наоборот", async ({ page }) => {
    await page.goto("/?department=sales");
    const rail = page.getByRole("navigation", { name: "Панель отделов" });

    await rail.getByRole("button", { name: task.railLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toBeVisible();
    // Переключение прошло без возврата в overview — 10/90-раскладка та же.
    await expect(rail).toBeVisible();
  });

  test("отправляет заявку через форму контактов и показывает подтверждение", async ({ page }) => {
    let sentRequest: Record<string, unknown> | null = null;
    await page.route("**/api/contact", async (route) => {
      sentRequest = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    await page.goto("/?section=task");
    await fillContactForm(page);
    await page.getByRole("button", { name: "Отправить заявку" }).click();

    await expect(page.getByText("Спасибо! Заявка отправлена.")).toBeVisible();
    expect(sentRequest).toMatchObject({
      name: CONTACT_NAME,
      telegram: CONTACT_TELEGRAM,
      process: CONTACT_PROCESS,
    });
    // Поля очищаются, чтобы человек не отправил ту же заявку второй раз, не заметив.
    await expect(page.getByRole("textbox", { name: "Ваше имя" })).toHaveValue("");
    await expect(
      page.getByRole("textbox", { name: "Какой процесс хотите автоматизировать" }),
    ).toHaveValue("");
  });

  test("при ошибке сервера сообщает об ошибке, а не об успехе", async ({ page }) => {
    // 503 — ровно то, что вернёт роут, если бот не настроен. Худший возможный исход здесь —
    // показать «отправлено»: человек будет ждать ответа, которого никто не получил.
    await page.route("**/api/contact", (route) =>
      route.fulfill({ status: 503, json: { ok: false } }),
    );

    await page.goto("/?section=task");
    await fillContactForm(page);
    await page.getByRole("button", { name: "Отправить заявку" }).click();

    await expect(page.getByText("Не удалось отправить заявку.")).toBeVisible();
    await expect(page.getByText("Спасибо! Заявка отправлена.")).toHaveCount(0);
    // Текст не потерян — человеку не придётся набирать его заново.
    await expect(
      page.getByRole("textbox", { name: "Какой процесс хотите автоматизировать" }),
    ).toHaveValue(CONTACT_PROCESS);
  });

  test("без телефона или Telegram заявка не уходит на сервер вовсе", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/contact", async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    await page.goto("/?section=task");
    await page.getByRole("textbox", { name: "Ваше имя" }).fill(CONTACT_NAME);
    await page
      .getByRole("textbox", { name: "Какой процесс хотите автоматизировать" })
      .fill(CONTACT_PROCESS);
    await page.getByRole("button", { name: "Отправить заявку" }).click();

    await expect(page.getByText("Укажите телефон или Telegram.")).toBeVisible();
    expect(requestCount).toBe(0);
  });

  test("состояние отправки объявляется скринридеру, а не только цветом", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({ status: 200, json: { ok: true } }),
    );

    await page.goto("/?section=task");
    await fillContactForm(page);
    await page.getByRole("button", { name: "Отправить заявку" }).click();

    // role="status" — то, что зачитает скринридер; проверяем, что результат попал именно туда.
    await expect(page.getByRole("status")).toContainText("Спасибо! Заявка отправлена.");
  });
});
