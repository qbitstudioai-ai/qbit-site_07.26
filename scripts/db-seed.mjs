/**
 * `npm run db:seed` — переносит текущий контент сайта в базу.
 *
 * Источник — файлы в `data/` и `data/seed/`: это ТЕ ЖЕ тексты, что были в исходном коде до
 * появления админ-панели, перенесённые дословно. Скрипт идемпотентен: существующие записи не
 * трогаются, поэтому повторный запуск не затирает правки владельца сайта.
 *
 * `--reset` очищает контентные таблицы и заполняет их заново — так возвращают исходное состояние.
 * Сессии, журнал и историю правок `--reset` не трогает.
 *
 * Файлы документов копируются в объектное хранилище (`var/uploads`), а не остаются ссылками на
 * `public/`: удаление документа из админ-панели должно удалять и сам файл.
 *
 * Модуль и запускается напрямую, и импортируется тестами: заполнение выполняется только при прямом
 * запуске, а блок статей и сброс экспортируются как функции.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MAX_RELATIONS_PER_SOURCE } from "./backfill-legacy-material-relations.mjs";
import {
  applyMigrations,
  nowIso,
  openDatabase,
  projectRoot,
  readJson,
  resolveDbPath,
  resolveUploadsDir,
} from "./db-lib.mjs";

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Контентные таблицы, которые очищает `--reset`. Кейсы в список не входят намеренно. */
const RESET_TABLES = [
  "departments",
  "products",
  "page_content",
  "articles",
  "contacts",
  "documents",
  "document_categories",
];

/**
 * Типы материалов, чьи строки `--reset` удаляет, — и потому типы, чьи связи он обязан снять.
 *
 * У полиморфной связи нет внешнего ключа и каскада, поэтому связь, у которой источник ИЛИ цель лежит
 * в очищаемой таблице, после сброса стала бы ссылкой в никуда. Хуже того: seed-статьи получают те же
 * идентификаторы, и повторная вставка их связей упёрлась бы в первичный ключ оставшихся строк. Связи
 * между кейсами сброс не трогает — таблица `cases` не очищается.
 */
export const RESET_RELATION_ENTITY_TYPES = Object.freeze(["article", "product", "department"]);

/** Роль связей, которые seed пишет из `relations`. Та же, что пишет backfill. */
export const SEED_RELATION_ROLE = "related";

/**
 * Допустимые цели связей seed-статьи и условие их публикации (Amendment 61 / REL-02F.3a).
 *
 * Имя таблицы и условие подставляются в SQL текстом, поэтому приходят ТОЛЬКО отсюда: тип цели из
 * JSON сначала проверяется на принадлежность этому объекту. Отдела здесь нет намеренно, но причина
 * с Amendment 64 другая: публичный блок «Материалы по теме» отдел ВЫВОДИТ, а seed-статьи на отделы
 * не ссылаются — перелинковку на решения составляет владелец сайта в админ-панели, и придумывать за
 * него связи демо-контента незачем. Понадобится — добавляется строкой
 * `department: { table: "departments", published: "is_published = 1" }`.
 */
const SEED_RELATION_TARGETS = Object.freeze({
  article: { table: "articles", published: "status = 'published'" },
  product: { table: "products", published: "is_published = 1" },
  case: { table: "cases", published: "status = 'published'" },
});

/**
 * Флаг, который разрешает `--reset` снести связи, восстановить которые seed не сможет.
 *
 * Имя длинное намеренно. Короткого `--force` здесь быть не должно: его набирают не глядя, а эта
 * операция необратима и уносит ручную работу владельца сайта. Флаг обязан читаться как
 * утверждение о последствиях, а не как способ убрать помеху.
 */
export const FORCE_UNMANAGED_RELATIONS_RESET_FLAG = "--force-unmanaged-relations-reset";

/**
 * Отказ `--reset`: в базе есть связи, которые сброс уничтожит безвозвратно.
 *
 * Отдельный класс с полем `relations`, а не голый `Error`: точку выхода из процесса решает
 * вызывающий код, а перечень нужен ему целиком — и чтобы напечатать, и чтобы проверить в тестах.
 */
