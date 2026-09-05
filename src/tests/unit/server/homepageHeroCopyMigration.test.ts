import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  runHomepageHeroCopyMigration,
  FIELDS,
  UNTOUCHED,
} from "../../../../scripts/homepage-hero-copy-migration.mjs";

/**
 * Договор разовой правки заголовка и подзаголовка первого экрана.
 *
 * Проверяется не «скрипт что-то записал», а то, ради чего он написан отдельно от seed'а: правятся
 * ровно два поля, все остальные тексты главной остаются байт в байт, `updated_at` не сдвигается, а
 * любое неожиданное состояние базы (правка владельцем сайта) обязано остановить запись, а не быть
 * затёртым.
 */

interface Row {
  [column: string]: unknown;
}

interface Homepage {
  eyebrow: string;
  headline: string;
  subheadline: string;
  headerPhone: string;
  heroInfoPanel: { title: string };
}

const UPDATED_AT = "2026-08-11T10:00:00.000Z";

/** Главная в том виде, в каком она лежит на боевом сайте до правки. */
function oldHomepage(): Homepage {
  return {
    eyebrow: UNTOUCHED.eyebrow,
    headline: FIELDS[0].old,
    subheadline: FIELDS[1].old,
    headerPhone: "не трогать",
    heroInfoPanel: { title: "РЕАЛЬНЫЕ КЕЙСЫ" },
  };
}

function createDb(content: Homepage): DatabaseSync {
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
    JSON.stringify(content),
    UPDATED_AT,
  );
  return db;
}

function readHomepage(db: DatabaseSync) {
  const row = db
    .prepare("SELECT content, updated_at FROM page_content WHERE page_key = ?")
    .get("homepage") as Row;
  return {
    content: JSON.parse(String(row.content)) as Homepage,
    updatedAt: row.updated_at,
  };
}

describe("правка заголовка и подзаголовка первого экрана", () => {
  it("сухой прогон ничего не пишет и сообщает о предстоящем изменении", () => {
    const db = createDb(oldHomepage());
    const before = readHomepage(db);

    const result = runHomepageHeroCopyMigration(db, { apply: false });

    expect(result.mode).toBe("dry-run");
    expect(result.before.state).toBe("old");
    expect(result.before.willChange).toBe(true);
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("проставляет оба новых текста", () => {
    const db = createDb(oldHomepage());

    const result = runHomepageHeroCopyMigration(db, { apply: true });

    expect(result.changed).toBe(1);
    expect(result.after?.state).toBe("new");

    const { content } = readHomepage(db);
    expect(content.headline).toBe(FIELDS[0].new);
    expect(content.subheadline).toBe(FIELDS[1].new);
    db.close();
  });

  it("не меняет ни одного другого поля и updated_at", () => {
    const db = createDb(oldHomepage());
    const before = readHomepage(db);

    runHomepageHeroCopyMigration(db, { apply: true });

    const after = readHomepage(db);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.content.eyebrow).toBe(before.content.eyebrow);
    expect(after.content.headerPhone).toBe(before.content.headerPhone);
    expect(after.content.heroInfoPanel).toEqual(before.content.heroInfoPanel);

    // Всё, кроме двух правленых полей, обязано совпасть дословно — включая набор ключей.
    const strip = (content: Homepage) => {
      const { headline, subheadline, ...rest } = content;
      void headline;
      void subheadline;
      return rest;
    };
    expect(strip(after.content)).toEqual(strip(before.content));
    expect(Object.keys(after.content)).toEqual(Object.keys(before.content));
    db.close();
  });

  it("повторный запуск после применения ничего не делает", () => {
    const db = createDb(oldHomepage());
    runHomepageHeroCopyMigration(db, { apply: true });
    const afterFirst = readHomepage(db);

    const result = runHomepageHeroCopyMigration(db, { apply: true });

    expect(result.changed).toBe(0);
    expect(result.before.state).toBe("new");
    expect(readHomepage(db)).toEqual(afterFirst);
    db.close();
  });

  it("отказывается писать поверх чужой правки вместо того, чтобы затереть её", () => {
    const content = oldHomepage();
    content.subheadline = "текст, который владелец сайта написал сам";
    const db = createDb(content);
    const before = readHomepage(db);

    expect(() => runHomepageHeroCopyMigration(db, { apply: true })).toThrow(
      /Unexpected subheadline/,
    );
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("отказывается писать, если правка уже частично применена вручную", () => {
    const content = oldHomepage();
    content.headline = FIELDS[0].new;
    const db = createDb(content);
    const before = readHomepage(db);

    expect(() => runHomepageHeroCopyMigration(db, { apply: true })).toThrow(/Mixed/);
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("отказывается писать, если тронута надзаголовочная строка", () => {
    const content = oldHomepage();
    content.eyebrow = "другой надзаголовок";
    const db = createDb(content);
    const before = readHomepage(db);

    expect(() => runHomepageHeroCopyMigration(db, { apply: true })).toThrow(/untouched/);
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });
});
