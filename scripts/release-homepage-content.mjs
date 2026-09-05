/**
 * Единственная точка применения контентных правок главной при релизе.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ ВООБЩЕ СУЩЕСТВУЕТ. Тексты главной живут в базе (`page_content.homepage`), а seed
 * `data/homepage-copy.json` читается ТОЛЬКО когда записи в базе нет. Значит, после выкатки кода
 * посетитель увидит СТАРЫЙ текст, пока по базе не пройдут разовые миграции. Раньше их полагалось
 * запускать руками, и это ровно тот шаг, который забывают: тесты зелёные, документы обновлены,
 * сайт показывает прошлую редакцию. Здесь три миграции сведены в одну идемпотентную команду,
 * которую вызывает `deploy.sh`, — забыть её больше нельзя.
 *
 * ПОРЯДОК ФИКСИРОВАН. Технически он безразличен: миграции правят непересекающиеся поля и каждая
 * читает строку заново под оптимистичной блокировкой. Но «безразличен» и «не записан» — разные
 * вещи: зафиксированный порядок делает вывод команды воспроизводимым и сравнимым между релизами.
 *
 * ЧТО С `updated_at` И ПОЧЕМУ ЭТО ВАЖНО. Сами миграции его не трогают сознательно: правка подписи
 * под цифрой — не повод объявлять поисковым системам, что страница изменилась. Но релиз, в котором
 * переписаны H1 и первый абзац, — повод. Поэтому дату двигает ЭТОТ скрипт, и только когда правка
 * действительно применилась на этом запуске (или по явному `--touch`). Следствие: повторный деплой
 * ничего не меняет и дату не сдвигает, поэтому шаг можно держать в `deploy.sh` постоянно.
 *
 * `page_content.homepage.updated_at` — источник `lastmod` главной в `sitemap.xml`
 * (`homepageLastModified()` в `src/server/content/lastModified.ts` берёт максимум из этой даты и
 * дат опубликованных отделов). Даты остальных страниц лежат в своих строках `page_content` и
 * здесь не затрагиваются.
 *
 * Запуск:
 *
 *   node scripts/release-homepage-content.mjs            — сухой прогон, база открыта только на чтение
 *   node scripts/release-homepage-content.mjs --apply     — применить и, если что-то изменилось, сдвинуть дату
 *   node scripts/release-homepage-content.mjs --apply --touch
 *                                                        — сдвинуть дату, даже если миграции уже применены
 *                                                          (нужно, только если их прогнали руками до релиза)
 *
 * Код возврата: 0 — успех (в том числе «уже применено»), 1 — любая остановка. Остановка означает,
 * что база в состоянии, которого скрипт не ожидал (текст правили в обход миграций), и решение
 * принимает человек.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";
import {
  applyHomepageCaseQualifiersMigration,
  runHomepageCaseQualifiersMigration,
} from "./homepage-case-qualifiers-migration.mjs";
import {
  applyHomepageHeroCopyMigration,
  runHomepageHeroCopyMigration,
} from "./homepage-hero-copy-migration.mjs";
import {
  applyHomepageSecondaryCtaMigration,
  runHomepageSecondaryCtaMigration,
} from "./homepage-secondary-cta-migration.mjs";

const PAGE_KEY = "homepage";

/**
 * Порядок применения. Менять его без причины не нужно — см. док-комментарий выше.
 *
 * У каждого шага две формы. `apply` — запись БЕЗ собственной транзакции: её открывает релиз, чтобы
 * все три правки и сдвиг даты легли одной транзакцией. `inspect` — только чтение, для сухого
 * прогона; используется форма с `apply: false`, которая ничего не пишет.
 */
export const RELEASE_STEPS = [
  {
    name: "case-qualifiers",
    apply: applyHomepageCaseQualifiersMigration,
    inspect: runHomepageCaseQualifiersMigration,
  },
  {
    name: "hero-copy",
    apply: applyHomepageHeroCopyMigration,
    inspect: runHomepageHeroCopyMigration,
  },
  {
    name: "secondary-cta",
    apply: applyHomepageSecondaryCtaMigration,
    inspect: runHomepageSecondaryCtaMigration,
  },
];

function readUpdatedAt(db) {
  const row = db.prepare("SELECT updated_at FROM page_content WHERE page_key = ?").get(PAGE_KEY);
  if (!row?.updated_at) throw new Error("Missing page_content.homepage row");
  return String(row.updated_at);
}

/**
 * Сдвиг даты изменения главной на момент релиза.
 *
 * Три предосторожности. Первая — дата не едет назад: если в базе уже стоит более поздняя (правка
 * из админ-панели во время релиза, расхождение часов сервера), она остаётся. `lastmod`, уехавший
 * в прошлое, поисковая система читает как «страница откатилась». Вторая — оптимистичная блокировка
 * по прежнему значению: параллельная запись из админ-панели не будет затёрта. Третья — правится
 * ТОЛЬКО строка `homepage`: у остальных страниц свои строки, и условие `page_key = ?` их не
 * задевает.
 */
