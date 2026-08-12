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
  cases: "/cases",
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

/**
 * Раздел «Кейсы» после публикации, правки или удаления кейса.
 *
 * Сбрасывается ВЕСЬ сегмент (`"layout"`), а не отдельная страница: картотеку слева рисует
 * `src/app/cases/layout.tsx`, и она общая для обложки архива и для каждого досье — сброса одной
 * страницы хватило бы только на неё саму.
 *
 * ВАЖНО про сегодняшнее устройство раздела. Обложка, layout и страница кейса объявлены
 * `force-dynamic` (запасных текстов у кейсов нет, а образ собирается без базы — см.
 * `src/app/cases/page.tsx`), поэтому сбрасывать там нечего: каждая страница и так собирается на
 * запрос и показывает правку сразу. Вызов остаётся по двум причинам — он делает намерение явным и
 * держит раздел корректным, если кэширование сюда однажды вернут. Второго слоя кэша он не создаёт.
 */
export function revalidateCases(): void {
  revalidatePath(PUBLIC_PATHS.cases, "layout");
  revalidatePath(`${PUBLIC_PATHS.cases}/[slug]`, "page");
  revalidatePath("/sitemap.xml");
}
