import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrations } from "@/server/db/schema.mjs";

/**
 * Миграция 0002 — колонка `products.seo_title` и короткие заголовки шестнадцати страниц.
 *
 * Проверяется на базе, собранной в состоянии ДО миграции: только первая миграция плюс записи с
 * прежними значениями. Это единственный способ убедиться, что выкат на живой базе (а там записи
 * уже есть) сделает ровно то, что задумано, и не тронет ничего лишнего.
 */

const OLD_ARTICLE_SEO_TITLE =
  "Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM — QBit-Studio-Ai";
const NEW_ARTICLE_SEO_TITLE = "Как автоматизировать обработку заявок — QBit-Studio-Ai";

const ARTICLE_TITLE = "Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM";
const PRODUCT_FULL_TITLE = "AI-ассистент по знаниям компании";

interface Row {
  [column: string]: unknown;
}

/** База в состоянии «применена только миграция 0001», с одним продуктом и одной статьёй. */
function databaseBeforeMigration(articleSeoTitle: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(migrations[0].sql);
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
    );
  `);
  db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?)").run(
    migrations[0].name,
    "2026-01-01T00:00:00.000Z",
  );

  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           sort_order, is_published, created_at, updated_at)
     VALUES ('product-01', 'rag-ai-assistant', 'AI-ассистент', ?, '{}', '{}', '{}', 'Фотография',
             1, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  ).run(PRODUCT_FULL_TITLE);

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, description, body_markdown, cover_url,
                           cover_alt, placement, category, tags, related_slugs, author, seo_title,
                           seo_description, status, is_featured, sort_order, published_at,
                           created_at, updated_at)
     VALUES ('kak-avtomatizirovat-obrabotku-zayavok', 'kak-avtomatizirovat-obrabotku-zayavok', ?,
             'Анонс', 'Описание', '# Текст', '/blog/cover.webp', 'Обложка', 'blog', 'Автоматизация',
             '[]', '[]', 'QBit-Studio-Ai', ?, 'SEO-описание', 'published', 0, 10, '2026-07-25',
             '2026-07-25T00:00:00.000Z', '2026-07-25T00:00:00.000Z')`,
  ).run(ARTICLE_TITLE, articleSeoTitle);

  return db;
}

/** Применяет все ещё не применённые миграции — тем же способом, что делает приложение. */
function applyRemainingMigrations(db: DatabaseSync): void {
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => Number((row as { version: number }).version)),
  );

  migrations.forEach((migration, index) => {
    const version = index + 1;
    if (applied.has(version)) return;

    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        version,
        migration.name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}

const product = (db: DatabaseSync): Row =>
  db.prepare("SELECT * FROM products WHERE id = 'product-01'").get() as Row;

const article = (db: DatabaseSync): Row =>
  db
    .prepare("SELECT * FROM articles WHERE id = 'kak-avtomatizirovat-obrabotku-zayavok'")
    .get() as Row;

describe("миграция 0002", () => {
  it("добавляет продукту заголовок, которого у него не было", () => {
    const db = databaseBeforeMigration(OLD_ARTICLE_SEO_TITLE);
    applyRemainingMigrations(db);

    expect(product(db).seo_title).toBe("AI-ассистент по знаниям: стоимость | QBit-Studio-Ai");
    db.close();
  });

  it("заменяет прежний длинный заголовок статьи коротким", () => {
    const db = databaseBeforeMigration(OLD_ARTICLE_SEO_TITLE);
    applyRemainingMigrations(db);

    expect(article(db).seo_title).toBe(NEW_ARTICLE_SEO_TITLE);
    db.close();
  });

  it("не трогает заголовок, заданный владельцем сайта вручную", () => {
    // Главный риск миграции, которая пишет данные: затереть правку, сделанную из админ-панели.
    const custom = "Свой заголовок владельца — QBit-Studio-Ai";
    const db = databaseBeforeMigration(custom);
    applyRemainingMigrations(db);

    expect(article(db).seo_title).toBe(custom);
    db.close();
  });

  it("не меняет видимые названия, адреса и остальной контент", () => {
    const db = databaseBeforeMigration(OLD_ARTICLE_SEO_TITLE);
    const productBefore = product(db);
    const articleBefore = article(db);

    applyRemainingMigrations(db);

    const productAfter = product(db);
    const articleAfter = article(db);

    expect(productAfter.full_title).toBe(PRODUCT_FULL_TITLE);
    expect(productAfter.slug).toBe(productBefore.slug);
    expect(productAfter.menu_title).toBe(productBefore.menu_title);
    expect(productAfter.image_alt).toBe(productBefore.image_alt);
    expect(productAfter.content).toBe(productBefore.content);
    expect(productAfter.is_published).toBe(productBefore.is_published);
    expect(productAfter.updated_at).toBe(productBefore.updated_at);

    expect(articleAfter.title).toBe(ARTICLE_TITLE);
    expect(articleAfter.slug).toBe(articleBefore.slug);
    expect(articleAfter.body_markdown).toBe(articleBefore.body_markdown);
    expect(articleAfter.seo_description).toBe(articleBefore.seo_description);
    expect(articleAfter.excerpt).toBe(articleBefore.excerpt);
    expect(articleAfter.status).toBe(articleBefore.status);
    expect(articleAfter.updated_at).toBe(articleBefore.updated_at);

    db.close();
  });

  it("повторный прогон ничего не меняет", () => {
    const db = databaseBeforeMigration(OLD_ARTICLE_SEO_TITLE);
    applyRemainingMigrations(db);

    // Повторное выполнение SQL второй миграции напрямую: `ALTER TABLE` упадёт — колонка уже есть,
    // — поэтому проверяется только идемпотентность записи значений.
    const updates = migrations[1].sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.includes("UPDATE ") && !statement.includes("ALTER TABLE"));

    expect(updates.length).toBe(16);
    for (const statement of updates) db.exec(statement);

    expect(product(db).seo_title).toBe("AI-ассистент по знаниям: стоимость | QBit-Studio-Ai");
    expect(article(db).seo_title).toBe(NEW_ARTICLE_SEO_TITLE);
    db.close();
  });

  it("применяется на пустой базе без ошибок — свежая установка", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
      );
    `);

    expect(() => applyRemainingMigrations(db)).not.toThrow();
    expect(db.prepare("SELECT COUNT(*) AS total FROM products").get()).toEqual({ total: 0 });
    db.close();
  });
});
