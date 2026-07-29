import { revalidatePath } from "next/cache";

/**
 * Сброс кэша публичных страниц после сохранения.
 *
 * Публичные страницы рендерятся статически — это и даёт мгновенный первый экран. Чтобы правка из
 * админ-панели появлялась без пересборки проекта, после каждой записи соответствующие маршруты
 * помечаются устаревшими и перерисовываются при следующем обращении.
 *
 * `"layout"` вместо `"page"` там, где менялись общие данные (телефон в шапке, пункты меню):
 * шапку рисует layout, и сброса одной страницы было бы мало.
 */

export const PUBLIC_PATHS = {
  home: "/",
  products: "/products",
  blog: "/blog",
  documents: "/documents",
  contacts: "/contacts",
  faq: "/faq",
  howWeWork: "/how-we-work",
} as const;

export function revalidatePublicPaths(paths: readonly string[]): void {
  for (const path of paths) {
    revalidatePath(path);
  }
}

/** Данные, которые видны на каждой странице (шапка, контакты) — сбрасываем весь layout. */
export function revalidateSiteWide(): void {
  revalidatePath("/", "layout");
}

/**
 * Раздел с динамическим адресом: страница списка и все её материалы.
 *
 * `/sitemap.xml` сбрасывается вместе с ними: он собирается статически и читает опубликованные
 * статьи и продукты из базы, поэтому без сброса новый материал не попадал бы в карту сайта до
 * следующей сборки (найдено code review 2026-07-27).
 */
export function revalidateSection(section: string): void {
  revalidatePath(section);
  revalidatePath(`${section}/[[...slug]]`, "page");
  revalidatePath("/sitemap.xml");
}
