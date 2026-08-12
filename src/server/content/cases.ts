import { cache } from "react";
import { caseRecordToStudy } from "@/features/cases/caseRecord";
import { CASES_PAGE_COPY } from "@/features/cases/casesPageCopy";
import type { CaseStudy } from "@/features/cases/types";
import { getCaseRecordBySlug, listPublishedCases } from "@/server/repositories/cases";

/**
 * Источник данных раздела «Кейсы».
 *
 * ЕДИНСТВЕННОЕ место, которое знает, откуда берутся кейсы. Страницы `/cases` и `/cases/[slug]`
 * спрашивают их только здесь, компоненты — вообще не спрашивают, а получают готовый объект пропсом.
 *
 * Источник ОДИН — таблица `cases` (миграция `0003_cases`). Кейсов в коде больше нет: и первое дело
 * архива, перенесённое миграцией дословно, и любое созданное в админ-панели читаются одинаково.
 * Из этого следует главное свойство раздела: новый кейс не требует ни правки кода, ни пересборки,
 * ни ручного добавления в карту сайта.
 *
 * `cache()` — дедупликация в пределах одного запроса: список нужен и картотеке в layout, и
 * `generateMetadata`, и самой странице.
 */

/**
 * Видимые кейсы в порядке картотеки.
 *
 * Правило видимости выполняет запрос (`status = 'published'`), а не компонент: компонент не должен
 * знать про статусы. Пользовательских черновиков в разделе нет — всё, что создано в админ-панели,
 * опубликовано в момент создания.
 */
export const getPublishedCases = cache((): CaseStudy[] =>
  listPublishedCases().map(caseRecordToStudy),
);

/**
 * Кейс по адресу. `undefined` — такого видимого кейса нет, страница отвечает 404.
 *
 * Запрос по `slug` идёт в базу напрямую, а не фильтрует весь список: адрес приходит от посетителя,
 * и читать ради одной страницы весь архив незачем. Именно эта функция делает архитектуру серверной:
 * страница получает содержимое ДО отрисовки HTML, а не подгружает его после монтирования. От неё же
 * зависит SEO/GEO — текст обязан быть в первом ответе сервера.
 */
export function getCaseBySlug(slug: string | undefined): CaseStudy | undefined {
  const record = getCaseRecordBySlug(slug);
  return record ? caseRecordToStudy(record) : undefined;
}

/**
 * Общие тексты раздела — обложка архива.
 *
 * Остаются в коде сознательно: это не кейс, а вводный текст раздела, и админ-панель им не
 * управляет. Отдельного экрана для одной страницы в задаче нет.
 */
export function getCasesPageCopy() {
  return CASES_PAGE_COPY;
}