export class UnmanagedRelationsResetError extends Error {
  constructor(relations) {
    super(
      `--reset остановлен: ${relations.length} связь(и) будут уничтожены без возможности восстановления.`,
    );
    this.name = "UnmanagedRelationsResetError";
    this.relations = relations;
  }
}

/**
 * Связи, которые `--reset` снимет и которые seed НЕ создаст заново.
 *
 * Правило ровно одно и оно проверяемое: seed пишет связи ТОЛЬКО с `source_type = 'article'` (см.
 * `INSERT` в `seedArticles()`, где тип источника стоит строкой). Значит любая снесённая сбросом
 * связь с другим источником восстановлению средствами seed не подлежит — её завёл владелец сайта
 * в админ-панели или отдельная задача перелинковки. Такие связи и называются здесь `unmanaged`:
 * seed ими не управляет и потому не вправе их уничтожать по умолчанию.
 *
 * Практический повод появился с SOL-OUT-01: утверждены 11 связей отдела с продуктами и кейсами
 * (`source_type = 'department'`). Сброс обязан их снять — таблицы `departments` и `products` он
 * очищает, и без этого остались бы ссылки в никуда. Сохранить их, не сломав смысл сброса, нельзя.
 * Поэтому выбран третий путь: НЕ УДАЛЯТЬ МОЛЧА И НЕ УДАЛЯТЬ БЕЗ СПРОСА.
 *
 * `WHERE` дословно повторяет условие удаления в `resetContent()` — иначе отчёт разошёлся бы с тем,
 * что происходит на самом деле, и предупреждение стало бы опаснее его отсутствия.
 */
