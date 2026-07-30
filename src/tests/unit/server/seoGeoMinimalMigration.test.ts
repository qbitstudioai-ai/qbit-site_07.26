import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import seedArticles from "../../../../data/seed/articles.json";
import {
  ARTICLE_OLD_SHA256,
  PRODUCT_UPDATES,
  runSeoGeoMinimalMigration,
} from "../../../../scripts/seo-geo-minimal-migration.mjs";

interface Row {
  [column: string]: unknown;
}

const TARGET_LINKS: Record<string, { href: string; anchor: string }> = {
  "kak-avtomatizirovat-obrabotku-zayavok": {
    href: "/products/leads-to-crm",
    anchor: "Единый сбор заявок в CRM",
  },
  "ai-assistent-po-baze-znaniy": {
    href: "/products/rag-ai-assistant",
    anchor: "AI-ассистент по знаниям компании",
  },
  "analiz-zvonkov-otdela-prodazh": {
    href: "/products/call-analysis",
    anchor: "AI-контроль качества звонков",
  },
  "avtomatizatsiya-dokumentov-s-ai": {
    href: "/products/document-analysis",
    anchor: "AI-обработка и анализ документов",
  },
  "sayt-crm-i-messendzhery": {
    href: "/products/leads-to-crm",
    anchor: "Единый сбор заявок с сайта и мессенджеров в CRM",
  },
  "chto-mozhno-avtomatizirovat-na-n8n": {
    href: "/products/n8n-automation",
    anchor: "Автоматизация бизнес-процесса на n8n",
  },
};

