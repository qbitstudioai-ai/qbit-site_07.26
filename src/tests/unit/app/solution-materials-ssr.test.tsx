import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Блоки «Подходящие решения» и «Пример внедрения» в ПЕРВОМ серверном HTML страницы отдела
 * (SOL-OUT-02).
 *
 * Зачем отдельный файл, если читатель уже проверен в
 * `src/tests/unit/server/departmentRelatedMaterials.test.ts`, а вёрстка — в
 * `src/tests/unit/features/solutions/solutionDocument.test.tsx`. Те два проверяют ДАННЫЕ и
 * КОМПОНЕНТ по отдельности. Этот проверяет единственное, чего не проверяет ни один из них: что
 * страница читает связи по СТАБИЛЬНОМУ идентификатору отдела, а не по сегменту адреса. Ошибка здесь
 * невидима на четырёх отделах из пяти и проявляется только на дирекции, где идентификатор
 * `executive`, а сегмент `management`.
 *
 * Тот же приём и те же оговорки, что в `solution-relation-ssr.test.tsx`: база настоящая и
 * временная, пользовательская `var/content.db` не открывается, production не читается.
 *
 * УТВЕРЖДЁННЫХ 11 СВЯЗЕЙ ЗДЕСЬ НЕТ: данные тестовые, механизм обязан работать без них.
 */

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound() вызван там, где отдел обязан существовать");
  },
}));

const NOW = "2026-09-01T10:00:00.000Z";
const SSR_TIMEOUT_MS = 30_000;

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-solution-materials-"));
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

/**
 * Дирекция с настоящим текстом и связями на продукт и кейс.
 *
 * Текст берётся из `data/departments.json`: `departmentSchema` проверяет содержимое отдела ПРИ
 * ЧТЕНИИ и подменяет негодную запись seed-текстом, поэтому пустой `{}` здесь дал бы страницу не той
 * записи, которую тест положил в базу.
 */
async function seed(options: { withRelations: boolean }): Promise<void> {
  const { getDatabase } = await import("@/server/db/client");
  const { default: seedDepartments } = await import("../../../../data/departments.json");
  const db = getDatabase();

  const executive = (seedDepartments as { id: string }[]).find(
    (department) => department.id === "executive",
  );
  // `id` — колонка таблицы, а не часть содержимого: в JSON-колонку он не попадает.
  const content = Object.fromEntries(
    Object.entries(executive as Record<string, unknown>).filter(([key]) => key !== "id"),
  );

  db.prepare(
    `INSERT INTO departments (id, display_name, content, is_published, created_at, updated_at)
     VALUES ('executive', 'Дирекция', ?, 1, ?, ?)`,
  ).run(JSON.stringify(content), NOW, NOW);

  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           is_published, created_at, updated_at)
     VALUES ('product-05', 'call-analysis', 'Анализ звонков', 'AI-контроль качества звонков', ?,
             'wide', 'executive', 'Иллюстрация', 1, ?, ?)`,
  ).run(
    JSON.stringify({ summary: "Система расшифровывает звонки и проверяет их по чек-листу." }),
    NOW,
    NOW,
  );

  db.prepare(
    `INSERT INTO cases (id, slug, title, short_title, file_number, summary, seo_description,
                        status, created_at, updated_at)
     VALUES ('case-calls', 'analiz-zvonkov-testovyy', ?, ?, '92', ?, ?, 'published', ?, ?)`,
  ).run(
    "AI-анализ звонков: от нескольких часов проверки к 10–15 минутам",
    "AI-анализ звонков отдела продаж",
    "На контроль уходило 4–5 часов в неделю, стало 10–15 минут.",
    "Кейс: с 4–5 часов до 10–15 минут в неделю.",
    NOW,
    NOW,
  );

  if (!options.withRelations) return;

  const link = db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                    relation_role, sort_order, created_at, updated_at)
     VALUES ('department', 'executive', ?, ?, ?, ?, ?, ?)`,
  );
  link.run("product", "product-05", "primary", 0, NOW, NOW);
  link.run("case", "case-calls", "primary", 1, NOW, NOW);
}

/** HTML страницы `/solutions/management` со снятыми `<script>`. */
async function documentHtml(): Promise<string> {
  const { default: SolutionPage } = await import("@/app/solutions/[slug]/page");
  const html = renderToStaticMarkup(
    await SolutionPage({ params: Promise.resolve({ slug: "management" }) }),
  );
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

describe("SSR: связанные материалы на странице отдела", () => {
  it(
    "дирекция читает связи по id executive, хотя адрес страницы — /solutions/management",
    async () => {
      await seed({ withRelations: true });

      const html = await documentHtml();

      expect(html).toContain("Подходящие решения");
      expect(html).toContain('href="/products/call-analysis"');
      expect(html).toContain("AI-контроль качества звонков");

      expect(html).toContain("Пример внедрения");
      expect(html).toContain('href="/cases/analiz-zvonkov-testovyy"');
      expect(html).toContain("AI-анализ звонков отдела продаж");
    },
    SSR_TIMEOUT_MS,
  );

  it(
    "измеренный результат кейса в разметку блока не попадает",
    async () => {
      await seed({ withRelations: true });

      const html = await documentHtml();

      expect(html).not.toContain("10–15 минут");
      expect(html).not.toContain("4–5 часов");
    },
    SSR_TIMEOUT_MS,
  );

  it(
    "отдел без связей не отдаёт ни заголовка блока, ни пустой секции",
    async () => {
      await seed({ withRelations: false });

      const html = await documentHtml();

      expect(html).not.toContain("Подходящие решения");
      expect(html).not.toContain("Пример внедрения");
      expect(html).not.toContain("Примеры внедрения");
      expect(html).not.toContain("solution-products-heading");
      expect(html).not.toContain("solution-cases-heading");

      // Сам документ при этом на месте: пустая перелинковка страницу не ломает.
      expect(html).toContain("Результат для бизнеса");
    },
    SSR_TIMEOUT_MS,
  );
});
