import { describe, expect, it } from "vitest";
import { metadata } from "@/app/blog/not-found";

/**
 * Метаданные 404 раздела «Блог».
 *
 * До 2026-07-29 у сегмента не было своего `not-found.tsx`, и Next.js рисовал встроенную заглушку
 * внутри layout блога: ответ 404 был верным, но `<title>` — общим «QBit-Studio-Ai», а `<h1>` не
 * было вовсе. Тест закрывает возврат к этому состоянию и потерю `noindex`.
 *
 * Сам HTTP-статус здесь не проверяется намеренно: его выставляет механизм `notFound()` Next.js, а
 * не этот файл. Статус проверяется e2e-прогоном по живой сборке.
 */

describe("blog not-found metadata", () => {
  it("closes the page from indexing and from cached copies", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true });
  });

  it("names the page so it is distinguishable from the blog index", () => {
    expect(metadata.title).toBe("Статья не найдена — QBit-Studio-Ai");
    expect(String(metadata.description)).not.toHaveLength(0);
  });

  it("не объявляет canonical: канонического адреса у несуществующей страницы нет", () => {
    // Canonical на битый адрес хуже его отсутствия — он подтверждал бы, что страница существует.
    expect(metadata.alternates?.canonical).toBeUndefined();
  });
});
