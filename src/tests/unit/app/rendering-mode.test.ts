import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Сторож против повторения ошибки первого деплоя (29.07.2026).
 *
 * Что случилось. Образ собирается там, где базы контента ещё нет: она живёт на постоянном томе
 * сервера и наполняется уже после сборки. Публичные страницы пререндерились статически, и то, что
 * они прочитали на сборке, запекалось в образ навсегда. Блог и раздел документов читают только
 * базу, запасных текстов в `data/` у них нет — в production уехали пустой список статей, пустой
 * каталог документов и карта сайта без единой статьи. При этом в базе всё лежало.
 *
 * Поэтому у каждой публичной страницы, читающей базу, должен быть явно объявлен режим рендера:
 *
 *   `force-dynamic` — там, где статического «состояния по умолчанию» не существует и пустая
 *                     страница уехала бы в production;
 *   `revalidate`    — там, где запасные тексты есть, но страница обязана догнать базу после
 *                     деплоя, иначе правка из админ-панели пропадёт при следующей сборке.
 *
 * Проверяется исходный текст, а не импорт модуля: значение важно именно как объявление на уровне
 * файла, которое читает сборщик Next.js. Импорт страницы сюда потянул бы React-компоненты и
 * серверное соединение с базой, ничего не добавив к сути проверки.
 */

const APP_DIR = path.join(process.cwd(), "src", "app");

function source(relativePath: string): string {
  const fullPath = path.join(APP_DIR, relativePath);
  // Отдельная проверка: переименовали файл — тест обязан упасть, а не молча пройти по пустой строке.
  expect(fs.existsSync(fullPath), `нет файла ${relativePath}`).toBe(true);
  return fs.readFileSync(fullPath, "utf8");
}

/**
 * Разделы, чьё содержимое целиком принадлежит админ-панели: статикой они уехали бы пустыми.
 *
 * Главная здесь же, хотя пустой она не бывает: она и так рендерится на запрос, потому что читает
 * `searchParams`. Объявление сделано явным, чтобы режим не зависел молча от того, работает ли
 * страница с параметрами адреса.
 */
const MUST_BE_DYNAMIC = [
  "page.tsx",
  "blog/[[...slug]]/page.tsx",
  "documents/page.tsx",
  "sitemap.ts",
] as const;

/** Страницы с запасными текстами в `data/`: статика допустима, но обязана догонять базу. */
const MUST_REVALIDATE = [
  "products/[[...slug]]/page.tsx",
  "contacts/page.tsx",
  "faq/page.tsx",
  "how-we-work/page.tsx",
] as const;

describe("режим рендера публичных страниц", () => {
  it.each(MUST_BE_DYNAMIC)("%s рендерится на запрос", (file) => {
    expect(source(file)).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it.each(MUST_REVALIDATE)("%s обновляется в фоне", (file) => {
    const match = source(file).match(/export const revalidate = (\d+)/);

    expect(match, "нет объявления revalidate").not.toBeNull();

    // Верхняя граница — час. Больше означало бы, что после деплоя сайт может полдня показывать
    // содержимое сборки вместо базы, а это и есть та самая ошибка, от которой стоит этот тест.
    const seconds = Number(match?.[1]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(3600);
  });

  it("страницы с force-dynamic не объявляют ещё и revalidate", () => {
    // Одновременно заданные режимы читаются как противоречие: `force-dynamic` уже означает, что
    // кэшировать нечего, и `revalidate` рядом с ним вводит в заблуждение следующего читателя.
    for (const file of MUST_BE_DYNAMIC) {
      expect(source(file), `${file}: объявлены оба режима`).not.toMatch(
        /export const revalidate =/,
      );
    }
  });
});
