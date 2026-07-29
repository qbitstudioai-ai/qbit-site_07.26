import { expect, test } from "@playwright/test";
import { LEGACY_REDIRECTS, REDIRECT_EXCLUDED_URLS } from "../../lib/legacyRedirects";

/**
 * Переадресации старых адресов проверяются по реальным ответам production-сборки, а не по
 * конфигурации: состав списка стережёт unit-тест, а здесь важно ровно то, что увидит поисковый
 * робот — код ответа, заголовок `Location`, сохранённые параметры и отсутствие второго перехода.
 *
 * Запросы идут через `request`, а не `page`: браузер выполняет переадресацию сам и промежуточный
 * ответ до теста не доходит, поэтому «один переход» через страницу не доказать.
 */

const PERMANENT_CODES = [301, 308];
const REDIRECT_CODES = [301, 302, 303, 307, 308];

/** Ссылка из письма или рекламы: параметры обязаны пережить переход. */
const QUERY = "utm_source=newsletter&utm_medium=email&page=2";

function location(headers: Record<string, string>, baseURL: string): string {
  const raw = headers["location"];
  expect(raw, "ответ без заголовка Location").toBeTruthy();
  // Next.js может отдать как относительный путь, так и полный адрес — сравнивается путь с query.
  const url = new URL(raw, baseURL);
  return `${url.pathname}${url.search}`;
}

test.describe("переадресации старых адресов", () => {
  for (const { source, destination } of LEGACY_REDIRECTS) {
    test(`${source} → ${destination}: постоянный код, один переход, живой получатель`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.get(source, { maxRedirects: 0 });

      expect(PERMANENT_CODES, `${source}: код ${response.status()}`).toContain(response.status());
      expect(location(response.headers(), baseURL!)).toBe(destination);

      // Один переход, а не цепочка: получатель обязан отвечать содержимым, а не новой переадресацией.
      const target = await request.get(destination, { maxRedirects: 0 });
      expect(target.status(), `${destination}: получатель отвечает ${target.status()}`).toBe(200);
    });

    test(`${source} сохраняет query-параметры`, async ({ request, baseURL }) => {
      const response = await request.get(`${source}?${QUERY}`, { maxRedirects: 0 });

      expect(PERMANENT_CODES).toContain(response.status());
      expect(location(response.headers(), baseURL!)).toBe(`${destination}?${QUERY}`);
    });

    test(`${source} доводит до получателя со статусом 200`, async ({ request }) => {
      // Проверка «с точки зрения посетителя»: переход отрабатывает целиком и приводит на страницу.
      const response = await request.get(`${source}?${QUERY}`);

      expect(response.status()).toBe(200);
      expect(new URL(response.url()).pathname).toBe(destination);
    });
  }

  test("адреса из списка исключений не переадресуются", async ({ request }) => {
    for (const excluded of REDIRECT_EXCLUDED_URLS) {
      const response = await request.get(excluded, { maxRedirects: 0 });
      expect(
        REDIRECT_CODES,
        `${excluded}: адрес запрещено трогать, а он отвечает ${response.status()}`,
      ).not.toContain(response.status());
    }
  });

  test("действующие адреса разделов остались прямыми ответами", async ({ request }) => {
    // Сторож против случайного захвата соседних адресов шаблоном: разделы, к которым ведут
    // переадресации, сами обязаны отвечать без единого перехода.
    for (const route of ["/", "/products", "/blog"]) {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status(), `${route}: ответ ${response.status()}`).toBe(200);
    }
  });
});
