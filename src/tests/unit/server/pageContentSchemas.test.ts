import { afterEach, describe, expect, it, vi } from "vitest";
import seedPageContent from "../../../../data/seed/page-content.json";
import seedHomepageCopy from "../../../../data/homepage-copy.json";
import {
  PAGE_CONTENT_SCHEMAS,
  parseStoredPageContent,
  safePageCopy,
} from "@/server/content/pageContentSchemas";
import { PAGE_KEYS } from "@/server/repositories/pageContent";

/**
 * Строгие схемы общих текстов страниц (аудит 2026-07-27, SEC-09).
 *
 * До исправления сохранение принимало любой объект (`z.record(z.string(), z.unknown())`), поэтому
 * значение вроде `{"headline": {"a": 1}}` оседало в базе и роняло публичную страницу с «Objects are
 * not valid as a React child».
 */

const validProducts = seedPageContent.products;

// Восстановление в afterEach, а не в конце теста: упавший тест не доходил бы до `mockRestore()`,
// и следующий получал бы spy с чужими вызовами — одно падение превращалось в два.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("покрытие ключей страниц", () => {
  it("у каждого ключа из PAGE_KEYS есть своя схема", () => {
    for (const key of PAGE_KEYS) {
      expect(PAGE_CONTENT_SCHEMAS[key], `нет схемы для «${key}»`).toBeDefined();
    }
  });

  it("лишних схем без соответствующего ключа нет", () => {
    expect(Object.keys(PAGE_CONTENT_SCHEMAS).sort()).toEqual([...PAGE_KEYS].sort());
  });
});

