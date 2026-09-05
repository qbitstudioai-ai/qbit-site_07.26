import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  runHomepageContentRelease,
  RELEASE_STEPS,
} from "../../../../scripts/release-homepage-content.mjs";
import { FIELDS as HERO_FIELDS } from "../../../../scripts/homepage-hero-copy-migration.mjs";
import { FIELD as CTA_FIELD } from "../../../../scripts/homepage-secondary-cta-migration.mjs";
import { UNTOUCHED as CASE_UNTOUCHED } from "../../../../scripts/homepage-case-qualifiers-migration.mjs";

/**
 * Договор релизной команды, которую вызывает `deploy.sh`.
 *
 * Проверяется ровно то, ради чего она написана: три миграции применяются за один вызов, дата
 * изменения главной двигается ТОЛЬКО когда контент действительно поменялся, повторный запуск
 * (каждый следующий деплой) ничего не делает и дату не трогает, а неожиданное состояние базы
 * останавливает релиз, а не перезаписывается вслепую.
 */

interface Row {
  [column: string]: unknown;
}

const UPDATED_AT = "2026-08-11T10:00:00.000Z";
const RELEASE_NOW = "2026-09-05T12:00:00.000Z";

/** Главная в том виде, в каком она лежит на боевом сайте до релиза. */
function oldHomepage() {
  return {
    eyebrow: "АВТОМАТИЗАЦИЯ БИЗНЕС-ПРОЦЕССОВ С ИИ",
    headline: HERO_FIELDS[0].old,
    subheadline: HERO_FIELDS[1].old,
    primaryCta: "Получить бесплатный разбор процессов",
    secondaryCta: CTA_FIELD.old,
    heroInfoPanel: {
      title: "РЕАЛЬНЫЕ КЕЙСЫ",
      scenarios: [
        {
          metric: "20–25",
          unit: "ч/мес",
          title: "Контроль качества работы менеджеров",
          effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
        },
        {
          metric: "500–700 тыс.",
          unit: "₽/мес",
          qualifier: CASE_UNTOUCHED.qualifier,
          title: "Возврат упущенных продаж",
          effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
        },
        {
          metric: "75–80",
          unit: "ч/мес",
          qualifier: "раньше занимал ручной анализ",
          title: "Анализ работы полевой команды",
          effectLabel: "ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ",
        },
      ],
    },
  };
}

function createDb(content: object, updatedAt = UPDATED_AT): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE page_content (
      page_key    TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);
  const insert = db.prepare(
    "INSERT INTO page_content (page_key, content, updated_at) VALUES (?, ?, ?)",
  );
  insert.run("homepage", JSON.stringify(content), updatedAt);
  // Соседние страницы: их даты релиз главной трогать не имеет права.
  insert.run("products", JSON.stringify({ headline: "Продукты" }), UPDATED_AT);
  insert.run("contacts", JSON.stringify({ headline: "Контакты" }), UPDATED_AT);
  return db;
}

function readPage(db: DatabaseSync, key: string) {
  const row = db
    .prepare("SELECT content, updated_at FROM page_content WHERE page_key = ?")
    .get(key) as Row;
  return { content: JSON.parse(String(row.content)), updatedAt: String(row.updated_at) };
}

