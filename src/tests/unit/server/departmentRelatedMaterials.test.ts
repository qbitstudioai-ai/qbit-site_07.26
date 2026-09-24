import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Читатель перелинковки отдела: `listPublishedDepartmentRelatedMaterials()` (SOL-OUT-02).
 *
 * Тесты работают на НАСТОЯЩЕЙ временной базе — миграции применяются целиком, репозиторий не
 * подменяется, пользовательская `var/content.db` не открывается. Те же правила, что у
 * `contentRelations.test.ts`, и по той же причине: проверяется поведение запроса на фактических
 * данных, а не факт вызова функции.
 *
 * Материалы создаются прямым INSERT: проверяется читатель связей, и репозитории продуктов, кейсов и
 * отделов не должны быть его зависимостью. Связи — тоже прямым INSERT, потому что проверять нужно и
 * те состояния, которые репозиторий записать не даст (одна цель в двух ролях).
 *
 * Адреса и номера дел у тестовых кейсов заведомо свои: миграция 0003 уже переносит в базу кейс
 * `case-sales-call-analysis` со `slug = analiz-zvonkov-otdela-prodazh` и `file_number = 01`, а обе
 * колонки UNIQUE. Ни одной связи на него тесты не заводят, поэтому в выдаче он не участвует.
 *
 * УТВЕРЖДЁННЫХ 11 СВЯЗЕЙ ЗДЕСЬ НЕТ намеренно: механизм обязан работать на тестовых данных, а сами
 * связи — предмет отдельной задачи SOL-OUT-03.
 */

const NOW = "2026-09-01T10:00:00.000Z";

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-department-materials-"));
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

/**
 * Отделы, продукты и кейсы — опубликованные и снятые с публикации.
 *
 * `executive` заведён наравне с `sales`: проверка «идентификатор, а не сегмент адреса» без него
 * была бы вакуумной.
 */
async function seedEntities(): Promise<DatabaseSync> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();

  const insertDepartment = db.prepare(
    `INSERT INTO departments (id, display_name, content, is_published, created_at, updated_at)
     VALUES (?, ?, '{}', ?, ?, ?)`,
  );
  insertDepartment.run("sales", "Продажи", 1, NOW, NOW);
  insertDepartment.run("executive", "Дирекция", 1, NOW, NOW);
  insertDepartment.run("hr", "HR", 1, NOW, NOW);

  const insertProduct = db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'wide', 'sales', 'Иллюстрация', ?, ?, ?)`,
  );
  insertProduct.run(
    "product-03",
    "leads-to-crm",
    "Заявки в CRM",
    "Единый сбор заявок в CRM",
    JSON.stringify({ summary: "Система собирает обращения из разных каналов." }),
    1,
    NOW,
    NOW,
  );
  insertProduct.run(
    "product-04",
    "crm-ai-assistant",
    "AI-помощник в CRM",
    "AI-помощник менеджера в CRM",
    JSON.stringify({ summary: "Система анализирует карточки сделок." }),
    1,
    NOW,
    NOW,
  );
  // Продукт без описания: карточка обязана строиться и без `summary`.
  insertProduct.run(
    "product-09",
    "meeting-protocol",
    "Протокол",
    "AI-протокол совещаний",
    "{}",
    1,
    NOW,
    NOW,
  );
  // Снят с публикации: его страница отвечает 404, значит в блоке его быть не должно.
  insertProduct.run(
    "product-77",
    "skrytyy-produkt",
    "Скрытый",
    "Скрытый продукт",
    JSON.stringify({ summary: "Не должен попасть в блок." }),
    0,
    NOW,
    NOW,
  );

  const insertCase = db.prepare(
    `INSERT INTO cases (id, slug, title, short_title, file_number, summary, seo_description,
                        status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertCase.run(
    "case-leads",
    "sbor-zayavok-v-crm",
    "Автоматический сбор заявок в CRM: как перестать терять обращения",
    "Сбор заявок из почты и мессенджеров в CRM",
    "91",
    "После внедрения продажи выросли примерно на 500 000–700 000 ₽ в месяц.",
    "Кейс: рост продаж на 500 000–700 000 ₽ в месяц.",
    "published",
    NOW,
    NOW,
  );
  insertCase.run(
    "case-calls",
    "analiz-zvonkov-otdela-prodazh-test",
    "AI-анализ звонков отдела продаж: от нескольких часов проверки к 10–15 минутам",
    "AI-анализ звонков отдела продаж",
    "92",
    "На контроль уходило 4–5 часов в неделю, стало 10–15 минут.",
    "Кейс: с 4–5 часов до 10–15 минут в неделю.",
    "published",
    NOW,
    NOW,
  );
  insertCase.run(
    "case-draft",
    "chernovik",
    "Черновик",
    "Черновик кейса",
    "99",
    "",
    "",
    "draft",
    NOW,
    NOW,
  );

  return db;
}

