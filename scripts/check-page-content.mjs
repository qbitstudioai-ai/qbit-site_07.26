/**
 * `node scripts/check-page-content.mjs` — проверка записей `page_content` на соответствие схемам.
 *
 * Появился по итогам аудита 2026-07-27 (SEC-09): до него общие тексты страниц сохранялись без
 * структурной проверки, поэтому в базе могла осесть запись, роняющая публичную страницу.
 *
 * Скрипт РЕЖИМЕ ТОЛЬКО ЧТЕНИЯ по умолчанию: база открывается `readOnly`, ничего не изменяется.
 * Он перечисляет негодные записи и поля, из-за которых они негодны.
 *
 *   node scripts/check-page-content.mjs             — проверить и показать отчёт
 *   node scripts/check-page-content.mjs --verbose   — показать также усечённые значения полей
 *
 * Значения по умолчанию НЕ печатаются: содержимое страниц может включать данные, которых в выводе
 * консоли и в логах быть не должно. С `--verbose` они усекаются до 80 символов.
 *
 * Скрипт ничего не чинит намеренно. Негодная запись безопасна: читатели в `src/server/content/*`
 * подставляют seed-тексты, страница работает. Решение, чем заменить содержимое, принимает владелец
 * сайта через админ-панель — угадывать его тексты скрипт не вправе.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const dbPath = process.env.QBIT_DB_PATH
  ? path.resolve(process.env.QBIT_DB_PATH)
  : path.join(process.env.QBIT_DATA_DIR ?? path.join(projectRoot, "var"), "content.db");

const verbose = process.argv.includes("--verbose");

/**
 * Схемы живут в TypeScript (`src/server/content/pageContentSchemas.ts`) и напрямую отсюда не
 * импортируются: скрипт должен запускаться без сборки. Здесь описана та же форма — набор полей на
 * страницу.
 *
 * Это ВТОРОЙ источник истины, и его расхождение со схемами автоматически не ловится. Скрипт —
 * вспомогательная диагностика, а не гейт: решение принимают схемы приложения. При изменении формы
 * страницы список ниже нужно поправить вручную.
 */
const REQUIRED_FIELDS = {
  products: [
    "eyebrow",
    "headline",
    "seoTitle",
    "seoDescription",
    "priceColumnLabel",
    "moreLabel",
    "sectionHeadings.applies",
    "sectionHeadings.examples",
    "sectionHeadings.prices",
    "sectionHeadings.benefit",
    "tabs.overview",
    "tabs.examples",
    "tabs.prices",
    "tabs.benefit",
    "implementationFormats.title",
    "implementationFormats.items",
    "implementationFormats.note",
  ],
  documents: ["headline", "subheading", "emptyMessage", "seoDescription"],
  blog: ["eyebrow", "headline", "railTitle", "seoDescription"],
  contacts: [
    "eyebrow",
    "heading",
    "subheading",
    "intro",
    "contactsHeading",
    "formHeading",
    "formDescription",
    "companyName",
    "address",
    "workingHours",
  ],
  // homepage проверяется отдельной схемой в приложении: полей там несколько десятков, и
  // дублировать их список здесь значило бы заводить второй источник истины.
  homepage: [],
};

/**
 * Потолки длины из `pageContentSchemas.ts`: `line` = 300, `paragraph` = 2000. Поля-абзацы
 * перечислены явно, остальные считаются однострочными.
 */
const DEFAULT_LENGTH_LIMIT = 300;
const LENGTH_LIMITS = {
  seoDescription: 2000,
  subheading: 2000,
  emptyMessage: 2000,
  intro: 2000,
  formDescription: 2000,
  address: 2000,
  "implementationFormats.note": 2000,
};

function valueAt(object, dottedPath) {
  return dottedPath.split(".").reduce((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    return current[part];
  }, object);
}

function describe(value) {
  if (value === undefined) return "отсутствует";
  if (value === null) return "null";
  if (Array.isArray(value)) return `массив (${value.length})`;
  return typeof value;
}

