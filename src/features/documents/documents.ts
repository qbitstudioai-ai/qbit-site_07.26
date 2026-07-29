/**
 * Каталог документов — формы данных и правила отбора.
 *
 * САМИХ ДОКУМЕНТОВ здесь больше нет: записи хранятся в базе, файлы — в объектном хранилище
 * (`var/uploads`), и то и другое управляется из `/admin/documents`. Компоненты по-прежнему не знают
 * об источнике: они получают уже отобранный список пропсами, а `loadDocuments()` спрашивает API.
 */

export interface DocumentItem {
  id: string;
  title: string;
  description?: string;
  /** Идентификатор категории. Строка, а не union: список категорий приходит из админ-панели. */
  category: string;
  /** Расширение файла в нижнем регистре: "pdf", "docx", "xlsx", "png"… */
  fileType: string;
  /**
   * Размер файла В БАЙТАХ. Именно число, а не готовая строка «1,8 МБ»: строку нельзя ни
   * отсортировать, ни сравнить, а форматирование — задача интерфейса (`formatFileSize`).
   */
  fileSize?: number;
  /** ISO-дата (YYYY-MM-DD) последнего обновления. */
  updatedAt?: string;
  /** Ссылка на ИСХОДНЫЙ файл — то, что скачивает пользователь. */
  fileUrl: string;
  /**
   * Ссылка на ИЗОБРАЖЕНИЕ предпросмотра — отдельное поле, а не производное от `fileUrl`.
   * Для картинок это может быть сам файл; для PDF и офисных форматов изображение готовит
   * админ-панель. Если поля нет — показывается заглушка формата.
   */
  previewUrl?: string;
  /** Порядок в списке. Записи без значения уходят в конец. */
  sortOrder?: number;
  /** Снятые с публикации записи в каталог не попадают. Отсутствие поля = опубликован. */
  isPublished?: boolean;
}

export interface DocumentCategory {
  id: string;
  label: string;
}

export interface DocumentCategoryOption extends DocumentCategory {
  count: number;
}

/** Тексты раздела «Документы», редактируемые в админ-панели. */
export interface DocumentsPageCopy {
  headline: string;
  subheading: string;
  emptyMessage: string;
  seoDescription: string;
}

/** Идентификатор псевдокатегории «показать всё». Никогда не приходит из данных документа. */
export const ALL_CATEGORIES = "all";

/**
 * Отбор для показа: только опубликованные, по возрастанию `sortOrder`; записи без `sortOrder`
 * уходят в конец, внутри равных значений порядок — по названию, чтобы список не «прыгал» при
 * одинаковых весах из админ-панели.
 */
export function selectPublishedDocuments(items: readonly DocumentItem[]): DocumentItem[] {
  return items
    .filter((item) => item.isPublished !== false)
    .slice()
    .sort((a, b) => {
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title, "ru");
    });
}

/** Название категории по идентификатору. Незнакомый id из админ-панели показывается как есть. */
export function categoryLabel(categoryId: string, categories: readonly DocumentCategory[]): string {
  return categories.find((category) => category.id === categoryId)?.label ?? categoryId;
}

/**
 * Категории для фильтра: «Все» плюс только НЕПУСТЫЕ категории в заданном порядке, затем незнакомые
 * категории из данных. Пустые не показываются — иначе при малом каталоге ряд фильтров занимал бы
 * место, ничего не давая. Если непустая категория всего одна, фильтр не нужен вовсе.
 */
export function selectCategoryOptions(
  items: readonly DocumentItem[],
  categories: readonly DocumentCategory[],
): DocumentCategoryOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  const known = categories
    .filter((category) => counts.has(category.id))
    .map((category) => ({ ...category, count: counts.get(category.id) ?? 0 }));
  const unknown = [...counts.keys()]
    .filter((id) => !categories.some((category) => category.id === id))
    .map((id) => ({ id, label: id, count: counts.get(id) ?? 0 }));

  const present = [...known, ...unknown];
  if (present.length < 2) return [];

  return [{ id: ALL_CATEGORIES, label: "Все", count: items.length }, ...present];
}

export function filterByCategory(
  items: readonly DocumentItem[],
  categoryId: string,
): DocumentItem[] {
  if (categoryId === ALL_CATEGORIES) return [...items];
  return items.filter((item) => item.category === categoryId);
}

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/**
 * "2026-07-18" → "18 июля 2026". Формат собирается вручную, а не через `Intl`: результат обязан
 * совпасть на сервере и на клиенте (иначе hydration mismatch) и не зависеть от локали хоста.
 * Некорректная строка возвращается как есть — данные из админ-панели не должны ронять экран.
 */
export function formatUpdatedAt(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  const monthName = MONTHS_GENITIVE[Number(month) - 1];
  if (!monthName) return isoDate;

  return `${Number(day)} ${monthName} ${year}`;
}

/**
 * Байты → «1,8 МБ». Разделитель дробной части — запятая, единицы русские; как и с датой, строка
 * собирается вручную, чтобы сервер и клиент дали одинаковый результат.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} Б`;

  const units = ["КБ", "МБ", "ГБ"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[unitIndex]}`;
}

/**
 * Строка фактов о файле: «PDF · 1,8 МБ · обновлено 18 июля 2026». Отсутствующие поля просто
 * выпадают, разделители не задваиваются — запись из админ-панели может прийти без размера и даты.
 */
export function documentFacts(item: DocumentItem, updatedPrefix = ""): string {
  const parts = [item.fileType.toUpperCase()];
  const size = item.fileSize ? formatFileSize(item.fileSize) : "";
  if (size) parts.push(size);
  if (item.updatedAt) parts.push(`${updatedPrefix}${formatUpdatedAt(item.updatedAt)}`);
  return parts.join(" · ");
}

interface DocumentsApiResponse {
  documents: DocumentItem[];
  categories: DocumentCategory[];
}

/**
 * ЕДИНСТВЕННАЯ точка клиентской загрузки каталога — публичный API. Используется, когда страница не
 * отдала список серверным рендером (см. `useDocuments`), и при повторной попытке после ошибки.
 */
export async function loadDocuments(): Promise<DocumentItem[]> {
  const response = await fetch("/api/content/documents", { cache: "no-store" });
  if (!response.ok) throw new Error("Не удалось загрузить документы");

  const payload = (await response.json()) as DocumentsApiResponse;
  return selectPublishedDocuments(payload.documents ?? []);
}
