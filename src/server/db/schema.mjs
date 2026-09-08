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
  {
    name: "0003_cases",
    sql: /* sql */ `
      -- Раздел «Кейсы» переезжает из кода в базу: до этой миграции единственный опубликованный
      -- кейс лежал объектом в \`src/features/cases/casesRealData.ts\`, и добавить второй можно было
      -- только правкой исходников. После неё источник истины ОДИН — эта таблица.
      --
      -- Смысловая модель повторяет утверждённое досье: шесть разделов документа лежат отдельными
      -- колонками, а не общим полем разметки. Причина не в удобстве хранения, а в том, что
      -- владелец сайта заполняет форму, а не пишет HTML: структура кейса (краткий итог → задача →
      -- реализация → процесс → результат → метрика → человек → ограничение) обязана соблюдаться
      -- независимо от того, кто вводит текст. Сборкой \`CaseStudy\` из этих колонок занимается
      -- \`src/features/cases/caseRecord.ts\` — единственное место, знающее порядок блоков.
      --
      -- Несколько абзацев внутри раздела хранятся одной строкой с пустой строкой между абзацами:
      -- ровно то, что человек набирает в textarea. Отдельная таблица абзацев дала бы порядок и
      -- нумерацию, которые здесь всё равно нечем наполнить, — раздел всегда читается целиком.
      CREATE TABLE cases (
        id              TEXT PRIMARY KEY,
        slug            TEXT NOT NULL UNIQUE,
        title           TEXT NOT NULL,
        short_title     TEXT NOT NULL,
        folder_caption  TEXT NOT NULL DEFAULT 'Проект',
        file_number     TEXT NOT NULL,
        label           TEXT NOT NULL DEFAULT 'РЕАЛИЗОВАННЫЙ ПРОЕКТ',
        summary         TEXT NOT NULL DEFAULT '',
        task            TEXT NOT NULL DEFAULT '',
        implementation  TEXT NOT NULL DEFAULT '',
        workflow_steps  TEXT NOT NULL DEFAULT '[]',
        result          TEXT NOT NULL DEFAULT '',
        metric_label    TEXT NOT NULL DEFAULT '',
        metric_before   TEXT NOT NULL DEFAULT '',
        metric_after    TEXT NOT NULL DEFAULT '',
        metric_source   TEXT NOT NULL DEFAULT '',
        human_control   TEXT NOT NULL DEFAULT '',
        limitations     TEXT NOT NULL DEFAULT '',
        cta_label       TEXT NOT NULL DEFAULT 'Обсудить похожую задачу',
        cta_href        TEXT NOT NULL DEFAULT '/contacts',
        seo_title       TEXT NOT NULL DEFAULT '',
        seo_description TEXT NOT NULL DEFAULT '',
        og_description  TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'published',
        stamp_enabled   INTEGER NOT NULL DEFAULT 1,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        -- Даты МАТЕРИАЛА, а не строки: заполняются только настоящим временем публикации и правки.
        -- У перенесённого кейса они остаются NULL — подтверждённой даты публикации не существует,
        -- а дата этой миграции рассказывала бы о базе, а не о проекте (см. \`types.ts\`).
        published_at    TEXT,
        modified_at     TEXT,
        -- Даты СТРОКИ: техническая отметка о записи. Публично не показываются.
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      -- Номер дела уникален: два документа «Дело № 02» в одном архиве — ошибка ввода, а не замысел.
      CREATE UNIQUE INDEX cases_file_number_idx ON cases (file_number);
      CREATE INDEX cases_order_idx ON cases (status, sort_order);

      -- Дело № 01 переносится ДОСЛОВНО из \`casesRealData.ts\`: тот же id, slug, H1, тексты, метрика,
      -- SEO и печать. Адрес \`/cases/analiz-zvonkov-otdela-prodazh\` не меняется, из карты сайта
      -- кейс не исчезает, содержимое не редактируется — переносится только место хранения.
      --
      -- \`INSERT OR IGNORE\` — вторая защита от дубля поверх версионирования миграций: повторный
      -- прогон этой SQL на базе, где кейс уже есть, не создаёт второй экземпляр.
      --
      -- Абзацы разделяются \`char(10) || char(10)\`, а не переносом строки внутри литерала: иначе в
      -- текст попал бы отступ этого файла.
      INSERT OR IGNORE INTO cases (
        id, slug, title, short_title, folder_caption, file_number, label,
        summary, task, implementation, workflow_steps, result,
        metric_label, metric_before, metric_after, metric_source,
        human_control, limitations, cta_label, cta_href,
        seo_title, seo_description, og_description,
        status, stamp_enabled, sort_order, published_at, modified_at, created_at, updated_at
      ) VALUES (
        'case-sales-call-analysis',
        'analiz-zvonkov-otdela-prodazh',
        'AI-анализ звонков отдела продаж: от нескольких часов проверки к 10–15 минутам',
        'AI-анализ звонков отдела продаж',
        'Проект',
        '01',
        'РЕАЛИЗОВАННЫЙ ПРОЕКТ',
        'Компания вручную контролировала звонки менеджеров: руководителю приходилось прослушивать записи и самостоятельно оценивать качество работы отдела продаж. На это уходило примерно 4–5 часов в неделю.'
          || char(10) || char(10) ||
          'После автоматизации звонки анализируются системой, а руководитель получает готовый AI-отчёт с результатами проверки. На изучение такого отчёта ему требуется около 10–15 минут в неделю вместо нескольких часов ручного прослушивания.',
        'Сократить время руководителя на регулярный контроль звонков менеджеров, не отказываясь от самого контроля качества работы отдела продаж.'
          || char(10) || char(10) ||
          'Проблема была не в отсутствии данных — записи разговоров уже существовали. Руководитель сам выбирал и прослушивал их, оценивал содержание звонков и формировал представление о качестве работы отдела. Объём анализа при этом упирался в то время, которое он мог выделить на прослушивание.',
        'Анализ звонков менеджеров автоматизирован: система обрабатывает разговоры и формирует для руководителя структурированный AI-отчёт.'
          || char(10) || char(10) ||
          'Проверка начинается не с прослушивания записей, а с готового отчёта: руководитель сосредотачивается на моментах, которые действительно требуют внимания, и при необходимости обращается к исходным материалам. AI используется как инструмент анализа и подготовки информации, а не как замена управленческого решения.',
        '["звонки менеджеров","автоматическая обработка","AI-анализ","структурированный отчёт","руководитель"]',
        'Главный измеримый результат проекта — сокращение времени руководителя на контроль звонков.'
          || char(10) || char(10) ||
          'Регулярный контроль сохранился, но основная часть ручной работы по первичному анализу передана автоматизированной системе. Результат относится к конкретному внедрению и не гарантирует такой же экономии времени в другой компании — подробнее ниже.',
        'Время руководителя на контроль звонков',
        '4–5 часов в неделю',
        '10–15 минут в неделю',
        'По данным заказчика',
        'AI выполняет анализ разговоров, структурирует результаты и помогает руководителю быстрее находить важные моменты.'
          || char(10) || char(10) ||
          'Окончательную оценку работы менеджеров и любые управленческие решения принимает человек.'
          || char(10) || char(10) ||
          'При необходимости руководитель может проверить выводы системы по исходным звонкам.',
        'Результат относится к конкретному внедрению и отражает фактическое изменение процесса у данного заказчика.'
          || char(10) || char(10) ||
          'Полученный результат не является гарантией аналогичной экономии времени для другой компании: эффект зависит от количества звонков, существующего процесса контроля и требований к анализу.',
        'Обсудить похожую задачу',
        '/contacts',
        'AI-анализ звонков отдела продаж: с 4–5 часов до 10–15 минут',
        'Кейс: AI-анализ звонков сократил время руководителя на контроль отдела продаж с 4–5 часов до 10–15 минут в неделю. По данным заказчика.',
        'Кейс QBit-Studio-Ai: анализ звонков автоматизирован, руководитель получает готовый AI-отчёт. По данным заказчика.',
        'published',
        1,
        1,
        NULL,
        NULL,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      );
    `,
  },
  {
    name: "0004_content_relations",
    sql: /* sql */ `
      -- Перелинковка материалов между собой: статья ↔ продукт, статья ↔ отдел, продукт ↔ кейс.
      --
      -- ОТДЕЛЬНАЯ таблица, а не колонка внутри каждой сущности. Колонка \`articles.related_slugs\`
      -- уже существует и остаётся нетронутой: она умеет связывать статью только со статьёй, хранит
      -- адреса, а не идентификаторы, и не даёт обратного вопроса «на кого ссылаются?». Ни одно из
      -- трёх ограничений не снимается расширением колонки — снимается только вынесением связи в
      -- собственную строку. Переноса данных из \`related_slugs\` в этой миграции НЕТ намеренно:
      -- шаг закладывает хранилище, а перенос содержимого — отдельная работа с отдельной приёмкой.
      --
      -- Связь хранится по ИДЕНТИФИКАТОРУ, а не по slug. Адрес материала владелец сайта меняет из
      -- админ-панели; идентификатор не меняется никогда. Хранение по slug означало бы, что
      -- переименование адреса молча рвёт перелинковку.
      --
      -- Ссылка полиморфна: цель — любая из четырёх сущностей, и тип лежит колонкой. Внешнего ключа
      -- на «таблицу, выбранную значением соседней колонки» в SQLite не существует, поэтому схема
      -- отвечает за то, что проверяемо декларативно (набор типов, набор ролей, запрет ссылки на
      -- себя), а существование самой цели проверяет репозиторий по фиксированному списку таблиц
      -- (см. \`src/server/repositories/contentRelations.ts\`). Отсюда же следует, что удаление
      -- материала обязано звать \`deleteRelationsForEntity()\` — каскад базы здесь не сработает.
      --
      -- Первичный ключ составной и включает роль: один и тот же материал может быть привязан к
      -- источнику только один раз в пределах роли, и повтор упирается в базу, а не в проверку формы.
      --
      -- \`CHECK (NOT (source_type = target_type AND source_id = target_id))\` запрещает ссылку
      -- материала на себя. Условие сравнивает и тип, и идентификатор: совпадение идентификаторов у
      -- РАЗНЫХ типов (статья и продукт с одинаковым id) — законная связь, а не ошибка.
      CREATE TABLE content_relations (
        source_type   TEXT NOT NULL,
        source_id     TEXT NOT NULL,
        target_type   TEXT NOT NULL,
        target_id     TEXT NOT NULL,
        relation_role TEXT NOT NULL DEFAULT 'related',
        sort_order    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,

        PRIMARY KEY (
          source_type,
          source_id,
          target_type,
          target_id,
          relation_role
        ),

        CHECK (source_type IN ('article','product','case','department')),
        CHECK (target_type IN ('article','product','case','department')),
        CHECK (relation_role IN ('primary','related')),
        CHECK (NOT (source_type = target_type AND source_id = target_id))
      );

      -- Прямой вопрос: «что показать рядом с этим материалом». Отбор идёт по префиксу
      -- (source_type, source_id); роль и порядок вывода лежат в индексе следом, поэтому строка
      -- читается из него целиком, без обращения к таблице. Сортировку списка индекс при этом НЕ
      -- закрывает: роль стоит между префиксом и \`sort_order\`, а запрос сортирует по \`sort_order\`,
      -- и SQLite досортировывает выборку временным b-tree. На числе связей у одного материала
      -- (единицы, максимум десятки) это ничего не стоит; состав колонок задан заданием.
      CREATE INDEX content_relations_source_idx
        ON content_relations (source_type, source_id, relation_role, sort_order);

      -- Обратный вопрос: «кто ссылается на этот материал». Нужен и для обратной перелинковки, и для
      -- уборки связей при удалении цели: без этого индекса такой поиск читал бы таблицу целиком.
      CREATE INDEX content_relations_target_idx
        ON content_relations (target_type, target_id, relation_role);
    `,
  },
];
