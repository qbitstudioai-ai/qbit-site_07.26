import type { CaseBlock, CaseSection, CaseStudy } from "./types";

/**
 * Запись кейса в хранилище и её превращение в документ архива.
 *
 * Здесь ЕДИНСТВЕННОЕ место, которое знает, как поля админ-панели становятся разделами досье.
 * Компоненты раздела по-прежнему получают готовый `CaseStudy` и ничего не знают ни о базе, ни о
 * форме: кейс, созданный владельцем сайта, отрисовывается тем же кодом, что и перенесённый в базу
 * первый кейс, — включая картотеку, перелистывание и печать.
 *
 * Модуль ЧИСТЫЙ: ни `node:sqlite`, ни `react`, ни `zod`. Его читают репозиторий (сервер), форма
 * админ-панели (клиент) и тесты. Появись здесь серверный импорт — форма перестала бы собираться.
 *
 * ── Почему структура разделов зашита в код, а не хранится строкой ──────────────────────────────
 *
 * Владелец сайта заполняет поля, а не пишет разметку. Порядок «краткий итог → задача → что
 * реализовали → результат → человек → ограничение» — это утверждённая структура кейса, на которой
 * держатся и читаемость документа, и GEO: цифра стоит рядом с источником и оговоркой, а полное
 * ограничение — последним разделом. Если бы порядок задавался вводом, первый же кейс, набранный
 * второпях, вышел бы обещанием без ограничения.
 */

/** Строка таблицы `cases` в виде, удобном приложению. */
export interface CaseRecord {
  id: string;
  /** Часть адреса `/cases/[slug]`. После публикации не меняется. */
  slug: string;
  /** H1 документа. */
  title: string;
  /** Имя папки в картотеке. */
  shortTitle: string;
  /** Мелкая подпись над именем папки. Значение модели, в форме не редактируется. */
  folderCaption: string;
  /** Номер дела в архиве. Строка: ведущий ноль — часть номера. */
  fileNumber: string;
  /** Служебная метка в шапке документа. Значение модели, в форме не редактируется. */
  label: string;

  // ── Разделы досье. Абзацы внутри раздела разделены пустой строкой. ──────────────────────────
  /** «Краткий итог». */
  summary: string;
  /** «Задача». */
  task: string;
  /** «Что реализовали». */
  implementation: string;
  /** Цепочка процесса внутри «Что реализовали». Пустой список — цепочки в документе нет. */
  workflowSteps: string[];
  /** «Результат». */
  result: string;
  /** «Что остаётся под контролем человека». */
  humanControl: string;
  /** «Об измеримом результате» — ограничение применимости. */
  limitations: string;

  // ── Измеримый результат. Либо заполнен целиком, либо пуст (проверяется схемой). ─────────────
  metricLabel: string;
  metricBefore: string;
  metricAfter: string;
  metricSource: string;

  /** Спокойная ссылка в конце досье. Значения модели, в форме не редактируются. */
  ctaLabel: string;
  ctaHref: string;

  seoTitle: string;
  seoDescription: string;
  ogDescription: string;

  /**
   * Внутреннее состояние публикации. Значение всегда `published`: пользовательских черновиков в
   * разделе нет — созданный кейс сразу становится страницей сайта. Колонка существует, чтобы снятие
   * кейса с публикации однажды не потребовало миграции схемы.
   */
  status: "published";
  stampEnabled: boolean;
  sortOrder: number;

  /**
   * Даты МАТЕРИАЛА. `null` — подтверждённой даты нет, и выдумывать её нельзя (см. `types.ts`).
   * Проставляются сервером: `publishedAt` — один раз, при публикации, `modifiedAt` — при каждой
   * правке.
   */
  publishedAt: string | null;
  modifiedAt: string | null;
  /** Даты СТРОКИ. Техническая отметка о записи, публично не показывается. */
  createdAt: string;
  updatedAt: string;
}

/** Поля, которые приходят из формы. Идентификатор и все даты ставит сервер. */
export type CaseInput = Omit<
  CaseRecord,
  "id" | "createdAt" | "updatedAt" | "publishedAt" | "modifiedAt"
>;

/** Значения, которые не редактируются в форме и одинаковы у всех дел архива. */
export const CASE_DEFAULTS = {
  folderCaption: "Проект",
  label: "РЕАЛИЗОВАННЫЙ ПРОЕКТ",
  ctaLabel: "Обсудить похожую задачу",
  ctaHref: "/contacts",
} as const;

/**
 * Разделы досье в утверждённом порядке.
 *
 * `key` — поле записи, `id` — окончание якоря заголовка, `heading` — текст H2. Порядок массива и
 * есть порядок разделов документа.
 */
export const CASE_SECTIONS = [
  { key: "summary", id: "summary", heading: "Краткий итог" },
  { key: "task", id: "task", heading: "Задача" },
  { key: "implementation", id: "solution", heading: "Что реализовали" },
  { key: "result", id: "result", heading: "Результат" },
  { key: "humanControl", id: "human-control", heading: "Что остаётся под контролем человека" },
  { key: "limitations", id: "limitations", heading: "Об измеримом результате" },
] as const satisfies readonly {
  key: keyof CaseRecord;
  id: string;
  heading: string;
}[];

