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
  {
    name: "0002_product_seo_title_and_short_titles",
    sql: /* sql */ `
      -- Отдельный SEO-заголовок продукта. Колонка NULLABLE намеренно: NULL означает «владелец
      -- ничего не задавал», и тогда заголовок собирается из полного названия, как раньше. У статей
      -- такое поле существует с первой миграции, но объявлено \`NOT NULL DEFAULT ''\` — перестраивать
      -- живую таблицу ради единообразия хранения нельзя, поэтому пустую строку и NULL приводит к
      -- одному значению репозиторий (см. \`src/server/repositories/*.ts\`).
      ALTER TABLE products ADD COLUMN seo_title TEXT;

      -- Значения из задания на устранение предупреждений Bing «Title too long» (2026-07-30).
      -- Условие \`seo_title IS NULL\` защищает от повторного применения: колонка только что создана,
      -- но миграция обязана оставаться безопасной, если её выполнят на базе, где поле уже заполнено.
      UPDATE products SET seo_title = 'AI-ассистент по знаниям: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-01' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-менеджер для сайта: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-02' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'Сбор заявок в CRM: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-03' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-помощник в CRM: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-04' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-контроль звонков: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-05' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-помощник для HR: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-06' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-аналитика продаж: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-07' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-анализ документов: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-08' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'AI-протокол совещаний: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-09' AND seo_title IS NULL;
      UPDATE products SET seo_title = 'Автоматизация на n8n: стоимость | QBit-Studio-Ai'
        WHERE id = 'product-10' AND seo_title IS NULL;

      -- У статей поле уже заполнено — прежним автоматическим значением «заголовок + бренд», из-за
      -- длины которого Bing и ругался. Сравнение с ТОЧНЫМ прежним значением, а не безусловная
      -- запись: если владелец сайта успел задать свой заголовок, миграция обязана его сохранить.
      UPDATE articles SET seo_title = 'Как автоматизировать обработку заявок — QBit-Studio-Ai'
        WHERE id = 'kak-avtomatizirovat-obrabotku-zayavok'
          AND seo_title = 'Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM — QBit-Studio-Ai';
      UPDATE articles SET seo_title = 'AI-ассистент по базе знаний на RAG — QBit-Studio-Ai'
        WHERE id = 'ai-assistent-po-baze-znaniy'
          AND seo_title = 'AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу — QBit-Studio-Ai';
      UPDATE articles SET seo_title = 'Анализ звонков отдела продаж с AI — QBit-Studio-Ai'
        WHERE id = 'analiz-zvonkov-otdela-prodazh'
          AND seo_title = 'Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить — QBit-Studio-Ai';
      UPDATE articles SET seo_title = 'Автоматизация документов с AI — QBit-Studio-Ai'
        WHERE id = 'avtomatizatsiya-dokumentov-s-ai'
          AND seo_title = 'Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных — QBit-Studio-Ai';
      UPDATE articles SET seo_title = 'Как связать сайт, CRM и мессенджеры — QBit-Studio-Ai'
        WHERE id = 'sayt-crm-i-messendzhery'
          AND seo_title = 'Как связать сайт, CRM и мессенджеры в единый бизнес-процесс — QBit-Studio-Ai';
      UPDATE articles SET seo_title = 'Автоматизация на n8n для бизнеса — QBit-Studio-Ai'
        WHERE id = 'chto-mozhno-avtomatizirovat-na-n8n'
          AND seo_title = 'Что можно автоматизировать на n8n: практические сценарии для бизнеса — QBit-Studio-Ai';
    `,
  },
];
