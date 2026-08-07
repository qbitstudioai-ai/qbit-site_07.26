import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_COOKIE_MAX_BYTES,
  ATTRIBUTION_COOKIE_NAME,
  ATTRIBUTION_VALUE_MAX_LENGTH,
  buildAttribution,
  parseAttributionCookie,
  readAttributionCookie,
  sanitizeAdValue,
  sanitizeLandingPath,
  serializeAttributionCookie,
} from "@/features/attribution/attribution";

/**
 * Модуль рекламной атрибуции. Проверяется прежде всего недоверенный ввод: метки задаёт тот, кто
 * прислал ссылку, а cookie правится в браузере вручную.
 */

const params = (query: string) => new URLSearchParams(query);
const CAPTURED_AT = new Date("2026-08-07T10:20:30.000Z");

describe("sanitizeAdValue", () => {
  it("убирает переводы строк и управляющие символы", () => {
    expect(sanitizeAdValue("yandex\n\rdirect\t")).toBe("yandexdirect");
    // Zero-width space и метка смены направления письма: невидимы, но меняют отображаемый текст.
    expect(sanitizeAdValue("dir​ect‮")).toBe("direct");
  });

  it("обрезает значение до 200 символов", () => {
    const value = sanitizeAdValue("а".repeat(500));
    expect(value).toHaveLength(ATTRIBUTION_VALUE_MAX_LENGTH);
  });

  it("пустое значение и не-строка становятся null", () => {
    expect(sanitizeAdValue("   ")).toBeNull();
    expect(sanitizeAdValue("\n\n")).toBeNull();
    expect(sanitizeAdValue(null)).toBeNull();
    expect(sanitizeAdValue(undefined)).toBeNull();
  });
});

describe("sanitizeLandingPath", () => {
  it("оставляет внутренний путь", () => {
    expect(sanitizeLandingPath("/blog/kak-avtomatizirovat")).toBe("/blog/kak-avtomatizirovat");
    expect(sanitizeLandingPath("/")).toBe("/");
  });

  it("не пропускает внешний адрес и протокол-относительный", () => {
    expect(sanitizeLandingPath("https://evil.example/phish")).toBe("/");
    expect(sanitizeLandingPath("//evil.example/phish")).toBe("/evil.example/phish");
    expect(sanitizeLandingPath("\\\\evil.example")).toBe("/evil.example");
  });

  it("отбрасывает строку запроса и якорь", () => {
    expect(sanitizeLandingPath("/contacts?utm_source=x#hash")).toBe("/contacts");
  });
});

describe("buildAttribution", () => {
  it("собирает запись, когда в адресе есть рекламные метки", () => {
    const attribution = buildAttribution(
      params("utm_source=yandex&utm_medium=cpc&utm_campaign=avto&yclid=123456789"),
      "/products",
      CAPTURED_AT,
    );

    expect(attribution).toEqual({
      yclid: "123456789",
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "avto",
      utm_content: null,
      utm_term: null,
      landing_path: "/products",
      captured_at: "2026-08-07T10:20:30.000Z",
    });
  });

  it("возвращает null без рекламных меток", () => {
    expect(buildAttribution(params(""), "/", CAPTURED_AT)).toBeNull();
    expect(buildAttribution(params("department=sales&section=task"), "/", CAPTURED_AT)).toBeNull();
  });

  it("хватает одного yclid — типичная ссылка Директа без utm", () => {
    const attribution = buildAttribution(params("yclid=98765"), "/contacts", CAPTURED_AT);
    expect(attribution?.yclid).toBe("98765");
    expect(attribution?.utm_source).toBeNull();
  });

  it("сохраняет только параметры из списка", () => {
    const attribution = buildAttribution(
      params("utm_source=yandex&gclid=google-id&fbclid=meta-id&ref=partner"),
      "/",
      CAPTURED_AT,
    );

    expect(Object.keys(attribution ?? {}).sort()).toEqual([
      "captured_at",
      "landing_path",
      "utm_campaign",
      "utm_content",
      "utm_medium",
      "utm_source",
      "utm_term",
      "yclid",
    ]);
    expect(JSON.stringify(attribution)).not.toContain("google-id");
    expect(JSON.stringify(attribution)).not.toContain("meta-id");
    expect(JSON.stringify(attribution)).not.toContain("partner");
  });

  it("санитайзит значения из адресной строки", () => {
    const attribution = buildAttribution(
      new URLSearchParams([
        ["utm_source", "yandex\nпод\rделка"],
        ["utm_term", "б".repeat(400)],
      ]),
      "/",
      CAPTURED_AT,
    );

    expect(attribution?.utm_source).toBe("yandexподделка");
    expect(attribution?.utm_term).toHaveLength(ATTRIBUTION_VALUE_MAX_LENGTH);
  });
});