describe("исходные тексты (seed) валидны — иначе fallback был бы бесполезен", () => {
  it.each(["products", "documents", "blog", "contacts"] as const)("%s", (key) => {
    const parsed = PAGE_CONTENT_SCHEMAS[key].safeParse(seedPageContent[key]);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("homepage", () => {
    const parsed = PAGE_CONTENT_SCHEMAS.homepage.safeParse(seedHomepageCopy);
    expect(parsed.success).toBe(true);
  });
});

describe("проверка при сохранении", () => {
  it("корректное содержимое принимается", () => {
    expect(PAGE_CONTENT_SCHEMAS.products.safeParse(validProducts).success).toBe(true);
  });

  it("пропущенное обязательное поле отклоняется", () => {
    const withoutHeadline: Record<string, unknown> = { ...validProducts };
    delete withoutHeadline.headline;

    expect(PAGE_CONTENT_SCHEMAS.products.safeParse(withoutHeadline).success).toBe(false);
  });

  it("поле неверного типа отклоняется — это и есть падение публичной страницы", () => {
    const broken = { ...validProducts, headline: { a: 1 } };

    const parsed = PAGE_CONTENT_SCHEMAS.products.safeParse(broken);

    expect(parsed.success).toBe(false);
  });

  it("вложенное поле неверного типа отклоняется", () => {
    const broken = { ...validProducts, tabs: { ...validProducts.tabs, prices: ["массив"] } };

    expect(PAGE_CONTENT_SCHEMAS.products.safeParse(broken).success).toBe(false);
  });

  it("массив с нестроковым элементом отклоняется", () => {
    const broken = {
      ...validProducts,
      implementationFormats: { ...validProducts.implementationFormats, items: ["ок", { a: 1 }] },
    };

    expect(PAGE_CONTENT_SCHEMAS.products.safeParse(broken).success).toBe(false);
  });

  it("слишком длинное значение отклоняется", () => {
    const broken = { ...validProducts, headline: "а".repeat(301) };

    expect(PAGE_CONTENT_SCHEMAS.products.safeParse(broken).success).toBe(false);
  });

  it("слишком длинный массив отклоняется", () => {
    const broken = {
      ...validProducts,
      implementationFormats: {
        ...validProducts.implementationFormats,
        items: Array.from({ length: 21 }, () => "пункт"),
      },
    };

    expect(PAGE_CONTENT_SCHEMAS.products.safeParse(broken).success).toBe(false);
  });

  it("лишние поля молча удаляются, а не ломают сохранение", () => {
    const withExtra = { ...validProducts, неизвестноеПоле: "значение" };

    const parsed = PAGE_CONTENT_SCHEMAS.products.safeParse(withExtra);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).not.toHaveProperty("неизвестноеПоле");
  });

  /**
   * Пустая строка — законный редакторский выбор (в текущей базе намеренно пусты «Адрес» и «Часы
   * работы» у контактов). Рендер она не роняет. Требование непустоты означало бы, что проверка сама
   * подменяет содержимое сайта seed-текстами.
   */
  it("пустая строка допускается: очищенное поле — выбор владельца, а не поломка", () => {
    const cleared = { ...seedPageContent.contacts, address: "", workingHours: "" };

    expect(PAGE_CONTENT_SCHEMAS.contacts.safeParse(cleared).success).toBe(true);
  });

  it("не объект отклоняется", () => {
    for (const value of ["строка", 42, null, ["массив"]]) {
      expect(PAGE_CONTENT_SCHEMAS.documents.safeParse(value).success).toBe(false);
    }
  });
});

describe("проверка при чтении и fallback", () => {
  it("повреждённая запись не роняет страницу — подставляются исходные тексты", () => {
    const seed = seedPageContent.documents;

    const result = safePageCopy("documents", { headline: { a: 1 } }, seed);

    expect(result).toEqual(seed);
  });

  /**
   * Замена точечная, а не «всё или ничего» (находка code review 2026-07-27, C-3).
   *
   * Первая редакция откатывала ВСЮ страницу из-за одного негодного поля: посетитель вместо
   * отредактированного текста получал демо-содержимое целиком.
   */
  it("негодным заменяется только испорченное поле, остальной текст владельца сохраняется", () => {
    const seed = seedPageContent.documents;
    const stored = {
      ...seed,
      headline: "Заголовок владельца",
      subheading: "Подзаголовок владельца",
      emptyMessage: { сломано: true },
    };

    const result = safePageCopy<typeof seed>("documents", stored, seed);

    expect(result.headline).toBe("Заголовок владельца");
    expect(result.subheading).toBe("Подзаголовок владельца");
    expect(result.emptyMessage).toBe(seed.emptyMessage);
  });

  it("ошибка уходит в серверный лог и не содержит значений полей", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    safePageCopy(
      "documents",
      { ...seedPageContent.documents, headline: { секрет: "не-должно-попасть-в-лог" } },
      seedPageContent.documents,
    );

    expect(spy).toHaveBeenCalledOnce();
    const logged = String(spy.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("headline");
    expect(logged).not.toContain("не-должно-попасть-в-лог");
    spy.mockRestore();
  });

  it("сообщение об ошибке не содержит stack trace", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    safePageCopy("blog", { headline: 5 }, seedPageContent.blog);

    const logged = String(spy.mock.calls[0]?.[0] ?? "");
    expect(logged).not.toMatch(/\bat\s+\w+.*:\d+:\d+/);
    spy.mockRestore();
  });

  it("корректные данные проходят без изменений — визуально ничего не меняется", () => {
    const result = safePageCopy("contacts", seedPageContent.contacts, seedPageContent.contacts);

    expect(result).toEqual(seedPageContent.contacts);
  });

  it("parseStoredPageContent сообщает путь негодного поля", () => {
    const parsed = parseStoredPageContent<unknown>("products", {
      ...validProducts,
      tabs: { ...validProducts.tabs, prices: 5 },
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.issues.join(" ")).toContain("tabs.prices");
  });
});

describe("схема отвергает ровно то, что роняет рендер", () => {
  /**
   * Смысловая проверка: любое значение, которое React не умеет отрисовать как узел (объект,
   * массив, функция), должно отклоняться схемой на КАЖДОМ строковом поле.
   */
  it.each([
    ["объект", { a: 1 }],
    ["массив", ["а", "б"]],
    ["число", 5],
    ["null", null],
  ])("%s в поле headline отклоняется", (_label, value) => {
    expect(
      PAGE_CONTENT_SCHEMAS.documents.safeParse({ ...seedPageContent.documents, headline: value })
        .success,
    ).toBe(false);
  });
});
