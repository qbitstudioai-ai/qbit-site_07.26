import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Рекламная атрибуция в настоящем браузере против production-сборки.
 *
 * Unit-тесты проверяют модуль и функцию middleware, но не отвечают на два вопроса, которые решает
 * только реальный сервер: срабатывает ли `matcher` на публичных страницах и сохраняет ли браузер
 * cookie такой, какой мы её выставляем.
 */

const COOKIE_NAME = "qbit_attr";

async function attributionCookie(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === COOKIE_NAME) ?? null;
}

async function attributionValue(context: BrowserContext) {
  const cookie = await attributionCookie(context);
  return cookie ? JSON.parse(decodeURIComponent(cookie.value)) : null;
}

test.describe("рекламный источник заявки", () => {
  test("переход с меткой запоминается, обычная навигация его не стирает", async ({
    page,
    context,
  }) => {
    // Заход по объявлению.
    await page.goto("/?yclid=98765&utm_source=yandex&utm_medium=cpc&utm_campaign=avtomatizaciya");

    const cookie = await attributionCookie(context);
    expect(cookie).not.toBeNull();
    // HttpOnly: клиентский скрипт метку не читает.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");

    const captured = await attributionValue(context);
    expect(captured.yclid).toBe("98765");
    expect(captured.utm_source).toBe("yandex");
    expect(captured.utm_medium).toBe("cpc");
    expect(captured.landing_path).toBe("/");

    // Обычная навигация по сайту: источник обязан пережить её без изменений.
    await page.goto("/contacts");
    await page.goto("/faq");
    expect(await attributionValue(context)).toEqual(captured);
  });

  test("новый рекламный переход заменяет прежний источник", async ({ page, context }) => {
    await page.goto("/?utm_source=yandex&utm_campaign=staraya");
    const first = await attributionValue(context);

    await page.goto("/contacts?utm_source=telegram&utm_campaign=novaya");
    const second = await attributionValue(context);

    expect(first.utm_source).toBe("yandex");
    expect(second.utm_source).toBe("telegram");
    expect(second.utm_campaign).toBe("novaya");
    expect(second.landing_path).toBe("/contacts");
  });

  test("ответ с меткой не отдаётся разделяемому кэшу", async ({ request }) => {
    // Проверка именно против production-сборки: заголовок ставит middleware, и важно, что Next не
    // перекрывает его собственным `s-maxage` уже после этого.
    const marked = await request.get("/?utm_source=yandex&yclid=98765");
    const cacheControl = marked.headers()["cache-control"] ?? "";
    expect(marked.headers()["set-cookie"] ?? "").toContain(COOKIE_NAME);
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("s-maxage");

    // Обычная страница остаётся кэшируемой: запрет касается только ответа с меткой.
    const plain = await request.get("/faq");
    expect(plain.headers()["set-cookie"] ?? "").not.toContain(COOKIE_NAME);
    expect(plain.headers()["cache-control"] ?? "").not.toContain("no-store");
  });

  test("запрос статики cookie не выставляет", async ({ request }) => {
    // `matcher` исключает файлы с точкой в пути: middleware не должен исполняться на каждой картинке.
    const response = await request.get("/favicon.ico?utm_source=yandex");
    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"] ?? "").not.toContain(COOKIE_NAME);
  });
});
