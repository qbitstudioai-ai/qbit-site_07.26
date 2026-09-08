import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Хранилище связей между материалами: миграция `0004_content_relations` и репозиторий
 * `src/server/repositories/contentRelations.ts`.
 *
 * Тесты работают на НАСТОЯЩЕЙ временной базе — миграции применяются целиком, репозиторий не
 * подменяется. Смысл файла именно в этом: проверяются не вызовы функций, а состояние таблицы после
 * них, включая ограничения самой схемы. Пользовательская `var/content.db` не открывается.
 *
 * Материалы для связывания создаются здесь прямым INSERT, а не через репозитории статей, продуктов
 * и отделов: проверяется хранилище связей, и чужие репозитории не должны быть его зависимостью.
 * Кейс `case-sales-call-analysis` переносит в базу миграция 0003 — он используется как есть.
 */

const MIGRATED_CASE_ID = "case-sales-call-analysis";
const RELATED_SLUGS = '["sayt-crm-i-messendzhery","chto-mozhno-avtomatizirovat-na-n8n"]';

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-relations-"));
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

/** Материалы четырёх типов, между которыми есть что связывать. */
async function seedEntities(): Promise<DatabaseSync> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();
  const now = "2026-09-01T10:00:00.000Z";

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, related_slugs,
                           created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "article-a",
    "kak-avtomatizirovat-zayavki",
    "Как автоматизировать заявки",
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    RELATED_SLUGS,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "article-b",
    "analiz-zvonkov",
    "Анализ звонков",
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    now,
    now,
  );

  const insertProduct = db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertProduct.run(
    "product-a",
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
  insertProduct.run(
    "product-b",
    "sbor-zayavok-v-crm",
    "Сбор заявок",
    "Сбор заявок в CRM",
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

describe("миграция 0004 — хранилище связей между материалами", () => {
  it("создаёт таблицу и оба индекса", async () => {
    const { getDatabase } = await import("@/server/db/client");
    const db = getDatabase();

    const objects = db
      .prepare(
        `SELECT name FROM sqlite_master
          WHERE name IN ('content_relations', 'content_relations_source_idx',
                         'content_relations_target_idx')
          ORDER BY name`,
      )
      .all()
      .map((row) => String((row as { name: unknown }).name));

    expect(objects).toEqual([
      "content_relations",
      "content_relations_source_idx",
      "content_relations_target_idx",
    ]);
  });

  it("записана в журнал применённых миграций под своим именем", async () => {
    const { getDatabase } = await import("@/server/db/client");
    const row = getDatabase()
      .prepare("SELECT name FROM schema_migrations WHERE version = 4")
      .get() as { name: unknown } | undefined;

    expect(row?.name).toBe("0004_content_relations");
  });

  it("сама запрещает чужие типы, чужие роли и ссылку на себя", async () => {
    /**
     * Проверки репозитория — первая линия, ограничения схемы — вторая. Здесь запись идёт МИМО
     * репозитория, поэтому отказывает именно база: обойти правила прямым SQL нельзя.
     */
    const db = await seedEntities();
    const insert = (values: string) =>
      db.exec(
        `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                        relation_role, sort_order, created_at, updated_at)
         VALUES (${values})`,
      );

    expect(() =>
      insert("'document', 'doc-1', 'product', 'product-a', 'related', 0, 'now', 'now'"),
    ).toThrow();
    expect(() =>
      insert("'article', 'article-a', 'document', 'doc-1', 'related', 0, 'now', 'now'"),
    ).toThrow();
    expect(() =>
      insert("'article', 'article-a', 'product', 'product-a', 'main', 0, 'now', 'now'"),
    ).toThrow();
    expect(() =>
      insert("'article', 'article-a', 'article', 'article-a', 'related', 0, 'now', 'now'"),
    ).toThrow();

    // Совпадение идентификаторов у РАЗНЫХ типов — законная связь, а не ссылка на себя.
    expect(() =>
      insert("'department', 'sales', 'product', 'sales', 'related', 0, 'now', 'now'"),
    ).not.toThrow();
  });
});

describe("связи между материалами разных типов", () => {
  it("связывает статью с продуктом", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a" },
    ]);

    const relations = listRelationsFrom("article", "article-a");
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      sourceType: "article",
      sourceId: "article-a",
      targetType: "product",
      targetId: "product-a",
      role: "related",
      sortOrder: 0,
    });
    // Связь хранится по идентификатору, а не по адресу: slug продукта в строке не встречается.
    expect(relations[0].targetId).not.toBe("ai-menedzher-dlya-sayta");
  });

  it("связывает статью с отделом", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "department", targetId: "sales", role: "primary" },
    ]);

    expect(listRelationsFrom("article", "article-a")).toMatchObject([
      { targetType: "department", targetId: "sales", role: "primary" },
    ]);
  });

  it("связывает продукт с кейсом", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("product", "product-a", [
      { targetType: "case", targetId: MIGRATED_CASE_ID },
    ]);

    expect(listRelationsFrom("product", "product-a")).toMatchObject([
      {
        sourceType: "product",
        sourceId: "product-a",
        targetType: "case",
        targetId: MIGRATED_CASE_ID,
      },
    ]);
  });

  it("различает главную связь и обычную", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a", role: "primary" },
      { targetType: "product", targetId: "product-b", role: "related" },
      { targetType: "department", targetId: "sales" },
    ]);

    const byTarget = new Map(
      listRelationsFrom("article", "article-a").map((relation) => [
        relation.targetId,
        relation.role,
      ]),
    );

    expect(byTarget.get("product-a")).toBe("primary");
    expect(byTarget.get("product-b")).toBe("related");
    // Роль по умолчанию совпадает с DEFAULT в схеме.
    expect(byTarget.get("sales")).toBe("related");
  });
});

