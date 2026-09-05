import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  runHomepageCaseQualifiersMigration,
  TARGETS,
  UNTOUCHED,
} from "../../../../scripts/homepage-case-qualifiers-migration.mjs";

/**
 * Договор разовой правки подписей в блоке «РЕАЛЬНЫЕ КЕЙСЫ».
 *
 * Проверяется не «скрипт что-то записал», а три вещи, ради которых он вообще написан отдельно от
 * seed'а: правятся ровно два сценария, третий и все прочие поля остаются байт в байт, а любое
 * неожиданное состояние базы (ручная правка на сервере) обязано остановить запись, а не быть
 * затёртым.
 */

interface Row {
  [column: string]: unknown;
}

interface Scenario {
  metric: string;
  unit: string;
  qualifier?: string;
  title: string;
  description: string;
  detail?: string;
  effectLabel: string;
}

interface Panel {
  title: string;
  subtitle: string;
  scenarios: Scenario[];
}

const UPDATED_AT = "2026-08-11T10:00:00.000Z";

/** Блок в том виде, в каком он лежит на боевом сайте до правки. */
function oldPanel(): Panel {
  return {
    title: "РЕАЛЬНЫЕ КЕЙСЫ",
    subtitle: "Обезличенные результаты внедрений",
    scenarios: [
      {
        metric: "20–25",
        unit: "ч/мес",
        title: "Контроль качества работы менеджеров",
        description: "Раньше руководитель тратил 4–5 часов в неделю на прослушивание звонков.",
        detail: "Изучение отчёта занимает 10–15 минут.",
        effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
      },
      {
        metric: "500–700 тыс.",
        unit: "₽/мес",
        qualifier: "рост продаж",
        title: "Возврат упущенных продаж",
        description: "Заявки из почты и мессенджеров автоматически фиксируются в CRM.",
        effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
      },
      {
        metric: "75–80",
        unit: "ч/мес",
        qualifier: "раньше занимал ручной анализ",
        title: "Анализ работы полевой команды",
        description: "Система обрабатывает около 10 000 строк отчётов в месяц.",
        detail: "Руководители изучают ежедневную сводку примерно за 10 минут.",
        effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
      },
    ],
  };
}

function createDb(panel: Panel): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE page_content (
      page_key    TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);
  db.prepare("INSERT INTO page_content (page_key, content, updated_at) VALUES (?, ?, ?)").run(
    "homepage",
    JSON.stringify({ headerPhone: "не трогать", heroInfoPanel: panel }),
    UPDATED_AT,
  );
  return db;
}

function readPanel(db: DatabaseSync) {
  const row = db
    .prepare("SELECT content, updated_at FROM page_content WHERE page_key = ?")
    .get("homepage") as Row;
  return {
    content: JSON.parse(String(row.content)) as { headerPhone: string; heroInfoPanel: Panel },
    updatedAt: row.updated_at,
  };
}

describe("правка подписей в блоке «РЕАЛЬНЫЕ КЕЙСЫ»", () => {
  it("сухой прогон ничего не пишет и сообщает о предстоящем изменении", () => {
    const db = createDb(oldPanel());
    const before = readPanel(db);

    const result = runHomepageCaseQualifiersMigration(db, { apply: false });

    expect(result.mode).toBe("dry-run");
    expect(result.before.state).toBe("old");
    expect(result.before.willChange).toBe(true);
    expect(readPanel(db)).toEqual(before);
    db.close();
  });

  it("проставляет обе новые подписи и не трогает сценарий «рост продаж»", () => {
    const db = createDb(oldPanel());

    const result = runHomepageCaseQualifiersMigration(db, { apply: true });

    expect(result.changed).toBe(1);
    expect(result.after?.state).toBe("new");

    const { content } = readPanel(db);
    const qualifiers = content.heroInfoPanel.scenarios.map((scenario) => scenario.qualifier);
    expect(qualifiers).toEqual([
      TARGETS[0].newQualifier,
      UNTOUCHED.qualifier,
      TARGETS[1].newQualifier,
    ]);
    db.close();
  });

  it("не меняет ни одного другого поля, порядок сценариев и updated_at", () => {
    const db = createDb(oldPanel());
    const before = readPanel(db);

    runHomepageCaseQualifiersMigration(db, { apply: true });

    const after = readPanel(db);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.content.headerPhone).toBe(before.content.headerPhone);
    expect(after.content.heroInfoPanel.title).toBe(before.content.heroInfoPanel.title);
    expect(after.content.heroInfoPanel.subtitle).toBe(before.content.heroInfoPanel.subtitle);

    // Всё, кроме `qualifier`, обязано совпасть дословно — включая порядок сценариев.
    const strip = (panel: Panel) =>
      panel.scenarios.map((scenario) => {
        const { qualifier, ...rest } = scenario;
        void qualifier;
        return rest;
      });
    expect(strip(after.content.heroInfoPanel)).toEqual(strip(before.content.heroInfoPanel));

    // `qualifier` стоит сразу после `unit`, как в остальных сценариях.
    expect(Object.keys(after.content.heroInfoPanel.scenarios[0]).slice(0, 3)).toEqual([
      "metric",
      "unit",
      "qualifier",
    ]);
    db.close();
  });

  it("повторный запуск после применения ничего не делает", () => {
    const db = createDb(oldPanel());
    runHomepageCaseQualifiersMigration(db, { apply: true });
    const afterFirst = readPanel(db);

    const result = runHomepageCaseQualifiersMigration(db, { apply: true });

    expect(result.changed).toBe(0);
    expect(result.before.state).toBe("new");
    expect(readPanel(db)).toEqual(afterFirst);
    db.close();
  });

  it("отказывается писать поверх чужой правки вместо того, чтобы затереть её", () => {
    const panel = oldPanel();
    panel.scenarios[2].qualifier = "правка владельца сайта";
    const db = createDb(panel);
    const before = readPanel(db);

    expect(() => runHomepageCaseQualifiersMigration(db, { apply: true })).toThrow(
      /Unexpected qualifier/,
    );
    expect(readPanel(db)).toEqual(before);
    db.close();
  });

  it("отказывается писать, если правка уже частично применена вручную", () => {
    const panel = oldPanel();
    panel.scenarios[0].qualifier = TARGETS[0].newQualifier;
    const db = createDb(panel);
    const before = readPanel(db);

    expect(() => runHomepageCaseQualifiersMigration(db, { apply: true })).toThrow(/Mixed/);
    expect(readPanel(db)).toEqual(before);
    db.close();
  });

  it("отказывается писать, если тронут сценарий «рост продаж»", () => {
    const panel = oldPanel();
    panel.scenarios[1].qualifier = "другой текст";
    const db = createDb(panel);
    const before = readPanel(db);

    expect(() => runHomepageCaseQualifiersMigration(db, { apply: true })).toThrow(/untouched/);
    expect(readPanel(db)).toEqual(before);
    db.close();
  });
});