describe("релизная команда текстов главной", () => {
  it("порядок шагов зафиксирован", () => {
    expect(RELEASE_STEPS.map((step) => step.name)).toEqual([
      "case-qualifiers",
      "hero-copy",
      "secondary-cta",
    ]);
  });

  it("сухой прогон ничего не пишет и не двигает дату", () => {
    const db = createDb(oldHomepage());
    const before = readPage(db, "homepage");

    const result = runHomepageContentRelease(db, { apply: false, now: RELEASE_NOW });

    expect(result.mode).toBe("dry-run");
    expect(result.changed).toBe(0);
    expect(result.steps.every((s: { state: string }) => s.state === "old")).toBe(true);
    expect(result.lastmod.moved).toBe(false);
    expect(readPage(db, "homepage")).toEqual(before);
    db.close();
  });

  it("применяет все три правки за один вызов", () => {
    const db = createDb(oldHomepage());

    const result = runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });

    expect(result.changed).toBe(3);
    const { content } = readPage(db, "homepage");
    expect(content.headline).toBe(HERO_FIELDS[0].new);
    expect(content.subheadline).toBe(HERO_FIELDS[1].new);
    expect(content.secondaryCta).toBe(CTA_FIELD.new);
    expect(content.heroInfoPanel.scenarios.map((s: { qualifier?: string }) => s.qualifier)).toEqual(
      [
        "экономия времени руководителю на изучение отчётов",
        CASE_UNTOUCHED.qualifier,
        "экономия времени на анализе отчётов",
      ],
    );
    db.close();
  });

  it("двигает дату изменения главной на момент релиза", () => {
    const db = createDb(oldHomepage());

    const result = runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });

    expect(result.lastmod.moved).toBe(true);
    expect(result.lastmod.before).toBe(UPDATED_AT);
    expect(readPage(db, "homepage").updatedAt).toBe(RELEASE_NOW);
    db.close();
  });

  it("не трогает даты остальных страниц", () => {
    const db = createDb(oldHomepage());

    runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });

    expect(readPage(db, "products").updatedAt).toBe(UPDATED_AT);
    expect(readPage(db, "contacts").updatedAt).toBe(UPDATED_AT);
    db.close();
  });

  it("повторный запуск ничего не меняет и НЕ двигает дату — обычный следующий деплой", () => {
    const db = createDb(oldHomepage());
    runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });
    const afterRelease = readPage(db, "homepage");

    const second = runHomepageContentRelease(db, {
      apply: true,
      now: "2026-10-01T00:00:00.000Z",
    });

    expect(second.changed).toBe(0);
    expect(second.lastmod.moved).toBe(false);
    expect(readPage(db, "homepage")).toEqual(afterRelease);
    db.close();
  });

  it("--touch двигает дату, даже если миграции уже применены руками", () => {
    const db = createDb(oldHomepage());
    runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });

    const later = "2026-10-01T00:00:00.000Z";
    const result = runHomepageContentRelease(db, { apply: true, touch: true, now: later });

    expect(result.changed).toBe(0);
    expect(result.lastmod.moved).toBe(true);
    expect(readPage(db, "homepage").updatedAt).toBe(later);
    db.close();
  });

  it("не двигает дату назад, если в базе уже более поздняя", () => {
    const future = "2027-01-01T00:00:00.000Z";
    const db = createDb(oldHomepage(), future);

    const result = runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });

    expect(result.changed).toBe(3);
    expect(result.lastmod.moved).toBe(false);
    expect(readPage(db, "homepage").updatedAt).toBe(future);
    db.close();
  });

  it("останавливается на неожиданном состоянии базы и откатывает всё целиком", () => {
    const content = oldHomepage();
    content.subheadline = "текст, который владелец сайта написал сам";
    const db = createDb(content);
    const before = readPage(db, "homepage");

    expect(() => runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW })).toThrow(
      /Unexpected subheadline/,
    );

    // Первый шаг (подписи кейсов) успевает записаться до падения второго — и обязан откатиться
    // вместе с ним. Строка должна остаться байт в байт прежней, включая дату.
    expect(readPage(db, "homepage")).toEqual(before);
    db.close();
  });
});

/**
 * Атомарность релиза.
 *
 * Проверяется не «шаги отработали», а главное свойство: при ЛЮБОЙ ошибке база возвращается к
 * исходному состоянию целиком. До перевода на одну транзакцию каждая миграция коммитила себя сама,
 * и падение на третьем шаге оставляло первые два применёнными — на сайте оказывался наполовину
 * новый первый экран.
 *
 * Сбой подставляется через `steps`: вместо настоящего шага — тот, что бросает исключение. Так
 * проверяется именно управление транзакцией, а не конкретная миграция.
 */
