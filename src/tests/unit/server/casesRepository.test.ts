import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrations } from "@/server/db/schema.mjs";
import { CASE_SALES_CALL_ANALYSIS } from "@/tests/fixtures/firstCase";

/**
 * Хранилище кейсов: перенос первого дела в базу, обратная сборка документа и правки из
 * админ-панели.
 *
 * Главная проверка файла — round-trip. Кейс № 01 был объектом в коде; теперь он строка таблицы, и
 * публичные страницы собирают его из колонок. Тест сравнивает СОБРАННЫЙ из базы документ с
 * замороженной копией прежнего объекта целиком (`toEqual`), а не по отдельным полям: расхождение в
 * одном абзаце, в порядке блоков, в якоре заголовка или в SEO — это уже регрессия production.
 *
 * Тесты работают на ОТДЕЛЬНОЙ временной базе; пользовательская `var/content.db` не открывается.
 */

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-cases-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

/** Поля кейса, которые заполняет форма админ-панели. Значения заведомо отличимы от первого дела. */
const NEW_CASE = {
  slug: "avtomatizatsiya-otcheta",
  title: "Автоматизация отчёта: заголовок документа",
  shortTitle: "Автоматизация отчёта",
  folderCaption: "Проект",
  fileNumber: "02",
  label: "РЕАЛИЗОВАННЫЙ ПРОЕКТ",
  summary: "Первый абзац краткого итога.\n\nВторой абзац краткого итога.",
  task: "Текст задачи.",
  implementation: "Вводный абзац реализации.\n\nПояснение после цепочки.",
  workflowSteps: ["первый шаг", "второй шаг"],
  result: "Абзац результата.\n\nОговорка рядом с цифрами.",
  metricLabel: "Время на подготовку отчёта",
  metricBefore: "3 часа в неделю",
  metricAfter: "20 минут в неделю",
  metricSource: "По данным заказчика",
  humanControl: "Решение принимает человек.",
  limitations: "Результат относится к конкретному внедрению.",
  ctaLabel: "Обсудить похожую задачу",
  ctaHref: "/contacts",
  seoTitle: "Автоматизация отчёта: с 3 часов до 20 минут",
  seoDescription: "Описание страницы кейса для поисковой выдачи.",
  ogDescription: "Описание карточки для мессенджеров.",
  status: "published" as const,
  stampEnabled: true,
  sortOrder: 2,
};

