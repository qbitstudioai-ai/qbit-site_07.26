// @vitest-environment node
import { describe, expect, it } from "vitest";
import { publicArticleBody, stripLegacyRelatedSection } from "@/features/blog/articleBody";
import { extractLegacyRelatedSection } from "@/features/blog/legacyRelatedSection.mjs";
import { parseBlogMarkdown } from "@/features/blog/markdown";

/**
 * Публичное тело статьи без legacy-секции «Материалы по теме» (Amendment 61 / REL-02F.2).
 *
 * Проверяется, что вырезается ровно диапазон extractor, что соседние разделы не склеиваются и что
 * неоднозначная секция остаётся в тексте (D5).
 */

const HEAD = [
  "**Краткий ответ:** текст.",
  "",
  "**Источники:**",
  "- [Источник](https://example.com/a)",
];
const SECTION = [
  "**Материалы по теме:**",
  "- «[Сбор заявок](/products/leads-to-crm)» — пояснение.  ",
  "- «[Связка](/blog/sayt-crm)» — пояснение.",
];

const headings = (markdown: string) =>
  parseBlogMarkdown(markdown).map((section) => section.heading);

describe("publicArticleBody / stripLegacyRelatedSection", () => {
  it("секция в конце тела вырезается целиком, остальные разделы не меняются", () => {
    const markdown = [...HEAD, "", ...SECTION].join("\n");
    const result = publicArticleBody(markdown);

    expect(result.legacySection).toBe("ok");
    expect(result.body).toBe(`${HEAD.join("\n")}\n\n`);
    expect(headings(result.body)).toEqual(["Краткий ответ", "Источники"]);
    expect(parseBlogMarkdown(result.body)).toEqual(parseBlogMarkdown(HEAD.join("\n")));
    expect(result.body).not.toContain("/products/leads-to-crm");
  });

  it("секция в середине: следующий раздел остаётся отдельным, соседние не склеиваются", () => {
    const tail = ["**Итог:**", "Абзац после секции."];
    const markdown = [...HEAD, "", ...SECTION, "", ...tail].join("\n");
    const result = publicArticleBody(markdown);

    expect(result.legacySection).toBe("ok");
    expect(headings(result.body)).toEqual(["Краткий ответ", "Источники", "Итог"]);
    expect(parseBlogMarkdown(result.body)).toEqual(
      parseBlogMarkdown([...HEAD, "", ...tail].join("\n")),
    );
  });

  it("секция вплотную между абзацем и заголовком, без пустых строк — абзацы не склеиваются", () => {
    const markdown = ["Абзац до.", ...SECTION, "**Итог:**", "Абзац после."].join("\n");
    const sections = parseBlogMarkdown(stripLegacyRelatedSection(markdown));

    expect(sections.map((section) => section.heading)).toEqual(["Материал", "Итог"]);
    expect(sections[0].blocks).toEqual([{ type: "paragraph", markdown: "Абзац до." }]);
    expect(sections[1].blocks).toEqual([{ type: "paragraph", markdown: "Абзац после." }]);
  });

  it("вырезается ровно диапазон extractor — ни символом больше", () => {
    const markdown = [...HEAD, "", ...SECTION, "", "**Итог:**", "Текст."].join("\n");
    const extraction = extractLegacyRelatedSection(markdown);
    if (extraction.state !== "ok") throw new Error("секция не распознана");

    const { start, end } = extraction.range;
    expect(stripLegacyRelatedSection(markdown)).toBe(
      markdown.slice(0, start) + markdown.slice(end),
    );
    expect(markdown.slice(start, end)).toBe(SECTION.join("\n"));
  });

  it("no_section — тот же текст без изменений", () => {
    const markdown = HEAD.join("\n");
    const result = publicArticleBody(markdown);

    expect(result).toEqual({ body: markdown, legacySection: "no_section" });
    expect(stripLegacyRelatedSection(markdown)).toBe(markdown);
  });

  it.each([
    ["заголовок ##", ["## Материалы по теме", "- [Сбор](/products/leads-to-crm)"]],
    ["пункт без ссылки", ["**Материалы по теме:**", "- просто текст"]],
    [
      "абсолютный адрес продукта",
      ["**Материалы по теме:**", "- [Сбор](https://allqbit.ru/products/leads-to-crm)"],
    ],
  ])("invalid (%s) — секция остаётся в тексте", (_label, lines) => {
    const markdown = [...HEAD, "", ...lines].join("\n");
    const result = publicArticleBody(markdown);

    expect(result).toEqual({ body: markdown, legacySection: "invalid" });
  });

  it("CRLF: секция распознаётся и вырезается, разделы разбираются как у LF", () => {
    const lf = [...HEAD, "", ...SECTION, "", "**Итог:**", "Текст."].join("\n");
    const crlf = lf.replace(/\n/gu, "\r\n");
    const result = publicArticleBody(crlf);

    expect(result.legacySection).toBe("ok");
    expect(result.body).not.toContain("Материалы по теме");
    expect(result.body).not.toContain("/products/leads-to-crm");
    expect(parseBlogMarkdown(result.body)).toEqual(
      parseBlogMarkdown(stripLegacyRelatedSection(lf)),
    );
  });
});
