import type { Metadata } from "next";
import {
  breadcrumbNode,
  normalizeSeoTitle,
  organizationNode,
  SITE_URL,
  webPageNode,
  withBrand,
} from "@/lib/seo";
import { CASES_PATH, caseUrl } from "./casesRoutes";
import { firstTextBlock, type CaseStudy } from "./types";

/**
 * SEO раздела «Кейсы».
 *
 * До 2026-08-11 в этом файле жили ровно две константы — `DRAFT_SECTION_ROBOTS` (`index: false`) и
 * `CASES_PREVIEW_MODE`, показывавший черновики, пока раздел закрыт. Обе удалены вместе с
 * публикацией первого реального кейса: раздел индексируется общесайтовым `INDEXABLE_ROBOTS`, а
 * видимость кейса определяется его собственным `status`. Отдельного «режима предпросмотра» больше
 * нет намеренно — флаг, который однажды выставят в `true` по невнимательности, показал бы
 * черновики на живом сайте.
 *
 * Разметка собирается ТЕМИ ЖЕ helper'ами, что и на остальных страницах (`organizationNode`,
 * `webPageNode`, `breadcrumbNode`), поэтому организация и сайт остаются ОДНОЙ сущностью графа:
 * общие `@id` не переопределяются здесь ни разу.
 */

/** Корень раздела, абсолютный адрес. Он же canonical страницы `/cases`. */
export const CASES_URL = `${SITE_URL}${CASES_PATH}`;

/**
 * Robots для несуществующего кейса.
 *
 * Страница в этом случае вызывает `notFound()`, и Next.js добавляет к ней собственный `noindex`;
 * это значение существует ради `generateMetadata`, который исполняется раньше и обязан вернуть
 * что-то определённое. `follow: true` — ссылки в шапке и картотеке настоящие, закрывать обход
 * незачем.
 */
export const NOT_FOUND_ROBOTS = {
  index: false,
  follow: true,
} as const satisfies Metadata["robots"];

/** Заголовок кейса для выдачи: заданный — дословно, иначе H1 с брендом. */
export function caseSeoTitle(study: CaseStudy): string {
  return normalizeSeoTitle(study.seoTitle) ?? withBrand(study.title);
}

/**
 * Описание кейса для выдачи.
 *
 * Порядок источников: заданное описание → вводная строка досье → первый абзац документа. Последний
 * вариант — не украшение, а гарантия: кейс из будущей админ-панели без заполненного описания всё
 * равно получит осмысленный текст, а не пустое поле.
 */
export function caseSeoDescription(study: CaseStudy): string {
  return study.seoDescription ?? study.summary ?? firstTextBlock(study) ?? "";
}

/** Описание для Open Graph и Twitter. Не задано отдельно — то же, что в выдаче. */
export function caseSocialDescription(study: CaseStudy): string {
  return study.ogDescription ?? caseSeoDescription(study);
}

/**
 * Разметка страницы кейса: BreadcrumbList → WebPage → Organization.
 *
 * `Article`/`BlogPosting` здесь НЕТ и не должно появиться, пока у кейса нет подтверждённой даты
 * публикации: `datePublished` — обязательная по смыслу часть такой разметки, и подставить туда
 * дату сборки значило бы заявить поисковой системе выдуманный факт. `CaseStudy`, `Review`,
 * `AggregateRating`, `Offer` и `FAQPage` не добавляются по той же причине — на странице нет ни
 * отзыва, ни оценки, ни предложения, ни вопросов с ответами.
 *
 * Третья ступень «хлебных крошек» — КОРОТКОЕ имя дела: полный H1 длиннее строки навигации, а
 * крошки описывают путь, а не заголовок документа.
 */
export function caseStudyStructuredData(study: CaseStudy) {
  // Адрес берётся существующим `caseUrl()`, а не собирается строкой: canonical, Open Graph и
  // разметка обязаны говорить об одном и том же адресе, и одно место сборки это гарантирует.
  const url = caseUrl(study);

  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Кейсы", url: CASES_URL },
      { name: study.shortTitle, url },
    ]),
    webPageNode({
      url,
      name: caseSeoTitle(study),
      description: caseSeoDescription(study),
    }),
    organizationNode(),
  ];
}

/**
 * Разметка обложки архива: BreadcrumbList → WebPage(CollectionPage) → Organization.
 *
 * Ровно те же общесайтовые сущности, что и у остальных разделов. `ItemList` намеренно не
 * добавляется: перечислять в разметке один опубликованный кейс — лишний узел без пользы.
 */
export function casesIndexStructuredData(page: { name: string; description: string }) {
  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Кейсы", url: CASES_URL },
    ]),
    webPageNode({
      url: CASES_URL,
      name: page.name,
      description: page.description,
      type: "CollectionPage",
    }),
    organizationNode(),
  ];
}
