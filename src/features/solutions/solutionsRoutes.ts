import { SOLUTION_PATH_BY_DEPARTMENT_ID } from "@/content/schema";
import type { Department, DepartmentId } from "@/content/types";
import { absoluteUrl } from "@/lib/seo";

/**
 * Адреса раздела «Решения» — страниц отделов, у которых есть собственный индексируемый документ.
 *
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ — `solutionPath` отдела. Он существует в проекте с самого начала:
 * объявлен таблицей `SOLUTION_PATH_BY_DEPARTMENT_ID` (`src/content/schema.ts`), записан полем
 * `solutionPath` у каждого отдела и СВЕРЯЕТСЯ схемой при каждом чтении из базы — `departmentSchema`
 * отклоняет отдел, у которого поле разошлось с таблицей. Поэтому здесь ничего не изобретается: этот
 * модуль лишь разбирает уже утверждённые адреса на составные части.
 *
 * Из этого следует правило, которое нельзя нарушать в будущем: адрес страницы отдела НИКОГДА не
 * собирается строкой на месте. Там, где отдел уже прочитан, берётся его собственный `solutionPath`
 * (`solutionPath()`/`solutionUrl()` ниже); там, где отдела ещё нет и его надо найти ПО адресу,
 * работает обратная таблица (`departmentIdBySolutionSlug`). Две стороны одного отображения выведены
 * из одной таблицы и поэтому не могут разойтись.
 *
 * Отдельно про `executive`. Системный идентификатор отдела — `executive`, а сегмент адреса —
 * `management`: так записано в `SOLUTION_PATH_BY_DEPARTMENT_ID` с момента её появления. Это НЕ
 * опечатка и не рассинхрон: идентификатор — первичный ключ, к которому привязаны зона офиса, сцена,
 * ревизии и связи материалов, и переименовать его нельзя; сегмент адреса — публичное слово. Ровно
 * ради этой пары отображение вынесено в таблицу, а не выводится из идентификатора.
 *
 * Модуль ЧИСТЫЙ в том смысле, который важен: он не обращается к базе и ничего не читает с диска.
 * `@/content/schema` тянет за собой zod — это допустимо, потому что все потребители серверные
 * (страница раздела, карта сайта), а клиентскому коду адрес отдела сегодня не нужен.
 */

/** Последний сегмент адреса — то, что попадает в `[slug]` маршрута. */
function slugOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Прямое отображение: идентификатор отдела → сегмент его адреса.
 *
 * Выводится из `SOLUTION_PATH_BY_DEPARTMENT_ID`, а не перечисляется заново. Второй список сегментов
 * означал бы ровно ту ошибку, от которой защищает `superRefine` в схеме, только в другом месте.
 */
export const SOLUTION_SLUG_BY_DEPARTMENT_ID: Readonly<Record<DepartmentId, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SOLUTION_PATH_BY_DEPARTMENT_ID).map(([id, path]) => [id, slugOf(path)]),
  ) as Record<DepartmentId, string>,
);

/** Обратное отображение: сегмент адреса → идентификатор отдела. */
const DEPARTMENT_ID_BY_SOLUTION_SLUG: ReadonlyMap<string, DepartmentId> = new Map(
  Object.entries(SOLUTION_SLUG_BY_DEPARTMENT_ID).map(([id, slug]) => [slug, id as DepartmentId]),
);

/**
 * Идентификатор отдела по сегменту адреса. `null` — такого сегмента не существует.
 *
 * Возвращается именно `null`, а не исключение: неизвестный адрес — обычная 404, а не сбой.
 */
export function departmentIdBySolutionSlug(slug: string): DepartmentId | null {
  return DEPARTMENT_ID_BY_SOLUTION_SLUG.get(slug) ?? null;
}

/** Внутренний путь страницы отдела — его собственный `solutionPath`, без пересборки строкой. */
export function solutionPath(department: Pick<Department, "solutionPath">): string {
  return department.solutionPath;
}

/**
 * Абсолютный адрес страницы отдела. Он же canonical, он же адрес в карте сайта и в разметке.
 *
 * Одна точка сборки — поэтому canonical, Open Graph, `BreadcrumbList`, `WebPage` и `sitemap.xml`
 * физически не могут заговорить о разных адресах.
 */
export function solutionUrl(department: Pick<Department, "solutionPath">): string {
  return absoluteUrl(solutionPath(department));
}
