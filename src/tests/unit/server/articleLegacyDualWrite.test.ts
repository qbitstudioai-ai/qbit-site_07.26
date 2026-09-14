import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleInput } from "@/server/repositories/articles";

/**
 * Переходный dual-write: `articles.related_slugs` выводится сервером из структурных связей.
 *
 * Публичный сайт до отдельного шага переключения читает прежнюю колонку, а редактировать владелец
 * сайта будет структурные связи. Значит, у колонки обязан быть ровно один источник, и вычислять его
 * должен сервер. Файл проверяет именно это свойство: что бы клиент ни прислал в `relatedSlugs`, до
 * базы доходит либо текущее значение, либо выведенное из связей.
 *
 * База НАСТОЯЩАЯ и временная, репозитории не подменяются: предмет проверки — состояние таблиц после
 * операции и после отката, а не список вызовов.
 *
 * Идентификаторы намеренно НЕ совпадают с адресами (`uuid-*` против `statya-*`). У материалов из
 * `data/seed` они совпадают случайно, и подстановка адреса вместо идентификатора прошла бы на такой
 * базе незамеченной.
 */

const SOURCE_ID = "uuid-source-0001";
const SOURCE_SLUG = "kak-avtomatizirovat-zayavki";
const ORIGINAL_TITLE = "Как автоматизировать заявки";
const NEW_TITLE = "Новое название после правки";

/** Цели: две пригодные, черновик и статья другого раздела. */
const TARGET_A = { id: "uuid-target-aaaa", slug: "statya-a" };
const TARGET_B = { id: "uuid-target-bbbb", slug: "statya-b" };
const DRAFT_TARGET = { id: "uuid-target-draft", slug: "statya-chernovik" };
const OTHER_PLACEMENT_TARGET = { id: "uuid-target-other", slug: "statya-drugogo-razdela" };

/** Кейс из миграции `0005`: настоящая строка, а не тестовая вставка. */
const CASE_ID = "case-sales-call-analysis";

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-legacy-dual-write-"));
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

