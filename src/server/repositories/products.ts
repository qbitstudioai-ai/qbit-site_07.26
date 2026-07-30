import {
  buildProductLocation,
  type ProductContent,
  type ProductHotspot,
  type ProductId,
  type ProductLayout,
  type ProductLocation,
} from "@/features/products/products";
import { normalizeSeoTitle } from "@/lib/seo";
import { getDatabase, nowIso, parseJsonColumn, transaction } from "../db/client";
import { logActivity, saveRevision } from "./revisions";

/**
 * Репозиторий продуктов.
 *
 * Десять продуктов существуют постоянно: их идентификаторы (`product-01`…`product-10`) связаны с
 * фотографиями `public/products/product-XX-*.webp` и зонами лаборатории. Поэтому админ-панель
 * умеет редактировать и скрывать продукт, но НЕ удалять — удаление оставило бы «дыру» в сцене.
 *
 * `content`, `layout` и `hotspot` — JSON-колонки: это вложенные структуры (список примеров, список
 * цен, геометрия зоны), которые всегда читаются и пишутся целиком.
 */

export interface ProductRecord extends ProductLocation {
  isPublished: boolean;
  updatedAt: string;
}

interface ProductRow {
  id: string;
  slug: string;
  menu_title: string;
  full_title: string;
  content: string;
  layout: string;
  hotspot: string;
  image_alt: string;
  seo_title: string | null;
  sort_order: number;
  is_published: number;
  updated_at: string;
}

function toProduct(row: ProductRow): ProductRecord {
  const location = buildProductLocation({
    id: row.id as ProductId,
    slug: row.slug,
    menuTitle: row.menu_title,
    fullTitle: row.full_title,
    order: Number(row.sort_order),
    alt: row.image_alt,
    seoTitle: row.seo_title,
    hotspot: parseJsonColumn<ProductHotspot>(row.hotspot, {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      marker: { x: 50, y: 50, align: "center" },
    }),
    content: parseJsonColumn<ProductContent>(row.content, {
      summary: "",
      applies: "",
      examples: ["", "", "", ""],
      prices: [],
      benefit: "",
    }),
    layout: parseJsonColumn<ProductLayout>(row.layout, {
      objectPosition: "50% 50%",
      focusPoint: "",
      freeArea: "",
      panelPosition: "right",
      panelVertical: "center",
      panelMaxWidth: 520,
    }),
  });

  return { ...location, isPublished: row.is_published === 1, updatedAt: String(row.updated_at) };
}

const SELECT = `SELECT id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                       seo_title, sort_order, is_published, updated_at FROM products`;

/** Опубликованные продукты в порядке отображения — то, что видит посетитель. */
export function getProducts(): ProductLocation[] {
  return getDatabase()
    .prepare(`${SELECT} WHERE is_published = 1 ORDER BY sort_order ASC, id ASC`)
    .all()
    .map((row) => toProduct(row as unknown as ProductRow));
}

/** Все продукты, включая скрытые — для админ-панели. */
export function listAllProducts(): ProductRecord[] {
  return getDatabase()
    .prepare(`${SELECT} ORDER BY sort_order ASC, id ASC`)
    .all()
    .map((row) => toProduct(row as unknown as ProductRow));
}

export function getProductBySlug(slug: string | undefined): ProductLocation | undefined {
  if (!slug) return undefined;
  const row = getDatabase()
    .prepare(`${SELECT} WHERE slug = ? AND is_published = 1`)
    .get(slug) as unknown as ProductRow | undefined;
  return row ? toProduct(row) : undefined;
}

export function getProductById(id: string | undefined): ProductRecord | undefined {
  if (!id) return undefined;
  const row = getDatabase().prepare(`${SELECT} WHERE id = ?`).get(id) as unknown as
    ProductRow | undefined;
  return row ? toProduct(row) : undefined;
}

/** Занят ли slug другим продуктом. Адрес продукта обязан оставаться уникальным. */
export function isProductSlugTaken(slug: string, exceptId: string): boolean {
  return Boolean(
    getDatabase().prepare("SELECT 1 FROM products WHERE slug = ? AND id <> ?").get(slug, exceptId),
  );
}