function link(
  db: DatabaseSync,
  source: string,
  targetType: string,
  targetId: string,
  role = "related",
  sortOrder = 0,
): void {
  db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                    relation_role, sort_order, created_at, updated_at)
     VALUES ('department', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(source, targetType, targetId, role, sortOrder, NOW, NOW);
}

async function read(departmentId: string) {
  const { listPublishedDepartmentRelatedMaterials } =
    await import("@/server/repositories/contentRelations");
  return listPublishedDepartmentRelatedMaterials(departmentId);
}

describe("listPublishedDepartmentRelatedMaterials", () => {
  it("отдаёт связанные продукт и кейс по stable id, а не по адресу", async () => {
    const db = await seedEntities();
    link(db, "sales", "product", "product-03", "primary", 0);
    link(db, "sales", "case", "case-leads", "primary", 1);

    expect(await read("sales")).toEqual([
      {
        type: "product",
        id: "product-03",
        slug: "leads-to-crm",
        title: "Единый сбор заявок в CRM",
        href: "/products/leads-to-crm",
        summary: "Система собирает обращения из разных каналов.",
      },
      {
        type: "case",
        id: "case-leads",
        slug: "sbor-zayavok-v-crm",
        title: "Сбор заявок из почты и мессенджеров в CRM",
        href: "/cases/sbor-zayavok-v-crm",
        summary: null,
      },
    ]);
  });

  it("у кейса описания нет никогда — измеренный результат в подпись не попадает", async () => {
    /**
     * Сторож копирайта, а не оформления. У кейса единственные краткие тексты — `summary` и
     * `seo_description`, и в обоих стоит результат конкретного внедрения. На странице отдела такая
     * подпись читалась бы как обещание того же результата любому посетителю.
     */
    const db = await seedEntities();
    link(db, "sales", "case", "case-leads", "primary", 0);
    link(db, "executive", "case", "case-calls", "primary", 0);

    const serialized = JSON.stringify([...(await read("sales")), ...(await read("executive"))]);

    expect(serialized).not.toContain("500 000");
    expect(serialized).not.toContain("700 000");
    expect(serialized).not.toContain("10–15 минут");
    expect(serialized).not.toContain("4–5 часов");
    expect(serialized).not.toMatch(/\d/u);
  });

  it("принимает стабильный идентификатор отдела, включая executive", async () => {
    const db = await seedEntities();
    link(db, "executive", "product", "product-09", "primary", 0);

    expect((await read("executive")).map((material) => material.id)).toEqual(["product-09"]);
    // Сегмент адреса идентификатором НЕ является: связей у «management» нет.
    expect(await read("management")).toEqual([]);
  });

  it("не возвращает неопубликованный продукт и неопубликованный кейс", async () => {
    const db = await seedEntities();
    link(db, "sales", "product", "product-03", "primary", 0);
    link(db, "sales", "product", "product-77", "related", 1);
    link(db, "sales", "case", "case-draft", "related", 2);

    expect((await read("sales")).map((material) => material.id)).toEqual(["product-03"]);
  });

  it("соблюдает sort_order", async () => {
    const db = await seedEntities();
    link(db, "sales", "case", "case-leads", "related", 0);
    link(db, "sales", "product", "product-09", "related", 1);
    link(db, "sales", "product", "product-03", "related", 2);

    expect((await read("sales")).map((material) => material.id)).toEqual([
      "case-leads",
      "product-09",
      "product-03",
    ]);
  });

  it("при равном sort_order порядок детерминирован и не меняется между запросами", async () => {
    const db = await seedEntities();
    // Все три с одним и тем же порядком: решать обязаны тип и идентификатор цели.
    link(db, "sales", "product", "product-09", "related", 0);
    link(db, "sales", "case", "case-leads", "related", 0);
    link(db, "sales", "product", "product-03", "related", 0);

    const expected = ["case-leads", "product-03", "product-09"];
    expect((await read("sales")).map((material) => material.id)).toEqual(expected);
    expect((await read("sales")).map((material) => material.id)).toEqual(expected);
  });

  it("одна цель в двух ролях показывается один раз, на месте первого вхождения", async () => {
    const db = await seedEntities();
    link(db, "sales", "product", "product-03", "primary", 0);
    link(db, "sales", "product", "product-03", "related", 0);
    link(db, "sales", "product", "product-04", "related", 1);

    expect((await read("sales")).map((material) => material.id)).toEqual([
      "product-03",
      "product-04",
    ]);
  });

  it("не подхватывает связи чужого отдела и чужого типа источника", async () => {
    const db = await seedEntities();
    link(db, "sales", "product", "product-03", "primary", 0);
    // Тот же продукт, но источник — статья: блок отдела её видеть не должен.
    db.prepare(
      `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, created_at, updated_at)
       VALUES ('article-a', 'statya', 'Статья', 'Описание', 'Текст', 'blog', ?, ?)`,
    ).run(NOW, NOW);
    db.prepare(
      `INSERT INTO content_relations (source_type, source_id, target_type, target_id,
                                      relation_role, sort_order, created_at, updated_at)
       VALUES ('article', 'article-a', 'product', 'product-04', 'related', 0, ?, ?)`,
    ).run(NOW, NOW);

    expect((await read("sales")).map((material) => material.id)).toEqual(["product-03"]);
    expect(await read("hr")).toEqual([]);
  });

  it("связь на статью и на отдел в блок отдела не попадает", async () => {
    const db = await seedEntities();
    db.prepare(
      `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, created_at, updated_at)
       VALUES ('article-a', 'statya', 'Статья', 'Описание', 'Текст', 'blog', ?, ?)`,
    ).run(NOW, NOW);
    link(db, "sales", "article", "article-a", "related", 0);
    link(db, "sales", "department", "hr", "related", 1);
    link(db, "sales", "product", "product-03", "related", 2);

    expect((await read("sales")).map((material) => material.id)).toEqual(["product-03"]);
  });

  it("неизвестный отдел и отдел без связей дают пустой список, а не ошибку", async () => {
    await seedEntities();

    expect(await read("hr")).toEqual([]);
    expect(await read("takogo-otdela-net")).toEqual([]);
    expect(await read("")).toEqual([]);
  });

  it("продукт без описания отдаётся с summary = null, а не с пустой строкой", async () => {
    const db = await seedEntities();
    link(db, "sales", "product", "product-09", "primary", 0);

    expect(await read("sales")).toEqual([
      {
        type: "product",
        id: "product-09",
        slug: "meeting-protocol",
        title: "AI-протокол совещаний",
        href: "/products/meeting-protocol",
        summary: null,
      },
    ]);
  });

  it("название и адрес берутся из актуальной строки цели, а не из связи", async () => {
    const db = await seedEntities();
    link(db, "sales", "product", "product-03", "primary", 0);

    db.prepare("UPDATE products SET slug = ?, full_title = ? WHERE id = ?").run(
      "novyy-adres",
      "Новое название продукта",
      "product-03",
    );

    expect(await read("sales")).toMatchObject([
      {
        id: "product-03",
        slug: "novyy-adres",
        title: "Новое название продукта",
        href: "/products/novyy-adres",
      },
    ]);
  });
});