function touchUpdatedAt(db, { now = new Date().toISOString() } = {}) {
  const before = readUpdatedAt(db);
  if (before >= now) {
    return { moved: false, reason: "в базе уже более поздняя дата", before, after: before };
  }

  const result = db
    .prepare("UPDATE page_content SET updated_at = ? WHERE page_key = ? AND updated_at = ?")
    .run(now, PAGE_KEY, before);
  if (Number(result.changes) !== 1) {
    throw new Error(`Expected to touch one homepage row, changed ${result.changes}`);
  }
  const after = readUpdatedAt(db);
  if (after !== now) throw new Error("updated_at was not written");
  return { moved: true, before, after };
}

/**
 * Применение релиза. При `apply` — ОДНА транзакция на все четыре операции: три правки текста и
 * сдвиг `updated_at`. Любая ошибка откатывает всё; полуприменённого состояния не бывает.
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ apply?: boolean, touch?: boolean, now?: string, steps?: typeof RELEASE_STEPS }} [options]
 *   `now` и `steps` задаются только тестами: `now` фиксирует дату (в бою она берётся из системных
 *   часов), `steps` позволяет подставить падающий шаг и проверить откат.
 */
export function runHomepageContentRelease(
  db,
  { apply = false, touch = false, now, steps: releaseSteps = RELEASE_STEPS } = {},
) {
  // Сухой прогон: только чтение, транзакция не нужна и не открывается — база при запуске из CLI
  // открыта `readOnly`, и `BEGIN` там был бы лишним риском.
  if (!apply) {
    const steps = releaseSteps.map((step) => {
      const result = step.inspect(db, { apply: false });
      return { step: step.name, state: result.before.state, changed: 0 };
    });
    const updatedAt = readUpdatedAt(db);
    return {
      mode: "dry-run",
      changed: 0,
      steps,
      lastmod: { moved: false, reason: "сухой прогон", before: updatedAt, after: updatedAt },
      homepageUpdatedAt: updatedAt,
    };
  }

  const steps = [];
  let changed = 0;

  // ОДНА транзакция на все четыре операции: три правки текста и сдвиг даты. Так релиз становится
  // «всё или ничего» — падение на любом шаге откатывает и предыдущие. До этого каждая миграция
  // коммитила себя сама, и ошибка на третьем шаге оставляла первые два применёнными: на сайте
  // оказывался наполовину новый первый экран, и понять это по коду возврата было нельзя.
  //
  // Вложенный `BEGIN` в SQLite невозможен, поэтому шаги вызываются в форме `apply` — без
  // собственного управления транзакцией (см. `applyHomepage*Migration` в файлах миграций).
  db.exec("BEGIN");
  try {
    for (const step of releaseSteps) {
      const result = step.apply(db);
      steps.push({ step: step.name, state: result.before.state, changed: result.changed });
      changed += result.changed;
    }

    const updatedAtBefore = readUpdatedAt(db);
    const lastmod =
      changed > 0 || touch
        ? touchUpdatedAt(db, now ? { now } : {})
        : {
            moved: false,
            reason: "миграции ничего не изменили и --touch не задан",
            before: updatedAtBefore,
            after: updatedAtBefore,
          };

    db.exec("COMMIT");
    return {
      mode: "apply",
      changed,
      steps,
      lastmod,
      // `lastmod` главной в sitemap.xml берёт максимум из этой даты и дат опубликованных отделов,
      // поэтому итоговое значение в карте сайта может оказаться позднее.
      homepageUpdatedAt: lastmod.after,
    };
  } catch (error) {
    // Откат в собственном `try`, и это не перестраховка. Часть ошибок SQLite (нехватка места,
    // ошибка ввода-вывода) откатывает транзакцию сама, и тогда явный `ROLLBACK` бросит «cannot
    // rollback — no transaction is active». Без этой обёртки наружу ушла бы ЭТА ошибка вместо
    // настоящей причины, а `deploy.sh` показал бы оператору не тот диагноз. Данные при таком
    // раскладе всё равно откачены — самой СУБД.
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      error.rollbackNote = `откат вернул: ${rollbackError.message}`;
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const touch = process.argv.includes("--touch");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    console.log(JSON.stringify(runHomepageContentRelease(db, { apply, touch }), null, 2));
  } catch (error) {
    console.error(`\nОстановлено: ${error.message}`);
    if (error.rollbackNote) console.error(error.rollbackNote);
    console.error(
      "Изменения НЕ применены: транзакция откачена целиком, база в прежнем состоянии.\n" +
        "Обычная причина — тексты главной правили в обход миграций. Разберитесь сухим прогоном\n" +
        "(без --apply) и решите вручную; вслепую перезаписывать нельзя.",
    );
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
