import type { CaseStudy } from "./types";

/**
 * ЧЕРНОВИКИ раздела «Кейсы» — дела 02–07.
 *
 * Здесь СОЗНАТЕЛЬНО нет ни одного факта: ни отрасли, ни клиента, ни цифры, ни результата, ни
 * маркетингового утверждения. Тексты нейтральны и прямо сообщают, что содержимое появится позже.
 * Настоящие кейсы добавляются по одному отдельными задачами; первое дело архива уже реальное и
 * опубликовано — см. `casesRealData.ts`.
 *
 * ПОСЛЕ ОТКРЫТИЯ РАЗДЕЛА ДЛЯ ИНДЕКСИРОВАНИЯ (2026-08-11) эти дела не видны никому: у них
 * `status: "draft"`, а источник данных отдаёт только `published`. Ни папки в картотеке, ни адреса,
 * ни строки в карте сайта у них нет — `/cases/case-02`…`/cases/case-07` отвечают 404. Это
 * ожидаемое поведение, а не потеря содержимого.
 *
 * Файл при этом НЕ удалён намеренно: он и есть работающее доказательство того, что черновик в
 * разделе возможен и безопасен. Когда раздел подключат к админ-панели, заменяется ровно одна
 * функция в `src/server/content/cases.ts`, а компоненты не меняются вовсе. Именно поэтому черновики
 * объявлены обычными `CaseStudy` — теми же объектами, что придут из базы.
 */

const PLACEHOLDER_SECTION_TEXT = "Содержание будет добавлено на следующем этапе.";

const PLACEHOLDER_SUMMARY =
  "Описание проекта будет добавлено после утверждения визуальной и SEO/GEO-концепции раздела.";

function draftCase(index: number): CaseStudy {
  const number = String(index).padStart(2, "0");

  return {
    id: `case-${number}`,
    slug: `case-${number}`,
    title: `Кейс ${number}`,
    shortTitle: `Кейс ${number}`,
    folderCaption: "Проект",
    fileNumber: number,
    label: "РЕАЛИЗОВАННЫЙ ПРОЕКТ",
    summary: PLACEHOLDER_SUMMARY,
    sections: [
      {
        id: `case-${number}-task`,
        heading: "Задача",
        blocks: [{ kind: "text", text: PLACEHOLDER_SECTION_TEXT }],
      },
      {
        id: `case-${number}-solution`,
        heading: "Решение",
        blocks: [{ kind: "text", text: PLACEHOLDER_SECTION_TEXT }],
      },
      {
        id: `case-${number}-result`,
        heading: "Результат",
        blocks: [{ kind: "text", text: PLACEHOLDER_SECTION_TEXT }],
      },
    ],
    // ЧЕРНОВИК. Содержания у дела нет, поэтому публичным оно быть не может: источник данных
    // (`src/server/content/cases.ts`) отбирает только `published`, и адрес отвечает 404.
    status: "draft",
    // Печать включена у всех заготовок: переключатель существует ради будущей админ-панели, а не
    // ради этих объектов.
    stampEnabled: true,
    sortOrder: index,
  };
}

/**
 * Черновики занимают номера 02–07: место дела № 01 занял первый реальный кейс.
 *
 * Адрес `/cases/case-01` не существует — дубля первого дела в разделе нет.
 */
const DRAFT_CASE_NUMBERS = [2, 3, 4, 5, 6, 7];

export const CASES_DRAFT: readonly CaseStudy[] = DRAFT_CASE_NUMBERS.map(draftCase);