export function listUnmanagedRelations(db) {
  const placeholders = RESET_RELATION_ENTITY_TYPES.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT source_type, source_id, target_type, target_id, relation_role, sort_order
         FROM content_relations
        WHERE (source_type IN (${placeholders}) OR target_type IN (${placeholders}))
          AND source_type <> 'article'
        ORDER BY source_type ASC, source_id ASC, sort_order ASC,
                 target_type ASC, target_id ASC, relation_role ASC`,
    )
    .all(...RESET_RELATION_ENTITY_TYPES, ...RESET_RELATION_ENTITY_TYPES);
}

/**
 * Перечень связей построчно — ОДИН формат и для отказа, и для отчёта после принудительного сноса.
 *
 * Общая функция, а не два похожих цикла: расхождение между тем, что показал отказ, и тем, что
 * показал снос, означало бы, что владелец сверяет два разных списка одних и тех же строк.
 */
function formatRelations(relations) {
  return relations
    .map(
      (relation) =>
        `  ${relation.source_type}:${relation.source_id} → ` +
        `${relation.target_type}:${relation.target_id} ` +
        `(роль ${relation.relation_role}, порядок ${relation.sort_order})`,
    )
    .join("\n");
}

/**
 * Текст отказа: что найдено, что будет уничтожено и каким флагом это разрешить.
 *
 * Перечень идёт ЦЕЛИКОМ, без усечения: сообщение существует ради того, чтобы владелец сохранил
 * список до того, как согласится его потерять. Обрезанный список сделал бы отказ бесполезным.
 */
function formatUnmanagedRelationsRefusal(relations) {
  return (
    `\nОТКАЗ: --reset остановлен, база НЕ изменена.\n\n` +
    `Найдено связей, которые seed не создаёт заново: ${relations.length}.\n` +
    `Заведены вручную через админ-панель или отдельной задачей перелинковки:\n\n` +
    `${formatRelations(relations)}\n\n` +
    `Сохраните этот список, если он вам нужен.\n\n` +
    `Повторить сброс вместе с их безвозвратным удалением:\n` +
    `  npm run db:seed -- --reset ${FORCE_UNMANAGED_RELATIONS_RESET_FLAG}\n`
  );
}

/**
 * Сброс контента одной транзакцией: связи очищаемых типов и сами контентные таблицы.
 *
 * Возвращает перечень `unmanaged`-связей, которые сброс только что уничтожил (см.
 * `listUnmanagedRelations`). Перечень снимается ДО удаления и внутри той же транзакции: список,
 * собранный после `DELETE`, был бы всегда пуст, а собранный до транзакции — мог бы разойтись с
 * тем, что удалено.
 *
 * Сама функция НИЧЕГО не запрещает: решение «сносить или отказать» принимается до её вызова, в
 * `runSeed()`. Здесь запрета нет намеренно — `resetContent()` вызывают и тесты, которым нужен
 * именно сброс, а не диалог о его допустимости.
 */
export function resetContent(db) {
  const placeholders = RESET_RELATION_ENTITY_TYPES.map(() => "?").join(", ");

  db.exec("BEGIN");
  try {
    const unmanaged = listUnmanagedRelations(db);

    db.prepare(
      `DELETE FROM content_relations
        WHERE source_type IN (${placeholders}) OR target_type IN (${placeholders})`,
    ).run(...RESET_RELATION_ENTITY_TYPES, ...RESET_RELATION_ENTITY_TYPES);

    for (const table of RESET_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.exec("COMMIT");
    return unmanaged;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Статьи и их связи на статьи, продукты и кейсы. Возвращает число вставленных статей.
 *
 * Свежая база обязана выйти из seed с перелинковкой в ОБЕИХ моделях: публичный блок читает
 * `content_relations`, а `related_slugs` пока пишется ради переходного dual-write. Требовать для
 * нового окружения ручной backfill значило бы оставить его с пустыми блоками до первой ошибки.
 *
 * ИСТОЧНИК СВЯЗЕЙ — ТОЛЬКО `relations` статьи (Amendment 61 / REL-02F.3a, решение D8): массив
 * `{targetType, targetId}`, где позиция в массиве — `sort_order`, а цель задана stable id, не адресом.
 * Текст статьи связей не задаёт: legacy-секция «Материалы по теме» из seed удалена.
 *
 * `relatedSlugs` — НЕ второй источник, а legacy-проекция статей для колонки `related_slugs`. Поэтому
 * seed проверяет, что статьи из `relations` в том же порядке — ровно `relatedSlugs`, разрешённые в
 * идентификаторы: любое расхождение означало бы, что две модели выйдут из seed разными.
 *
 * Связи пишутся ТОЛЬКО для статей, вставленных в этом запуске. Существующая статья могла быть
 * отредактирована владельцем, и её связи — его данные, а не seed.
 *
 * Статьи и связи — ОДНА транзакция. Ошибка в данных связей отменяет весь блок: статья без своих связей
 * была бы тем самым расхождением двух моделей, которое seed обязан исключить. Отказ — исключение,
 * которое при прямом запуске завершает процесс ненулевым кодом.
 *
 * Правила отказа: `relations` не массив или длиннее предела; неизвестный тип цели (включая отдел);
 * пустой идентификатор; цель не найдена по id; цель не опубликована; ссылка статьи на себя; повтор
 * цели; расхождение со `relatedSlugs`, в том числе неразрешимый адрес в нём. Правила для статей
 * совпадают с backfill (`scripts/backfill-article-relations.mjs`): иначе seed записал бы то, что
 * backfill назвал бы непереносимым.
 */
export function seedArticles(db, articles, timestamp = nowIso()) {
  const articleExists = db.prepare("SELECT 1 FROM articles WHERE id = ?");
  const insertArticle = db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, description, body_markdown, cover_url, cover_alt,
                           placement, category, tags, related_slugs, author, seo_title, seo_description,
                           status, is_featured, sort_order, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const findArticleBySlug = db.prepare("SELECT id FROM articles WHERE slug = ?");
  const findTarget = Object.fromEntries(
    Object.entries(SEED_RELATION_TARGETS).map(([type, target]) => [
      type,
      db.prepare(`SELECT id, (${target.published}) AS is_public FROM ${target.table} WHERE id = ?`),
    ]),
  );
  const insertRelation = db.prepare(
    `INSERT INTO content_relations
       (source_type, source_id, target_type, target_id, relation_role, sort_order,
        created_at, updated_at)
     VALUES ('article', ?, ?, ?, ?, ?, ?, ?)`,
  );

  const inserted = [];

  db.exec("BEGIN");
  try {
    for (const article of articles) {
      if (articleExists.get(article.id)) continue;
      insertArticle.run(
        article.id,
        article.slug,
        article.title,
        article.excerpt,
        article.description,
        article.bodyMarkdown,
        article.coverUrl,
        article.coverAlt,
        article.placement,
        article.category,
        JSON.stringify(article.tags ?? []),
        JSON.stringify(article.relatedSlugs ?? []),
        article.author,
        // Колонка `NOT NULL`: отсутствующий в JSON заголовок обязан стать пустой строкой, иначе
        // `undefined` уронил бы привязку параметра.
        (article.seoTitle ?? "").trim(),
        article.seoDescription,
        article.status,
        article.isFeatured ? 1 : 0,
        article.sortOrder,
        article.publishedAt,
        article.publishedAt ? `${article.publishedAt}T00:00:00.000Z` : timestamp,
        article.modifiedAt ? `${article.modifiedAt}T00:00:00.000Z` : timestamp,
      );
      inserted.push(article);
    }

    // Связи — после ВСЕХ статей: цель может стоять в файле позже того, кто на неё ссылается.
    for (const article of inserted) {
      const fail = (reason) => {
        throw new Error(`Seed-статья «${article.slug}»: ${reason}`);
      };

      const relations = article.relations;
      if (!Array.isArray(relations)) fail("relations не является массивом");
      if (relations.length > MAX_RELATIONS_PER_SOURCE) {
        fail(`больше ${MAX_RELATIONS_PER_SOURCE} связей`);
      }

      const seen = new Set();
      const rows = relations.map((relation, index) => {
        const targetType = relation?.targetType;
        const targetId = relation?.targetId;

        if (!Object.hasOwn(SEED_RELATION_TARGETS, targetType)) {
          fail(`недопустимый тип цели «${String(targetType)}» на позиции ${index}`);
        }
        if (typeof targetId !== "string" || targetId.trim() === "") {
          fail(`пустой идентификатор цели на позиции ${index}`);
        }

        const target = findTarget[targetType].get(targetId);
        if (!target) fail(`цель «${targetType}:${targetId}» не найдена`);
        if (Number(target.is_public) !== 1)
          fail(`цель «${targetType}:${targetId}» не опубликована`);

        if (targetType === "article" && targetId === article.id) fail("ссылается сама на себя");

        const key = `${targetType}:${targetId}`;
        if (seen.has(key)) fail(`цель «${key}» указана дважды`);
        seen.add(key);

        // Порядок — позиция в массиве, как у формы админ-панели.
        return { targetType, targetId, sortOrder: index };
      });

      // `relatedSlugs` — только legacy-проекция статей для `related_slugs`: он обязан ровно совпасть
      // со статьями из `relations`, по составу и порядку.
      const slugs = article.relatedSlugs ?? [];
      if (!Array.isArray(slugs)) fail("relatedSlugs не является массивом");
      const legacyIds = slugs.map((slug, index) => {
        if (typeof slug !== "string" || slug.trim() === "") {
          fail(`пустой адрес в relatedSlugs на позиции ${index}`);
        }
        const row = findArticleBySlug.get(slug);
        if (!row) fail(`связанная статья «${slug}» из relatedSlugs не найдена`);
        return String(row.id);
      });
      const articleIds = rows
        .filter((row) => row.targetType === "article")
        .map((row) => row.targetId);
      if (
        articleIds.length !== legacyIds.length ||
        articleIds.some((id, index) => id !== legacyIds[index])
      ) {
        fail(
          `статьи из relations (${articleIds.join(", ")}) не совпадают с relatedSlugs ` +
            `(${legacyIds.join(", ")})`,
        );
      }

      for (const row of rows) {
        insertRelation.run(
          article.id,
          row.targetType,
          row.targetId,
          SEED_RELATION_ROLE,
          row.sortOrder,
          timestamp,
          timestamp,
        );
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return inserted.length;
}

function runSeed({ reset, forceUnmanagedRelationsReset = false }) {
  const db = openDatabase();
  const stats = { departments: 0, products: 0, pages: 0, articles: 0, contacts: 0, documents: 0 };
  const uploadsDir = resolveUploadsDir();

  try {
    applyMigrations(db);
    const timestamp = nowIso();

    if (reset) {
      /**
       * ПРОВЕРКА ДО УДАЛЕНИЯ, а не отчёт после него.
       *
       * `listUnmanagedRelations()` читает базу, ещё не тронутую сбросом: `applyMigrations()` выше
       * только создаёт недостающие таблицы. Если сносить нечего из того, чем seed не управляет, —
       * поведение прежнее, ни одной новой строки в выводе. Если есть — процесс останавливается
       * здесь, и НИ ОДНА строка контента не удаляется: `resetContent()` даже не вызывается.
       */
      const unmanaged = listUnmanagedRelations(db);

      if (unmanaged.length > 0 && !forceUnmanagedRelationsReset) {
        throw new UnmanagedRelationsResetError(unmanaged);
      }

      const removed = resetContent(db);
      console.log("Контентные таблицы очищены (--reset).");

      /**
       * Снос по явному флагу всё равно печатает перечень ПОИМЁННО, а не счётчиком.
       *
       * Разрешение — не то же самое, что отсутствие последствий: полная строка (источник, цель,
       * роль, порядок) остаётся готовым списком для повторного ввода, и это последнее место, где
       * её ещё можно прочитать.
       */
      if (removed.length > 0) {
        console.warn(
          `\nВНИМАНИЕ: по флагу ${FORCE_UNMANAGED_RELATIONS_RESET_FLAG} снято ${removed.length} связь(и),` +
            `\nкоторые seed НЕ создаёт заново. Восстановить их можно только тем же способом,` +
            `\nкаким они были заведены:`,
        );
        console.warn(formatRelations(removed));
        console.warn("");
      }
    }

    const exists = (table, id, column = "id") =>
      Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ?`).get(id));

    // ── Отделы ──────────────────────────────────────────────────────────────────────────────────
    const departments = readJson("data/departments.json");
    const insertDepartment = db.prepare(
      `INSERT INTO departments (id, display_name, content, sort_order, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    );
    departments.forEach((department, index) => {
      if (exists("departments", department.id)) return;
      const { id, ...content } = department;
      insertDepartment.run(
        id,
        content.name,
        JSON.stringify(content),
        (index + 1) * 10,
        timestamp,
        timestamp,
      );
      stats.departments += 1;
    });

    // ── Продукты ────────────────────────────────────────────────────────────────────────────────
    const products = readJson("data/seed/products.json");
    const insertProduct = db.prepare(
      `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                             seo_title, sort_order, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    for (const product of products) {
      if (exists("products", product.id)) continue;
      insertProduct.run(
        product.id,
        product.slug,
        product.menuTitle,
        product.fullTitle,
        JSON.stringify(product.content),
        JSON.stringify(product.layout),
        JSON.stringify(product.hotspot),
        product.imageAlt,
        product.seoTitle?.trim() || null,
        product.order,
        timestamp,
        timestamp,
      );
      stats.products += 1;
    }

    // ── Общие тексты страниц ────────────────────────────────────────────────────────────────────
    const pageContent = {
      homepage: readJson("data/homepage-copy.json"),
      ...readJson("data/seed/page-content.json"),
    };
    const insertPage = db.prepare(
      "INSERT INTO page_content (page_key, content, updated_at) VALUES (?, ?, ?)",
    );
    for (const [pageKey, content] of Object.entries(pageContent)) {
      if (exists("page_content", pageKey, "page_key")) continue;
      insertPage.run(pageKey, JSON.stringify(content), timestamp);
      stats.pages += 1;
    }

    // ── Статьи и их связи ───────────────────────────────────────────────────────────────────────
    stats.articles = seedArticles(db, readJson("data/seed/articles.json"), timestamp);

    // ── Контакты ────────────────────────────────────────────────────────────────────────────────
    const contacts = readJson("data/seed/contacts.json");
    const insertContact = db.prepare(
      `INSERT INTO contacts (id, kind, label, value, href, accessible_label, header_label,
                             is_external, is_published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const contact of contacts) {
      if (exists("contacts", contact.id)) continue;
      insertContact.run(
        contact.id,
        contact.kind,
        contact.label,
        contact.value,
        contact.href,
        contact.accessibleLabel ?? "",
        contact.headerLabel ?? "",
        contact.isExternal ? 1 : 0,
        contact.isPublished === false ? 0 : 1,
        contact.sortOrder,
        timestamp,
        timestamp,
      );
      stats.contacts += 1;
    }

    // ── Документы ───────────────────────────────────────────────────────────────────────────────
    const documentsSeed = readJson("data/seed/documents.json");
    const insertCategory = db.prepare(
      "INSERT INTO document_categories (id, label, sort_order) VALUES (?, ?, ?)",
    );
    for (const category of documentsSeed.categories) {
      if (exists("document_categories", category.id)) continue;
      insertCategory.run(category.id, category.label, category.sortOrder);
    }

    const insertDocument = db.prepare(
      `INSERT INTO documents (id, title, description, category, file_type, mime_type, file_size,
                              original_file_name, original_file_url, storage_key, preview_url,
                              auto_preview_key, manual_preview_key, sort_order, is_published,
                              document_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const document of documentsSeed.documents) {
      if (exists("documents", document.id)) continue;

      const sourcePath = path.join(projectRoot, document.sourceFile);
      if (!fs.existsSync(sourcePath)) {
        console.warn(`Пропущен документ «${document.title}»: нет файла ${document.sourceFile}`);
        continue;
      }

      const originalFileName = path.basename(document.sourceFile);
      const extension = path.extname(originalFileName).slice(1).toLowerCase();
      // Имя в хранилище не совпадает с исходным намеренно: одинаковые имена не должны затирать
      // друг друга, а исходное имя остаётся отдельным полем и отдаётся при скачивании.
      const storageKey = `documents/${randomUUID()}.${extension}`;
      const targetPath = path.join(uploadsDir, storageKey);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);

      const size = fs.statSync(sourcePath).size;
      // Изображение само себе предпросмотр; готовые SVG-заглушки остаются статикой репозитория.
      const isImage = ["jpg", "jpeg", "png", "webp"].includes(extension);
      const previewUrl = isImage
        ? `/api/files/${storageKey}`
        : (document.previewFile?.replace(/^public\//, "/") ?? null);

      insertDocument.run(
        document.id,
        document.title,
        document.description ?? "",
        document.category,
        extension,
        MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
        size,
        originalFileName,
        `/api/files/${storageKey}`,
        storageKey,
        previewUrl,
        isImage ? storageKey : null,
        null,
        document.sortOrder,
        document.isPublished === false ? 0 : 1,
        document.documentDate ?? null,
        timestamp,
        timestamp,
      );
      stats.documents += 1;
    }
  } finally {
    db.close();
  }

  console.log(`База: ${resolveDbPath()}`);
  console.log(`Хранилище файлов: ${uploadsDir}`);
  console.log(
    `Добавлено — отделы: ${stats.departments}, продукты: ${stats.products}, страницы: ${stats.pages}, ` +
      `статьи: ${stats.articles}, контакты: ${stats.contacts}, документы: ${stats.documents}.`,
  );
  console.log(
    "Существующие записи не изменялись. Полная переустановка: npm run db:seed -- --reset",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runSeed({
      reset: process.argv.includes("--reset"),
      forceUnmanagedRelationsReset: process.argv.includes(FORCE_UNMANAGED_RELATIONS_RESET_FLAG),
    });
  } catch (error) {
    /**
     * Отказ по `unmanaged`-связям — не сбой скрипта, а его решение, поэтому и выглядит иначе:
     * понятный текст с перечнем и ненулевой код выхода, без стека. Любая другая ошибка пробрасывается
     * как была — прятать её за тем же кодом значило бы скрыть настоящую поломку.
     */
    if (error instanceof UnmanagedRelationsResetError) {
      console.error(formatUnmanagedRelationsRefusal(error.relations));
      process.exit(1);
    }
    throw error;
  }
}
