/**
 * `npm run db:migrate` — приводит схему базы к актуальной версии.
 *
 * Приложение делает то же самое при первом обращении к базе, поэтому отдельный запуск нужен там,
 * где схему хотят обновить ДО старта сервера (деплой, миграция на новой машине, CI).
 */
import { applyMigrations, openDatabase, resolveDbPath } from "./db-lib.mjs";

const db = openDatabase();
const executed = applyMigrations(db);
db.close();

console.log(`База: ${resolveDbPath()}`);
console.log(
  executed.length > 0
    ? `Применено миграций: ${executed.length} (${executed.join(", ")})`
    : "Схема уже актуальна, применять нечего.",
);
