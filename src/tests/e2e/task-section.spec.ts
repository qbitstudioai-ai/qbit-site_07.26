import { expect, test, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";

// Step 12.7 — раздел «Ваша задача». Настоящая доставка в Telegram здесь НЕ проверяется: она требует
// токена бота, которого в тестовом окружении нет и быть не должно. Вместо этого /api/task
// перехватывается, и проверяется то, что относится к фронтенду: что форма отправляет введённый
// текст, что показывает результат и что при ошибке не рапортует об успехе.
const copy = getHomepageCopy();
const task = copy.taskSection;
const VALID_MESSAGE = "Заявки приходят из чатов и почты, часть теряется — хочу единое окно.";

async function openOverview(page: Page) {
  await page.getByRole("link", { name: copy.secondaryCta }).click();
  await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
}

test.describe("Step 12.7 — раздел «Ваша задача»", () => {
  test("открывается с обзорного экрана и закрывается обратно", async ({ page }) => {
    await page.goto("/");
    await openOverview(page);

    await page.getByRole("button", { name: task.overviewCtaLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toBeVisible();
    await expect(page.getByText(task.intro)).toBeVisible();

    await page.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
  });

  test("доступен по прямому адресу ?section=task и закрывается по Escape", async ({ page }) => {
    await page.goto("/?section=task");
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toHaveCount(0);
  });

  test("доступен из рельса при открытом отделе, и наоборот", async ({ page }) => {
    await page.goto("/?department=sales");
    const rail = page.getByRole("navigation", { name: "Панель отделов" });

    await rail.getByRole("button", { name: task.railLabel }).click();
    await expect(page.getByRole("heading", { level: 2, name: task.headline })).toBeVisible();
    // Переключение прошло без возврата в overview — 10/90-раскладка та же.
    await expect(rail).toBeVisible();
  });

  test("отправляет введённый текст и показывает подтверждение", async ({ page }) => {
    let sentMessage: string | null = null;
    await page.route("**/api/task", async (route) => {
      sentMessage = JSON.parse(route.request().postData() ?? "{}").message;
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    await page.goto("/?section=task");
    await page.getByRole("textbox", { name: task.fieldLabel }).fill(VALID_MESSAGE);
    await page.getByRole("button", { name: task.submitLabel }).click();

    await expect(page.getByText(task.successMessage)).toBeVisible();
    expect(sentMessage).toBe(VALID_MESSAGE);
    // Поле очищается, чтобы человек не отправил тот же текст второй раз, не заметив.
    await expect(page.getByRole("textbox", { name: task.fieldLabel })).toHaveValue("");
  });

  test("при ошибке сервера сообщает об ошибке, а не об успехе", async ({ page }) => {
    // 503 — ровно то, что вернёт роут, если бот не настроен. Худший возможный исход здесь —
    // показать «отправлено»: человек будет ждать ответа, которого никто не получил.
    await page.route("**/api/task", (route) => route.fulfill({ status: 503, json: { ok: false } }));

    await page.goto("/?section=task");
    await page.getByRole("textbox", { name: task.fieldLabel }).fill(VALID_MESSAGE);
    await page.getByRole("button", { name: task.submitLabel }).click();

    await expect(page.getByText(task.errorMessage)).toBeVisible();
    await expect(page.getByText(task.successMessage)).toHaveCount(0);
    // Текст не потерян — человеку не придётся набирать его заново.
    await expect(page.getByRole("textbox", { name: task.fieldLabel })).toHaveValue(VALID_MESSAGE);
  });

  test("слишком короткий текст не уходит на сервер вовсе", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/task", async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    await page.goto("/?section=task");
    await page.getByRole("textbox", { name: task.fieldLabel }).fill("тест");
    await page.getByRole("button", { name: task.submitLabel }).click();

    await expect(page.getByText(task.tooShortMessage)).toBeVisible();
    expect(requestCount).toBe(0);
  });

  test("состояние отправки объявляется скринридеру, а не только цветом", async ({ page }) => {
    await page.route("**/api/task", (route) => route.fulfill({ status: 200, json: { ok: true } }));

    await page.goto("/?section=task");
    await page.getByRole("textbox", { name: task.fieldLabel }).fill(VALID_MESSAGE);
    await page.getByRole("button", { name: task.submitLabel }).click();

    // role="status" — то, что зачитает скринридер; проверяем, что результат попал именно туда.
    await expect(page.getByRole("status")).toContainText(task.successMessage);
  });
});
