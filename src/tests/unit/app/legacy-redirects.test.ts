import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";
import { LEGACY_REDIRECTS, REDIRECT_EXCLUDED_URLS } from "@/lib/legacyRedirects";

/**
 * Договор таблицы переадресаций старых адресов.
 *
 * Проверяется не только состав списка. Три требования задачи невозможно увидеть глазами в
 * пятистрочном массиве, и именно они ломаются при следующей правке:
 *
 *   «один переход без цепочек» — ни один получатель не должен быть одновременно чьим-то источником;
 *   «не перенаправлять на главную» — получатель никогда не `/`;
 *   «не трогать перечисленные адреса» — они не должны попасть ни в источники, ни под шаблон.
 *
 * Отдельно проверяется, что адреса получателей существуют в исходных данных. Список фиксируется на
 * сборке, а slug редактируется в админ-панели: без этого сторожа переименование в `data/seed`
 * тихо превратило бы переадресацию в путь к 404.
 */

const ROOT = process.cwd();

function readSeed<T>(file: string): T[] {
  const raw = fs.readFileSync(path.join(ROOT, "data", "seed", file), "utf8");
  const parsed: unknown = JSON.parse(raw);
  expect(Array.isArray(parsed), `${file}: ожидался массив`).toBe(true);
  return parsed as T[];
}

const productSlugs = new Set(readSeed<{ slug: string }>("products.json").map((item) => item.slug));
const publishedArticleSlugs = new Set(
  readSeed<{ slug: string; status: string }>("articles.json")
    .filter((item) => item.status === "published")
    .map((item) => item.slug),
);

/** Ровно те пять пар, что заказаны пакетом SEO №2. Лишняя или пропавшая строка обязана уронить тест. */
const EXPECTED: ReadonlyArray<readonly [source: string, destination: string]> = [
  ["/pricing", "/products"],
  ["/integrations", "/products/leads-to-crm"],
  ["/blog/ai-document-automation", "/blog/avtomatizatsiya-dokumentov-s-ai"],
  ["/blog/lead-automation-telegram-crm", "/blog/sayt-crm-i-messendzhery"],
  ["/blog/n8n-business-automation", "/blog/chto-mozhno-avtomatizirovat-na-n8n"],
];

describe("переадресации старых адресов", () => {
  it("список совпадает с заказанным составом", () => {
    expect(LEGACY_REDIRECTS.map((rule) => [rule.source, rule.destination])).toEqual(
      EXPECTED.map((pair) => [...pair]),
    );
  });

  it("конфигурация Next.js применяет весь список постоянным кодом", async () => {
    // Проверяется именно то, что уедет в routes-manifest, а не промежуточная константа: между
    // таблицей и конфигурацией есть преобразование, и ошибка в нём иначе осталась бы незамеченной.
    const applied = await nextConfig.redirects!();

    expect(applied).toEqual(
      LEGACY_REDIRECTS.map((rule) => ({
        source: rule.source,
        destination: rule.destination,
        permanent: true,
      })),
    );
    // `permanent: true` — 308. Временный код не передаёт сигналы адреса поисковым системам.
    expect(applied.every((rule) => rule.permanent === true)).toBe(true);
  });

  it("ни один переход не ведёт в следующий переход", () => {
    const sources = new Set(LEGACY_REDIRECTS.map((rule) => rule.source));
    for (const rule of LEGACY_REDIRECTS) {
      expect(sources.has(rule.destination), `цепочка: ${rule.source} → ${rule.destination}`).toBe(
        false,
      );
    }
  });

  it("ни один переход не ведёт на главную", () => {
    for (const rule of LEGACY_REDIRECTS) {
      expect(rule.destination, `${rule.source} ведёт на главную`).not.toBe("/");
      expect(rule.destination.startsWith("/")).toBe(true);
      expect(rule.destination.length).toBeGreaterThan(1);
    }
  });

  it("источники заданы точными адресами, без шаблонов и завершающего слэша", () => {
    for (const rule of LEGACY_REDIRECTS) {
      // `:` и `*` в `source` — синтаксис шаблона Next.js. Шаблон мог бы захватить соседний адрес,
      // который задача запрещает трогать, поэтому в этой таблице допустимы только точные пути.
      expect(rule.source, `${rule.source}: шаблон вместо точного адреса`).not.toMatch(/[:*(]/);
      expect(rule.source.startsWith("/")).toBe(true);
      expect(rule.source.endsWith("/")).toBe(false);
      expect(rule.source).not.toContain("?");
    }
  });

  it("исключённые адреса не участвуют в переадресациях", () => {
    for (const excluded of REDIRECT_EXCLUDED_URLS) {
      for (const rule of LEGACY_REDIRECTS) {
        expect(rule.source, `${excluded} попал в источники`).not.toBe(excluded);
        expect(rule.destination, `${excluded} попал в получатели`).not.toBe(excluded);
      }
    }
  });

  it("список исключений совпадает с заказанным", () => {
    expect([...REDIRECT_EXCLUDED_URLS]).toEqual([
      "/ai-assistant-for-business",
      "/blog/ai-assistant-business-tasks",
      "/blog/ai-agents-for-business",
      "/blog/data-parser-automation",
      "/blog/telegram-bot-dlya-biznesa",
    ]);
  });

  it("у источников нет собственных страниц: переадресация ничего не перекрывает", () => {
    // Страница победила бы переадресацию по смыслу задачи (адрес живой — переносить нечего), но
    // `redirects()` обрабатывается раньше файловой маршрутизации и молча спрятал бы её.
    for (const rule of LEGACY_REDIRECTS) {
      const segment = rule.source.slice(1).split("/")[0];
      const literalRoute = path.join(ROOT, "src", "app", rule.source.slice(1), "page.tsx");
      expect(fs.existsSync(literalRoute), `${rule.source}: у источника есть страница`).toBe(false);
      // `/pricing` и `/integrations` не должны существовать даже как каталог верхнего уровня.
      if (!rule.source.slice(1).includes("/")) {
        expect(
          fs.existsSync(path.join(ROOT, "src", "app", segment)),
          `${rule.source}: у источника есть каталог маршрута`,
        ).toBe(false);
      }
    }
  });

  it("адреса получателей существуют в исходных данных", () => {
    expect(
      fs.existsSync(path.join(ROOT, "src", "app", "products", "[[...slug]]", "page.tsx")),
    ).toBe(true);

    for (const rule of LEGACY_REDIRECTS) {
      if (rule.destination === "/products") continue;

      if (rule.destination.startsWith("/products/")) {
        expect(productSlugs, `нет продукта для ${rule.destination}`).toContain(
          rule.destination.slice("/products/".length),
        );
        continue;
      }

      expect(rule.destination.startsWith("/blog/"), `неожиданный раздел: ${rule.destination}`).toBe(
        true,
      );
      expect(publishedArticleSlugs, `нет опубликованной статьи для ${rule.destination}`).toContain(
        rule.destination.slice("/blog/".length),
      );
    }
  });

  it("исключённые адреса статей не существуют и не выдают себя за опубликованные", () => {
    // Обратная сторона предыдущей проверки: эти адреса запрещено трогать именно потому, что они
    // не соответствуют ни одной статье сайта. Появись такая статья — запрет нужно пересматривать
    // осознанно, а не обнаруживать постфактум.
    for (const excluded of REDIRECT_EXCLUDED_URLS) {
      if (!excluded.startsWith("/blog/")) continue;
      expect(publishedArticleSlugs).not.toContain(excluded.slice("/blog/".length));
    }
  });
});
