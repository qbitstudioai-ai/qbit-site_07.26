import { describe, expect, it } from "vitest";
import { FAQ_HEADING, faqItems } from "@/features/faq/faqData";
import { FAQ_URL, faqStructuredData } from "@/features/faq/faqSeo";
import { SITE_URL } from "@/lib/seo";

/**
 * `FAQPage` законна только тогда, когда вопросы и ответы реально показаны посетителю. Здесь
 * проверяется именно это соответствие: каждый вопрос разметки обязан существовать в содержимом
 * раздела, а текст ответа — совпадать с видимым текстом.
 */
describe("разметка раздела вопросов и ответов", () => {
  const schemas = faqStructuredData();
  const faqPage = schemas.find((schema) => schema["@type"] === "FAQPage") as
    | {
        url: string;
        name: string;
        mainEntity: { name: string; acceptedAnswer: { text: string } }[];
      }
    | undefined;

  it("страница описана как FAQPage по своему каноническому адресу", () => {
    expect(faqPage?.url).toBe(FAQ_URL);
    expect(faqPage?.url).toBe(`${SITE_URL}/faq`);
    expect(faqPage?.name).toBe(FAQ_HEADING);
  });

  it("в разметке ровно те вопросы, что показаны на странице", () => {
    expect(faqPage?.mainEntity).toHaveLength(faqItems.length);
    expect(faqPage?.mainEntity.map((entity) => entity.name)).toEqual(
      faqItems.map((item) => item.question),
    );
  });

  it("текст ответа не пустой и не содержит разметки", () => {
    for (const entity of faqPage?.mainEntity ?? []) {
      expect(entity.acceptedAnswer.text.length).toBeGreaterThan(0);
      expect(entity.acceptedAnswer.text).not.toContain("<");
    }
  });

  it("ссылки внутри ответа схлопнуты до видимой подписи", () => {
    // Первый ответ содержит внутреннюю ссылку — в разметку обязан попасть её текст, а не адрес.
    const firstAnswer = faqPage?.mainEntity[0].acceptedAnswer.text ?? "";

    expect(firstAnswer).toContain("записей разговоров");
    expect(firstAnswer).not.toContain("/blog/");
  });
});
