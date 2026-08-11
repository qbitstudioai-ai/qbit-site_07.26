import { cache } from "react";
import { CASES_CONTENT } from "@/features/cases/casesContent";
import { CASES_PAGE_COPY } from "@/features/cases/casesPageCopy";
import type { CaseStudy } from "@/features/cases/types";

/**
 * Источник данных раздела «Кейсы».
 *
 * ЕДИНСТВЕННОЕ место, которое знает, откуда берутся кейсы. Страницы `/cases` и `/cases/[slug]`
 * спрашивают их только здесь, компоненты — вообще не спрашивают, а получают готовый объект пропсом.
 * Когда раздел подключат к админ-панели, меняются только тела функций ниже: чтение репозитория
 * вместо массива из файла. Ни один компонент, ни один стиль и ни одна анимация при этом не меняются.
 *
 * Сейчас данные лежат в файлах — см. `src/features/cases/casesRealData.ts` (опубликованные дела) и
 * `src/features/cases/casesDraftData.ts` (черновики 02–07, публике не видны).
 *
 * `cache()` — дедупликация в пределах одного запроса: список нужен и картотеке, и `generateMetadata`.
 */

/**
 * Видно ли дело посетителю.
 *
 * Правило ровно одно и без исключений: виден только `published`. Черновик не получает ни папки в
 * картотеке, ни адреса, ни строки в карте сайта — его адрес отвечает 404. Прежний режим
 * предпросмотра (`CASES_PREVIEW_MODE`), показывавший черновики, пока раздел был закрыт от
 * индексирования, удалён вместе с публикацией раздела 2026-08-11: на индексируемом сайте у такого
 * флага нет безопасного значения `true`.
 *
 * Правило живёт ЗДЕСЬ, а не в компоненте: компонент не должен знать про статусы.
 */
function isVisible(study: CaseStudy): boolean {
  return study.status === "published";
}

/**
 * Видимые кейсы в порядке картотеки.
 *
 * Сортировка стабильная — при равных `sortOrder` порядок решает `slug`, иначе список тасовался бы
 * между запросами.
 */
export const getPublishedCases = cache((): CaseStudy[] =>
  CASES_CONTENT.filter(isVisible).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
  ),
);

/**
 * Кейс по адресу. `undefined` — такого видимого кейса нет, страница отвечает 404.
 *
 * Именно эта функция делает архитектуру серверной: страница кейса получает содержимое ДО отрисовки
 * HTML, а не подгружает его после монтирования. От неё же зависит будущее SEO/GEO — текст обязан
 * быть в первом ответе сервера.
 */
export function getCaseBySlug(slug: string | undefined): CaseStudy | undefined {
  if (!slug) return undefined;
  return getPublishedCases().find((study) => study.slug === slug);
}

/** Общие тексты раздела. Заменяются вместе с источником, когда появится админ-панель. */
export function getCasesPageCopy() {
  return CASES_PAGE_COPY;
}
