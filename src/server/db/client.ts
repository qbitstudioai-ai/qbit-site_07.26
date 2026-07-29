import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "../config";
import { migrations } from "./schema.mjs";

/**
 * Соединение с базой контента.
 *
 * SQLite через встроенный модуль `node:sqlite` — постоянное хранилище без внешних зависимостей и
 * без нативной сборки. База лежит файлом в `var/` (см. `src/server/config.ts`), то есть переживает
 * пересборку и перезапуск сервера; на production директория монтируется томом.
 *
 * Модуль СЕРВЕРНЫЙ: `node:sqlite` и файловая система существуют только на сервере. Импортировать
 * его из "use client"-компонента нельзя — по той же договорённости, что и остальной код в
 * `src/server/**` (см. DECISIONS.md, Step 2).
 */

declare global {
  // Dev-режим Next.js перезагружает модули при каждом изменении файла. Без кэша в globalThis это
  // означало бы новое соединение (и новый прогон миграций) на каждый HMR-цикл.
  var __qbitDatabase: DatabaseSync | undefined;
}

function applyMigrations(db: DatabaseSync): void {
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
      .map((row) => Number((row as { version: number }).version)),
  );

  migrations.forEach((migration, index) => {
    const version = index + 1;
    if (applied.has(version)) return;

    // Каждая миграция — одна транзакция: частично применённая схема хуже неприменённой.
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        version,
        migration.name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}

function createDatabase(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  // WAL — параллельное чтение публичными страницами во время записи из админ-панели.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  applyMigrations(db);

  return db;
}

export function getDatabase(): DatabaseSync {
  if (!globalThis.__qbitDatabase) {
    globalThis.__qbitDatabase = createDatabase();
  }
  return globalThis.__qbitDatabase;
}

/** Выполняет функцию в транзакции: любая ошибка внутри откатывает все записи. */
export function transaction<T>(run: () => T): T {
  const db = getDatabase();
  db.exec("BEGIN");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Безопасный разбор JSON-колонки: битая запись не должна ронять публичную страницу. */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
