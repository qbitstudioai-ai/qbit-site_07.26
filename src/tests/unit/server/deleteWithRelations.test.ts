import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Уборка связей при удалении материала.
 *
 * У полиморфной ссылки нет внешнего ключа, поэтому каскада у базы нет: связи обязан снять код,
 * удаляющий материал. Снимаются ОБЕ стороны — и «на что ссылался этот материал», и «кто ссылался на
 * него», иначе чужие страницы остались бы со ссылками в никуда.
 *
 * Проверяется, что уборка идёт в ТОЙ ЖЕ транзакции, что и само удаление: материал без снятых связей
 * и снятые связи без удалённого материала одинаково плохи. Тесты работают на НАСТОЯЩЕЙ временной
 * базе — репозитории не подменяются, и смысл файла в состоянии таблиц после удаления и после
 * отката, а не в том, какие функции были вызваны.
 */

const ARTICLE_A = "article-a";
const ARTICLE_B = "article-b";
const PRODUCT = "product-a";
const CASE_ID = "case-02-otchet";

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-delete-relations-"));
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

/** Две статьи, продукт и отдел — прямым INSERT: проверяется удаление, а не создание. */
async function seedEntities(): Promise<DatabaseSync> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();
  const now = "2026-09-01T10:00:00.000Z";

  const insertArticle = db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, created_at,
                           updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertArticle.run(
    ARTICLE_A,
    "kak-avtomatizirovat-zayavki",
    "Как автоматизировать заявки",
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    now,
    now,
  );
  insertArticle.run(
    ARTICLE_B,
    "analiz-zvonkov",
    "Анализ звонков",
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    now,
    now,
  );

  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    PRODUCT,
    "ai-menedzher-dlya-sayta",
    "AI-менеджер",
    "AI-менеджер для сайта",
    "{}",
    "wide",
    "sales",
    "Иллюстрация продукта",
    now,
    now,
  );

  db.prepare(
    `INSERT INTO departments (id, display_name, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("sales", "Отдел продаж", "{}", now, now);

  return db;
}

/** Второй кейс — настоящим репозиторием: у кейса слишком много обязательных полей для INSERT. */
async function seedCase(): Promise<void> {
  const { createCase } = await import("@/server/repositories/cases");
  createCase(
    CASE_ID,
    {
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
      status: "published",
      stampEnabled: true,
      sortOrder: 2,
    },
    "2026-09-01",
  );
}

/** Все связи базы одной строкой на связь — так виднее, что уцелело, а что снято. */
async function allRelations(): Promise<string[]> {
  const { getDatabase } = await import("@/server/db/client");
  return getDatabase()
    .prepare(
      `SELECT source_type, source_id, target_type, target_id FROM content_relations
        ORDER BY source_type, source_id, target_type, target_id`,
    )
    .all()
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      return `${row.source_type}:${row.source_id} -> ${row.target_type}:${row.target_id}`;
    });
}

async function countRows(sql: string, ...parameters: string[]): Promise<number> {
  const { getDatabase } = await import("@/server/db/client");
  return Number(
    (
      getDatabase()
        .prepare(sql)
        .get(...parameters) as { total: number }
    ).total,
  );
}

const revisionCount = (entityType: string, entityId: string) =>
  countRows(
    "SELECT COUNT(*) AS total FROM content_revisions WHERE entity_type = ? AND entity_id = ?",
    entityType,
    entityId,
  );

const deleteActivityCount = (entity: string, entityId: string) =>
  countRows(
    "SELECT COUNT(*) AS total FROM activity_log WHERE entity = ? AND entity_id = ? AND action = 'delete'",
    entity,
    entityId,
  );

// ── A. Удаление статьи ────────────────────────────────────────────────────────────────────────

describe("удаление статьи снимает связи с обеих сторон", () => {
  it("снимает исходящие и входящие связи и не трогает чужие", async () => {
    await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");

    // Исходящая связь удаляемой статьи…
    replaceRelationsFrom("article", ARTICLE_A, [{ targetType: "product", targetId: PRODUCT }]);
    // …входящая на неё от соседней статьи и заведомо посторонняя связь той же соседки.
    replaceRelationsFrom("article", ARTICLE_B, [
      { targetType: "article", targetId: ARTICLE_A },
      { targetType: "product", targetId: PRODUCT },
    ]);

    expect(await allRelations()).toHaveLength(3);

    const { deleteArticle, getArticleById } = await import("@/server/repositories/articles");
    expect(deleteArticle(ARTICLE_A)).toBe(true);

    expect(getArticleById(ARTICLE_A)).toBeUndefined();
    // Осталась ровно посторонняя связь: обе стороны удалённой статьи сняты.
    expect(await allRelations()).toEqual([`article:${ARTICLE_B} -> product:${PRODUCT}`]);

    const { listRelationsFrom, listRelationsTo } =
      await import("@/server/repositories/contentRelations");
    expect(listRelationsFrom("article", ARTICLE_A)).toEqual([]);
    expect(listRelationsTo("article", ARTICLE_A)).toEqual([]);

    // История и журнал удаления на месте: уборка связей их не подменяет.
    expect(await revisionCount("article", ARTICLE_A)).toBe(1);
    expect(await deleteActivityCount("article", ARTICLE_A)).toBe(1);
  });
});

// ── B. Удаление кейса ─────────────────────────────────────────────────────────────────────────

describe("удаление кейса снимает связи с обеих сторон", () => {
  it("снимает исходящие и входящие связи и не трогает чужие", async () => {
    await seedEntities();
    await seedCase();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");

    // Кейс как ЦЕЛЬ чужой ссылки — его обычная роль…
    replaceRelationsFrom("article", ARTICLE_A, [{ targetType: "case", targetId: CASE_ID }]);
    // …и как источник собственной.
    replaceRelationsFrom("case", CASE_ID, [{ targetType: "product", targetId: PRODUCT }]);
    // Посторонняя связь, которой удаление кейса касаться не должно.
    replaceRelationsFrom("article", ARTICLE_B, [{ targetType: "product", targetId: PRODUCT }]);

    expect(await allRelations()).toHaveLength(3);

    const { deleteCase, getCaseById } = await import("@/server/repositories/cases");
    expect(deleteCase(CASE_ID)).toBe(true);

    expect(getCaseById(CASE_ID)).toBeUndefined();
    expect(await allRelations()).toEqual([`article:${ARTICLE_B} -> product:${PRODUCT}`]);

    expect(await deleteActivityCount("case", CASE_ID)).toBe(1);
  });
});

// ── C и D. Откат после удаления материала ─────────────────────────────────────────────────────

describe("откат: отказ уборки связей отменяет само удаление", () => {
  /**
   * Ключевая проверка шага. Сбой вносится триггером `BEFORE DELETE ON content_relations`, то есть
   * срабатывает строго ПОСЛЕ удаления самой записи материала.
   *
   * Условие `WHEN` — не украшение: триггер срабатывает, только если материала в его таблице уже
   * нет. Само срабатывание доказывает, что точка отказа лежит после `DELETE` материала, — без
   * допущений о порядке строк в коде. И оно же гарантирует, что триггер не сработает на посевных
   * `replaceRelationsFrom()`, которые тоже выполняют `DELETE FROM content_relations`.
   *
   * Тест падает, если уборку связей вынести за пределы транзакции удаления.
   */
  it.each([
    {
      name: "статья",
      entity: "article",
      table: "articles",
      id: ARTICLE_A,
      remove: async () => {
        const { deleteArticle } = await import("@/server/repositories/articles");
        return deleteArticle(ARTICLE_A);
      },
      exists: async () => {
        const { getArticleById } = await import("@/server/repositories/articles");
        return getArticleById(ARTICLE_A) !== undefined;
      },
    },
    {
      name: "кейс",
      entity: "case",
      table: "cases",
      id: CASE_ID,
      remove: async () => {
        const { deleteCase } = await import("@/server/repositories/cases");
        return deleteCase(CASE_ID);
      },
      exists: async () => {
        const { getCaseById } = await import("@/server/repositories/cases");
        return getCaseById(CASE_ID) !== undefined;
      },
    },
  ])("$name: материал и все его связи возвращаются на место", async (subject) => {
    const db = await seedEntities();
    await seedCase();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");

    replaceRelationsFrom(subject.entity as "article" | "case", subject.id, [
      { targetType: "product", targetId: PRODUCT },
    ]);
    replaceRelationsFrom("article", ARTICLE_B, [
      { targetType: subject.entity as "article" | "case", targetId: subject.id },
    ]);

    const relationsBefore = await allRelations();
    expect(relationsBefore).toHaveLength(2);

    // Кейс заводится репозиторием, и его создание уже оставило запись в журнале — считаем от неё.
    const revisionsBefore = await revisionCount(subject.entity, subject.id);

    db.exec(`
      CREATE TRIGGER forced_relation_cleanup_failure
      BEFORE DELETE ON content_relations
      WHEN (SELECT COUNT(*) FROM ${subject.table} WHERE id = '${subject.id}') = 0
      BEGIN
        SELECT RAISE(ABORT, 'forced relation cleanup failure');
      END;
    `);

    await expect(subject.remove()).rejects.toThrow(/forced relation cleanup failure/);

    db.exec("DROP TRIGGER forced_relation_cleanup_failure");

    // Материал вернулся…
    expect(await subject.exists()).toBe(true);
    // …и обе его связи вместе с ним, в прежнем составе.
    expect(await allRelations()).toEqual(relationsBefore);
    // Ревизия удаления и запись журнала откатились: следов неудавшегося удаления не осталось.
    expect(await revisionCount(subject.entity, subject.id)).toBe(revisionsBefore);
    expect(await deleteActivityCount(subject.entity, subject.id)).toBe(0);
  });

  it("после отката транзакция закрыта — следующее удаление проходит", async () => {
    const db = await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", ARTICLE_A, [{ targetType: "product", targetId: PRODUCT }]);

    db.exec(`
      CREATE TRIGGER forced_relation_cleanup_failure
      BEFORE DELETE ON content_relations
      WHEN (SELECT COUNT(*) FROM articles WHERE id = '${ARTICLE_A}') = 0
      BEGIN
        SELECT RAISE(ABORT, 'forced relation cleanup failure');
      END;
    `);

    const { deleteArticle } = await import("@/server/repositories/articles");
    expect(() => deleteArticle(ARTICLE_A)).toThrow();

    db.exec("DROP TRIGGER forced_relation_cleanup_failure");

    // Незакрытая транзакция проявилась бы не здесь, а на следующем запросе — проверяем прямо.
    expect(deleteArticle(ARTICLE_A)).toBe(true);
    expect(await allRelations()).toEqual([]);
  });
});

// ── E. Несуществующий материал ────────────────────────────────────────────────────────────────

const GHOST_ARTICLE = "article-prizrak";
const GHOST_CASE = "case-prizrak";

/**
 * Связь ПРЯМЫМ SQL, мимо репозитория.
 *
 * Репозиторий такую строку не создаст: он требует существования источника. Но именно она —
 * единственный настоящий свидетель того, что уборка стоит ПОСЛЕ проверки существования. Строка
 * типизирована так, что попала бы под `DELETE` уборки, если бы та выполнялась для несуществующего
 * материала: `source_type` и `source_id` в точности те, с которыми будет вызвано удаление.
 *
 * Внешнего ключа у полиморфной ссылки нет, поэтому база такую строку принимает — ровно так же, как
 * она появилась бы в production от материала, удалённого до появления этой уборки.
 */
async function insertDanglingRelation(
  sourceType: "article" | "case",
  sourceId: string,
): Promise<void> {
  const { getDatabase } = await import("@/server/db/client");
  getDatabase()
    .prepare(
      `INSERT INTO content_relations
         (source_type, source_id, target_type, target_id, relation_role, sort_order,
          created_at, updated_at)
       VALUES (?, ?, 'product', ?, 'related', 0, '2026-09-01', '2026-09-01')`,
    )
    .run(sourceType, sourceId, PRODUCT);
}

describe("несуществующий материал: контракт прежний, чужие связи целы", () => {
  /**
   * Уборка вызывается только ПОСЛЕ подтверждения существования материала — иначе удаление по
   * случайному или устаревшему идентификатору тихо снимало бы чужие связи.
   *
   * Проверка держится на висячей строке, вставленной прямым SQL: её `source_type`/`source_id`
   * совпадают с аргументами удаления, поэтому `DELETE` уборки её ЗАХВАТИЛ БЫ. Если поднять
   * `deleteRelationsForEntity()` выше раннего `return false`, эти два теста упадут — без такой
   * строки они прошли бы при любом порядке и ничего бы не доказывали.
   */
  it("deleteArticle: ранний выход не снимает висячие связи с тем же идентификатором", async () => {
    await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", ARTICLE_B, [{ targetType: "product", targetId: PRODUCT }]);
    await insertDanglingRelation("article", GHOST_ARTICLE);

    const before = await allRelations();
    expect(before).toContain(`article:${GHOST_ARTICLE} -> product:${PRODUCT}`);

    const { deleteArticle } = await import("@/server/repositories/articles");

    // Статьи с таким идентификатором нет — функция обязана выйти до уборки.
    expect(deleteArticle(GHOST_ARTICLE)).toBe(false);
    // И идентификатор существующего материала ДРУГОГО типа тоже не даёт удалить статью.
    expect(deleteArticle(PRODUCT)).toBe(false);

    expect(await allRelations()).toEqual(before);
    expect(await deleteActivityCount("article", GHOST_ARTICLE)).toBe(0);
  });

  it("deleteCase: ранний выход не снимает висячие связи с тем же идентификатором", async () => {
    await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", ARTICLE_A, [{ targetType: "product", targetId: PRODUCT }]);
    await insertDanglingRelation("case", GHOST_CASE);

    const before = await allRelations();
    expect(before).toContain(`case:${GHOST_CASE} -> product:${PRODUCT}`);

    const { deleteCase } = await import("@/server/repositories/cases");

    expect(deleteCase(GHOST_CASE)).toBe(false);
    // Кейса с идентификатором статьи не существует — связи статьи трогать нельзя.
    expect(deleteCase(ARTICLE_A)).toBe(false);

    expect(await allRelations()).toEqual(before);
    expect(await deleteActivityCount("case", GHOST_CASE)).toBe(0);
  });
});