function truncate(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof text !== "string") return String(text);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function main() {
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
  } catch (error) {
    console.error(`Не удалось открыть базу ${dbPath}: ${error.message}`);
    process.exit(2);
  }

  let rows;
  try {
    rows = db.prepare("SELECT page_key, content, updated_at FROM page_content").all();
  } catch (error) {
    console.error(`Не удалось прочитать page_content: ${error.message}`);
    db.close();
    process.exit(2);
  }

  console.log(`База: ${dbPath}`);
  console.log(`Записей page_content: ${rows.length}\n`);

  let broken = 0;

  for (const row of rows) {
    const pageKey = String(row.page_key);
    const problems = [];

    let content;
    try {
      content = JSON.parse(String(row.content));
    } catch {
      problems.push("содержимое не разбирается как JSON");
    }

    if (content !== undefined) {
      if (content === null || typeof content !== "object" || Array.isArray(content)) {
        problems.push(`ожидается объект, получено: ${describe(content)}`);
      } else {
        for (const field of REQUIRED_FIELDS[pageKey] ?? []) {
          const value = valueAt(content, field);
          const isArrayField = field.endsWith("items");
          // Пустая строка — законный редакторский выбор и рендер не роняет; проверяется ТИП.
          const valid = isArrayField
            ? Array.isArray(value) && value.every((item) => typeof item === "string")
            : typeof value === "string";

          if (!valid) {
            problems.push(
              `${field}: ${describe(value)}${verbose && value !== undefined ? ` → ${truncate(value)}` : ""}`,
            );
            continue;
          }

          // Потолки длины из схем приложения: без них скрипт объявлял бы OK запись, которую
          // приложение отвергнет при сохранении.
          const limit = LENGTH_LIMITS[field] ?? DEFAULT_LENGTH_LIMIT;
          if (typeof value === "string" && value.length > limit) {
            problems.push(`${field}: длина ${value.length} превышает потолок ${limit}`);
          }
          if (isArrayField && Array.isArray(value)) {
            if (value.length > 20) {
              problems.push(`${field}: элементов ${value.length}, потолок 20`);
            }
            // Каждый элемент в схеме — `line(...)`, то есть не длиннее 300 символов.
            const tooLong = value.filter((item) => item.length > DEFAULT_LENGTH_LIMIT).length;
            if (tooLong > 0) {
              problems.push(`${field}: ${tooLong} элем. длиннее ${DEFAULT_LENGTH_LIMIT} символов`);
            }
          }
        }
      }
    }

    if (!Object.hasOwn(REQUIRED_FIELDS, pageKey)) {
      console.log(`  ? ${pageKey} — неизвестный ключ, ни одна страница его не читает`);
    } else if (REQUIRED_FIELDS[pageKey].length === 0) {
      // Честнее промолчать, чем написать OK: список полей homepage здесь не дублируется, значит
      // скрипт эту запись НЕ проверял. Раньше она печаталась как OK — ложное успокоение
      // (найдено code review 2026-07-27).
      console.log(
        `  — ${pageKey} — скриптом не проверяется, только схемой приложения (обновлено ${row.updated_at})`,
      );
    } else if (problems.length === 0) {
      console.log(`  OK       ${pageKey} (обновлено ${row.updated_at})`);
    } else {
      broken += 1;
      console.log(`  ПРОБЛЕМА ${pageKey} (обновлено ${row.updated_at})`);
      for (const problem of problems) console.log(`             — ${problem}`);
    }
  }

  const unknown = rows
    .map((row) => String(row.page_key))
    .filter((key) => !Object.hasOwn(REQUIRED_FIELDS, key));
  if (unknown.length > 0) {
    console.log(
      `\nЗаписи с неизвестным ключом страницы (не читаются ни одной страницей): ${unknown.join(", ")}`,
    );
  }

  db.close();

  // Формулировка не должна обещать больше, чем скрипт проверил: часть записей он не смотрит вовсе
  // (homepage) или не знает (неизвестный ключ). Раньше итог всё равно гласил «Все записи
  // соответствуют схемам» — то же самое over-claiming, ради снятия которого правился вывод выше.
  const unchecked = rows.filter((row) => {
    const key = String(row.page_key);
    return !Object.hasOwn(REQUIRED_FIELDS, key) || REQUIRED_FIELDS[key].length === 0;
  }).length;

  if (broken > 0) {
    console.log(
      `\nНегодных записей: ${broken}. Публичные страницы при этом работают — читатели подставляют исходные тексты из data/seed/. Исправьте содержимое в админ-панели.`,
    );
  } else if (unchecked > 0) {
    console.log(
      `\nПроверенные записи соответствуют схемам. Не проверялось скриптом: ${unchecked} — их проверяет только приложение при сохранении и при чтении.`,
    );
  } else {
    console.log("\nВсе записи соответствуют схемам.");
  }

  // Ненулевой код — чтобы проверку можно было поставить в конвейер развёртывания.
  process.exit(broken === 0 ? 0 : 1);
}

main();