function articleTargets(): Record<string, string> {
  return Object.fromEntries(
    seedArticles
      .filter((article) => Object.hasOwn(TARGET_LINKS, article.slug))
      .map((article) => [article.slug, article.bodyMarkdown]),
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function oldArticleBody(slug: string, body: string): string {
  const target = TARGET_LINKS[slug];
  const escapedHref = target.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAnchor = target.anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(
    new RegExp(`^- «\\[${escapedAnchor}\\]\\(${escapedHref}\\)».*\\r?\\n`, "m"),
    "",
  );
}

async function oldArticleTargets(): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = [];
  for (const [slug, body] of Object.entries(articleTargets())) {
    const oldBody = oldArticleBody(slug, body);
    expect(await sha256(oldBody)).toBe(ARTICLE_OLD_SHA256[slug as keyof typeof ARTICLE_OLD_SHA256]);
    entries.push([slug, oldBody]);
  }
  return Object.fromEntries(entries);
}

function createDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      slug TEXT PRIMARY KEY,
      seo_title TEXT,
      content TEXT NOT NULL,
      full_title TEXT NOT NULL,
      description TEXT NOT NULL,
      canonical TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE articles (
      slug TEXT PRIMARY KEY,
      body_markdown TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      seo_description TEXT NOT NULL,
      canonical TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

async function seedOldDb(): Promise<{ db: DatabaseSync; newBodies: Record<string, string> }> {
  const db = createDb();
  const newBodies = articleTargets();
  const oldBodies = await oldArticleTargets();

  for (const update of PRODUCT_UPDATES) {
    const content =
      update.column === "content.summary"
        ? { summary: update.oldValue, applies: "unchanged" }
        : { summary: "unchanged", applies: "unchanged" };
    db.prepare(
      `INSERT INTO products (slug, seo_title, content, full_title, description, canonical, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      update.slug,
      update.column === "seo_title" ? update.oldValue : "unchanged title",
      JSON.stringify(content),
      `H1 ${update.slug}`,
      `Description ${update.slug}`,
      `https://allqbit.ru/products/${update.slug}`,
      "2026-07-25T00:00:00.000Z",
    );
  }

  for (const [slug, body] of Object.entries(oldBodies)) {
    db.prepare(
      `INSERT INTO articles (slug, body_markdown, title, description, seo_description, canonical, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      slug,
      body,
      `H1 ${slug}`,
      `Description ${slug}`,
      `SEO description ${slug}`,
      `https://allqbit.ru/blog/${slug}`,
      "2026-07-25T00:00:00.000Z",
    );
  }

  return { db, newBodies };
}

function allRows(db: DatabaseSync, table: "products" | "articles"): Row[] {
  return db.prepare(`SELECT * FROM ${table} ORDER BY slug`).all() as Row[];
}

describe("SEO/GEO minimal data migration", () => {
  it("updates exactly the expected product and article rows", async () => {
    const { db, newBodies } = await seedOldDb();

    const result = runSeoGeoMinimalMigration(db, { apply: true, articleTargets: newBodies });

    expect(result.changed).toEqual({ products: 3, articles: 6 });
    for (const update of PRODUCT_UPDATES) {
      const row = db
        .prepare("SELECT seo_title, content FROM products WHERE slug = ?")
        .get(update.slug) as Row;
      const value =
        update.column === "seo_title"
          ? row.seo_title
          : (JSON.parse(String(row.content)) as { summary: string }).summary;
      expect(value).toBe(update.newValue);
    }
    for (const [slug, body] of Object.entries(newBodies)) {
      expect(
        (db.prepare("SELECT body_markdown FROM articles WHERE slug = ?").get(slug) as Row)
          .body_markdown,
      ).toBe(body);
    }

    db.close();
  });

  it("fails instead of overwriting when a guard value differs", async () => {
    const { db, newBodies } = await seedOldDb();
    db.prepare("UPDATE products SET seo_title = ? WHERE slug = 'call-analysis'").run(
      "Manual production title",
    );

    expect(() => runSeoGeoMinimalMigration(db, { apply: true, articleTargets: newBodies })).toThrow(
      "Unexpected seo_title for product call-analysis",
    );

    expect(
      (db.prepare("SELECT seo_title FROM products WHERE slug = 'call-analysis'").get() as Row)
        .seo_title,
    ).toBe("Manual production title");
    db.close();
  });

  it("does not change H1, descriptions, canonicals, updated_at or unrelated JSON fields", async () => {
    const { db, newBodies } = await seedOldDb();
    const productBefore = allRows(db, "products");
    const articleBefore = allRows(db, "articles");

    runSeoGeoMinimalMigration(db, { apply: true, articleTargets: newBodies });

    const productAfter = allRows(db, "products");
    const articleAfter = allRows(db, "articles");
    for (let index = 0; index < productBefore.length; index += 1) {
      expect(productAfter[index].full_title).toBe(productBefore[index].full_title);
      expect(productAfter[index].description).toBe(productBefore[index].description);
      expect(productAfter[index].canonical).toBe(productBefore[index].canonical);
      expect(productAfter[index].updated_at).toBe(productBefore[index].updated_at);
      expect((JSON.parse(String(productAfter[index].content)) as { applies: string }).applies).toBe(
        "unchanged",
      );
    }
    for (let index = 0; index < articleBefore.length; index += 1) {
      expect(articleAfter[index].title).toBe(articleBefore[index].title);
      expect(articleAfter[index].description).toBe(articleBefore[index].description);
      expect(articleAfter[index].seo_description).toBe(articleBefore[index].seo_description);
      expect(articleAfter[index].canonical).toBe(articleBefore[index].canonical);
      expect(articleAfter[index].updated_at).toBe(articleBefore[index].updated_at);
    }

    db.close();
  });

  it("is repeatable after the rows already contain the new values", async () => {
    const { db, newBodies } = await seedOldDb();

    runSeoGeoMinimalMigration(db, { apply: true, articleTargets: newBodies });
    const result = runSeoGeoMinimalMigration(db, { apply: true, articleTargets: newBodies });

    expect(result.changed).toEqual({ products: 0, articles: 0 });
    db.close();
  });

  it("keeps the database untouched in dry-run mode", async () => {
    const { db, newBodies } = await seedOldDb();
    const before = { products: allRows(db, "products"), articles: allRows(db, "articles") };

    const result = runSeoGeoMinimalMigration(db, { articleTargets: newBodies });

    expect(result.mode).toBe("dry-run");
    expect({ products: allRows(db, "products"), articles: allRows(db, "articles") }).toEqual(
      before,
    );
    db.close();
  });
});
