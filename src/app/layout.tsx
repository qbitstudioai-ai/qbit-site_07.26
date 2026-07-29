import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

/**
 * Общесайтовые метаданные.
 *
 * `metadataBase` — обязательная опора для всех адресных полей: без него относительный путь в
 * `alternates.canonical` или `openGraph.images` вызывает ошибку сборки, а Next.js не может
 * достроить абсолютный адрес.
 *
 * Чего здесь СОЗНАТЕЛЬНО нет:
 *
 * - `alternates.canonical`. Значение из корневого layout досталось бы каждой странице, которая не
 *   объявила своё, — включая 404 и служебные. Canonical на несуществующую страницу хуже, чем его
 *   отсутствие, поэтому canonical задаётся ТОЛЬКО постранично.
 * - `openGraph`. Метаданные сливаются поверхностно: страница со своим `openGraph` заменила бы
 *   объект целиком, и общие поля отсюда до неё всё равно не дошли бы. Общие поля подставляет
 *   `buildOpenGraph()` из `src/lib/seo.ts`.
 * - `robots`. Проверено на собранном сайте: значение отсюда достаётся и странице 404, к которой
 *   Next.js сам добавляет `noindex`. В `<head>` оказывались ДВА противоречащих указания —
 *   `noindex` и `index, follow`. Правила индексирования задаются постранично константой
 *   `INDEXABLE_ROBOTS` из `src/lib/seo.ts`, и только на страницах, которые действительно
 *   индексируются.
 *
 * `title`/`description` остаются запасным вариантом для сегментов без собственных метаданных
 * (`/login`, служебные страницы); главная объявляет свои.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: `${SITE_NAME} — автоматизация бизнес-процессов для компаний.`,
  icons: {
    icon: "/logo.svg",
  },
};

// Step 15: `viewportFit: "cover"` — обязательная половина работы с safe-area. Без него
// `env(safe-area-inset-*)` в CSS всегда равен 0px даже на устройстве с вырезом, то есть
// safe-area-отступы в OfficeExperience.module.css были бы мёртвым кодом. Вторая половина — сами
// отступы: `cover` без них увёл бы контент ПОД вырез и скруглённые углы, что хуже исходного
// состояния. Оба изменения вводятся одним шагом и работают только вместе.
// Значения width/initialScale — те же, что Next.js ставит по умолчанию; они выписаны явно, потому
// что объявление собственного `viewport` полностью заменяет умолчание, а не дополняет его.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: класс "js" ставится синхронным inline-скриптом ниже до гидратации,
    // намеренно в обход React (тот же паттерн, что и в next-themes для тёмной темы) — без этого
    // React в dev-режиме считает несовпадение атрибута html.class ошибкой гидратации.
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Синхронно, до первой отрисовки: помечает <html> как JS-enabled, чтобы CSS сразу скрыл
            контент, раскрываемый по клику (OfficeExperience.module.css), без "мигания"
            видимого-затем-скрытого содержимого при гидратации (docs/05 hero-состояние, Step 4). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
