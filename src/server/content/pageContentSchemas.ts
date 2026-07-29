import { z } from "zod";
import { homepageCopySchema } from "@/content/schema";
import type { PageKey } from "../repositories/pageContent";

/**
 * Строгие схемы содержимого `page_content` — по одной на страницу.
 *
 * До аудита 2026-07-27 здесь была одна общая схема `z.record(z.string(), z.unknown())`: она
 * принимала любой объект. Значение вроде `{"headline": {"a": 1}}` сохранялось, попадало в
 * поверхностное слияние с seed-текстами и рендерилось как React-узел — публичная страница падала с
 * «Objects are not valid as a React child». То есть владелец панели мог уронить сайт, не имея
 * такого намерения и не получив ни одного предупреждения.
 *
 * Защита строится в два уровня. ЭТОТ модуль — первый: сохранить неверную структуру нельзя, ответ
 * 422 приходит до записи в базу. Второй уровень — разбор ПРИ ЧТЕНИИ в `src/server/content/*`: уже
 * лежащая в базе запись (сохранённая до этой правки или правкой файла базы мимо приложения) не
 * должна ронять страницу, поэтому читатели проверяют её и при ошибке берут seed-тексты.
 *
 * Политика неизвестных полей — УДАЛЯТЬ, а не отклонять (поведение Zod по умолчанию). Отклонение
 * сломало бы сохранение при малейшем расхождении формы редактора и схемы, а пользы не дало бы:
 * лишнее поле всё равно не читается ни одной страницей. Отсутствие обязательного поля и неверный
 * тип отклоняются жёстко — именно они и роняют рендер.
 */

/**
 * Поле обязано ПРИСУТСТВОВАТЬ и быть строкой; пустая строка допускается сознательно.
 *
 * Публичную страницу роняет неверный ТИП (`{"headline": {"a": 1}}` → «Objects are not valid as a
 * React child»), а не пустота: пустая строка рендерится молча. При этом очищенное поле — законный
 * редакторский выбор: в текущей базе у контактов намеренно пусты «Адрес» и «Часы работы».
 * Требование `min(1)` отвергло бы эту запись, и читатель подставил бы seed-тексты — то есть
 * проверка САМА изменила бы содержимое сайта. Поэтому проверяется тип и потолок длины, а решение
 * «показывать ли пустое поле» остаётся за владельцем.
 */
const line = (label: string) =>
  z.string({ error: `${label}: ожидается текст` }).max(300, `${label}: не длиннее 300 символов`);

/** То же для абзаца: вступление, SEO-описание. */
const paragraph = (label: string) =>
  z.string({ error: `${label}: ожидается текст` }).max(2000, `${label}: не длиннее 2000 символов`);

const productsPageSchema = z.object({
  eyebrow: line("Надзаголовок"),
  headline: line("Заголовок"),
  seoTitle: line("SEO-заголовок"),
  seoDescription: paragraph("SEO-описание"),
  priceColumnLabel: line("Заголовок колонки цены"),
  moreLabel: line("Подпись «ещё»"),
  sectionHeadings: z.object({
    applies: line("Заголовок «Применимо»"),
    examples: line("Заголовок «Примеры»"),
    prices: line("Заголовок «Стоимость»"),
    benefit: line("Заголовок «Выгода»"),
  }),
  tabs: z.object({
    overview: line("Вкладка «Обзор»"),
    examples: line("Вкладка «Примеры»"),
    prices: line("Вкладка «Стоимость»"),
    benefit: line("Вкладка «Выгода»"),
  }),
  implementationFormats: z.object({
    title: line("Заголовок форматов внедрения"),
    items: z.array(line("Формат внедрения")).max(20, "Форматы внедрения: не больше 20 пунктов"),
    note: paragraph("Примечание к форматам внедрения"),
  }),
});

const documentsPageSchema = z.object({
  headline: line("Заголовок"),
  subheading: paragraph("Подзаголовок"),
  emptyMessage: paragraph("Сообщение о пустом списке"),
  seoDescription: paragraph("SEO-описание"),
});

const blogPageSchema = z.object({
  eyebrow: line("Надзаголовок"),
  headline: line("Заголовок"),
  railTitle: line("Заголовок списка"),
  seoDescription: paragraph("SEO-описание"),
});

