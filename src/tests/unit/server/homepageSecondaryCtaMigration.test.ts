import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  runHomepageSecondaryCtaMigration,
  FIELD,
  UNTOUCHED,
} from "../../../../scripts/homepage-secondary-cta-migration.mjs";

/**
 * Договор разовой правки надписи на контурной кнопке первого экрана.
 *
 * Проверяется не «скрипт что-то записал», а то, ради чего он написан отдельно от seed'а: правится
 * ровно одно поле, соседний коммерческий CTA и пункт меню «Найти потери» остаются нетронутыми,
 * `updated_at` не сдвигается, а неожиданное состояние базы обязано остановить запись.
 */

interface Row {
  [column: string]: unknown;
}

interface Homepage {
  primaryCta: string;
  secondaryCta: string;
  ctaNote: string;
  heroLinks?: { label: string; href: string }[];
}

const UPDATED_AT = "2026-08-11T10:00:00.000Z";

/** Главная в том виде, в каком она лежит на боевом сайте до правки. */
function oldHomepage(): Homepage {
  return {
    primaryCta: UNTOUCHED.primaryCta,
    secondaryCta: FIELD.old,
    ctaNote: "не трогать",
    heroLinks: [
      { label: "Главная", href: "/" },
      { label: UNTOUCHED.heroLinkLabel, href: "/?section=office" },
    ],
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

describe("правка надписи на контурной кнопке первого экрана", () => {
  it("сухой прогон ничего не пишет и сообщает о предстоящем изменении", () => {
    const db = createDb(oldHomepage());
    const before = readHomepage(db);

    const result = runHomepageSecondaryCtaMigration(db, { apply: false });

    expect(result.mode).toBe("dry-run");
    expect(result.before.state).toBe("old");
    expect(result.before.willChange).toBe(true);
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("проставляет новую надпись", () => {
    const db = createDb(oldHomepage());

    const result = runHomepageSecondaryCtaMigration(db, { apply: true });

    expect(result.changed).toBe(1);
    expect(result.after?.state).toBe("new");
    expect(readHomepage(db).content.secondaryCta).toBe(FIELD.new);
    db.close();
  });

  it("не меняет ни одного другого поля, пункт меню и updated_at", () => {
    const db = createDb(oldHomepage());
    const before = readHomepage(db);

    runHomepageSecondaryCtaMigration(db, { apply: true });

    const after = readHomepage(db);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.content.primaryCta).toBe(before.content.primaryCta);
    expect(after.content.ctaNote).toBe(before.content.ctaNote);
    // Пункт шапки «Найти потери» ведёт в ту же карту офиса и намеренно НЕ переименован.
    expect(after.content.heroLinks).toEqual(before.content.heroLinks);
    expect(Object.keys(after.content)).toEqual(Object.keys(before.content));
    db.close();
  });

  it("повторный запуск после применения ничего не делает", () => {
    const db = createDb(oldHomepage());
    runHomepageSecondaryCtaMigration(db, { apply: true });
    const afterFirst = readHomepage(db);

    const result = runHomepageSecondaryCtaMigration(db, { apply: true });

    expect(result.changed).toBe(0);
    expect(result.before.state).toBe("new");
    expect(readHomepage(db)).toEqual(afterFirst);
    db.close();
  });

  it("отказывается писать поверх чужой правки вместо того, чтобы затереть её", () => {
    const content = oldHomepage();
    content.secondaryCta = "надпись владельца сайта";
    const db = createDb(content);
    const before = readHomepage(db);

    expect(() => runHomepageSecondaryCtaMigration(db, { apply: true })).toThrow(
      /Unexpected secondaryCta/,
    );
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("отказывается писать, если тронут соседний коммерческий CTA", () => {
    const content = oldHomepage();
    content.primaryCta = "другая кнопка";
    const db = createDb(content);
    const before = readHomepage(db);

    expect(() => runHomepageSecondaryCtaMigration(db, { apply: true })).toThrow(/primaryCta/);
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("отказывается писать, если переименован пункт меню «Найти потери»", () => {
    const content = oldHomepage();
    content.heroLinks![1].label = "Примеры";
    const db = createDb(content);
    const before = readHomepage(db);

    expect(() => runHomepageSecondaryCtaMigration(db, { apply: true })).toThrow(/menu item/);
    expect(readHomepage(db)).toEqual(before);
    db.close();
  });

  it("применяется и к записи без heroLinks — меню досбирается на чтении", () => {
    const content = oldHomepage();
    delete content.heroLinks;
    const db = createDb(content);

    const result = runHomepageSecondaryCtaMigration(db, { apply: true });

    expect(result.changed).toBe(1);
    expect(readHomepage(db).content.secondaryCta).toBe(FIELD.new);
    db.close();
  });
});
