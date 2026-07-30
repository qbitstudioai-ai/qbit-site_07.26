import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "./db-lib.mjs";

const PAGE_KEY = "homepage";

export const OLD_PANEL = {
  title: "ПРОЕКТНЫЕ СЦЕНАРИИ",
  subtitle: "Примеры решений и расчётный бизнес-эффект",
  scenarios: [
    {
      metric: "20–25",
      unit: "ч/мес",
      title: "Контроль качества работы менеджеров",
      description:
        "ИИ анализирует телефонные разговоры и каждый понедельник формирует отчёт о сильных сторонах, ошибках и точках роста сотрудников.",
      detail: "Руководителю достаточно около 15 минут для изучения отчёта.",
      effectLabel: "Расчётный эффект для руководителя",
    },
    {
      metricPrefix: "до",
      metric: "700 000",
      unit: "₽/мес",
      qualifier: "потенциальной выручки",
      title: "Возврат упущенных продаж",
      description:
        "Заявки из разных каналов автоматически распределяются в CRM, а перед планёркой руководитель получает список сделок и клиентов, требующих внимания.",
      effectLabel: "Расчётный потенциал на основе данных CRM",
    },
    {
      metricPrefix: "до",
      metric: "75–80",
      unit: "ч/мес",
      title: "Анализ работы полевой команды",
      description:
        "Система обрабатывает до 10 000 отчётов в месяц и формирует для руководителей сводку по посещениям, отклонениям и работе территориальных менеджеров.",
      detail: "Четыре руководителя получают общую картину примерно за 15 минут в неделю.",
      effectLabel: "Расчётный эффект для четырёх руководителей",
    },
  ],
};

export const NEW_PANEL = {
  title: "РЕАЛЬНЫЕ КЕЙСЫ",
  subtitle: "Обезличенные результаты внедрений",
  scenarios: [
    {
      metric: "20–25",
      unit: "ч/мес",
      title: "Контроль качества работы менеджеров",
      description:
        "Раньше руководитель тратил 4–5 часов в неделю на прослушивание звонков. Теперь ИИ каждый понедельник формирует отчёт о сильных сторонах, ошибках и точках роста.",
      detail: "Изучение отчёта занимает 10–15 минут.",
      effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
    },
    {
      metric: "500–700 тыс.",
      unit: "₽/мес",
      qualifier: "рост продаж",
      title: "Возврат упущенных продаж",
      description:
        "Заявки из почты и мессенджеров автоматически фиксируются в CRM и больше не остаются вне контроля. По данным клиента, продажи выросли на 500 000–700 000 ₽ в месяц.",
      effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
    },
    {
      metric: "75–80",
      unit: "ч/мес",
      qualifier: "раньше занимал ручной анализ",
      title: "Анализ работы полевой команды",
      description:
        "Для команды из 50 менеджеров система обрабатывает около 10 000 строк отчётов в месяц и формирует сводки по подразделениям.",
      detail: "Руководители изучают ежедневную сводку примерно за 10 минут.",
      effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
    },
  ],
};

const stableStringify = (value) => JSON.stringify(value);
const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");
const panelCore = (panel) => ({
  title: panel?.title,
  subtitle: panel?.subtitle,
  scenarios: panel?.scenarios,
});

function readHomepageRow(db) {
  return db
    .prepare("SELECT page_key, content, updated_at FROM page_content WHERE page_key = ?")
    .get(PAGE_KEY);
}

function panelState(panel) {
  const serialized = stableStringify(panelCore(panel));
  if (serialized === stableStringify(OLD_PANEL)) return "old";
  if (serialized === stableStringify(NEW_PANEL)) return "new";
  return "unexpected";
}

function inspectHomepage(db) {
  const row = readHomepageRow(db);
  if (!row?.content) throw new Error("Missing page_content.homepage row");

  const content = JSON.parse(row.content);
  const state = panelState(content.heroInfoPanel);
  if (state === "unexpected") {
    throw new Error("Unexpected page_content.homepage.heroInfoPanel state");
  }

  return {
    state,
    updatedAt: row.updated_at,
    contentSha256: sha256(row.content),
    willChange: state === "old",
  };
}

export function runHomepageCasesMigration(db, { apply = false } = {}) {
  const before = inspectHomepage(db);
  if (!apply) return { mode: "dry-run", before, changed: 0 };

  if (before.state === "new") {
    return { mode: "apply", before, after: before, changed: 0 };
  }

  const row = readHomepageRow(db);
  const content = JSON.parse(row.content);
  content.heroInfoPanel = { ...content.heroInfoPanel, ...NEW_PANEL };
  const nextContent = JSON.stringify(content);

  db.exec("BEGIN");
  try {
    const result = db
      .prepare("UPDATE page_content SET content = ? WHERE page_key = ? AND content = ?")
      .run(nextContent, PAGE_KEY, row.content);
    if (Number(result.changes) !== 1) {
      throw new Error(`Expected to update one homepage row, changed ${result.changes}`);
    }
    const after = inspectHomepage(db);
    if (after.state !== "new") throw new Error("Homepage cases migration did not apply");
    if (after.updatedAt !== before.updatedAt) throw new Error("updated_at changed unexpectedly");
    db.exec("COMMIT");
    return { mode: "apply", before, after, changed: Number(result.changes) };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(resolveDbPath(), { readOnly: !apply });
  try {
    console.log(JSON.stringify(runHomepageCasesMigration(db, { apply }), null, 2));
  } finally {
    db.close();
  }
}
