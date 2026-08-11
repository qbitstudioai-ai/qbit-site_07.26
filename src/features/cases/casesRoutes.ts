import { SITE_URL } from "@/lib/seo";
import type { CaseStudy } from "./types";

/**
 * Адреса раздела «Кейсы» в одном месте.
 *
 * Модуль ЧИСТЫЙ — ни zod, ни доступа к базе: его импортируют и серверные страницы, и клиентские
 * компоненты анимации, поэтому ничего серверного здесь быть не должно.
 */

/** Корень раздела. Он же — значение `activeHref` пункта меню на всех страницах кейсов. */
export const CASES_PATH = "/cases";

/** Внутренний путь кейса. Единственный способ собрать адрес — чтобы он не был написан строкой. */
export function casePath(study: Pick<CaseStudy, "slug">): string {
  return `${CASES_PATH}/${study.slug}`;
}

/** Абсолютный адрес кейса. Понадобится canonical и картe сайта ПОСЛЕ утверждения содержимого. */
export function caseUrl(study: Pick<CaseStudy, "slug">): string {
  return `${SITE_URL}${casePath(study)}`;
}