/**
 * Абзацы раздела из одного текстового поля.
 *
 * Разделитель — пустая строка: ровно то, что человек набирает в textarea, и ровно то, что видно
 * глазом. Одиночный перенос строки НЕ создаёт абзаца намеренно — иначе перенос, случайно
 * поставленный при наборе, разрывал бы предложение на два абзаца документа.
 *
 * `\r` снимается: текст, вставленный из Word или из Windows-редактора, приходит с `\r\n`.
 */
export function caseParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Обратное преобразование: абзацы в значение textarea. */
export function caseParagraphsToText(paragraphs: readonly string[]): string {
  return paragraphs.join("\n\n");
}

/** Заполнена ли метрика. Пустой блок в документе не рисуется вовсе. */
export function hasCaseMetric(
  record: Pick<CaseRecord, "metricLabel" | "metricBefore" | "metricAfter">,
): boolean {
  return Boolean(record.metricLabel && record.metricBefore && record.metricAfter);
}

/**
 * Блоки раздела: абзацы плюс, если он есть, один служебный блок ПОСЛЕ первого абзаца.
 *
 * Место вставки выбрано не для красоты. В утверждённом кейсе цепочка процесса стоит сразу за
 * вводящим её абзацем («система обрабатывает разговоры и формирует отчёт» → сама цепочка →
 * пояснение), а таблица «до/после» — между абзацем «главный измеримый результат» и оговоркой о
 * применимости. Оговорка обязана остаться ПОСЛЕ цифр: генеративные системы цитируют абзац вместе с
 * ближайшим контекстом, и ограничение, оторванное от метрики, перестаёт работать.
 */
function blocksWithInsert(text: string, insert: CaseBlock | null): CaseBlock[] {
  const paragraphs: CaseBlock[] = caseParagraphs(text).map((paragraph) => ({
    kind: "text",
    text: paragraph,
  }));

  if (!insert) return paragraphs;
  // Абзацев нет вовсе — служебный блок становится единственным содержимым раздела.
  if (paragraphs.length === 0) return [insert];

  return [paragraphs[0], insert, ...paragraphs.slice(1)];
}

/**
 * Запись хранилища → документ архива.
 *
 * Функция ЧИСТАЯ и полностью определяет публичный вид кейса. Перенесённое в базу дело № 01
 * проходит через неё и обязано совпасть с прежним объектом из кода до последнего символа — это
 * закреплено тестом (`cases-record.test.ts`), а не проверяется глазами.
 */
export function caseRecordToStudy(record: CaseRecord): CaseStudy {
  const sections: CaseSection[] = [];

  for (const section of CASE_SECTIONS) {
    const text = String(record[section.key] ?? "");

    let insert: CaseBlock | null = null;
    if (section.key === "implementation" && record.workflowSteps.length > 0) {
      insert = { kind: "chain", steps: [...record.workflowSteps] };
    }
    if (section.key === "result" && hasCaseMetric(record)) {
      insert = {
        kind: "metrics",
        items: [
          {
            label: record.metricLabel,
            before: record.metricBefore,
            after: record.metricAfter,
            // Источник необязателен по типу: без него поле просто не рисуется.
            ...(record.metricSource ? { sourceNote: record.metricSource } : {}),
          },
        ],
      };
    }

    const blocks = blocksWithInsert(text, insert);
    // Пустой раздел в документ не попадает: заголовок без содержимого — дыра, а не оформление.
    if (blocks.length > 0) {
      sections.push({
        // Якорь заголовка привязан к номеру дела — так он совпал с прежними якорями кода
        // (`case-01-summary`, `case-01-result`, …), на которые ссылаются тесты и скрипты съёмки.
        id: `case-${record.fileNumber}-${section.id}`,
        heading: section.heading,
        blocks,
      });
    }
  }

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    shortTitle: record.shortTitle,
    folderCaption: record.folderCaption,
    fileNumber: record.fileNumber,
    label: record.label,
    // Вводной строки над «Кратким итогом» у кейсов архива нет: она повторяла бы первый абзац
    // документа слово в слово. Поле модели сохранено — оно принадлежит контракту отрисовки.
    sections,
    ...(record.ctaLabel && record.ctaHref
      ? { cta: { label: record.ctaLabel, href: record.ctaHref } }
      : {}),
    ...(record.seoTitle ? { seoTitle: record.seoTitle } : {}),
    ...(record.seoDescription ? { seoDescription: record.seoDescription } : {}),
    ...(record.ogDescription ? { ogDescription: record.ogDescription } : {}),
    ...(record.publishedAt ? { publishedAt: record.publishedAt } : {}),
    ...(record.modifiedAt ? { modifiedAt: record.modifiedAt } : {}),
    status: record.status,
    stampEnabled: record.stampEnabled,
    sortOrder: record.sortOrder,
  };
}
