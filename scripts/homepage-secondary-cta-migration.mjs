/**
 * Разовая правка надписи на контурной кнопке первого экрана (обращение заказчика 04.09.2026).
 *
 * «Найти потери в своём отделе» → «Посмотреть примеры».
 *
 * Зачем отдельный скрипт, а не правка `data/homepage-copy.json`. Тексты главной живут в базе
 * (`page_content.homepage`), а seed читается ТОЛЬКО когда записи в базе нет
 * (`src/server/content/homepage.ts`). На боевом сайте запись есть, поэтому одна правка seed'а
 * посетителю не видна.
 *
 * Почему отдельный файл, а не поле в `homepage-hero-copy-migration.mjs`. Та миграция уже применена
 * к локальной базе разработчика: добавь в неё третье поле — и она увидела бы смешанное состояние
 * (заголовок новый, кнопка старая) и отказалась бы писать. Разделение оставляет обе миграции
 * идемпотентными и позволяет применять их в любом порядке.
 *
 * ПОВЕДЕНИЕ КНОПКИ НЕ МЕНЯЕТСЯ — это решение заказчика. Кнопка по-прежнему разворачивает
 * интерактивный офис (`ACTIVATE_CTA`), а не ведёт в раздел примеров работ `/cases`. Расхождение
 * между надписью и действием известно и записано в `docs/04-homepage-copy.md`.
 *
 * Чего скрипт НЕ делает намеренно:
 *   — не трогает `primaryCta`, `ctaNote`, пункт меню «Найти потери» (`heroLinks`) и любые другие
 *     поля;
 *   — не трогает `updated_at`, поэтому дата главной в `sitemap.xml` остаётся прежней.
 *
 * Запуск: `node scripts/homepage-secondary-cta-migration.mjs` — сухой прогон (база открывается
 * только на чтение), `--apply` — запись. Повторный запуск после применения безопасен.
 */
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";

const PAGE_KEY = "homepage";

const FIELD = {
  key: "secondaryCta",
  old: "Найти потери в своём отделе",
  new: "Посмотреть примеры",
};

/**
 * Поля, которых правка касаться не должна, но перепутать с ними легко: соседний коммерческий CTA и
 * пункт меню, у которого надпись тоже начинается со слов «Найти потери». Сторож против промаха.
 */
const UNTOUCHED = {
  primaryCta: "Получить бесплатный разбор процессов",
  heroLinkLabel: "Найти потери",
};

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

function readHomepageRow(db) {
  return db
    .prepare("SELECT page_key, content, updated_at FROM page_content WHERE page_key = ?")
    .get(PAGE_KEY);
}

/**
 * Состояние кнопки: `old` — ещё прежняя надпись, `new` — уже новая, иначе исключение: значит,
 * надпись правил кто-то ещё, и перезаписывать её вслепую нельзя.
 *
 * Пункт меню проверяется мягко — ТОЛЬКО если он вообще есть в записи. `heroLinks` досбирается на
 * чтении (`withOfficeMapLink` в `src/server/content/homepage.ts`), поэтому в базе его может не
 * быть вовсе: это законное состояние, а не повод отказаться от правки.
 */
function ctaState(content) {
  const value = content?.[FIELD.key];
  const state = value === FIELD.old ? "old" : value === FIELD.new ? "new" : null;
  if (state === null) throw new Error(`Unexpected ${FIELD.key}: ${JSON.stringify(value)}`);

  if (content?.primaryCta !== UNTOUCHED.primaryCta) {
    throw new Error(`Unexpected state of the untouched field "primaryCta"`);
  }

  const heroLinks = content?.heroLinks;
  if (Array.isArray(heroLinks)) {
    const officeLink = heroLinks.filter((link) => link?.href === "/?section=office");
    if (
      officeLink.length > 1 ||
      (officeLink[0] && officeLink[0].label !== UNTOUCHED.heroLinkLabel)
    ) {
      throw new Error(`Unexpected state of the untouched menu item "${UNTOUCHED.heroLinkLabel}"`);
    }
  }

  return state;
}

function inspectHomepage(db) {
  const row = readHomepageRow(db);
  if (!row?.content) throw new Error("Missing page_content.homepage row");

  const content = JSON.parse(row.content);
  const state = ctaState(content);
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
 * файла по-прежнему получает собственную транзакцию — её открывает `runHomepageSecondaryCtaMigration`
 * ниже. Функция бросает исключение при любом расхождении; откатывает тот, кто открыл транзакцию.
 */
export function applyHomepageSecondaryCtaMigration(db) {
  const before = inspectHomepage(db);
  if (before.state === "new") return { before, after: before, changed: 0 };

  const row = readHomepageRow(db);
  const content = JSON.parse(row.content);
  content[FIELD.key] = FIELD.new;
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
  if (after.state !== "new") throw new Error("Homepage secondary CTA migration did not apply");
  if (after.updatedAt !== before.updatedAt) throw new Error("updated_at changed unexpectedly");

  return { before, after, changed: Number(result.changes) };
}

export function runHomepageSecondaryCtaMigration(db, { apply = false } = {}) {
  const before = inspectHomepage(db);
  if (!apply) return { mode: "dry-run", before, changed: 0 };
  if (before.state === "new") return { mode: "apply", before, after: before, changed: 0 };

  db.exec("BEGIN");
  try {
    const result = applyHomepageSecondaryCtaMigration(db);
    db.exec("COMMIT");
    return { mode: "apply", before, after: result.after, changed: result.changed };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export { FIELD, UNTOUCHED };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    console.log(JSON.stringify(runHomepageSecondaryCtaMigration(db, { apply }), null, 2));
  } finally {
    db.close();
  }
}
