import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleInput } from "@/server/repositories/articles";

/**
 * Атомарное сохранение статьи вместе с её связями.
 *
 * Проверяется одно свойство: правка текста и замена перелинковки либо применяются целиком, либо не
 * применяются вовсе — вместе с ревизией и записью журнала. Тесты работают на НАСТОЯЩЕЙ временной
 * базе: репозитории не подменяются, транзакция настоящая, и смысл файла именно в состоянии таблиц
 * ПОСЛЕ отката, а не в том, какие функции были вызваны.
 *
 * Материалы для связывания создаются прямым INSERT — как в `contentRelations.test.ts`. Статья же
 * правится настоящим репозиторием, потому что предмет проверки — его транзакция.
 */

const ARTICLE_ID = "article-a";
const ORIGINAL_TITLE = "Как автоматизировать заявки";
const NEW_TITLE = "Новое название после правки";
const RELATED_SLUGS = ["sayt-crm-i-messendzhery", "chto-mozhno-avtomatizirovat-na-n8n"];

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-article-relations-"));
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

/** Материалы трёх типов, между которыми есть что связывать. */
async function seedEntities(): Promise<DatabaseSync> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();
  const now = "2026-09-01T10:00:00.000Z";

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, related_slugs,
                           created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ARTICLE_ID,
    "kak-avtomatizirovat-zayavki",
    ORIGINAL_TITLE,
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    JSON.stringify(RELATED_SLUGS),
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

/** Тело правки статьи — ровно то, что принимает репозиторий. */
function articleInput(overrides: Partial<ArticleInput> = {}): ArticleInput {
  return {
    slug: "kak-avtomatizirovat-zayavki",
    title: ORIGINAL_TITLE,
    excerpt: "Краткое описание.",
    description: "",
    bodyMarkdown: "Текст статьи.",
    coverUrl: "",
    coverAlt: "",
    placement: "blog",
    category: "",
    tags: [],
    relatedSlugs: RELATED_SLUGS,
    author: "",
    seoDescription: "",
    status: "draft",
    isFeatured: false,
    sortOrder: 0,
    publishedAt: null,
    ...overrides,
  };
}

/** Исходные связи статьи: продукт и отдел. Ставятся ОТДЕЛЬНОЙ операцией, до проверяемой правки. */
async function seedRelations(): Promise<void> {
  const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
  replaceRelationsFrom("article", ARTICLE_ID, [
    { targetType: "product", targetId: "product-a" },
    { targetType: "department", targetId: "sales" },
  ]);
}

interface Snapshot {
  title: string;
  relations: string[];
  revisions: number;
  activity: number;
  relatedSlugs: string;
}

/** Всё, что обязано откатиться вместе, — одним снимком. */
async function snapshot(): Promise<Snapshot> {
  const { getDatabase } = await import("@/server/db/client");
  const { listRelationsFrom } = await import("@/server/repositories/contentRelations");
  const db = getDatabase();

  const article = db
    .prepare("SELECT title, related_slugs FROM articles WHERE id = ?")
    .get(ARTICLE_ID) as { title: string; related_slugs: string };

  const count = (sql: string, ...parameters: string[]) =>
    Number((db.prepare(sql).get(...parameters) as { total: number }).total);

  return {
    title: article.title,
    relatedSlugs: article.related_slugs,
    relations: listRelationsFrom("article", ARTICLE_ID).map(
      (relation) => `${relation.targetType}:${relation.targetId}`,
    ),
    revisions: count(
      "SELECT COUNT(*) AS total FROM content_revisions WHERE entity_type = 'article' AND entity_id = ?",
      ARTICLE_ID,
    ),
    activity: count(
      "SELECT COUNT(*) AS total FROM activity_log WHERE entity = 'article' AND entity_id = ?",
      ARTICLE_ID,
    ),
  };
}

