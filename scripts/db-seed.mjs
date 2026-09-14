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

/** Роль связей, которые seed выводит из `relatedSlugs`. Та же, что пишет backfill. */
export const SEED_RELATION_ROLE = "related";

/** Сброс контента одной транзакцией: связи очищаемых типов и сами контентные таблицы. */
export function resetContent(db) {
  const placeholders = RESET_RELATION_ENTITY_TYPES.map(() => "?").join(", ");

  db.exec("BEGIN");
  try {
    db.prepare(
      `DELETE FROM content_relations
        WHERE source_type IN (${placeholders}) OR target_type IN (${placeholders})`,
    ).run(...RESET_RELATION_ENTITY_TYPES, ...RESET_RELATION_ENTITY_TYPES);

    for (const table of RESET_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Статьи и их связи статья → статья. Возвращает число вставленных статей.
 *
 * Свежая база обязана выйти из seed с перелинковкой в ОБЕИХ моделях: публичный блок переходит на
 * `content_relations`, а `related_slugs` пока пишется ради переходного dual-write. Требовать для
 * нового окружения ручной backfill значило бы оставить его с пустыми блоками до первой ошибки.
 *
 * Связи пишутся ТОЛЬКО для статей, вставленных в этом запуске. Существующая статья могла быть
 * отредактирована владельцем, и её связи — его данные, а не seed.
 *
 * Статьи и связи — ОДНА транзакция. Ошибка в данных связей отменяет весь блок: статья без своих связей
 * была бы тем самым расхождением двух моделей, которое seed обязан исключить. Отказ — исключение,
 * которое при прямом запуске завершает процесс ненулевым кодом.
 *
 * Связь хранится по ИДЕНТИФИКАТОРУ: slug цели разрешается через таблицу `articles` той же базы. У
 * статей из `data/seed` идентификатор совпадает с адресом, но на это совпадение код не опирается.
 * Правила отказа совпадают с backfill (`scripts/backfill-article-relations.mjs`): неразрешимый адрес,
 * ссылка на себя, повтор цели, цель-черновик. Иначе seed записал бы то, что backfill назвал бы
 * непереносимым, и две процедуры давали бы разные базы из одних данных.
 */
export function seedArticles(db, articles, timestamp = nowIso()) {
  const articleExists = db.prepare("SELECT 1 FROM articles WHERE id = ?");
  const insertArticle = db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, description, body_markdown, cover_url, cover_alt,
                           placement, category, tags, related_slugs, author, seo_title, seo_description,
                           status, is_featured, sort_order, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const findTarget = db.prepare("SELECT id, status FROM articles WHERE slug = ?");
  const insertRelation = db.prepare(
    `INSERT INTO content_relations
       (source_type, source_id, target_type, target_id, relation_role, sort_order,
        created_at, updated_at)
     VALUES ('article', ?, 'article', ?, ?, ?, ?, ?)`,
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
      const slugs = article.relatedSlugs ?? [];
      if (!Array.isArray(slugs)) {
        throw new Error(`Seed-статья «${article.slug}»: relatedSlugs не является массивом`);
      }

      const seen = new Set();
      slugs.forEach((slug, index) => {
        if (typeof slug !== "string" || slug.trim() === "") {
          throw new Error(`Seed-статья «${article.slug}»: пустой адрес связи на позиции ${index}`);
        }

        const target = findTarget.get(slug);
        if (!target) {
          throw new Error(`Seed-статья «${article.slug}»: связанная статья «${slug}» не найдена`);
        }

        const targetId = String(target.id);
        if (targetId === article.id) {
          throw new Error(`Seed-статья «${article.slug}» ссылается сама на себя`);
        }
        if (seen.has(targetId)) {
          throw new Error(`Seed-статья «${article.slug}»: связь на «${slug}» указана дважды`);
        }
        seen.add(targetId);

        if (String(target.status) !== "published") {
          throw new Error(
            `Seed-статья «${article.slug}»: связанная статья «${slug}» не опубликована`,
          );
        }

        // Порядок — позиция в массиве, как у backfill и у формы админ-панели.
        insertRelation.run(article.id, targetId, SEED_RELATION_ROLE, index, timestamp, timestamp);
      });
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return inserted.length;
}

function runSeed({ reset }) {
  const db = openDatabase();
  const stats = { departments: 0, products: 0, pages: 0, articles: 0, contacts: 0, documents: 0 };
  const uploadsDir = resolveUploadsDir();

  try {
    applyMigrations(db);
    const timestamp = nowIso();

    if (reset) {
      resetContent(db);
      console.log("Контентные таблицы очищены (--reset).");
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
  runSeed({ reset: process.argv.includes("--reset") });
}
