import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ссылка на страницу отдела в ПЕРВОМ серверном HTML статьи (SOLREL-02 / Amendment 64).
 *
 * Зачем отдельный файл, если вывод материалов уже проверен в
 * `src/tests/unit/server/publicArticleRelations.test.ts`. Тот тест проверяет ДАННЫЕ — форму
 * `relatedMaterials` у статьи. Этот проверяет, что связь доживает от базы до разметки СТРАНИЦЫ,
 * через всю её сборку, а не только до объекта, который страница могла бы и не отрисовать.
 *
 * Чего этот тест НЕ доказывает, и это важно не перепутать: здесь нет конвейера RSC —
 * `renderToStaticMarkup` рисует клиентские компоненты на месте, поэтому отличить «значение в
 * RSC-payload» от «содержимого документа» он в принципе не может. Настоящая проверка этого
 * различия — поднятый standalone-сервер (`WORKLOG.md`, 2026-09-22). Снятие `<script>` здесь
 * проверяет более узкое, но тоже нужное: ссылка лежит в разметке, а не только в JSON-LD, который
 * страница отдаёт отдельным `<script type="application/ld+json">`.
 *
 * База НАСТОЯЩАЯ и временная, как в `publicArticleRelations.test.ts`. Пользовательская
 * `var/content.db` не открывается, production не читается.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  notFound: () => {
    throw new Error("notFound() вызван там, где статья обязана существовать");
  },
}));

const NOW = "2026-09-01T10:00:00.000Z";
const ARTICLE = { id: "uuid-ssr-source", slug: "istochnik-ssr" };
/** `executive` → `/solutions/management`: идентификатор и сегмент адреса — разные слова. */
const DEPARTMENT = { id: "executive", name: "Дирекция" };
const HIDDEN_DEPARTMENT = { id: "hr", name: "HR" };

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-solution-ssr-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function seed(options: { departmentPublished: boolean }): Promise<void> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, status,
                           related_slugs, sort_order, created_at, updated_at)
     VALUES (?, ?, 'Статья источник', 'Анонс.', 'Текст статьи.', 'blog', 'published', '[]', 0, ?, ?)`,
  ).run(ARTICLE.id, ARTICLE.slug, NOW, NOW);

  for (const [department, isPublished] of [
    [DEPARTMENT, options.departmentPublished],
    [HIDDEN_DEPARTMENT, false],
  ] as const) {
    db.prepare(
      `INSERT INTO departments (id, display_name, content, is_published, created_at, updated_at)
       VALUES (?, ?, '{}', ?, ?, ?)`,
    ).run(department.id, department.name, isPublished ? 1 : 0, NOW, NOW);

    db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('article', ?, 'department', ?, 'related', 0, ?, ?)`,
    ).run(ARTICLE.id, department.id, NOW, NOW);
  }
}

/** HTML статьи со снятыми `<script>` — то, что остаётся краулеру без JavaScript. */
async function documentHtml(): Promise<string> {
  const { default: BlogPage } = await import("@/app/blog/[[...slug]]/page");
  const html = renderToStaticMarkup(
    await BlogPage({ params: Promise.resolve({ slug: [ARTICLE.slug] }) }),
  );
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

/**
 * Дефолтных 5 секунд не хватает ПЕРВОМУ тесту файла: он первым импортирует страницу блога со всем
 * её деревом модулей (около шести секунд на холодную), а `vi.resetModules()` в `beforeEach` не даёт
 * этому импорту прогреться заранее. Предел поднят на файл, а не глобально: остальной набор от этого
 * зависеть не должен.
 */
const SSR_TIMEOUT_MS = 30_000;

describe("SSR: связь статьи на отдел — обычная crawlable ссылка", () => {
  it(
    "опубликованный отдел даёт <a href> из solutionPath в первом серверном HTML",
    async () => {
      await seed({ departmentPublished: true });

      const html = await documentHtml();

      expect(html).toContain('href="/solutions/management"');
      expect(html).toContain("Решение");
      expect(html).toContain(DEPARTMENT.name);
      // Адрес собран из таблицы, а не из идентификатора отдела.
      expect(html).not.toContain('href="/solutions/executive"');
    },
    SSR_TIMEOUT_MS,
  );

  it(
    "снятый с публикации отдел не попадает в документ ни одной ссылкой",
    async () => {
      await seed({ departmentPublished: false });

      const html = await documentHtml();

      /**
       * Проверяется адрес СКРЫТОГО отдела, а не строка `/solutions/` вообще: общий запрет сломался
       * бы в тот день, когда на странице блога законно появится ссылка на раздел решений, и тест
       * начал бы падать на здоровом коде.
       */
      expect(html).not.toContain('href="/solutions/hr"');
      expect(html).not.toContain(HIDDEN_DEPARTMENT.name);
    },
    SSR_TIMEOUT_MS,
  );
});