const contactsPageSchema = z.object({
  eyebrow: line("Надзаголовок"),
  heading: line("Заголовок"),
  subheading: paragraph("Подзаголовок"),
  intro: paragraph("Вступление"),
  contactsHeading: line("Заголовок блока контактов"),
  formHeading: line("Заголовок формы"),
  formDescription: paragraph("Описание формы"),
  companyName: line("Название компании"),
  address: paragraph("Адрес"),
  workingHours: line("Часы работы"),
});

/**
 * Схема на каждый ключ страницы. `satisfies` следит, чтобы список не разошёлся с `PAGE_KEYS`:
 * добавление страницы без схемы перестанет собираться.
 */
export const PAGE_CONTENT_SCHEMAS = {
  homepage: homepageCopySchema,
  products: productsPageSchema,
  documents: documentsPageSchema,
  blog: blogPageSchema,
  contacts: contactsPageSchema,
} satisfies Record<PageKey, z.ZodType>;

export function pageContentSchemaFor(pageKey: PageKey): z.ZodType {
  return PAGE_CONTENT_SCHEMAS[pageKey];
}

/**
 * Разбор записи, прочитанной из базы.
 *
 * Возвращает `null`, если запись не соответствует схеме, — вызывающий читатель подставляет
 * seed-тексты. Наружу ошибка не уходит: посетитель увидит исходный текст страницы, а не сбой.
 */
export function parseStoredPageContent<T>(
  pageKey: PageKey,
  stored: unknown,
): { ok: true; data: T } | { ok: false; issues: string[]; topLevelPaths: string[] } {
  const parsed = PAGE_CONTENT_SCHEMAS[pageKey].safeParse(stored);
  if (parsed.success) return { ok: true, data: parsed.data as T };

  return {
    ok: false,
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(корень)"}: ${issue.message}`,
    ),
    // Поля верхнего уровня отдаются отдельно и структурно: разбирать обратно текст сообщения было
    // бы хрупко — в самом сообщении встречается двоеточие.
    topLevelPaths: parsed.error.issues
      .map((issue) => issue.path[0])
      .filter((segment): segment is string => typeof segment === "string"),
  };
}

/**
 * Второй уровень защиты: проверка того, что реально прочитано из базы.
 *
 * Запись могла быть сохранена до появления строгих схем или изменена в файле базы мимо приложения.
 * Публичная страница из-за этого падать не должна, поэтому негодная запись заменяется исходными
 * seed-текстами, а подробности уходят в СЕРВЕРНЫЙ лог — посетителю ни ошибка, ни stack trace не
 * показываются.
 *
 * В лог пишутся только путь поля и текст правила, без значений: содержимое страницы может включать
 * данные, которых в логах быть не должно.
 */
export function safePageCopy<T>(pageKey: PageKey, candidate: unknown, seed: T): T {
  const parsed = parseStoredPageContent<T>(pageKey, candidate);
  if (parsed.ok) return parsed.data;

  const schema = PAGE_CONTENT_SCHEMAS[pageKey];

  /**
   * Заменяется негодное ПОЛЕ ВЕРХНЕГО УРОВНЯ, а не вся страница.
   *
   * Первая редакция откатывала весь набор текстов из-за одной ошибки: посетитель вместо
   * отредактированной страницы получал демо-тексты целиком, причём молча (найдено code review
   * 2026-07-27).
   *
   * Точность — до поля верхнего уровня: ошибка во вложенном `tabs.prices` откатывает весь `tabs`.
   * Это сознательный предел, а не недосмотр — вложенные группы у этих страниц маленькие и
   * осмысленны целиком, а рекурсивная починка усложнила бы разбор ради выигрыша в две подписи.
   */
  if (candidate !== null && typeof candidate === "object") {
    const repaired: Record<string, unknown> = { ...(candidate as Record<string, unknown>) };
    const seedRecord = seed as unknown as Record<string, unknown>;
    for (const topLevel of parsed.topLevelPaths) {
      if (Object.hasOwn(seedRecord, topLevel)) repaired[topLevel] = seedRecord[topLevel];
    }

    const second = schema.safeParse(repaired);
    if (second.success) {
      console.error(
        `[page-content] поля записи «${pageKey}» не соответствуют схеме — для них показаны исходные тексты: ${parsed.issues.join("; ")}`,
      );
      return second.data as T;
    }
  }

  console.error(
    `[page-content] запись «${pageKey}» не соответствует схеме — показаны исходные тексты. Поля: ${parsed.issues.join("; ")}`,
  );
  return seed;
}
