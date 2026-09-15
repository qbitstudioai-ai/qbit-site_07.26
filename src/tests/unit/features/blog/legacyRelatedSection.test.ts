// @vitest-environment node
import { describe, expect, it } from "vitest";
import seedArticles from "../../../../../data/seed/articles.json";
import { extractLegacyRelatedSection } from "@/features/blog/legacyRelatedSection.mjs";

/**
 * Extractor legacy-секции «Материалы по теме» (Amendment 61 / REL-02F.1).
 *
 * Проверяется договор fail-closed: ровно одна форма секции распознаётся, всё похожее, но иное —
 * отказ с кодом; диапазон указывает в исходную строку; порядок целей — порядок текста.
 */

const item = (href: string, label = "Материал") => `- «[${label}](${href})» — пояснение.`;

function body(lines: string[], heading = "**Материалы по теме:**"): string {
  return [
    "**Краткий ответ:** текст.",
    "",
    "**Источники:**",
    item("https://example.com/a"),
    "",
    heading,
    ...lines,
  ].join("\n");
}

function extractOk(markdown: string) {
  const result = extractLegacyRelatedSection(markdown);
  if (result.state !== "ok")
    throw new Error(`ожидалась секция, получено ${JSON.stringify(result)}`);
  return result;
}

function errorCodes(markdown: string): string[] {
  const result = extractLegacyRelatedSection(markdown);
  if (result.state !== "invalid") throw new Error(`ожидался отказ, получено ${result.state}`);
  return result.errors.map((error) => error.code);
}

describe("extractLegacyRelatedSection: распознавание", () => {
  it("правильная секция: цели в порядке текста, тип, slug, href и подпись", () => {
    const markdown = body([
      item("/products/leads-to-crm", "Сбор заявок"),
      item("/blog/sayt-crm", "Связка каналов"),
      item("/cases/analiz-zvonkov", "Кейс"),
    ]);
    const result = extractOk(markdown);

    expect(result.heading).toBe("**Материалы по теме:**");
    expect(result.targets).toEqual([
      {
        type: "product",
        slug: "leads-to-crm",
        href: "/products/leads-to-crm",
        label: "Сбор заявок",
        line: 7,
      },
      {
        type: "article",
        slug: "sayt-crm",
        href: "/blog/sayt-crm",
        label: "Связка каналов",
        line: 8,
      },
      {
        type: "case",
        slug: "analiz-zvonkov",
        href: "/cases/analiz-zvonkov",
        label: "Кейс",
        line: 9,
      },
    ]);
    expect(result.lines).toEqual({ first: 6, last: 9 });
  });

  it("canonical URL статьи https://allqbit.ru/blog/<slug> — article target, href исходный", () => {
    const href = "https://allqbit.ru/blog/test-article";
    const result = extractOk(body([item(href, "Статья"), item("/products/a")]));
    expect(result.targets[0]).toEqual({
      type: "article",
      slug: "test-article",
      href,
      label: "Статья",
      line: 7,
    });
  });

  it("заголовок без двоеточия допустим", () => {
    expect(extractOk(body([item("/products/a")], "**Материалы по теме**")).targets).toHaveLength(1);
  });

  it("отсутствие секции — no_section, а не ошибка", () => {
    expect(extractLegacyRelatedSection("**Краткий ответ:** текст.\n\n- пункт")).toEqual({
      state: "no_section",
    });
  });

  it("раздел после секции ограничивает её: диапазон точен, текст после не входит", () => {
    const markdown = [
      "Вступление.",
      "",
      "**Материалы по теме:**",
      item("/products/a"),
      item("/cases/b"),
      "",
      "**Источники:**",
      item("https://example.com/x"),
    ].join("\n");
    const result = extractOk(markdown);

    expect(markdown.slice(result.range.start, result.range.end)).toBe(
      ["**Материалы по теме:**", item("/products/a"), item("/cases/b")].join("\n"),
    );
    expect(result.targets.map((target) => target.slug)).toEqual(["a", "b"]);
    expect(result.lines).toEqual({ first: 3, last: 5 });
  });

  it("CRLF: диапазон указывает в исходную строку без перевода строки в конце", () => {
    const markdown = [
      "Текст.",
      "",
      "**Материалы по теме**",
      item("/products/a"),
      item("/blog/b"),
      "",
    ].join("\r\n");
    const result = extractOk(markdown);

    expect(markdown.slice(result.range.start, result.range.end)).toBe(
      ["**Материалы по теме**", item("/products/a"), item("/blog/b")].join("\r\n"),
    );
    expect(result.targets.map((target) => target.type)).toEqual(["product", "article"]);
  });

  it("заголовок внутри блока кода секцией не считается", () => {
    const markdown = ["```", "**Материалы по теме:**", item("/products/a"), "```"].join("\n");
    expect(extractLegacyRelatedSection(markdown)).toEqual({ state: "no_section" });
  });

  it("seed-статьи после REL-02F.3a legacy-секции не содержат", () => {
    expect(seedArticles).toHaveLength(6);
    for (const article of seedArticles) {
      expect(extractLegacyRelatedSection(article.bodyMarkdown), article.slug).toEqual({
        state: "no_section",
      });
    }
  });
});

