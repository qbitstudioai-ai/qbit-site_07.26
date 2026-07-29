/**
 * Общая часть скриптов `db:migrate` и `db:seed`: открытие базы и применение миграций.
 *
 * Схема берётся из того же модуля, что использует приложение (`src/server/db/schema.mjs`), поэтому
 * «схема в коде» и «схема в скриптах» не могут разойтись.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "../src/server/db/schema.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

export function resolveDataDir() {
  return process.env.QBIT_DATA_DIR
    ? path.resolve(process.env.QBIT_DATA_DIR)
    : path.join(projectRoot, "var");
}

export function resolveDbPath() {
  return process.env.QBIT_DB_PATH
    ? path.resolve(process.env.QBIT_DB_PATH)
    : path.join(resolveDataDir(), "content.db");
}

export function resolveUploadsDir() {
  return process.env.QBIT_UPLOADS_DIR
    ? path.resolve(process.env.QBIT_UPLOADS_DIR)
    : path.join(resolveDataDir(), "uploads");
}

export { projectRoot };

export function openDatabase() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

/** @returns {string[]} названия применённых на этом запуске миграций */
export function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => Number(row.version)),
  );

  const executed = [];
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
      executed.push(migration.name);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });

  return executed;
}

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

export const nowIso = () => new Date().toISOString();
