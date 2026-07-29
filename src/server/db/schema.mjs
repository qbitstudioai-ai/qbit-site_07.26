/**
 * Миграции схемы. Массив упорядочен, номер = позиция + 1; применённые версии фиксируются в таблице
 * `schema_migrations`. Существующую миграцию НЕЛЬЗЯ править после выката — только добавлять новую:
 * на уже развёрнутой базе изменённый текст повторно не выполнится.
 *
 * Модуль намеренно на JavaScript (`.mjs`), а не на TypeScript: тот же файл читают и приложение
 * (через `src/server/db/client.ts`), и скрипты `npm run db:migrate` / `npm run db:seed`, которые
 * запускаются обычным `node` без сборщика. Одна копия схемы вместо двух расходящихся.
 *
 * @typedef {{ name: string, sql: string }} Migration
 * @type {readonly Migration[]}
 */
export const migrations = [
  {
    name: "0001_initial_content_schema",
    sql: /* sql */ `
      CREATE TABLE departments (
        id            TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL,
        content       TEXT NOT NULL,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        is_published  INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE products (
        id            TEXT PRIMARY KEY,
        slug          TEXT NOT NULL UNIQUE,
        menu_title    TEXT NOT NULL,
        full_title    TEXT NOT NULL,
        content       TEXT NOT NULL,
        layout        TEXT NOT NULL,
        hotspot       TEXT NOT NULL,
        image_alt     TEXT NOT NULL,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        is_published  INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE page_content (
        page_key    TEXT PRIMARY KEY,
        content     TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE articles (
        id              TEXT PRIMARY KEY,
        slug            TEXT NOT NULL UNIQUE,
        title           TEXT NOT NULL,
        excerpt         TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        body_markdown   TEXT NOT NULL,
        cover_url       TEXT NOT NULL DEFAULT '',
        cover_alt       TEXT NOT NULL DEFAULT '',
        placement       TEXT NOT NULL,
        category        TEXT NOT NULL DEFAULT '',
        tags            TEXT NOT NULL DEFAULT '[]',
        related_slugs   TEXT NOT NULL DEFAULT '[]',
        author          TEXT NOT NULL DEFAULT '',
        seo_title       TEXT NOT NULL DEFAULT '',
        seo_description TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'draft',
        is_featured     INTEGER NOT NULL DEFAULT 0,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        published_at    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX articles_status_idx ON articles (status, sort_order);

      CREATE TABLE contacts (
        id               TEXT PRIMARY KEY,
        kind             TEXT NOT NULL,
        label            TEXT NOT NULL,
        value            TEXT NOT NULL,
        href             TEXT NOT NULL,
        accessible_label TEXT NOT NULL DEFAULT '',
        -- Подпись для шапки сайта. Пустая строка = использовать \`value\`. Отдельное поле нужно
        -- ровно одному каналу — телефону: в шапке он набран в формате «+7 (937) 534-65-75», на
        -- странице контактов — «+7 937 534-65-75». Номер при этом ОДИН и правится в одном месте.
        header_label     TEXT NOT NULL DEFAULT '',
        is_external      INTEGER NOT NULL DEFAULT 0,
        is_published     INTEGER NOT NULL DEFAULT 1,
        sort_order       INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );

      CREATE TABLE document_categories (
        id          TEXT PRIMARY KEY,
        label       TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE documents (
        id                 TEXT PRIMARY KEY,
        title              TEXT NOT NULL,
        description        TEXT NOT NULL DEFAULT '',
        category           TEXT NOT NULL,
        file_type          TEXT NOT NULL,
        mime_type          TEXT NOT NULL,
        file_size          INTEGER NOT NULL DEFAULT 0,
        original_file_name TEXT NOT NULL,
        original_file_url  TEXT NOT NULL,
        storage_key        TEXT NOT NULL DEFAULT '',
        preview_url        TEXT,
        auto_preview_key   TEXT,
        manual_preview_key TEXT,
        sort_order         INTEGER NOT NULL DEFAULT 0,
        is_published       INTEGER NOT NULL DEFAULT 1,
        document_date      TEXT,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      );

      CREATE INDEX documents_published_idx ON documents (is_published, sort_order);

      CREATE TABLE content_revisions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type   TEXT NOT NULL,
        entity_id     TEXT NOT NULL,
        previous_data TEXT NOT NULL,
        created_at    TEXT NOT NULL
      );

      CREATE INDEX content_revisions_entity_idx ON content_revisions (entity_type, entity_id, id);

      CREATE TABLE admin_sessions (
        id           TEXT PRIMARY KEY,
        created_at   TEXT NOT NULL,
        expires_at   TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE login_attempts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        client_key TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX login_attempts_client_idx ON login_attempts (client_key, created_at);

      CREATE TABLE activity_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        entity     TEXT NOT NULL,
        entity_id  TEXT NOT NULL,
        action     TEXT NOT NULL,
        summary    TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
];
