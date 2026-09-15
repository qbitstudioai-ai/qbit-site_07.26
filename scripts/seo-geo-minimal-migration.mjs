import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, resolveDbPath } from "./db-lib.mjs";

export const PRODUCT_UPDATES = [
  {
    slug: "call-analysis",
    column: "seo_title",
    oldValue: "AI-контроль звонков: стоимость | QBit-Studio-Ai",
    newValue: "AI-анализ звонков: стоимость | QBit-Studio-Ai",
  },
  {
    slug: "ai-manager",
    column: "content.summary",
    oldValue:
      "AI-менеджер для сайта и мессенджеров — это система, которая принимает обращения, отвечает на частые вопросы, уточняет потребность клиента и передаёт подготовленную заявку менеджеру или в CRM.",
    newValue:
      "AI-менеджер и AI-чат-бот для сайта и мессенджеров — это система, которая принимает обращения, отвечает на частые вопросы, уточняет потребность клиента и передаёт подготовленную заявку менеджеру или в CRM.",
  },
  {
    slug: "leads-to-crm",
    column: "content.summary",
    oldValue:
      "Единый сбор заявок в CRM — это система, которая собирает обращения из разных каналов и автоматически создаёт контакты, сделки и задачи в CRM.",
    newValue:
      "Единый сбор заявок с сайта и мессенджеров в CRM — это система, которая собирает обращения из разных каналов и автоматически создаёт контакты, сделки и задачи в CRM.",
  },
];

export const ARTICLE_OLD_SHA256 = {
  "kak-avtomatizirovat-obrabotku-zayavok":
    "2bb61b421b669f22e56168cba3eb4c6df6e583b710d227d6d32a03cdc8cbd4eb",
  "ai-assistent-po-baze-znaniy": "30ed897afa3b21d39af3f0f4632b487fe2e57844a877896ecb8b12510cf82bec",
  "analiz-zvonkov-otdela-prodazh":
    "7d51bc31b276744596b5c38df214dffc9266419efd029cc8029e235354f3c62b",
  "avtomatizatsiya-dokumentov-s-ai":
    "3d0dfa1f9883e5d35ce2861c6d91fe108bcdd8690fa4e5f7717c41db3bf34382",
  "sayt-crm-i-messendzhery": "bdf965a015b00c1e98dd9a69678176b67ea1bc87a089e2430fa16ff697f4f19b",
  "chto-mozhno-avtomatizirovat-na-n8n":
    "26eb8d42b50dde3ca3b4c8763734946dd1c38afa2bd5ce30abd718f67aa537d4",
};

// Target bodies of this historical migration, frozen from data/seed/articles.json at 4be10e0 (before
// REL-02F.3a removed the legacy section from the seed). The seed is mutable, so a drifted target
// means the migration no longer describes the state it was written for: fail closed.
export const ARTICLE_TARGET_SHA256 = {
  "kak-avtomatizirovat-obrabotku-zayavok":
    "8a263af6877bc16733b8c6789946da096033571994048d044a44bb729a2b10a7",
  "ai-assistent-po-baze-znaniy": "3d3339d58b1b14ed5569eb85cfb0df1a8b68fa000498f58f1e3f9312ae2a5f97",
  "analiz-zvonkov-otdela-prodazh":
    "8bd4d1d047430bc6d27620c01faa86a478b760f7db55cfb67f652c6080d90231",
  "avtomatizatsiya-dokumentov-s-ai":
    "d726064fd5ff32eba78214d7130b74970d85ac2e6d8c2179386257b3110ac9e7",
  "sayt-crm-i-messendzhery": "5f1c5a6b4d3897e5d7c77717db91136d4516a3c96112185354f61606991d4246",
  "chto-mozhno-avtomatizirovat-na-n8n":
    "7d548ad393a6d3b4c21a94998e075a4e82886069eea82d945d5e8ea64c9c79f5",
};

const ARTICLE_SLUGS = Object.keys(ARTICLE_OLD_SHA256);

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

function assertHistoricalTargets(articleTargets) {
  for (const slug of ARTICLE_SLUGS) {
    const target = articleTargets?.[slug];
    if (typeof target !== "string") throw new Error(`Historical article target missing: ${slug}`);
    if (sha256(target) !== ARTICLE_TARGET_SHA256[slug]) {
      throw new Error(`Historical article target drifted: ${slug}`);
    }
  }
}