describe("порядок связей", () => {
  it("выдаёт связи в заданном порядке, а не в порядке вставки", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a", sortOrder: 20 },
      { targetType: "department", targetId: "sales", sortOrder: 10 },
      { targetType: "case", targetId: MIGRATED_CASE_ID, sortOrder: 5 },
    ]);

    expect(listRelationsFrom("article", "article-a").map((relation) => relation.targetId)).toEqual([
      MIGRATED_CASE_ID,
      "sales",
      "product-a",
    ]);
  });

  it("без явного порядка сохраняет порядок списка, присланного формой", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-b" },
      { targetType: "product", targetId: "product-a" },
    ]);

    expect(listRelationsFrom("article", "article-a").map((relation) => relation.sortOrder)).toEqual(
      [0, 1],
    );
    expect(listRelationsFrom("article", "article-a").map((relation) => relation.targetId)).toEqual([
      "product-b",
      "product-a",
    ]);
  });

  it("при равном порядке сортирует стабильно — по типу, затем по идентификатору цели", async () => {
    /**
     * Равный `sort_order` — обычное состояние: схема ставит 0 по умолчанию. Без второго и третьего
     * ключа сортировки блок перелинковки менял бы состав и порядок от захода к заходу.
     */
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-b", sortOrder: 0 },
      { targetType: "department", targetId: "sales", sortOrder: 0 },
      { targetType: "product", targetId: "product-a", sortOrder: 0 },
      { targetType: "case", targetId: MIGRATED_CASE_ID, sortOrder: 0 },
    ]);

    const order = listRelationsFrom("article", "article-a").map(
      (relation) => `${relation.targetType}:${relation.targetId}`,
    );

    expect(order).toEqual([
      `case:${MIGRATED_CASE_ID}`,
      "department:sales",
      "product:product-a",
      "product:product-b",
    ]);
    // Повторное чтение даёт тот же порядок.
    expect(
      listRelationsFrom("article", "article-a").map(
        (relation) => `${relation.targetType}:${relation.targetId}`,
      ),
    ).toEqual(order);
  });

  it("замыкает порядок ролью — даже для строк, записанных мимо репозитория", async () => {
    /**
     * Репозиторий не даёт связать одну цель дважды, но первичный ключ таблицы роль различает, и
     * прямой SQL такую пару запишет. Тогда `sort_order`, тип и идентификатор цели совпадают все
     * три, и последний ключ сортировки — единственное, что задаёт порядок.
     *
     * Честная оговорка: сегодня тест зелёный и БЕЗ этого ключа, то есть удаление `relation_role`
     * из ORDER BY он не поймает. Причина в плане запроса: SQLite сортирует выборку временным
     * b-tree, а на вход сортировщику строки поступают в порядке индекса
     * `content_relations_source_idx`, где роль стоит третьей колонкой, — и результат совпадает с
     * требуемым. Тест закрепляет КОНТРАКТ, на который может опереться вызывающий код, и поймает
     * смену плана или состава индекса; воспроизвести отказ на текущей схеме нечем. Считать его
     * защитой ключа сортировки нельзя — этот ключ держится на чтении кода, а не на проверке.
     */
    const db = await seedEntities();
    const insert = db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('article', 'article-a', 'product', 'product-a', ?, 0, 'now', 'now')`,
    );
    // Сначала «related», потом «primary»: порядок вставки обратен ожидаемому.
    insert.run("related");
    insert.run("primary");

    const { listRelationsFrom } = await import("@/server/repositories/contentRelations");

    expect(listRelationsFrom("article", "article-a").map((relation) => relation.role)).toEqual([
      "primary",
      "related",
    ]);
  });
});

describe("обратный поиск связей", () => {
  it("показывает, кто ссылается на материал, без зеркальной записи", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsTo } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a", role: "primary" },
    ]);
    replaceRelationsFrom("article", "article-b", [
      { targetType: "product", targetId: "product-a" },
    ]);
    replaceRelationsFrom("product", "product-b", [
      { targetType: "product", targetId: "product-a" },
    ]);

    const incoming = listRelationsTo("product", "product-a");

    expect(incoming.map((relation) => `${relation.sourceType}:${relation.sourceId}`)).toEqual([
      "article:article-a",
      "article:article-b",
      "product:product-b",
    ]);
    expect(incoming[0].role).toBe("primary");
    // Обратная связь не создаёт исходящей: у продукта-цели своих связей нет.
    const { listRelationsFrom } = await import("@/server/repositories/contentRelations");
    expect(listRelationsFrom("product", "product-a")).toEqual([]);
  });

  it("сортирует входящие связи стабильно, а не в порядке их появления", async () => {
    /**
     * У входящих связей `sort_order` приходит из ЧУЖИХ списков и совпадает сплошь и рядом: у
     * каждого источника своя нумерация с нуля. Без ключей по источнику порядок определялся бы тем,
     * кто раньше сохранил свою перелинковку.
     */
    await seedEntities();
    const { replaceRelationsFrom, listRelationsTo } =
      await import("@/server/repositories/contentRelations");

    // Записаны в порядке, обратном ожидаемому, и все с sort_order = 0.
    replaceRelationsFrom("product", "product-b", [{ targetType: "department", targetId: "sales" }]);
    replaceRelationsFrom("article", "article-b", [{ targetType: "department", targetId: "sales" }]);
    replaceRelationsFrom("article", "article-a", [{ targetType: "department", targetId: "sales" }]);

    const order = listRelationsTo("department", "sales").map(
      (relation) => `${relation.sourceType}:${relation.sourceId}`,
    );

    expect(order).toEqual(["article:article-a", "article:article-b", "product:product-b"]);
    expect(
      listRelationsTo("department", "sales").map(
        (relation) => `${relation.sourceType}:${relation.sourceId}`,
      ),
    ).toEqual(order);
  });

  it("для материала без входящих ссылок возвращает пустой список", async () => {
    await seedEntities();
    const { listRelationsTo } = await import("@/server/repositories/contentRelations");

    expect(listRelationsTo("department", "sales")).toEqual([]);
  });
});

describe("замена связей источника", () => {
  it("удаляет прежние связи источника и записывает новые", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom, listRelationsTo } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a" },
      { targetType: "department", targetId: "sales" },
    ]);
    replaceRelationsFrom("article", "article-b", [
      { targetType: "product", targetId: "product-a" },
    ]);

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-b", role: "primary" },
    ]);

    expect(listRelationsFrom("article", "article-a")).toMatchObject([
      { targetType: "product", targetId: "product-b", role: "primary" },
    ]);
    // Связи ЧУЖОГО источника на ту же цель замена не трогает.
    expect(listRelationsTo("product", "product-a").map((relation) => relation.sourceId)).toEqual([
      "article-b",
    ]);
  });

  it("пустой список снимает все связи источника", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a" },
    ]);
    expect(replaceRelationsFrom("article", "article-a", [])).toEqual([]);
    expect(listRelationsFrom("article", "article-a")).toEqual([]);
  });

  it("отказ проверки не доходит до удаления прежних связей", async () => {
    /**
     * Первый рубеж: несуществующая цель отбивается ДО `DELETE`, поэтому прежние связи не трогаются
     * даже без отката. Транзакцию этот тест не проверяет — её проверяет следующий.
     */
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a" },
      { targetType: "department", targetId: "sales" },
    ]);

    expect(() =>
      replaceRelationsFrom("article", "article-a", [
        { targetType: "product", targetId: "product-b" },
        { targetType: "case", targetId: "case-does-not-exist" },
      ]),
    ).toThrow(/не существует/);

    expect(listRelationsFrom("article", "article-a").map((relation) => relation.targetId)).toEqual([
      "product-a",
      "sales",
    ]);
  });

  it("отказ ПОСЛЕ удаления откатывает замену целиком", async () => {
    /**
     * Ради этого замена и завёрнута в транзакцию. Проверки репозитория стоят до `DELETE`, поэтому
     * добраться до состояния «прежние связи удалены, новые записаны не все» можно только отказом
     * самой вставки. Такой отказ достижим и без злого умысла: форма считает порядок через
     * `Number(...)`, нечисловое поле даёт `NaN`, а `NaN` не проходит `NOT NULL` у `sort_order`.
     *
     * Тест намеренно рассчитан так, чтобы падать, если убрать `transaction(...)`: первая связь
     * успевает записаться, `DELETE` уже выполнен, и без отката источник остался бы с одной новой
     * связью вместо двух прежних.
     */
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom, listRelationsTo } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a" },
      { targetType: "department", targetId: "sales" },
    ]);

    expect(() =>
      replaceRelationsFrom("article", "article-a", [
        { targetType: "product", targetId: "product-b", sortOrder: 0 },
        { targetType: "case", targetId: MIGRATED_CASE_ID, sortOrder: Number("не число") },
      ]),
    ).toThrow();

    // Прежние две связи на месте, ни одной новой не записано.
    expect(listRelationsFrom("article", "article-a").map((relation) => relation.targetId)).toEqual([
      "product-a",
      "sales",
    ]);
    expect(listRelationsTo("product", "product-b")).toEqual([]);
  });
});

describe("отказы репозитория связей", () => {
  it("несуществующий источник — ошибка", async () => {
    await seedEntities();
    const { replaceRelationsFrom, ContentRelationError } =
      await import("@/server/repositories/contentRelations");

    expect(() =>
      replaceRelationsFrom("article", "article-net", [
        { targetType: "product", targetId: "product-a" },
      ]),
    ).toThrow(ContentRelationError);

    try {
      replaceRelationsFrom("article", "article-net", []);
      expect.unreachable("замена связей несуществующего источника не должна проходить");
    } catch (error) {
      expect((error as InstanceType<typeof ContentRelationError>).code).toBe("missing_entity");
    }
  });

  it("несуществующая цель — ошибка, в том числе цель не того типа", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom, ContentRelationError } =
      await import("@/server/repositories/contentRelations");

    expect(() =>
      replaceRelationsFrom("article", "article-a", [
        { targetType: "product", targetId: "product-net" },
      ]),
    ).toThrow(ContentRelationError);

    // Идентификатор существует, но в ДРУГОЙ таблице: существование проверяется по типу цели.
    expect(() =>
      replaceRelationsFrom("article", "article-a", [{ targetType: "case", targetId: "product-a" }]),
    ).toThrow(/не существует/);

    expect(listRelationsFrom("article", "article-a")).toEqual([]);
  });

  it("ссылка материала на себя — ошибка", async () => {
    await seedEntities();
    const { replaceRelationsFrom, ContentRelationError } =
      await import("@/server/repositories/contentRelations");

    try {
      replaceRelationsFrom("article", "article-a", [
        { targetType: "article", targetId: "article-a" },
      ]);
      expect.unreachable("ссылка на себя не должна проходить");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentRelationError);
      expect((error as InstanceType<typeof ContentRelationError>).code).toBe("self_link");
    }
  });

  it("повтор одной цели у одного источника — ошибка, в том числе с разными ролями", async () => {
    await seedEntities();
    const { replaceRelationsFrom, listRelationsFrom, ContentRelationError } =
      await import("@/server/repositories/contentRelations");

    try {
      replaceRelationsFrom("article", "article-a", [
        { targetType: "product", targetId: "product-a" },
        { targetType: "product", targetId: "product-a" },
      ]);
      expect.unreachable("дубль связи не должен проходить");
    } catch (error) {
      expect((error as InstanceType<typeof ContentRelationError>).code).toBe("duplicate_relation");
    }

    expect(() =>
      replaceRelationsFrom("article", "article-a", [
        { targetType: "product", targetId: "product-a", role: "primary" },
        { targetType: "product", targetId: "product-a", role: "related" },
      ]),
    ).toThrow(ContentRelationError);

    expect(listRelationsFrom("article", "article-a")).toEqual([]);
  });

  it("неизвестный тип материала не доходит до запроса", async () => {
    await seedEntities();
    const { listRelationsFrom, listRelationsTo, deleteRelationsForEntity, ContentRelationError } =
      await import("@/server/repositories/contentRelations");
    // Значение, которого в типе нет: так выглядит тело запроса из внешнего мира, а не вызов из TS.
    // Имя таблицы подставляется в SQL текстом, поэтому проверка типа обязана стоять до запроса.
    const unknownType = "document" as unknown as Parameters<typeof listRelationsFrom>[0];

    expect(() => listRelationsFrom(unknownType, "doc-1")).toThrow(ContentRelationError);
    expect(() => listRelationsTo(unknownType, "doc-1")).toThrow(ContentRelationError);
    expect(() => deleteRelationsForEntity(unknownType, "doc-1")).toThrow(ContentRelationError);
  });
});

describe("уборка связей удалённого материала", () => {
  it("снимает связи, где материал был и источником, и целью", async () => {
    await seedEntities();
    const { replaceRelationsFrom, deleteRelationsForEntity, listRelationsFrom, listRelationsTo } =
      await import("@/server/repositories/contentRelations");

    // Продукт A ссылается на кейс, а на продукт A ссылаются две статьи.
    replaceRelationsFrom("product", "product-a", [
      { targetType: "case", targetId: MIGRATED_CASE_ID },
      { targetType: "department", targetId: "sales" },
    ]);
    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a" },
    ]);
    replaceRelationsFrom("article", "article-b", [
      { targetType: "product", targetId: "product-a" },
      { targetType: "department", targetId: "sales" },
    ]);

    expect(deleteRelationsForEntity("product", "product-a")).toBe(4);

    expect(listRelationsFrom("product", "product-a")).toEqual([]);
    expect(listRelationsTo("product", "product-a")).toEqual([]);
    // Чужие связи, не касавшиеся продукта, остались на месте.
    expect(listRelationsFrom("article", "article-b").map((relation) => relation.targetId)).toEqual([
      "sales",
    ]);
    expect(listRelationsTo("department", "sales").map((relation) => relation.sourceId)).toEqual([
      "article-b",
    ]);
  });

  it("на материале без связей ничего не удаляет и не падает", async () => {
    await seedEntities();
    const { deleteRelationsForEntity } = await import("@/server/repositories/contentRelations");

    expect(deleteRelationsForEntity("department", "sales")).toBe(0);
    // Материала уже нет в базе — существование намеренно не проверяется.
    expect(deleteRelationsForEntity("article", "article-udalyonnaya")).toBe(0);
  });
});

describe("прежняя перелинковка статей", () => {
  it("колонка articles.related_slugs не меняется ни одной операцией со связями", async () => {
    /**
     * Шаг закладывает хранилище, но НЕ переносит содержимое `related_slugs`. Пока переноса нет,
     * старая перелинковка обязана остаться ровно такой, какой была: любое её изменение здесь — это
     * незаявленная миграция данных на живом сайте.
     */
    const db = await seedEntities();
    const readSlugs = () =>
      db
        .prepare("SELECT id, related_slugs FROM articles ORDER BY id")
        .all()
        .map((row) => [
          String((row as { id: unknown }).id),
          String((row as { related_slugs: unknown }).related_slugs),
        ]);

    const before = readSlugs();
    expect(before).toEqual([
      ["article-a", RELATED_SLUGS],
      ["article-b", "[]"],
    ]);

    const { replaceRelationsFrom, deleteRelationsForEntity } =
      await import("@/server/repositories/contentRelations");

    replaceRelationsFrom("article", "article-a", [
      { targetType: "product", targetId: "product-a", role: "primary" },
      { targetType: "article", targetId: "article-b" },
    ]);
    replaceRelationsFrom("article", "article-a", [{ targetType: "department", targetId: "sales" }]);
    deleteRelationsForEntity("article", "article-b");

    expect(readSlugs()).toEqual(before);
  });

  it("миграция 0004 не трогает содержимое перенесённого кейса", async () => {
    const { getDatabase } = await import("@/server/db/client");
    const row = getDatabase()
      .prepare("SELECT slug, published_at FROM cases WHERE id = ?")
      .get(MIGRATED_CASE_ID) as { slug: unknown; published_at: unknown } | undefined;

    expect(row?.slug).toBe("analiz-zvonkov-otdela-prodazh");
    expect(row?.published_at).toBeNull();
  });
});