describe("extractLegacyRelatedSection: отказы", () => {
  it.each([
    ["абсолютный URL", "https://allqbit.ru/products/a", "absolute_url"],
    ["протокол-относительный URL", "//allqbit.ru/products/a", "absolute_url"],
    ["http вместо https", "http://allqbit.ru/blog/test", "absolute_url"],
    ["www-хост", "https://www.allqbit.ru/blog/test", "absolute_url"],
    ["другой домен", "https://example.com/blog/test", "absolute_url"],
    ["протокол-относительный /blog", "//allqbit.ru/blog/test", "absolute_url"],
    ["canonical + query", "https://allqbit.ru/blog/test?x=1", "absolute_url"],
    ["canonical + hash", "https://allqbit.ru/blog/test#x", "absolute_url"],
    ["canonical + trailing slash", "https://allqbit.ru/blog/test/", "absolute_url"],
    ["canonical index /blog", "https://allqbit.ru/blog", "absolute_url"],
    ["абсолютный продукт", "https://allqbit.ru/products/test", "absolute_url"],
    ["абсолютный кейс", "https://allqbit.ru/cases/test", "absolute_url"],
    ["canonical с портом", "https://allqbit.ru:443/blog/test", "absolute_url"],
    ["canonical с userinfo", "https://user@allqbit.ru/blog/test", "absolute_url"],
    ["canonical с лишним сегментом", "https://allqbit.ru/blog/a/b", "absolute_url"],
    ["canonical в верхнем регистре", "HTTPS://ALLQBIT.RU/blog/test", "absolute_url"],
    ["canonical со slug в верхнем регистре", "https://allqbit.ru/blog/Test", "absolute_url"],
    ["query", "/products/a?utm=1", "query_url"],
    ["hash", "/blog/a#razdel", "hash_url"],
    ["trailing slash", "/cases/a/", "trailing_slash"],
    ["index /blog", "/blog", "index_url"],
    ["index /products", "/products", "index_url"],
    ["index /cases", "/cases", "index_url"],
    ["/products/<id>", "/products/product-03", "product_id_url"],
    ["неизвестный тип", "/documents/a", "unknown_url"],
    ["вложенный путь", "/blog/a/b", "unknown_url"],
    ["slug в верхнем регистре", "/blog/Stat", "unknown_url"],
    ["относительный путь", "products/a", "unknown_url"],
  ])("%s → %s", (_label, href, code) => {
    expect(errorCodes(body([item("/products/ok"), item(href)]))).toEqual([code]);
  });

  it("неразрывный пробел в заголовке — отказ, а не «секции нет»", () => {
    expect(errorCodes(body([item("/products/a")], "**Материалы по теме:**"))).toEqual([
      "ambiguous_heading",
    ]);
  });

  it("картинка вместо ссылки в пункте — отказ", () => {
    expect(errorCodes(body(["- ![Схема](/products/a)"]))).toEqual(["malformed_item"]);
  });

  it("повтор секции", () => {
    const markdown = [
      body([item("/products/a")]),
      "",
      "**Материалы по теме**",
      item("/cases/b"),
    ].join("\n");
    expect(errorCodes(markdown)).toEqual(["duplicate_section"]);
  });

  it.each([
    ["## заголовок", "## Материалы по теме"],
    ["без жирного", "Материалы по теме:"],
    ["текст в строке заголовка", "**Материалы по теме:** ниже ссылки"],
    ["двоеточие вне жирного", "**Материалы по теме**:"],
    ["курсив", "*Материалы по теме*"],
  ])("неоднозначный заголовок (%s)", (_label, heading) => {
    expect(errorCodes(body([item("/products/a")], heading))).toContain("ambiguous_heading");
  });

  it("точный заголовок рядом с неоднозначным — тоже отказ", () => {
    const markdown = [body([item("/products/a")]), "", "## Материалы по теме"].join("\n");
    expect(errorCodes(markdown)).toEqual(["ambiguous_heading"]);
  });

  it("строка не из списка внутри секции", () => {
    expect(errorCodes(body([item("/products/a"), "Ещё абзац без маркера."]))).toEqual([
      "malformed_section",
    ]);
  });

  it("нумерованный список и блок кода внутри секции — отказ", () => {
    expect(errorCodes(body(["1. [a](/products/a)"]))).toEqual(["malformed_section"]);
    expect(errorCodes(body([item("/products/a"), "```", "код", "```"]))).toContain(
      "malformed_section",
    );
  });

  it("пустая секция", () => {
    expect(errorCodes(body([]))).toEqual(["malformed_section"]);
  });

  it("пункт без ссылки и пункт с двумя ссылками", () => {
    expect(errorCodes(body(["- просто текст"]))).toEqual(["malformed_item"]);
    expect(errorCodes(body(["- [a](/products/a) и [b](/cases/b)"]))).toEqual(["malformed_item"]);
  });

  it("повтор article-ссылки — не отказ: обе цели возвращаются для диагностики", () => {
    const result = extractOk(body([item("/blog/b"), item("/products/a"), item("/blog/b")]));
    expect(result.targets.map((target) => `${target.type}:${target.slug}`)).toEqual([
      "article:b",
      "product:a",
      "article:b",
    ]);
  });

  it("дубль одной цели", () => {
    expect(
      errorCodes(
        body([item("/products/a"), item("/blog/b"), item("/products/a", "Другая подпись")]),
      ),
    ).toEqual(["duplicate_target"]);
  });

  it("возвращает все причины сразу", () => {
    expect(errorCodes(body([item("/products/a?x"), "- текст", item("/cases/")]))).toEqual([
      "query_url",
      "malformed_item",
      "trailing_slash",
    ]);
  });

  it("тело не строка — отказ, а не исключение", () => {
    expect(errorCodes(null as unknown as string)).toEqual(["malformed_section"]);
  });
});
