import {
  breadcrumbNode,
  CONTENT_LANGUAGE,
  organizationNode,
  SITE_URL,
  webPageNode,
} from "@/lib/seo";
import { FAQ_HEADING, FAQ_INTRO, faqItems, type FaqAnswerParagraph } from "./faqData";

/**
 * Канонический адрес раздела FAQ — один источник для metadata страницы и для sitemap, чтобы
 * canonical и запись в карте сайта не могли разойтись (в том числе по завершающему слэшу).
 */
export const FAQ_URL = `${SITE_URL}/faq`;

/**
 * Дата публикации раздела. Проставляется вручную, потому что содержание FAQ хранится в коде и не
 * имеет собственных временных меток, как посты блога.
 *
 * ОБНОВЛЯТЬ ПРИ КАЖДОЙ ПРАВКЕ ТЕКСТОВ в `faqData.ts`: значение уходит в `lastModified` sitemap, и
 * забытая дата будет сообщать поисковым системам, что раздел не менялся.
 */
export const FAQ_PUBLISHED_AT = "2026-07-26";

/**
 * Абзац ответа → обычный текст.
 *
 * Сегменты-ссылки схлопываются до своей подписи: в разметке остаётся ровно тот текст, который
 * читает посетитель. Разметка обязана совпадать с видимым ответом дословно — иначе это два разных
 * ответа на один вопрос.
 */
function paragraphToText(paragraph: FaqAnswerParagraph): string {
  return paragraph
    .map((segment) => (typeof segment === "string" ? segment : segment.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Разметка раздела вопросов и ответов.
 *
 * `FAQPage` здесь ЗАКОННА: все 14 вопросов и ответов реально показаны пользователю и приходят в
 * первом серверном HTML (список раскрывающихся `<details>`). Тип `FAQPage` запрещено ставить
 * странице, на которой вопросов и ответов нет, — это не тот случай.
 */
export function faqStructuredData() {
  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: FAQ_HEADING, url: FAQ_URL },
    ]),
    {
      ...webPageNode({
        url: FAQ_URL,
        name: FAQ_HEADING,
        description: FAQ_INTRO,
        type: "FAQPage",
      }),
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer.map(paragraphToText).join("\n\n"),
          inLanguage: CONTENT_LANGUAGE,
        },
      })),
    },
    organizationNode(),
  ];
}
