import { CASES_PATH } from "@/features/cases/casesRoutes";
import type { HeroLink } from "./types";

/**
 * Пункт общей шапки «Кейсы» — вход в архив реализованных проектов.
 *
 * Модуль ЧИСТЫЙ (только константы, без zod и доступа к базе) — его импортирует "use client"
 * Header, поэтому ничего серверного здесь быть не должно. Тот же приём, что и у `officeMapLink.ts`.
 */

/** Готовый пункт меню. Встраивается в `heroLinks` перед «Блогом» (см. `server/content/homepage.ts`). */
export const CASES_LINK: HeroLink = {
  label: "Кейсы",
  href: CASES_PATH,
};

export { CASES_PATH };