describe("составное сохранение: успешный путь", () => {
  it("статья и связи обновляются вместе", async () => {
    await seedEntities();
    await seedRelations();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    const result = updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), [
      { targetType: "product", targetId: "product-b" },
      { targetType: "department", targetId: "sales", role: "primary" },
    ]);

    expect(result.article.title).toBe(NEW_TITLE);
    expect(result.relations?.map((relation) => relation.targetId)).toEqual(["product-b", "sales"]);

    const after = await snapshot();
    expect(after.title).toBe(NEW_TITLE);
    expect(after.relations).toEqual(["product:product-b", "department:sales"]);
    // Правка статьи по-прежнему кладёт ревизию и строку журнала — ровно по одной.
    expect(after.revisions).toBe(1);
    expect(after.activity).toBe(1);
  });
});

describe("составное сохранение: три состояния поля relations", () => {
  it("поле отсутствует — статья обновлена, прежние связи полностью сохранены", async () => {
    await seedEntities();
    await seedRelations();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    const result = updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }));

    // Отсутствие поля — не пустой список: возвращать здесь нечего, потому что ничего не менялось.
    expect(result.relations).toBeUndefined();

    const after = await snapshot();
    expect(after.title).toBe(NEW_TITLE);
    expect(after.relations).toEqual(["product:product-a", "department:sales"]);
  });

  it("пустой список — статья обновлена, связи очищены", async () => {
    await seedEntities();
    await seedRelations();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    const result = updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), []);

    expect(result.relations).toEqual([]);

    const after = await snapshot();
    expect(after.title).toBe(NEW_TITLE);
    expect(after.relations).toEqual([]);
  });
});

describe("составное сохранение: откат", () => {
  it("несуществующая цель откатывает уже выполненную правку статьи", async () => {
    /**
     * Отказ наступает в проверке целей — то есть ПОСЛЕ того, как `UPDATE articles` уже выполнился
     * в этой же транзакции. Без общей транзакции статья осталась бы с новым текстом и старыми
     * связями.
     */
    await seedEntities();
    await seedRelations();
    const before = await snapshot();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");
    const { ContentRelationError } = await import("@/server/repositories/contentRelations");

    expect(() =>
      updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "product", targetId: "product-a" },
        { targetType: "product", targetId: "product-net-takogo" },
      ]),
    ).toThrow(ContentRelationError);

    const after = await snapshot();
    expect(after.title).toBe(ORIGINAL_TITLE);
    expect(after.relations).toEqual(before.relations);
    expect(after.revisions).toBe(0);
    expect(after.activity).toBe(0);
  });

  it("отказ ПОСЛЕ удаления старых связей откатывает всё, включая само удаление", async () => {
    /**
     * Ключевая проверка шага, и единственная, которая доказывает откат САМОГО `DELETE`.
     *
     * Сбой вносится триггером на `content_relations`, а не невалидной ролью: роль отсеивается
     * проверками репозитория ДО удаления, и такой тест доказывал бы не то. Триггер же срабатывает
     * на `INSERT`, то есть строго после `DELETE`.
     *
     * Условие `WHEN` — не украшение: триггер срабатывает ТОЛЬКО если к моменту вставки старых
     * связей статьи уже нет (значит, `DELETE` выполнился) И статья уже носит новое название
     * (значит, `UPDATE articles` выполнился). Само срабатывание триггера доказывает, что точка
     * отказа лежит после обоих шагов, — без допущений о порядке строк в коде.
     */
    const db = await seedEntities();
    await seedRelations();
    const before = await snapshot();

    db.exec(`
      CREATE TRIGGER forced_relation_insert_failure
      BEFORE INSERT ON content_relations
      WHEN (SELECT COUNT(*) FROM content_relations
             WHERE source_type = 'article' AND source_id = '${ARTICLE_ID}') = 0
       AND (SELECT COUNT(*) FROM articles
             WHERE id = '${ARTICLE_ID}' AND title = '${NEW_TITLE}') = 1
      BEGIN
        SELECT RAISE(ABORT, 'forced relation insert failure');
      END;
    `);

    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    expect(() =>
      updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "product", targetId: "product-b" },
      ]),
    ).toThrow(/forced relation insert failure/);

    db.exec("DROP TRIGGER forced_relation_insert_failure");

    const after = await snapshot();
    // Статья вернулась к прежнему тексту…
    expect(after.title).toBe(ORIGINAL_TITLE);
    // …и удалённые связи вернулись на место в прежнем составе и порядке.
    expect(after.relations).toEqual(before.relations);
    expect(after.relations).toEqual(["product:product-a", "department:sales"]);
    expect(after.revisions).toBe(0);
    expect(after.activity).toBe(0);
  });

  it("после отката транзакция закрыта — следующая операция проходит", async () => {
    /**
     * Незакрытая транзакция после отката проявилась бы не здесь, а на СЛЕДУЮЩЕМ запросе, и
     * выглядела бы как случайный сбой. Проверяется прямо: после неудачи обычное сохранение
     * работает.
     */
    await seedEntities();
    await seedRelations();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    expect(() =>
      updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "product", targetId: "product-net-takogo" },
      ]),
    ).toThrow();

    const { updateArticle } = await import("@/server/repositories/articles");
    expect(() =>
      updateArticle(ARTICLE_ID, articleInput({ title: "Обычная правка" })),
    ).not.toThrow();

    expect((await snapshot()).title).toBe("Обычная правка");
  });
});

