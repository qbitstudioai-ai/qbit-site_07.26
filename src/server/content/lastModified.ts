import { cache } from "react";
import { getContacts } from "../repositories/contacts";
import { listAllDepartments } from "../repositories/departments";
import { getPublishedDocuments } from "../repositories/documents";
import { getPageContentRecord, type PageKey } from "../repositories/pageContent";
import { listAllProducts } from "../repositories/products";

/**
 * Настоящие даты изменения публичных страниц — единственный источник `lastmod` для `sitemap.xml`.
 *
 * Правило одно и оно жёсткое: дата берётся ТОЛЬКО из колонки `updated_at` базы. Ни `new Date()`,
 * ни дата сборки, ни «сегодня» сюда не попадают. Подставлять их нельзя не из аккуратности, а по
 * существу: `lastmod` — это заявление поисковой системе «страница изменилась». Если он меняется на
 * каждой сборке, заявление становится ложным на всём сайте сразу, и поисковая система перестаёт
 * доверять сигналу целиком — включая те страницы, где дата настоящая.
 *
 * Отсюда следствие, которое важнее удобства: **если настоящей даты нет, функция возвращает
 * `undefined`, и строка карты сайта остаётся без `lastmod`**. Отсутствие поля — корректное
 * состояние; выдуманное поле — нет.
 *
 * Честная оговорка о точности. `updated_at` записи, которую ни разу не правили через
 * админ-панель, равен моменту `db:seed` — то есть первого наполнения базы, а не содержательного
 * изменения текста. На чистом томе такие даты у всех записей окажутся одинаковыми. Это всё ещё
 * настоящая дата появления содержимого в системе, а не отметка времени сборки, и она перестаёт
 * быть общей, как только запись действительно отредактируют. Но выдавать её за «дату последней
 * содержательной правки» нельзя, и на это здесь указано прямо.
 *
 * Почему у раздела берётся максимум из нескольких дат. Страница раздела показывает и собственный
 * текст (`page_content`), и список сущностей. Отредактированный продукт меняет `/products` ровно
 * так же, как правка заголовка раздела, — значит, честная дата изменения страницы это позднейшая
 * из двух, а не только одна из них.
 */

/** Позднейшая из дат. Пустые и нечитаемые значения игнорируются, а не превращаются в «сейчас». */
function latest(...values: readonly (string | undefined | null)[]): Date | undefined {
  let best: Date | undefined;

  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!best || parsed > best) best = parsed;
  }

  return best;
}

/** `updated_at` записи `page_content`. `undefined`, если записи нет (например, база пустая). */
function pageContentUpdatedAt(pageKey: PageKey): string | undefined {
  try {
    return getPageContentRecord(pageKey)?.updatedAt;
  } catch {
    // База недоступна (сборка образа идёт там, где тома ещё нет). Отсутствие даты — не ошибка.
    return undefined;
  }
}

/** Безопасное чтение списка: при недоступной базе карта сайта собирается без дат, а не падает. */
function safely<T>(read: () => readonly T[]): readonly T[] {
  try {
    return read();
  } catch {
    return [];
  }
}

/** Главная: собственный текст плюс тексты пяти отделов, которые она показывает. */
export const homepageLastModified = cache((): Date | undefined =>
  latest(
    pageContentUpdatedAt("homepage"),
    ...safely(listAllDepartments)
      .filter((department) => department.isPublished)
      .map((department) => department.updatedAt),
  ),
);

/** Каталог продуктов: текст раздела плюс все опубликованные продукты. */
export const productsIndexLastModified = cache((): Date | undefined =>
  latest(
    pageContentUpdatedAt("products"),
    ...safely(listAllProducts)
      .filter((product) => product.isPublished)
      .map((product) => product.updatedAt),
  ),
);

/** Дата каждого продукта по его slug. Продукта нет в базе (запасной каталог) — даты нет. */
export const productLastModifiedBySlug = cache((): ReadonlyMap<string, Date> => {
  const map = new Map<string, Date>();

  for (const product of safely(listAllProducts)) {
    if (!product.isPublished) continue;
    const date = latest(product.updatedAt);
    if (date) map.set(product.slug, date);
  }

  return map;
});

/** Каталог документов: текст раздела плюс все опубликованные документы. */
export const documentsLastModified = cache((): Date | undefined =>
  latest(
    pageContentUpdatedAt("documents"),
    ...safely(getPublishedDocuments).map((document) => document.updatedAt),
  ),
);

/** Контакты: текст страницы плюс сами каналы связи — телефон правится именно там. */
export const contactsLastModified = cache((): Date | undefined =>
  latest(
    pageContentUpdatedAt("contacts"),
    ...safely(getContacts).map((contact) => contact.updatedAt),
  ),
);

/**
 * Блог: текст раздела. Даты самих статей добавляет `sitemap.ts` — там они уже прочитаны
 * для списка адресов, и второе чтение той же таблицы было бы лишним.
 */
export const blogIndexPageContentLastModified = cache((): Date | undefined =>
  latest(pageContentUpdatedAt("blog")),
);

export { latest as latestDate };
