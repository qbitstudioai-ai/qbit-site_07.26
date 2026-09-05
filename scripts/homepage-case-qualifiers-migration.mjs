/**
 * Разовая правка подписей под цифрами в блоке «РЕАЛЬНЫЕ КЕЙСЫ» на главной.
 *
 * Зачем отдельный скрипт, а не правка `data/homepage-copy.json`. Тексты главной живут в базе
 * (`page_content.homepage`), а seed читается ТОЛЬКО когда записи в базе нет
 * (`src/server/content/homepage.ts`). На боевом сайте запись есть, поэтому одна правка seed'а
 * посетителю не видна — ровно та же причина, по которой существует
 * `scripts/homepage-cases-migration.mjs`. Редактора для `heroInfoPanel` в админ-панели нет, так
 * что через интерфейс это тоже не поменять.
 *
 * Что меняется: поле `qualifier` у первого и третьего сценария. Первый его вовсе не имел, у
 * третьего была подпись про прошлое («раньше занимал ручной анализ») — заказчик заменил обе на
 * формулировки об экономии времени. Второй сценарий («рост продаж») не трогается.
 *
 * Чего скрипт НЕ делает намеренно:
 *   — не трогает `updated_at`, поэтому дата главной в `sitemap.xml` остаётся прежней (правка
 *     подписей не заявлена как обновление страницы для поисковых систем);
 *   — не трогает ни одно другое поле сценариев, весь остальной `heroInfoPanel` и прочие тексты.
 *
 * Запуск: `node scripts/homepage-case-qualifiers-migration.mjs` — сухой прогон (база открывается
 * только на чтение), `--apply` — запись. Повторный запуск после применения безопасен: скрипт
 * видит уже новое состояние и не делает ничего.
 */
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";

const PAGE_KEY = "homepage";

/**
 * Опознавательные знаки сценариев. Индекс сам по себе ненадёжен: владелец сайта мог поменять
 * порядок. Совпасть обязаны и `metric`, и `title` — иначе скрипт откажется писать.
 */
const TARGETS = [
  {
    metric: "20–25",
    title: "Контроль качества работы менеджеров",
    /** Подписи не было вовсе. */
    oldQualifier: undefined,
    newQualifier: "экономия времени руководителю на изучение отчётов",
  },
  {
    metric: "75–80",
    title: "Анализ работы полевой команды",
    oldQualifier: "раньше занимал ручной анализ",
    newQualifier: "экономия времени на анализе отчётов",
  },
];

/** Сценарий, который правка обязана оставить нетронутым. Сторож против промаха по индексу. */
const UNTOUCHED = { metric: "500–700 тыс.", qualifier: "рост продаж" };

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

function readHomepageRow(db) {
  return db
    .prepare("SELECT page_key, content, updated_at FROM page_content WHERE page_key = ?")
    .get(PAGE_KEY);
}

function findScenario(scenarios, target) {
  const matches = scenarios.filter(
    (scenario) => scenario?.metric === target.metric && scenario?.title === target.title,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one scenario "${target.metric} / ${target.title}", found ${matches.length}`,
    );
  }
  return matches[0];
}

/**
 * Состояние блока: `old` — ещё старые подписи, `new` — уже новые, иначе исключение. Смешанное
 * состояние (одна подпись новая, другая старая) тоже отвергается: это признак ручной правки на
 * сервере, и дописывать поверх неё вслепую нельзя.
 */
function panelState(scenarios) {
  const states = TARGETS.map((target) => {
    const scenario = findScenario(scenarios, target);
    if (scenario.qualifier === target.oldQualifier) return "old";
    if (scenario.qualifier === target.newQualifier) return "new";
    throw new Error(
      `Unexpected qualifier for scenario "${target.metric}": ${JSON.stringify(scenario.qualifier)}`,
    );
  });

  const untouched = scenarios.filter((scenario) => scenario?.metric === UNTOUCHED.metric);
  if (untouched.length !== 1 || untouched[0].qualifier !== UNTOUCHED.qualifier) {
    throw new Error(`Unexpected state of the untouched scenario "${UNTOUCHED.metric}"`);
  }

  const unique = [...new Set(states)];
  if (unique.length !== 1) throw new Error(`Mixed qualifier state: ${states.join(", ")}`);
  return unique[0];
}

function inspectHomepage(db) {
  const row = readHomepageRow(db);
  if (!row?.content) throw new Error("Missing page_content.homepage row");

  const content = JSON.parse(row.content);
  const scenarios = content?.heroInfoPanel?.scenarios;
  if (!Array.isArray(scenarios)) throw new Error("Missing heroInfoPanel.scenarios");

  const state = panelState(scenarios);
  return {
    state,
    updatedAt: row.updated_at,
    contentSha256: sha256(row.content),
    willChange: state === "old",
  };
}

/**
 * Пересобирает сценарий так, чтобы `qualifier` стоял сразу после `unit` — как во всех остальных
 * сценариях и в `data/homepage-copy.json`. Порядок ключей на отображение не влияет, но разъехавшийся
 * порядок мешает читать diff базы глазами при следующем разборе.
 */
function withQualifier(scenario, qualifier) {
  const next = {};
  for (const [key, value] of Object.entries(scenario)) {
    if (key === "qualifier") continue;
    next[key] = value;
    if (key === "unit") next.qualifier = qualifier;
  }
  if (!Object.hasOwn(next, "qualifier")) next.qualifier = qualifier;
  return next;
}

/**
 * Запись БЕЗ управления транзакцией — её открывает вызывающая сторона.
 *
 * Разделение нужно ради `scripts/release-homepage-content.mjs`: релиз применяет три миграции и
 * сдвиг даты одной транзакцией, а вложенный `BEGIN` в SQLite невозможен. Отдельный запуск этого
 * файла по-прежнему получает собственную транзакцию — её открывает `runHomepageCaseQualifiersMigration`
 * ниже. Функция бросает исключение при любом расхождении; откатывает тот, кто открыл транзакцию.
 */
export function applyHomepageCaseQualifiersMigration(db) {
  const before = inspectHomepage(db);
  if (before.state === "new") return { before, after: before, changed: 0 };

  const row = readHomepageRow(db);
  const content = JSON.parse(row.content);
  content.heroInfoPanel = {
    ...content.heroInfoPanel,
    scenarios: content.heroInfoPanel.scenarios.map((scenario) => {
      const target = TARGETS.find(
        (candidate) => candidate.metric === scenario?.metric && candidate.title === scenario?.title,
      );
      return target ? withQualifier(scenario, target.newQualifier) : scenario;
    }),
  };
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
  if (after.state !== "new") throw new Error("Homepage qualifiers migration did not apply");
  if (after.updatedAt !== before.updatedAt) throw new Error("updated_at changed unexpectedly");

  return { before, after, changed: Number(result.changes) };
}

export function runHomepageCaseQualifiersMigration(db, { apply = false } = {}) {
  const before = inspectHomepage(db);
  if (!apply) return { mode: "dry-run", before, changed: 0 };
  if (before.state === "new") return { mode: "apply", before, after: before, changed: 0 };

  db.exec("BEGIN");
  try {
    const result = applyHomepageCaseQualifiersMigration(db);
    db.exec("COMMIT");
    return { mode: "apply", before, after: result.after, changed: result.changed };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export { TARGETS, UNTOUCHED };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    console.log(JSON.stringify(runHomepageCaseQualifiersMigration(db, { apply }), null, 2));
  } finally {
    db.close();
  }
}
