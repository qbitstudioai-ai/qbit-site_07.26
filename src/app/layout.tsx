import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allqbit",
  description: "Allqbit — прототип интерактивной главной страницы.",
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
