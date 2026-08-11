import { CASES_DRAFT } from "./casesDraftData";
import { CASES_REAL } from "./casesRealData";
import type { CaseStudy } from "./types";

/**
 * Содержимое архива: реальные дела плюс оставшиеся временные заготовки.
 *
 * Модуль ЧИСТЫЙ — ни `react`, ни доступа к базе: его импортируют и серверный источник данных
 * (`src/server/content/cases.ts`), и тесты, которым нужен перечень дел без поднятия приложения.
 * Порядок в массиве значения не имеет: картотеку упорядочивает `sortOrder` в источнике.
 */
export const CASES_CONTENT: readonly CaseStudy[] = [...CASES_REAL, ...CASES_DRAFT];