describe("составное сохранение: вложенная транзакция", () => {
  it("не выдаёт «cannot start a transaction within a transaction»", async () => {
    /**
     * Регресс-барьер против возврата к вызову обёрток изнутри составной операции. Вложенный
     * `BEGIN` в этом проекте опасен вдвойне: он падает сам, а его `ROLLBACK` отменяет ВНЕШНЮЮ
     * транзакцию, после чего внешний `COMMIT` падает вторым, бессмысленным сообщением.
     */
    await seedEntities();
    await seedRelations();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    let thrown: unknown;
    try {
      updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "product", targetId: "product-b" },
      ]);
    } catch (error) {
      thrown = error;
    }

    /**
     * Сообщение проверяется ОТДЕЛЬНО от факта отказа, и только когда отказ был: иначе проверка
     * текста стала бы вакуумной (`String(undefined)`) и создавала бы видимость барьера там, где
     * его нет. Первое утверждение — основное; второе уточняет причину, если шаг всё-таки сломают.
     */
    if (thrown !== undefined) {
      expect(String(thrown)).not.toMatch(/transaction within a transaction/);
    }
    expect(thrown).toBeUndefined();

    // И повторный вызов тоже: транзакция после успеха закрыта.
    expect(() =>
      updateArticleWithRelations(ARTICLE_ID, articleInput({ title: "Ещё правка" }), []),
    ).not.toThrow();
  });
});

describe("составное сохранение: прежняя перелинковка статей", () => {
  it("не трогает articles.related_slugs", async () => {
    /**
     * Старая колонка адресов и новая таблица связей до отдельного шага переноса живут порознь.
     * Замена связей не должна ни очищать её, ни дописывать в неё цели: значение колонки после
     * составной операции обязано совпадать с тем, что прислано в теле статьи, и ни с чем больше.
     */
    await seedEntities();
    await seedRelations();
    const { updateArticleWithRelations } =
      await import("@/server/repositories/articleWithRelations");

    updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), [
      { targetType: "product", targetId: "product-b" },
      { targetType: "department", targetId: "sales" },
    ]);

    const after = await snapshot();
    expect(JSON.parse(after.relatedSlugs)).toEqual(RELATED_SLUGS);
    // И очистка связей её тоже не задевает.
    updateArticleWithRelations(ARTICLE_ID, articleInput({ title: NEW_TITLE }), []);
    expect(JSON.parse((await snapshot()).relatedSlugs)).toEqual(RELATED_SLUGS);
  });
});