describe("атомарность релиза", () => {
  const boom = {
    name: "boom",
    apply: () => {
      throw new Error("искусственный сбой");
    },
    inspect: () => {
      throw new Error("искусственный сбой");
    },
  };

  /** Полный снимок таблицы: содержимое и даты ВСЕХ страниц. */
  function snapshot(db: DatabaseSync) {
    return db
      .prepare("SELECT page_key, content, updated_at FROM page_content ORDER BY page_key")
      .all()
      .map((row) => ({ ...(row as Row) }));
  }

  it("сбой ПОСЛЕ первого шага откатывает базу полностью", () => {
    const db = createDb(oldHomepage());
    const before = snapshot(db);

    expect(() =>
      runHomepageContentRelease(db, {
        apply: true,
        now: RELEASE_NOW,
        steps: [RELEASE_STEPS[0], boom, RELEASE_STEPS[1], RELEASE_STEPS[2]],
      }),
    ).toThrow(/искусственный сбой/);

    expect(snapshot(db)).toEqual(before);
    const { content, updatedAt } = readPage(db, "homepage");
    expect(content.headline).toBe(HERO_FIELDS[0].old);
    expect(content.secondaryCta).toBe(CTA_FIELD.old);
    expect(content.heroInfoPanel.scenarios[0].qualifier).toBeUndefined();
    expect(updatedAt).toBe(UPDATED_AT);
    db.close();
  });

  it("сбой ПОСЛЕ второго шага откатывает базу полностью", () => {
    const db = createDb(oldHomepage());
    const before = snapshot(db);

    expect(() =>
      runHomepageContentRelease(db, {
        apply: true,
        now: RELEASE_NOW,
        steps: [RELEASE_STEPS[0], RELEASE_STEPS[1], boom, RELEASE_STEPS[2]],
      }),
    ).toThrow(/искусственный сбой/);

    expect(snapshot(db)).toEqual(before);
    const { content, updatedAt } = readPage(db, "homepage");
    expect(content.headline).toBe(HERO_FIELDS[0].old);
    expect(content.subheadline).toBe(HERO_FIELDS[1].old);
    expect(content.secondaryCta).toBe(CTA_FIELD.old);
    expect(updatedAt).toBe(UPDATED_AT);
    db.close();
  });

  it("сбой ПОСЛЕ третьего шага откатывает и сдвиг даты", () => {
    const db = createDb(oldHomepage());
    const before = snapshot(db);

    expect(() =>
      runHomepageContentRelease(db, {
        apply: true,
        now: RELEASE_NOW,
        steps: [...RELEASE_STEPS, boom],
      }),
    ).toThrow(/искусственный сбой/);

    expect(snapshot(db)).toEqual(before);
    expect(readPage(db, "homepage").updatedAt).toBe(UPDATED_AT);
    db.close();
  });

  it("после отката база пригодна к работе: повторный релиз проходит целиком", () => {
    const db = createDb(oldHomepage());

    expect(() =>
      runHomepageContentRelease(db, {
        apply: true,
        now: RELEASE_NOW,
        steps: [RELEASE_STEPS[0], boom],
      }),
    ).toThrow(/искусственный сбой/);

    // Транзакция закрыта откатом, а не оставлена открытой: следующий `BEGIN` обязан пройти.
    const result = runHomepageContentRelease(db, { apply: true, now: RELEASE_NOW });

    expect(result.changed).toBe(3);
    expect(result.lastmod.moved).toBe(true);
    expect(readPage(db, "homepage").updatedAt).toBe(RELEASE_NOW);
    db.close();
  });

  it("сухой прогон не открывает транзакцию и не пишет — даже если шаг падает", () => {
    const db = createDb(oldHomepage());
    const before = snapshot(db);

    expect(() =>
      runHomepageContentRelease(db, {
        apply: false,
        now: RELEASE_NOW,
        steps: [RELEASE_STEPS[0], boom, RELEASE_STEPS[1]],
      }),
    ).toThrow(/искусственный сбой/);

    expect(snapshot(db)).toEqual(before);
    db.close();
  });
});
