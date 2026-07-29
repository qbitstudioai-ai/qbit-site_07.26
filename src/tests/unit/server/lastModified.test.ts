import { describe, expect, it } from "vitest";
import { latestDate } from "@/server/content/lastModified";

/**
 * `latestDate` — чистое ядро модуля дат карты сайта.
 *
 * Проверяется здесь, а не через `sitemap.xml`: в тесте карты сайта модуль целиком подменяется
 * стабами, и настоящая логика выбора даты там не исполняется вовсе.
 */

describe("latestDate", () => {
  it("выбирает позднейшую из нескольких настоящих дат", () => {
    const result = latestDate("2026-07-01", "2026-07-20T10:00:00.000Z", "2026-07-05");
    expect(result?.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  it("возвращает undefined, когда настоящей даты нет вовсе", () => {
    // Ключевое требование: при отсутствии данных строка карты сайта остаётся БЕЗ `lastmod`,
    // а не получает сегодняшнее число.
    expect(latestDate()).toBeUndefined();
    expect(latestDate(undefined, null, "")).toBeUndefined();
  });

  it("игнорирует нечитаемые значения, а не превращает их в «сейчас»", () => {
    // Именно `undefined`, а не «сегодня»: строка карты сайта должна остаться без `lastmod`.
    // `new Date("не дата")` даёт Invalid Date — важно, что он не просачивается наружу.
    expect(latestDate("не дата", "тоже не дата")).toBeUndefined();
  });

  it("не отбрасывает настоящую дату из-за соседнего мусора", () => {
    expect(latestDate("мусор", "2026-07-11", undefined)?.toISOString().slice(0, 10)).toBe(
      "2026-07-11",
    );
  });
});
