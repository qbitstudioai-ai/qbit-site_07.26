import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import seedArticles from "../../../../data/seed/articles.json";
import {
  ARTICLE_OLD_SHA256,
  ARTICLE_TARGET_SHA256,
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

const LEGACY_SECTION_HEADING = "**Материалы по теме:**";

function currentSeedBodies(): Record<string, string> {
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

// The migration's targets are the seed bodies as they were before REL-02F.3a removed the legacy
// section. Rebuilt here as cleaned seed body + the section from src/content/blog/<slug>.md (without
// the file's final newline); the frozen hash proves the reconstruction is the exact historical body.
async function articleTargets(): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = [];
  for (const [slug, cleanedBody] of Object.entries(currentSeedBodies())) {
    const markdown = readFileSync(
      path.resolve(process.cwd(), "src/content/blog", `${slug}.md`),
      "utf8",
    );
    const start = markdown.indexOf(LEGACY_SECTION_HEADING);
    expect(start).toBeGreaterThan(-1);
    expect(markdown.lastIndexOf(LEGACY_SECTION_HEADING)).toBe(start);
    const target = cleanedBody + markdown.slice(start).replace(/\n$/, "");
    expect(await sha256(target)).toBe(
      ARTICLE_TARGET_SHA256[slug as keyof typeof ARTICLE_TARGET_SHA256],
    );
    entries.push([slug, target]);
  }
  return Object.fromEntries(entries);
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

async function oldArticleTargets(
  newBodies: Record<string, string>,
): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = [];
  for (const [slug, body] of Object.entries(newBodies)) {
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
  const newBodies = await articleTargets();
  const oldBodies = await oldArticleTargets(newBodies);

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

function snapshot(db: DatabaseSync): { products: Row[]; articles: Row[] } {
  return { products: allRows(db, "products"), articles: allRows(db, "articles") };
}

// Records every statement the migration sends, to prove a rejection happens before the database
// is read or written at all.
function recordingDb(db: DatabaseSync): { db: DatabaseSync; statements: string[] } {
  const statements: string[] = [];
  const recorder = {
    prepare: (sql: string) => {
      statements.push(sql);
      return db.prepare(sql);
    },
    exec: (sql: string) => {
      statements.push(sql);
      db.exec(sql);
    },
  };
  return { db: recorder as unknown as DatabaseSync, statements };
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

  it("rejects the current cleaned seed as targets before touching the database", async () => {
    const { db } = await seedOldDb();
    const before = snapshot(db);
    const cleaned = currentSeedBodies();

    // Default targets (data/seed/articles.json) and the same bodies passed explicitly.
    for (const options of [
      {},
      { apply: true },
      { articleTargets: cleaned },
      { apply: true, articleTargets: cleaned },
    ]) {
      const recorded = recordingDb(db);
      expect(() => runSeoGeoMinimalMigration(recorded.db, options)).toThrow(
        "Historical article target drifted: kak-avtomatizirovat-obrabotku-zayavok",
      );
      expect(recorded.statements).toEqual([]);
    }

    expect(snapshot(db)).toEqual(before);
    db.close();
  });

  it("rejects one altered or missing historical target before touching the database", async () => {
    const { db, newBodies } = await seedOldDb();
    const before = snapshot(db);
    const altered = {
      ...newBodies,
      "analiz-zvonkov-otdela-prodazh": `${newBodies["analiz-zvonkov-otdela-prodazh"]}\n`,
    };
    const missing = Object.fromEntries(
      Object.entries(newBodies).filter(([slug]) => slug !== "sayt-crm-i-messendzhery"),
    );

    for (const apply of [false, true]) {
      let recorded = recordingDb(db);
      expect(() =>
        runSeoGeoMinimalMigration(recorded.db, { apply, articleTargets: altered }),
      ).toThrow("Historical article target drifted: analiz-zvonkov-otdela-prodazh");
      expect(recorded.statements).toEqual([]);

      recorded = recordingDb(db);
      expect(() =>
        runSeoGeoMinimalMigration(recorded.db, { apply, articleTargets: missing }),
      ).toThrow("Historical article target missing: sayt-crm-i-messendzhery");
      expect(recorded.statements).toEqual([]);
    }

    expect(snapshot(db)).toEqual(before);
    db.close();
  });
});
