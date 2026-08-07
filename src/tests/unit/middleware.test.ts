import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  ATTRIBUTION_COOKIE_NAME,
  buildAttribution,
  parseAttributionCookie,
  serializeAttributionCookie,
} from "@/features/attribution/attribution";
import { middleware } from "@/middleware";

/**
 * Запись рекламного источника в middleware.
 *
 * Проверяется именно семантика ПОСЛЕДНЕГО касания: переход с меткой перезаписывает cookie, переход
 * без меток не трогает её вообще. Ошибка в любую сторону тихо портит отчётность — либо первый
 * случайный переход навсегда присваивает себе все заявки, либо обычный клик по меню стирает
 * источник, за который заплачено.
 *
 * Административная часть middleware здесь не проверяется: у неё своя история (см. e2e
 * `public-routes.spec.ts`), а эти тесты — только про атрибуцию.
 */

function request(url: string, cookieHeader?: string) {
  return new NextRequest(new URL(url, "https://allqbit.ru"), {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

/** Атрибуция, «уже лежащая» в браузере с прошлого перехода. */
const EARLIER = buildAttribution(
  new URLSearchParams("utm_source=yandex&utm_campaign=staraya&yclid=111"),
  "/blog",
  new Date("2026-06-01T09:00:00.000Z"),
)!;
// Кодирование — как у браузера: в заголовке `Cookie` значение всегда процентно закодировано.
const EARLIER_COOKIE = `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(serializeAttributionCookie(EARLIER))}`;

/** `Set-Cookie` для нашей cookie, если middleware её выставил. */
function setCookieHeader(response: Response): string | null {
  const header = response.headers.get("set-cookie");
  if (!header || !header.includes(`${ATTRIBUTION_COOKIE_NAME}=`)) return null;
  return header;
}

describe("middleware: рекламная атрибуция", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("переход с рекламными метками записывает cookie", async () => {
    const response = await middleware(
      request("/products?utm_source=yandex&utm_medium=cpc&yclid=98765"),
    );

    const header = setCookieHeader(response)!;
    expect(header).toBeTruthy();
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=lax");
    expect(header).toContain("Path=/");
    expect(header).toContain(`Max-Age=${ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}`);

    const stored = parseAttributionCookie(
      response.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value ?? null,
    );
    expect(stored?.utm_source).toBe("yandex");
    expect(stored?.utm_medium).toBe("cpc");
    expect(stored?.yclid).toBe("98765");
    expect(stored?.landing_path).toBe("/products");
  });

  /**
   * Регрессия: значение в `Set-Cookie` должно быть закодировано РОВНО один раз. При двойном
   * кодировании браузер честно вернёт cookie обратно, но сервер увидит в ней не JSON, а процентную
   * строку, и `attribution` во всех заявках окажется null. Поймано e2e против production-сборки.
   */
  it("значение в Set-Cookie закодировано один раз и читается сервером", async () => {
    const response = await middleware(request("/?utm_source=yandex&utm_campaign=leto"));

    const header = setCookieHeader(response)!;
    const fromHeader = header
      .slice(header.indexOf(`${ATTRIBUTION_COOKIE_NAME}=`) + ATTRIBUTION_COOKIE_NAME.length + 1)
      .split(";")[0];

    // Так это значение прочитает `/api/contact` из заголовка `Cookie`.
    const parsed = parseAttributionCookie(fromHeader);
    expect(parsed?.utm_source).toBe("yandex");
    expect(parsed?.utm_campaign).toBe("leto");
  });

  it("одного yclid достаточно — ссылка Директа без utm", async () => {
    const response = await middleware(request("/?yclid=98765"));
    expect(setCookieHeader(response)).toBeTruthy();
  });

  /**
   * Персональный `Set-Cookie` не должен ужиться с разделяемым кэшем: страницы отдаются с
   * `s-maxage`, и промежуточный кэш иначе раздал бы метку одного перехода всем следующим
   * посетителям, приписав их заявки чужой кампании.
   */
  it("ответ с cookie запрещён к кэшированию, обычный ответ не трогает Cache-Control", async () => {
    const withMarker = await middleware(request("/?utm_source=yandex"));
    expect(withMarker.headers.get("cache-control")).toBe("private, no-store");

    const plain = await middleware(request("/contacts", EARLIER_COOKIE));
    expect(plain.headers.get("cache-control")).toBeNull();
  });

  it("новый рекламный переход перезаписывает прежний источник", async () => {
    const response = await middleware(
      request("/contacts?utm_source=telegram&utm_campaign=novaya", EARLIER_COOKIE),
    );

    const stored = parseAttributionCookie(
      response.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value ?? null,
    );
    expect(stored?.utm_source).toBe("telegram");
    expect(stored?.utm_campaign).toBe("novaya");
    expect(stored?.landing_path).toBe("/contacts");
    // Метки прежнего перехода не подмешиваются к новому: источник один, а не склейка двух.
    expect(stored?.yclid).toBeNull();
    expect(stored?.captured_at).not.toBe(EARLIER.captured_at);
  });

  it("обычный заход не трогает и не стирает cookie", async () => {
    for (const url of ["/", "/contacts", "/?department=sales&section=task", "/blog/statya"]) {
      const response = await middleware(request(url, EARLIER_COOKIE));
      expect(setCookieHeader(response)).toBeNull();
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("нерекламные параметры источником не считаются", async () => {
    const response = await middleware(request("/?gclid=google&fbclid=meta&ref=partner"));
    expect(setCookieHeader(response)).toBeNull();
  });

  it("пустая метка не создаёт пустой источник", async () => {
    const response = await middleware(request("/?utm_source=&utm_medium=%20"));
    expect(setCookieHeader(response)).toBeNull();
  });

  it("санитайзит метку и держит cookie в пределах лимита браузера", async () => {
    const query = new URLSearchParams();
    query.set("utm_source", "yandex\nподделка");
    query.set("utm_term", "я".repeat(500));
    query.set("utm_content", "я".repeat(500));
    query.set("utm_campaign", "я".repeat(500));

    const response = await middleware(request(`/?${query.toString()}`));
    const value = response.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value ?? "";

    // Считаем то, что реально уедет в заголовке: кириллица под кодированием растёт в шесть раз.
    expect(encodeURIComponent(value).length).toBeLessThanOrEqual(3800);
    const stored = parseAttributionCookie(value);
    expect(stored?.utm_source).toBe("yandexподделка");
    expect(stored?.utm_term?.length).toBeLessThanOrEqual(200);
  });

  it("в production cookie помечается Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await middleware(request("/?utm_source=yandex"));
    expect(setCookieHeader(response)).toContain("Secure");
  });

  it("административные страницы рекламный источник не пишут", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const response = await middleware(request("/admin?utm_source=yandex"));

    // Гость разворачивается на /login, и никакой cookie при этом не появляется.
    expect(response.status).toBe(307);
    expect(setCookieHeader(response)).toBeNull();
  });
});