async function seedEntities(): Promise<DatabaseSync> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();
  const now = "2026-09-01T10:00:00.000Z";

  const insertArticle = db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, status,
                           related_slugs, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertArticle.run(
    SOURCE_ID,
    SOURCE_SLUG,
    ORIGINAL_TITLE,
    "Краткое описание.",
    "Текст статьи.",
    "blog",
    "published",
    JSON.stringify([TARGET_A.slug]),
    now,
    now,
  );
  insertArticle.run(
    TARGET_A.id,
    TARGET_A.slug,
    "Статья А",
    "Анонс.",
    "Текст.",
    "blog",
    "published",
    "[]",
    now,
    now,
  );
  insertArticle.run(
    TARGET_B.id,
    TARGET_B.slug,
    "Статья Б",
    "Анонс.",
    "Текст.",
    "blog",
    "published",
    "[]",
    now,
    now,
  );
  insertArticle.run(
    DRAFT_TARGET.id,
    DRAFT_TARGET.slug,
    "Черновик",
    "Анонс.",
    "Текст.",
    "blog",
    "draft",
    "[]",
    now,
    now,
  );
  // Раздел, которого нет в справочнике: схема API его бы не приняла, а колонка базы принимает.
  // Проверяется репозиторий, поэтому строка ставится прямым INSERT.
  insertArticle.run(
    OTHER_PLACEMENT_TARGET.id,
    OTHER_PLACEMENT_TARGET.slug,
    "Статья другого раздела",
    "Анонс.",
    "Текст.",
    "spravochnik",
    "published",
    "[]",
    now,
    now,
  );

  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "uuid-product-0001",
    "ai-menedzher-dlya-sayta",
    "AI-менеджер",
    "AI-менеджер для сайта",
    // Содержимое НЕ `{}`: сборка продукта читает `content.prices[0]`, и продукт без тарифов —
    // состояние, которого админ-панель создать не даёт (схема требует хотя бы один тариф).
    // Пустышка здесь означала бы проверку на данных, которых в базе не бывает.
    JSON.stringify({
      summary: "Описание",
      applies: "Где применяется",
      examples: ["Пример"],
      prices: [{ label: "Базовый", value: "от 30 000 ₽", amount: 30000 }],
      benefit: "Выгода",
    }),
    "wide",
    "sales",
    "Иллюстрация продукта",
    now,
    now,
  );

  // Кейс НЕ вставляется: его создаёт миграция `0005`, и второй с тем же номером дела нарушил бы
  // уникальный индекс. Целью служит именно эта, настоящая строка — см. `CASE_ID`.

  db.prepare(
    `INSERT INTO departments (id, display_name, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("sales", "Отдел продаж", "{}", now, now);

  return db;
}

/**
 * Тело правки статьи.
 *
 * `relatedSlugs` по умолчанию содержит ЗАВЕДОМО ЧУЖОЕ значение: если оно хоть раз доедет до базы,
 * это увидит любой тест файла, а не только тот, который специально за этим следит.
 */
function articleInput(overrides: Partial<ArticleInput> = {}): ArticleInput {
  return {
    slug: SOURCE_SLUG,
    title: ORIGINAL_TITLE,
    excerpt: "Краткое описание.",
    description: "",
    bodyMarkdown: "Текст статьи.",
    coverUrl: "",
    coverAlt: "",
    placement: "blog",
    category: "",
    tags: [],
    relatedSlugs: ["adres-iz-tela-zaprosa"],
    author: "",
    seoDescription: "",
    status: "published",
    isFeatured: false,
    sortOrder: 0,
    publishedAt: "2026-09-01",
    ...overrides,
  };
}

interface Snapshot {
  title: string;
  relatedSlugs: string[];
  relations: string[];
  revisions: number;
  activity: number;
}

async function snapshot(): Promise<Snapshot> {
  const { getDatabase } = await import("@/server/db/client");
  const { listRelationsFrom } = await import("@/server/repositories/contentRelations");
  const db = getDatabase();

  const article = db
    .prepare("SELECT title, related_slugs FROM articles WHERE id = ?")
    .get(SOURCE_ID) as { title: string; related_slugs: string };

  const count = (sql: string, ...parameters: string[]) =>
    Number((db.prepare(sql).get(...parameters) as { total: number }).total);

  return {
    title: article.title,
    relatedSlugs: JSON.parse(article.related_slugs) as string[],
    relations: listRelationsFrom("article", SOURCE_ID).map(
      (relation) => `${relation.targetType}:${relation.targetId}`,
    ),
    revisions: count(
      "SELECT COUNT(*) AS total FROM content_revisions WHERE entity_type = 'article' AND entity_id = ?",
      SOURCE_ID,
    ),
    activity: count(
      "SELECT COUNT(*) AS total FROM activity_log WHERE entity = 'article' AND entity_id = ?",
      SOURCE_ID,
    ),
  };
}

async function coordinator() {
  return import("@/server/repositories/articleWithRelations");
}

// ── A. Поле relations отсутствует ─────────────────────────────────────────────────────────────

describe("relations отсутствует: подсистема связей неприкосновенна", () => {
  it("OLD CLIENT MUTATION TEST: устаревший relatedSlugs из тела не доходит до базы", async () => {
    /**
     * ГЛАВНЫЙ ТЕСТ ШАГА. Он и только он доказывает защиту от старой вкладки админ-панели.
     *
     * Вкладка, открытая до выката формы связей, шлёт `PUT` без поля `relations`, но с полем
     * `relatedSlugs` — и значение в нём такое, каким оно было в МОМЕНТ ОТКРЫТИЯ вкладки. Записать
     * его означало бы откатить чужую правку перелинковки, оставив `content_relations` нетронутой,
     * то есть развести две модели тем самым механизмом, который их сводит.
     *
     * При этом вкладка обязана сохранять обычные поля: запретить ей всё было бы не защитой, а
     * поломкой панели.
     */
    await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", SOURCE_ID, [{ targetType: "article", targetId: TARGET_A.id }]);

    const before = await snapshot();
    expect(before.relatedSlugs).toEqual([TARGET_A.slug]);
    expect(before.relations).toEqual([`article:${TARGET_A.id}`]);

    const { updateArticleWithRelations } = await coordinator();
    const result = updateArticleWithRelations(
      SOURCE_ID,
      articleInput({ title: NEW_TITLE, relatedSlugs: ["statya-b"] }),
      // Поле `relations` НЕ передаётся вовсе — ровно как его не шлёт старая вкладка.
    );

    const after = await snapshot();
    expect(after.relatedSlugs).toEqual([TARGET_A.slug]);
    expect(after.relations).toEqual([`article:${TARGET_A.id}`]);
    // …а обычное поле сохранено.
    expect(after.title).toBe(NEW_TITLE);
    // Ревизия ровно одна, журнал штатный: правка настоящая, а не подавленная.
    expect(after.revisions).toBe(1);
    expect(after.activity).toBe(1);
    // Ответ отдаёт текущие связи, а не `undefined`.
    expect(result.relations.map((relation) => relation.targetId)).toEqual([TARGET_A.id]);
  });

  it("пустой relatedSlugs в теле тоже не очищает колонку", async () => {
    // Отдельный случай: старая вкладка могла быть открыта на статье, у которой связей ещё не было.
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(SOURCE_ID, articleInput({ relatedSlugs: [] }));

    expect((await snapshot()).relatedSlugs).toEqual([TARGET_A.slug]);
  });
});

// ── B. Пустой список ──────────────────────────────────────────────────────────────────────────

describe("relations = []: обе модели очищаются", () => {
  it("очищает и связи, и прежнюю колонку", async () => {
    await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", SOURCE_ID, [{ targetType: "article", targetId: TARGET_A.id }]);

    const { updateArticleWithRelations } = await coordinator();
    const result = updateArticleWithRelations(SOURCE_ID, articleInput(), []);

    const after = await snapshot();
    expect(after.relations).toEqual([]);
    expect(after.relatedSlugs).toEqual([]);
    expect(result.relations).toEqual([]);
  });
});

// ── C. Смешанный список ───────────────────────────────────────────────────────────────────────

describe("relations — непустой список: источник истины один", () => {
  it("смешанный список: всё в связях, только статьи в прежней колонке", async () => {
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(SOURCE_ID, articleInput(), [
      { targetType: "product", targetId: "uuid-product-0001" },
      { targetType: "article", targetId: TARGET_B.id },
      { targetType: "case", targetId: CASE_ID },
      { targetType: "article", targetId: TARGET_A.id },
      { targetType: "department", targetId: "sales" },
    ]);

    const after = await snapshot();
    expect(after.relations).toEqual([
      "product:uuid-product-0001",
      `article:${TARGET_B.id}`,
      `case:${CASE_ID}`,
      `article:${TARGET_A.id}`,
      "department:sales",
    ]);
    // Порядок подмножества — пользовательский: Б раньше А, как и в исходном списке.
    expect(after.relatedSlugs).toEqual([TARGET_B.slug, TARGET_A.slug]);
  });

  it("прежняя колонка выводится по идентификатору цели, а не по присланному адресу", async () => {
    /**
     * Ключевое свойство переноса: адрес берётся из строки базы по стабильному идентификатору.
     * Здесь адрес цели меняется ПОСЛЕ создания связи — колонка обязана получить новый адрес, хотя
     * ни один клиент его не присылал.
     */
    const db = await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    db.prepare("UPDATE articles SET slug = ? WHERE id = ?").run(
      "novyj-adres-statyi-a",
      TARGET_A.id,
    );

    updateArticleWithRelations(SOURCE_ID, articleInput(), [
      { targetType: "article", targetId: TARGET_A.id },
    ]);

    expect((await snapshot()).relatedSlugs).toEqual(["novyj-adres-statyi-a"]);
  });

  it("присланный relatedSlugs игнорируется и при непустом списке связей", async () => {
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(
      SOURCE_ID,
      articleInput({ relatedSlugs: ["podmena", "eshchyo-podmena"] }),
      [{ targetType: "article", targetId: TARGET_B.id }],
    );

    expect((await snapshot()).relatedSlugs).toEqual([TARGET_B.slug]);
  });

  it("связь на материал без публичного блока не оставляет адресов в колонке", async () => {
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(SOURCE_ID, articleInput(), [
      { targetType: "department", targetId: "sales" },
    ]);

    expect((await snapshot()).relatedSlugs).toEqual([]);
  });
});

// ── Отказы: пригодность цели для публичного блока ─────────────────────────────────────────────

describe("отказы по цели: управляемая ошибка и полный откат", () => {
  it("цель-черновик → unpublished_target, ничего не записано", async () => {
    await seedEntities();
    const before = await snapshot();
    const { updateArticleWithRelations } = await coordinator();
    const { ContentRelationError } = await import("@/server/repositories/contentRelations");

    let thrown: unknown;
    try {
      updateArticleWithRelations(SOURCE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "article", targetId: DRAFT_TARGET.id },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ContentRelationError);
    expect((thrown as InstanceType<typeof ContentRelationError>).code).toBe("unpublished_target");

    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it("цель другого раздела → placement_mismatch, ничего не записано", async () => {
    await seedEntities();
    const before = await snapshot();
    const { updateArticleWithRelations } = await coordinator();
    const { ContentRelationError } = await import("@/server/repositories/contentRelations");

    let thrown: unknown;
    try {
      updateArticleWithRelations(SOURCE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "article", targetId: OTHER_PLACEMENT_TARGET.id },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ContentRelationError);
    expect((thrown as InstanceType<typeof ContentRelationError>).code).toBe("placement_mismatch");
    expect(await snapshot()).toEqual(before);
  });

  it("раздел сверяется с ПРИСЛАННЫМ разделом, а не с текущим", async () => {
    /**
     * Если статью в этом же сохранении переносят в другой раздел, целями обязаны быть материалы
     * раздела НАЗНАЧЕНИЯ. Здесь источник переезжает в «spravochnik», и связь на статью того же
     * нового раздела обязана пройти, хотя со старым разделом она не совпадает.
     */
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(SOURCE_ID, articleInput({ placement: "spravochnik" }), [
      { targetType: "article", targetId: OTHER_PLACEMENT_TARGET.id },
    ]);

    expect((await snapshot()).relatedSlugs).toEqual([OTHER_PLACEMENT_TARGET.slug]);
  });

  it("ссылка статьи на саму себя остаётся self_link, а не отказом по публикации", async () => {
    /**
     * Регресс-барьер на находку из этого же шага: проверка публикации, поставленная перед разбором
     * ссылки на себя, маскировала настоящую причину. Черновик, сославшийся на себя, получал отказ
     * «цель не опубликована» — верный по букве и бесполезный по смыслу, потому что публикация тут
     * ни при чём. Источник здесь намеренно ЧЕРНОВИК: у опубликованного ошибка не проявлялась.
     */
    const db = await seedEntities();
    db.prepare("UPDATE articles SET status = 'draft' WHERE id = ?").run(SOURCE_ID);

    const { updateArticleWithRelations } = await coordinator();
    const { ContentRelationError } = await import("@/server/repositories/contentRelations");

    let thrown: unknown;
    try {
      updateArticleWithRelations(SOURCE_ID, articleInput({ status: "draft" }), [
        { targetType: "article", targetId: SOURCE_ID },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ContentRelationError);
    expect((thrown as InstanceType<typeof ContentRelationError>).code).toBe("self_link");
  });

  it("несуществующая статья-цель → missing_entity", async () => {
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();
    const { ContentRelationError } = await import("@/server/repositories/contentRelations");

    let thrown: unknown;
    try {
      updateArticleWithRelations(SOURCE_ID, articleInput(), [
        { targetType: "article", targetId: "uuid-net-takoj-statyi" },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ContentRelationError);
    expect((thrown as InstanceType<typeof ContentRelationError>).code).toBe("missing_entity");
  });
});

// ── Предел прежней модели ─────────────────────────────────────────────────────────────────────

describe("предел в шесть статей", () => {
  /** Семь пригодных целей: шесть проходят, седьмая упирается в предел. */
  async function seedSevenTargets(): Promise<string[]> {
    const { getDatabase } = await import("@/server/db/client");
    const db = getDatabase();
    const now = "2026-09-01T10:00:00.000Z";
    const insert = db.prepare(
      `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, status,
                             related_slugs, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'blog', 'published', '[]', ?, ?)`,
    );

    const ids: string[] = [];
    for (let index = 1; index <= 7; index += 1) {
      const id = `uuid-many-${index}`;
      insert.run(id, `statya-many-${index}`, `Статья ${index}`, "Анонс.", "Текст.", now, now);
      ids.push(id);
    }
    return ids;
  }

  it("ровно шесть статей проходят", async () => {
    await seedEntities();
    const ids = await seedSevenTargets();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(
      SOURCE_ID,
      articleInput(),
      ids.slice(0, 6).map((id) => ({ targetType: "article" as const, targetId: id })),
    );

    expect((await snapshot()).relatedSlugs).toHaveLength(6);
  });

  it("седьмая статья → too_many_legacy_targets и полный откат", async () => {
    await seedEntities();
    const ids = await seedSevenTargets();
    const before = await snapshot();
    const { updateArticleWithRelations } = await coordinator();
    const { ContentRelationError } = await import("@/server/repositories/contentRelations");

    let thrown: unknown;
    try {
      updateArticleWithRelations(
        SOURCE_ID,
        articleInput({ title: NEW_TITLE }),
        ids.map((id) => ({ targetType: "article" as const, targetId: id })),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ContentRelationError);
    expect((thrown as InstanceType<typeof ContentRelationError>).code).toBe(
      "too_many_legacy_targets",
    );
    expect(await snapshot()).toEqual(before);
  });

  it("предел считает ТОЛЬКО статьи: материалы других типов сверх шести проходят", async () => {
    await seedEntities();
    const ids = await seedSevenTargets();
    const { updateArticleWithRelations } = await coordinator();

    updateArticleWithRelations(SOURCE_ID, articleInput(), [
      ...ids.slice(0, 6).map((id) => ({ targetType: "article" as const, targetId: id })),
      { targetType: "product", targetId: "uuid-product-0001" },
      { targetType: "case", targetId: CASE_ID },
      { targetType: "department", targetId: "sales" },
    ]);

    const after = await snapshot();
    expect(after.relations).toHaveLength(9);
    expect(after.relatedSlugs).toHaveLength(6);
  });

  it("предел совпадает с числом, объявленным координатором", async () => {
    const { MAX_LEGACY_ARTICLE_TARGETS } = await coordinator();
    expect(MAX_LEGACY_ARTICLE_TARGETS).toBe(6);
  });
});

// ── Атомарность ───────────────────────────────────────────────────────────────────────────────

describe("атомарность: откат после выполненного UPDATE", () => {
  it("отказ на вставке связи откатывает статью, колонку, связи, ревизию и журнал", async () => {
    /**
     * Сбой вносится триггером на `content_relations`: он срабатывает на `INSERT`, то есть строго
     * ПОСЛЕ того, как `UPDATE articles` и `DELETE` старых связей уже выполнились в этой же
     * транзакции. Условие `WHEN` доказывает эту позицию без допущений о порядке строк в коде.
     *
     * Проверка прежней колонки здесь принципиальна: она пишется тем же `UPDATE`, и без общей
     * транзакции статья осталась бы с выведенной колонкой и прежними связями.
     */
    const db = await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", SOURCE_ID, [{ targetType: "article", targetId: TARGET_A.id }]);

    const before = await snapshot();

    db.exec(`
      CREATE TRIGGER forced_relation_insert_failure
      BEFORE INSERT ON content_relations
      WHEN (SELECT COUNT(*) FROM content_relations
             WHERE source_type = 'article' AND source_id = '${SOURCE_ID}') = 0
       AND (SELECT COUNT(*) FROM articles
             WHERE id = '${SOURCE_ID}' AND title = '${NEW_TITLE}') = 1
      BEGIN
        SELECT RAISE(ABORT, 'forced relation insert failure');
      END;
    `);

    const { updateArticleWithRelations } = await coordinator();

    expect(() =>
      updateArticleWithRelations(SOURCE_ID, articleInput({ title: NEW_TITLE }), [
        { targetType: "article", targetId: TARGET_B.id },
      ]),
    ).toThrow(/forced relation insert failure/);

    db.exec("DROP TRIGGER forced_relation_insert_failure");

    const after = await snapshot();
    expect(after.title).toBe(ORIGINAL_TITLE);
    expect(after.relatedSlugs).toEqual([TARGET_A.slug]);
    expect(after.relations).toEqual([`article:${TARGET_A.id}`]);
    expect(after.revisions).toBe(before.revisions);
    expect(after.activity).toBe(before.activity);
    expect(after.revisions).toBe(0);
    expect(after.activity).toBe(0);
  });

  it("вложенной транзакции не возникает ни в одной из трёх веток", async () => {
    await seedEntities();
    const { updateArticleWithRelations } = await coordinator();

    const branches: (() => unknown)[] = [
      () => updateArticleWithRelations(SOURCE_ID, articleInput()),
      () => updateArticleWithRelations(SOURCE_ID, articleInput(), []),
      () =>
        updateArticleWithRelations(SOURCE_ID, articleInput(), [
          { targetType: "article", targetId: TARGET_A.id },
        ]),
    ];

    for (const branch of branches) {
      let thrown: unknown;
      try {
        branch();
      } catch (error) {
        thrown = error;
      }
      if (thrown !== undefined) {
        expect(String(thrown)).not.toMatch(/transaction within a transaction/);
      }
      expect(thrown).toBeUndefined();
    }
  });
});

// ── SSR-props админ-страницы ──────────────────────────────────────────────────────────────────

describe("серверный рендер /admin/blog", () => {
  it("отдаёт редактору уже существующие связи и каталог четырёх типов", async () => {
    /**
     * Прямая проверка того свойства, ради которого связи не грузятся отдельным запросом: они уже
     * лежат в props первого рендера. Заодно это единственное место, где вызывается сам серверный
     * компонент страницы — то есть проверяется, что вспомогательные функции каталога вызываемы вне
     * клиентского бандла.
     */
    await seedEntities();
    const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
    replaceRelationsFrom("article", SOURCE_ID, [
      { targetType: "article", targetId: TARGET_A.id },
      { targetType: "department", targetId: "sales" },
    ]);

    const { default: AdminBlogPage } = await import("@/app/admin/blog/page");
    const element = AdminBlogPage() as {
      props: {
        articles: { id: string; relations: { targetType: string; targetId: string }[] }[];
        relationOptions: { type: string; id: string; placement: string | null }[];
      };
    };

    const source = element.props.articles.find((article) => article.id === SOURCE_ID);
    expect(source?.relations).toEqual([
      { targetType: "article", targetId: TARGET_A.id },
      { targetType: "department", targetId: "sales" },
    ]);

    // Роль и числовой порядок в props не попадают: их неоткуда будет вернуть на сервер.
    for (const relation of source?.relations ?? []) {
      expect(Object.keys(relation).sort()).toEqual(["targetId", "targetType"]);
    }

    const types = new Set(element.props.relationOptions.map((option) => option.type));
    expect(types).toEqual(new Set(["article", "product", "case", "department"]));

    // Раздел приходит только у статей — остальным типам его неоткуда взять.
    for (const option of element.props.relationOptions) {
      if (option.type !== "article") expect(option.placement).toBeNull();
    }
  });
});