describe("serializeAttributionCookie", () => {
  const attribution = buildAttribution(
    params("utm_source=yandex&utm_medium=cpc&utm_content=obyavlenie-1"),
    "/faq",
    CAPTURED_AT,
  )!;

  /**
   * Контракт кодирования. Значение отдаётся ЧИСТЫМ JSON: процентное кодирование делает тот, кто
   * cookie записывает (`NextResponse.cookies.set`). Пока функция кодировала сама, в браузер уезжало
   * двойное кодирование, и `parseAttributionCookie` не находил в нём JSON — атрибуция терялась на
   * всех заявках, а unit-тесты этого не видели, потому что кодировали ровно один раз.
   */
  it("отдаёт чистый JSON, а не процентную строку", () => {
    const value = serializeAttributionCookie(attribution);
    expect(value.startsWith("{")).toBe(true);
    expect(JSON.parse(value).utm_source).toBe("yandex");
  });

  it("значение переживает круг «запись → браузер → чтение»", () => {
    // Браузер возвращает то, что записал Next: значение под encodeURIComponent.
    const fromBrowser = encodeURIComponent(serializeAttributionCookie(attribution));
    expect(parseAttributionCookie(fromBrowser)).toEqual(attribution);
    // И тот же JSON без кодирования — так его отдаёт `NextResponse.cookies.get()`.
    expect(parseAttributionCookie(serializeAttributionCookie(attribution))).toEqual(attribution);
  });

  it("двойное кодирование источником не считается", () => {
    const doubled = encodeURIComponent(encodeURIComponent(serializeAttributionCookie(attribution)));
    expect(parseAttributionCookie(doubled)).toBeNull();
  });

  it("не выходит за лимит размера cookie даже на раздутом адресе", () => {
    // Кириллица под encodeURIComponent растёт в шесть раз: без сжатия браузер бы cookie не сохранил.
    const query = new URLSearchParams();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      query.set(key, "я".repeat(200));
    }
    query.set("yclid", "я".repeat(200));

    const value = serializeAttributionCookie(buildAttribution(query, "/", CAPTURED_AT)!);

    // Лимит считается по тому, что реально уедет в заголовке.
    expect(encodeURIComponent(value).length).toBeLessThanOrEqual(ATTRIBUTION_COOKIE_MAX_BYTES);
    // Сжатие сохраняет запись читаемой, а не превращает её в мусор.
    expect(parseAttributionCookie(value)?.utm_source).toMatch(/^я+$/);
  });
});

describe("parseAttributionCookie", () => {
  it("отвергает мусор вместо того, чтобы протащить его в заявку", () => {
    expect(parseAttributionCookie(null)).toBeNull();
    expect(parseAttributionCookie("")).toBeNull();
    expect(parseAttributionCookie("не json")).toBeNull();
    expect(parseAttributionCookie("%E0%A4%A")).toBeNull();
    expect(parseAttributionCookie(encodeURIComponent(JSON.stringify(["массив"])))).toBeNull();
    // Нет ни одной рекламной метки — это отсутствие источника, а не источник из пустых полей.
    expect(
      parseAttributionCookie(
        encodeURIComponent(
          JSON.stringify({ landing_path: "/", captured_at: "2026-08-07T10:20:30.000Z" }),
        ),
      ),
    ).toBeNull();
    // Подделанная метка времени.
    expect(
      parseAttributionCookie(
        encodeURIComponent(JSON.stringify({ utm_source: "x", captured_at: "вчера" })),
      ),
    ).toBeNull();
  });

  it("повторно санитайзит подделанную вручную cookie", () => {
    const forged = encodeURIComponent(
      JSON.stringify({
        utm_source: "yandex\nЗаявка с сайта — подделка",
        utm_term: "в".repeat(900),
        landing_path: "https://evil.example",
        captured_at: "2026-08-07T10:20:30.000Z",
        chat_id: "-100500",
      }),
    );

    const parsed = parseAttributionCookie(forged);

    expect(parsed?.utm_source).toBe("yandexЗаявка с сайта — подделка");
    expect(parsed?.utm_source).not.toContain("\n");
    expect(parsed?.utm_term).toHaveLength(ATTRIBUTION_VALUE_MAX_LENGTH);
    expect(parsed?.landing_path).toBe("/");
    expect(parsed).not.toHaveProperty("chat_id");
  });
});

describe("readAttributionCookie", () => {
  // Ровно то, что придёт в заголовке `Cookie` от браузера.
  const value = encodeURIComponent(
    serializeAttributionCookie(
      buildAttribution(params("utm_source=yandex"), "/pricing-check", CAPTURED_AT)!,
    ),
  );

  it("находит свою cookie среди чужих", () => {
    const header = `qbit_admin_session=abc.def; ${ATTRIBUTION_COOKIE_NAME}=${value}; other=1`;
    expect(readAttributionCookie(header)?.utm_source).toBe("yandex");
  });

  it("без cookie возвращает null", () => {
    expect(readAttributionCookie(null)).toBeNull();
    expect(readAttributionCookie("")).toBeNull();
    expect(readAttributionCookie("qbit_admin_session=abc.def")).toBeNull();
    // Похожее имя — не наше имя.
    expect(readAttributionCookie(`not_${ATTRIBUTION_COOKIE_NAME}=${value}`)).toBeNull();
  });
});