describe("миграция 0003 — переезд раздела «Кейсы» в базу", () => {
  it("создаёт таблицу и переносит ровно одно дело — первое", async () => {
    const { getDatabase } = await import("@/server/db/client");
    const rows = getDatabase().prepare("SELECT id, slug, file_number FROM cases").all();

    expect(rows).toEqual([
      {
        id: "case-sales-call-analysis",
        slug: "analiz-zvonkov-otdela-prodazh",
        file_number: "01",
      },
    ]);
  });

  it("не выдумывает дату публикации перенесённому кейсу", async () => {
    /**
     * Прямое требование: подтверждённой даты у кейса нет, а дата переезда рассказывала бы о базе,
     * а не о проекте. Пустые `published_at`/`modified_at` — это и отсутствие `lastmod` в карте
     * сайта, и отсутствие `Article`-разметки.
     */
    const { getDatabase } = await import("@/server/db/client");
    const row = getDatabase()
      .prepare("SELECT published_at, modified_at FROM cases WHERE file_number = '01'")
      .get() as { published_at: unknown; modified_at: unknown };

    expect(row.published_at).toBeNull();
    expect(row.modified_at).toBeNull();
  });

  it("идемпотентна: повторное выполнение не создаёт второй экземпляр первого кейса", async () => {
    const { getDatabase } = await import("@/server/db/client");
    const db = getDatabase();

    // Версионирование миграций уже не даст выполнить её дважды, поэтому вставка запускается
    // НАПРЯМУЮ — так проверяется вторая защита, `INSERT OR IGNORE`, а не только счётчик версий.
    const insert = migrations[2].sql
      .split(";")
      .map((statement) => statement.trim())
      // По `includes`, а не по началу строки: перед вставкой стоят комментарии миграции, и они
      // попадают в тот же фрагмент. Выполнению это не мешает — комментарии SQL пропускает.
      .find((statement) => statement.includes("INSERT OR IGNORE INTO cases"));

    expect(insert, "во второй миграции не нашлось вставки первого кейса").toBeTruthy();
    db.exec(insert as string);
    db.exec(insert as string);

    const total = db.prepare("SELECT COUNT(*) AS total FROM cases").get() as { total: number };
    expect(total.total).toBe(1);
  });

  it("применяется на базе, где уже есть первая миграция", () => {
    // Живая база: миграции 0001–0002 применены, кейсов ещё нет. Именно это состояние выкатывается.
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
      );
    `);
    db.exec(migrations[0].sql);
    db.exec(migrations[1].sql);

    expect(() => db.exec(migrations[2].sql)).not.toThrow();
    expect(db.prepare("SELECT COUNT(*) AS total FROM cases").get()).toEqual({ total: 1 });
    db.close();
  });
});

describe("первый кейс после переезда", () => {
  it("собирается из базы БЕЗ единого расхождения с production-версией", async () => {
    const { getPublishedCases } = await import("@/server/content/cases");
    const studies = getPublishedCases();

    expect(studies).toHaveLength(1);
    // Сравнение целиком: тексты, порядок блоков, цепочка, метрика, CTA, SEO, печать, номер дела.
    expect(studies[0]).toEqual(CASE_SALES_CALL_ANALYSIS);
  });

  it("открывается по прежнему адресу, а чужой адрес остаётся 404", async () => {
    const { getCaseBySlug } = await import("@/server/content/cases");

    expect(getCaseBySlug("analiz-zvonkov-otdela-prodazh")).toEqual(CASE_SALES_CALL_ANALYSIS);
    expect(getCaseBySlug("case-01")).toBeUndefined();
    expect(getCaseBySlug("case-02")).toBeUndefined();
    expect(getCaseBySlug(undefined)).toBeUndefined();
  });

  it("сохраняет якоря разделов, на которые ссылаются тесты и скрипты съёмки", async () => {
    const { getPublishedCases } = await import("@/server/content/cases");
    const [study] = getPublishedCases();

    expect(study.sections.map((section) => section.id)).toEqual([
      "case-01-summary",
      "case-01-task",
      "case-01-solution",
      "case-01-result",
      "case-01-human-control",
      "case-01-limitations",
    ]);
  });
});

describe("кейс, созданный в админ-панели", () => {
  it("появляется в картотеке и получает даты публикации", async () => {
    const { createCase } = await import("@/server/repositories/cases");
    const { getPublishedCases, getCaseBySlug } = await import("@/server/content/cases");

    const publishedAt = "2026-08-11T09:00:00.000Z";
    const record = createCase("case-test-01", NEW_CASE, publishedAt);

    expect(record.publishedAt).toBe(publishedAt);
    expect(record.modifiedAt).toBe(publishedAt);

    // `getPublishedCases` кэширован в пределах запроса — в тесте достаточно прочитать по адресу.
    const study = getCaseBySlug(NEW_CASE.slug);
    expect(study?.title).toBe(NEW_CASE.title);
    expect(study?.publishedAt).toBe(publishedAt);
    expect(getPublishedCases().map((item) => item.slug)).toContain(NEW_CASE.slug);
  });

  it("превращает поля формы в тот же документ, что и у первого кейса по строению", async () => {
    const { createCase } = await import("@/server/repositories/cases");
    const { getCaseBySlug } = await import("@/server/content/cases");

    createCase("case-test-01", NEW_CASE, "2026-08-11T09:00:00.000Z");
    const study = getCaseBySlug(NEW_CASE.slug);

    expect(study?.sections.map((section) => section.heading)).toEqual([
      "Краткий итог",
      "Задача",
      "Что реализовали",
      "Результат",
      "Что остаётся под контролем человека",
      "Об измеримом результате",
    ]);

    // Цепочка стоит СРАЗУ после вводящего абзаца, метрика — между абзацем результата и оговоркой.
    const solution = study?.sections.find((section) => section.heading === "Что реализовали");
    expect(solution?.blocks.map((block) => block.kind)).toEqual(["text", "chain", "text"]);

    const result = study?.sections.find((section) => section.heading === "Результат");
    expect(result?.blocks.map((block) => block.kind)).toEqual(["text", "metrics", "text"]);

    // Метрика собрана из четырёх полей формы — вручную её никто не верстал.
    const metrics = result?.blocks.find((block) => block.kind === "metrics");
    expect(metrics?.kind === "metrics" && metrics.items[0]).toEqual({
      label: "Время на подготовку отчёта",
      before: "3 часа в неделю",
      after: "20 минут в неделю",
      sourceNote: "По данным заказчика",
    });

    // Два абзаца «Краткого итога» разделены пустой строкой в textarea — и стали двумя абзацами.
    const summary = study?.sections.find((section) => section.heading === "Краткий итог");
    expect(summary?.blocks).toEqual([
      { kind: "text", text: "Первый абзац краткого итога." },
      { kind: "text", text: "Второй абзац краткого итога." },
    ]);
  });

  it("правка сохраняет дату публикации и двигает дату изменения", async () => {
    const { createCase, updateCase } = await import("@/server/repositories/cases");
    const { getCaseBySlug } = await import("@/server/content/cases");

    const publishedAt = "2026-08-11T09:00:00.000Z";
    createCase("case-test-01", NEW_CASE, publishedAt);

    const modifiedAt = "2026-08-12T10:30:00.000Z";
    const updated = updateCase(
      "case-test-01",
      { ...NEW_CASE, shortTitle: "Новое короткое название" },
      modifiedAt,
    );

    expect(updated.publishedAt).toBe(publishedAt);
    expect(updated.modifiedAt).toBe(modifiedAt);
    // Адрес правкой не меняется: он определяется тем, что лежит в базе.
    expect(updated.slug).toBe(NEW_CASE.slug);
    expect(getCaseBySlug(NEW_CASE.slug)?.shortTitle).toBe("Новое короткое название");
  });

  it("удаление убирает кейс из картотеки и делает адрес недоступным", async () => {
    const { createCase, deleteCase, listAllCases } = await import("@/server/repositories/cases");
    const { getCaseBySlug } = await import("@/server/content/cases");

    createCase("case-test-01", NEW_CASE, "2026-08-11T09:00:00.000Z");
    expect(deleteCase("case-test-01")).toBe(true);

    expect(getCaseBySlug(NEW_CASE.slug)).toBeUndefined();
    // Первый кейс на месте — удаление одного дела не трогает архив.
    expect(listAllCases().map((item) => item.slug)).toEqual(["analiz-zvonkov-otdela-prodazh"]);
    expect(deleteCase("case-test-01")).toBe(false);
  });

  it("не даёт занять чужой адрес и чужой номер дела", async () => {
    const { createCase, isCaseSlugTaken, isCaseFileNumberTaken } =
      await import("@/server/repositories/cases");

    createCase("case-test-01", NEW_CASE, "2026-08-11T09:00:00.000Z");

    expect(isCaseSlugTaken("analiz-zvonkov-otdela-prodazh")).toBe(true);
    expect(isCaseSlugTaken(NEW_CASE.slug)).toBe(true);
    expect(isCaseSlugTaken(NEW_CASE.slug, "case-test-01")).toBe(false);
    expect(isCaseFileNumberTaken("01")).toBe(true);
    expect(isCaseFileNumberTaken("02", "case-test-01")).toBe(false);
    expect(isCaseSlugTaken("svobodnyy-adres")).toBe(false);

    // Ограничение стоит и в схеме: обход проверки формы упирается в базу, а не создаёт дубль.
    expect(() =>
      createCase("case-test-02", { ...NEW_CASE, fileNumber: "03" }, "2026-08-11T09:00:00.000Z"),
    ).toThrow();
  });

  it("подсказывает следующий свободный порядок в картотеке", async () => {
    const { createCase, nextCaseSortOrder } = await import("@/server/repositories/cases");

    expect(nextCaseSortOrder()).toBe(2);
    createCase("case-test-01", NEW_CASE, "2026-08-11T09:00:00.000Z");
    expect(nextCaseSortOrder()).toBe(3);
  });

  it("хранит опасную строку как текст, а не как разметку", async () => {
    /**
     * Поля кейса попадают в документ текстовыми узлами React — тег в них не становится тегом.
     * Проверяется здесь, на границе хранилища: строка обязана дойти до документа БЕЗ изменений и
     * без разбора, то есть остаться безобидным текстом, а не превратиться в блок разметки.
     */
    const { createCase } = await import("@/server/repositories/cases");
    const { getCaseBySlug } = await import("@/server/content/cases");

    const payload = '<script>alert("xss")</script>';
    createCase(
      "case-test-01",
      { ...NEW_CASE, task: payload, metricBefore: payload },
      "2026-08-11T09:00:00.000Z",
    );

    const study = getCaseBySlug(NEW_CASE.slug);
    const task = study?.sections.find((section) => section.heading === "Задача");

    expect(task?.blocks).toEqual([{ kind: "text", text: payload }]);
  });
});