export interface ProductUpdateInput {
  slug: string;
  menuTitle: string;
  fullTitle: string;
  imageAlt: string;
  /**
   * Заголовок для выдачи, ТРИ состояния:
   *
   * - поле отсутствует (`undefined`) — колонка не участвует в `UPDATE`, прежнее значение остаётся;
   * - `null` — явная очистка, заголовок снова собирается из `fullTitle`;
   * - строка — новое значение.
   *
   * Отсутствие отделено от очистки ради старого клиента: вкладка админ-панели, открытая до
   * деплоя, шлёт `PUT` без этого поля, и трактовать такой запрос как «очистить» значило бы терять
   * заголовок при каждом сохранении из устаревшей формы.
   */
  seoTitle?: string | null;
  content: ProductContent;
  layout: ProductLayout;
  hotspot: ProductHotspot;
  sortOrder: number;
  isPublished: boolean;
}

/**
 * Пары «колонка → значение» для записи продукта.
 *
 * Список, а не фиксированная строка SQL: `seo_title` попадает в запрос ТОЛЬКО когда клиент это
 * поле прислал. Позиционная привязка параметров и без того легко разъезжается с перечнем колонок,
 * а условная колонка сделала бы расхождение почти неизбежным.
 */
function productColumns(input: ProductUpdateInput): { name: string; value: unknown }[] {
  const columns: { name: string; value: unknown }[] = [
    { name: "slug", value: input.slug },
    { name: "menu_title", value: input.menuTitle },
    { name: "full_title", value: input.fullTitle },
    { name: "image_alt", value: input.imageAlt },
    { name: "content", value: JSON.stringify(input.content) },
    { name: "layout", value: JSON.stringify(input.layout) },
    { name: "hotspot", value: JSON.stringify(input.hotspot) },
    { name: "sort_order", value: input.sortOrder },
    { name: "is_published", value: input.isPublished ? 1 : 0 },
  ];

  if (input.seoTitle !== undefined) {
    columns.push({ name: "seo_title", value: normalizeSeoTitle(input.seoTitle) });
  }

  return columns;
}

export function updateProduct(id: string, input: ProductUpdateInput): ProductRecord {
  return transaction(() => {
    const previous = getProductById(id);
    if (!previous) throw new Error(`Продукт «${id}» не найден`);
    saveRevision("product", id, previous);

    const columns = productColumns(input);
    const assignments = columns.map((column) => `${column.name} = ?`).join(", ");

    getDatabase()
      .prepare(`UPDATE products SET ${assignments}, updated_at = ? WHERE id = ?`)
      .run(...(columns.map((column) => column.value) as never[]), nowIso(), id);

    logActivity("product", id, "update", `Продукт «${input.menuTitle}» обновлён`);
    return getProductById(id) as ProductRecord;
  });
}

/** Массовое изменение порядка — кнопки «вверх/вниз» в списке продуктов. */
export function reorderProducts(order: readonly string[]): void {
  transaction(() => {
    const statement = getDatabase().prepare(
      "UPDATE products SET sort_order = ?, updated_at = ? WHERE id = ?",
    );
    const timestamp = nowIso();
    order.forEach((id, index) => statement.run(index + 1, timestamp, id));
    logActivity("product", "*", "reorder", "Изменён порядок продуктов");
  });
}

export function insertProductIfMissing(input: ProductUpdateInput & { id: string }): boolean {
  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM products WHERE id = ?").get(input.id)) return false;

  // Создание: отсутствующий заголовок просто не попадает в список колонок и остаётся NULL — то же
  // самое, что «не задан». Различать здесь нечего: прежнего значения у новой записи нет.
  const columns = productColumns(input);
  const names = columns.map((column) => column.name).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const timestamp = nowIso();

  db.prepare(
    `INSERT INTO products (${names}, id, created_at, updated_at)
     VALUES (${placeholders}, ?, ?, ?)`,
  ).run(...(columns.map((column) => column.value) as never[]), input.id, timestamp, timestamp);

  return true;
}