function readArticleTargets() {
  const articles = readJson("data/seed/articles.json");
  return Object.fromEntries(
    articles
      .filter((article) => ARTICLE_SLUGS.includes(article.slug))
      .map((article) => [article.slug, article.bodyMarkdown]),
  );
}

function readProductRow(db, slug) {
  return db
    .prepare("SELECT slug, seo_title, content, updated_at FROM products WHERE slug = ?")
    .get(slug);
}

function readArticleRow(db, slug) {
  return db
    .prepare("SELECT slug, body_markdown, updated_at FROM articles WHERE slug = ?")
    .get(slug);
}

function currentProductValue(row, column) {
  if (column === "seo_title") return row.seo_title;
  if (column === "content.summary") return JSON.parse(row.content).summary;
  throw new Error(`Unsupported product column: ${column}`);
}

function assertExpectedState({ db, articleTargets }) {
  const report = { products: [], articles: [] };

  for (const update of PRODUCT_UPDATES) {
    const row = readProductRow(db, update.slug);
    if (!row) throw new Error(`Missing product row: ${update.slug}`);

    const current = currentProductValue(row, update.column);
    if (current !== update.oldValue && current !== update.newValue) {
      throw new Error(`Unexpected ${update.column} for product ${update.slug}`);
    }

    report.products.push({
      slug: update.slug,
      column: update.column,
      state: current === update.newValue ? "new" : "old",
      willChange: current === update.oldValue,
      updatedAt: row.updated_at,
    });
  }

  for (const slug of ARTICLE_SLUGS) {
    const row = readArticleRow(db, slug);
    if (!row) throw new Error(`Missing article row: ${slug}`);

    const currentHash = sha256(row.body_markdown);
    const newHash = sha256(articleTargets[slug] ?? "");
    if (currentHash !== ARTICLE_OLD_SHA256[slug] && currentHash !== newHash) {
      throw new Error(`Unexpected body_markdown hash for article ${slug}`);
    }

    report.articles.push({
      slug,
      column: "body_markdown",
      state: currentHash === newHash ? "new" : "old",
      willChange: currentHash === ARTICLE_OLD_SHA256[slug],
      bodySha256: currentHash,
      updatedAt: row.updated_at,
    });
  }

  return report;
}

function applyProductUpdate(db, update) {
  const row = readProductRow(db, update.slug);

  if (update.column === "seo_title") {
    if (row.seo_title === update.newValue) return 0;
    return Number(
      db
        .prepare("UPDATE products SET seo_title = ? WHERE slug = ? AND seo_title = ?")
        .run(update.newValue, update.slug, update.oldValue).changes,
    );
  }

  const content = JSON.parse(row.content);
  if (content.summary === update.newValue) return 0;
  content.summary = update.newValue;
  return Number(
    db
      .prepare("UPDATE products SET content = ? WHERE slug = ? AND content = ?")
      .run(JSON.stringify(content), update.slug, row.content).changes,
  );
}

export function runSeoGeoMinimalMigration(
  db,
  { apply = false, articleTargets = readArticleTargets() } = {},
) {
  assertHistoricalTargets(articleTargets);
  const before = assertExpectedState({ db, articleTargets });
  if (!apply) return { mode: "dry-run", before, changed: { products: 0, articles: 0 } };

  let productChanges = 0;
  let articleChanges = 0;
  db.exec("BEGIN");
  try {
    for (const update of PRODUCT_UPDATES) {
      productChanges += applyProductUpdate(db, update);
    }

    for (const slug of ARTICLE_SLUGS) {
      const row = readArticleRow(db, slug);
      const currentHash = sha256(row.body_markdown);
      const newBody = articleTargets[slug];
      if (currentHash === sha256(newBody)) continue;
      articleChanges += Number(
        db
          .prepare("UPDATE articles SET body_markdown = ? WHERE slug = ? AND body_markdown = ?")
          .run(newBody, slug, row.body_markdown).changes,
      );
    }

    const after = assertExpectedState({ db, articleTargets });
    const notNew = [...after.products, ...after.articles].filter((item) => item.state !== "new");
    if (notNew.length > 0) {
      throw new Error(
        `Migration did not update expected rows: ${notNew.map((item) => item.slug).join(", ")}`,
      );
    }

    db.exec("COMMIT");
    return {
      mode: "apply",
      before,
      after,
      changed: { products: productChanges, articles: articleChanges },
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    const result = runSeoGeoMinimalMigration(db, { apply });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    db.close();
  }
}
