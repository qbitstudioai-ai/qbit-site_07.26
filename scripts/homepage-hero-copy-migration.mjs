/**
 * Разовая правка заголовка и подзаголовка первого экрана главной (обращение заказчика 04.09.2026).
 *
 * Зачем отдельный скрипт, а не правка `data/homepage-copy.json`. Тексты главной живут в базе
 * (`page_content.homepage`), а seed читается ТОЛЬКО когда записи в базе нет
 * (`src/server/content/homepage.ts`). На боевом сайте запись есть, поэтому одна правка seed'а
 * посетителю не видна. Редактора для `headline`/`subheadline` в админ-панели нет: `DepartmentsEditor`
 * правит тексты ОТДЕЛОВ, а не первого экрана, — значит, через интерфейс это тоже не поменять. Та же
 * причина, по которой существуют `scripts/homepage-cases-migration.mjs` и
 * `scripts/homepage-case-qualifiers-migration.mjs`.
 *
 * Что меняется: ровно два поля верхнего уровня — `headline` и `subheadline`.
 *
 * Чего скрипт НЕ делает намеренно:
 *   — не трогает `eyebrow`, `valuePoints`, кнопки, `heroInfoPanel` и любые другие поля;
 *   — не трогает `updated_at`. Дата главной в `sitemap.xml` остаётся прежней: обновление даты —
 *     отдельное SEO-решение, а в этом обращении заявлена только правка текста. Тот же выбор сделан
 *     в миграции подписей под цифрами.
 *
 * ВАЖНО про метаданные. `subheadline` — это одновременно видимый абзац под H1 и `description`
 * страницы (`src/app/page.tsx`: `const description = copy.subheadline`), а также `description`
 * в JSON-LD. Связь сделана намеренно, чтобы сниппет не расходился с содержимым страницы. Поэтому
 * применение этой миграции меняет и мета-описание главной. `<title>` не затрагивается вовсе — он
 * задан отдельной константой `HOME_SEO_TITLE`.
 *
 * Порядок относительно `homepage-case-qualifiers-migration.mjs` не важен: каждая миграция читает
 * строку заново и пишет под оптимистичной блокировкой по прежнему `content`.
 *
 * Запуск: `node scripts/homepage-hero-copy-migration.mjs` — сухой прогон (база открывается только
 * на чтение), `--apply` — запись. Повторный запуск после применения безопасен: скрипт видит уже
 * новое состояние и не делает ничего.
 */
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";

const PAGE_KEY = "homepage";

/**
 * Прежнее и новое значение каждого поля. Прежнее значение — не украшение, а условие: скрипт пишет
 * только поверх текста, который сам и ожидает увидеть. Любая другая формулировка означает, что
 * страницу правили после этой миграции, и перезаписывать её вслепую нельзя.
 */
const FIELDS = [
  {
    key: "headline",
    old: "Автоматизируем продажи, поддержку и документы с помощью ИИ",
    new: "Создаём системы, которые берут на себя часть работы вашего бизнеса без дополнительного найма.",
  },
  {
    key: "subheadline",
    old: "Находим ручные операции и потери между системами. Внедряем автоматизацию, которая ускоряет обработку заявок, снижает ошибки и освобождает сотрудников от рутины.",
    new: "Автоматизируем задачи и процессы компании — от работы с клиентами и документами до анализа звонков, поддержки и отчётности. Используем ИИ там, где он действительно полезен.",
  },
];

/**
 * Поля, которых правка касаться не должна, но перепутать с ними легко: `eyebrow` стоит прямо над
 * заголовком и тоже про автоматизацию. Сторож против промаха по соседнему полю.
 */
const UNTOUCHED = { eyebrow: "АВТОМАТИЗАЦИЯ БИЗНЕС-ПРОЦЕССОВ С ИИ" };

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

function readHomepageRow(db) {
  return db
    .prepare("SELECT page_key, content, updated_at FROM page_content WHERE page_key = ?")
    .get(PAGE_KEY);
}

/**
 * Состояние первого экрана: `old` — ещё прежние тексты, `new` — уже новые, иначе исключение.
 * Смешанное состояние (заголовок новый, подзаголовок старый) тоже отвергается: это признак ручной
 * правки, и дописывать поверх неё нельзя.
 */
function heroState(content) {
  const states = FIELDS.map((field) => {
    const value = content?.[field.key];
    if (value === field.old) return "old";
    if (value === field.new) return "new";
    throw new Error(`Unexpected ${field.key}: ${JSON.stringify(value)}`);
  });

  if (content?.eyebrow !== UNTOUCHED.eyebrow) {
    throw new Error(`Unexpected state of the untouched field "eyebrow"`);
  }

  const unique = [...new Set(states)];
  if (unique.length !== 1) throw new Error(`Mixed hero copy state: ${states.join(", ")}`);
  return unique[0];
}

function inspectHomepage(db) {
  const row = readHomepageRow(db);
  if (!row?.content) throw new Error("Missing page_content.homepage row");

  const content = JSON.parse(row.content);
  const state = heroState(content);
  return {
    state,
    updatedAt: row.updated_at,
    contentSha256: sha256(row.content),
    willChange: state === "old",
  };
}

/**
 * Запись БЕЗ управления транзакцией — её открывает вызывающая сторона.
 *
 * Разделение нужно ради `scripts/release-homepage-content.mjs`: релиз применяет три миграции и
 * сдвиг даты одной транзакцией, а вложенный `BEGIN` в SQLite невозможен. Отдельный запуск этого
 * файла по-прежнему получает собственную транзакцию — её открывает `runHomepageHeroCopyMigration`
 * ниже. Функция бросает исключение при любом расхождении; откатывает тот, кто открыл транзакцию.
 */
export function applyHomepageHeroCopyMigration(db) {
  const before = inspectHomepage(db);
  if (before.state === "new") return { before, after: before, changed: 0 };

  const row = readHomepageRow(db);
  const content = JSON.parse(row.content);
  for (const field of FIELDS) content[field.key] = field.new;
  const nextContent = JSON.stringify(content);

  // Условие `AND content = ?` — оптимистичная блокировка: если между чтением и записью строку
  // изменили из админ-панели, обновится ноль строк и транзакция откатится.
  const result = db
    .prepare("UPDATE page_content SET content = ? WHERE page_key = ? AND content = ?")
    .run(nextContent, PAGE_KEY, row.content);
  if (Number(result.changes) !== 1) {
    throw new Error(`Expected to update one homepage row, changed ${result.changes}`);
  }
  const after = inspectHomepage(db);
  if (after.state !== "new") throw new Error("Homepage hero copy migration did not apply");
  if (after.updatedAt !== before.updatedAt) throw new Error("updated_at changed unexpectedly");

  return { before, after, changed: Number(result.changes) };
}

export function runHomepageHeroCopyMigration(db, { apply = false } = {}) {
  const before = inspectHomepage(db);
  if (!apply) return { mode: "dry-run", before, changed: 0 };
  if (before.state === "new") return { mode: "apply", before, after: before, changed: 0 };

  db.exec("BEGIN");
  try {
    const result = applyHomepageHeroCopyMigration(db);
    db.exec("COMMIT");
    return { mode: "apply", before, after: result.after, changed: result.changed };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export { FIELDS, UNTOUCHED };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    console.log(JSON.stringify(runHomepageHeroCopyMigration(db, { apply }), null, 2));
  } finally {
    db.close();
  }
}
