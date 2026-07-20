import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allqbit",
  description: "Allqbit — прототип интерактивной главной страницы.",
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
