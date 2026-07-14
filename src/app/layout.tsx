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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
