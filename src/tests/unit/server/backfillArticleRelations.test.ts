import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrations } from "@/server/db/schema.mjs";
import {
  exitCodeFor,
  runBackfillArticleRelations,
} from "../../../../scripts/backfill-article-relations.mjs";

/**
 * Договор переноса прежней перелинковки статей в таблицу связей (Amendment 58 / REL-02C).
 *
 * Проверяется не «скрипт что-то записал», а пять свойств, ради которых он написан отдельно:
 * связь хранится по идентификатору и никогда по адресу; порядок берётся из позиции в массиве;
 * непереносимая строка отменяет ВЕСЬ прогон, а не свою статью; повтор ничего не делает и не двигает
 * отметки времени; расхождение с уже существующими связями останавливает работу вместо слияния.
 *
 * Данные каждый тест строит сам. Ни одного числа из production-аудита здесь нет намеренно: на
 * машине разработчика база другая, и зашитое количество ссылок проверяло бы конкретную базу, а не
 * поведение скрипта.
 */

interface Row {
  [column: string]: unknown;
}

const STAMP = "2026-01-01T00:00:00.000Z";
const LATER = "2099-12-31T23:59:59.000Z";

function freshDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrations.forEach((migration) => db.exec(migration.sql));
  return db;
}

function addArticle(
  db: DatabaseSync,
  options: {
    id: string;
    slug: string;
    related?: unknown;
    status?: string;
    placement?: string;
    sortOrder?: number;
  },
): void {
  const related =
    typeof options.related === "string" ? options.related : JSON.stringify(options.related ?? []);

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, related_slugs,
                           status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    options.id,
    options.slug,
    `Статья ${options.slug}`,
    "Анонс",
    "Текст",
    options.placement ?? "blog",
    related,
    options.status ?? "published",
    options.sortOrder ?? 0,
    STAMP,
    STAMP,
  );
}

function addProduct(db: DatabaseSync, id: string, slug: string): void {
  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           created_at, updated_at)
     VALUES (?, ?, 'Меню', 'Полное', '{}', 'layout', 'hotspot', 'alt', ?, ?)`,
  ).run(id, slug, STAMP, STAMP);
}

function addRelation(
  db: DatabaseSync,
  options: {
    sourceId: string;
    targetId: string;
    targetType?: string;
    role?: string;
    sortOrder?: number;
  },
): void {
  db.prepare(
    `INSERT INTO content_relations (source_type, source_id, target_type, target_id, relation_role,
                                    sort_order, created_at, updated_at)
     VALUES ('article', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    options.sourceId,
    options.targetType ?? "article",
    options.targetId,
    options.role ?? "related",
    options.sortOrder ?? 0,
    STAMP,
    STAMP,
  );
}

function allRelations(db: DatabaseSync): Row[] {
  return db
    .prepare(
      `SELECT source_type, source_id, target_type, target_id, relation_role, sort_order,
              created_at, updated_at
         FROM content_relations
        ORDER BY source_id ASC, target_type ASC, sort_order ASC`,
    )
    .all() as Row[];
}

function articleRows(db: DatabaseSync): Row[] {
  return db
    .prepare("SELECT id, slug, status, related_slugs, updated_at FROM articles ORDER BY id")
    .all() as Row[];
}

/** Три статьи, связанные по кругу. Идентификатор нигде не равен адресу. */
function seedThreeArticles(db: DatabaseSync): void {
  addArticle(db, { id: "id-one", slug: "one", related: ["three", "two"], sortOrder: 1 });
  addArticle(db, { id: "id-two", slug: "two", related: ["one"], sortOrder: 2 });
  addArticle(db, { id: "id-three", slug: "three", related: [], sortOrder: 3 });
}

describe("backfill related_slugs → content_relations", () => {
  describe("перенос", () => {
    it("1. переносит каждую ссылку ровно одной строкой", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("applied");
      expect(report.plannedRelations).toBe(3);
      expect(report.changed).toBe(3);
      expect(report.articles).toBe(3);
      expect(report.articlesWithLinks).toBe(2);
      expect(allRelations(db)).toHaveLength(3);
      db.close();
    });

    it("2. сохраняет исходный порядок адресов в sort_order", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      runBackfillArticleRelations(db, { apply: true });

      const fromOne = allRelations(db).filter((row) => row.source_id === "id-one");
      expect(fromOne.map((row) => [row.target_id, row.sort_order])).toEqual([
        ["id-three", 0],
        ["id-two", 1],
      ]);
      db.close();
    });

    it("2b. записывает роль related всем связям", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      runBackfillArticleRelations(db, { apply: true });

      expect(allRelations(db).every((row) => row.relation_role === "related")).toBe(true);
      db.close();
    });

    it("3. разрешает адреса в идентификаторы вида UUID", () => {
      const db = freshDatabase();
      const first = "3f1c9a2e-0b7d-4a55-9c1e-77aa11bb22cc";
      const second = "8d4e5f60-1a2b-4c3d-8e9f-001122334455";
      addArticle(db, { id: first, slug: "one", related: ["two"] });
      addArticle(db, { id: second, slug: "two", related: ["one"] });

      runBackfillArticleRelations(db, { apply: true });

      expect(allRelations(db).map((row) => [row.source_id, row.target_id])).toEqual([
        [first, second],
        [second, first],
      ]);
      db.close();
    });

    it("22. ни разу не использует адрес как идентификатор", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      runBackfillArticleRelations(db, { apply: true });

      const slugs = new Set(articleRows(db).map((row) => String(row.slug)));
      const used = allRelations(db).flatMap((row) => [
        String(row.source_id),
        String(row.target_id),
      ]);
      expect(used.some((value) => slugs.has(value))).toBe(false);
      expect(used).not.toHaveLength(0);
      db.close();
    });
  });

  describe("идемпотентность", () => {
    it("4. второй запуск ничего не делает", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      runBackfillArticleRelations(db, { apply: true, now: () => STAMP });

      const second = runBackfillArticleRelations(db, { apply: true, now: () => LATER });

      expect(second.state).toBe("already-applied");
      expect(second.changed).toBe(0);
      expect(allRelations(db)).toHaveLength(3);
      db.close();
    });

    it("5. не двигает отметки времени существующих строк", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      runBackfillArticleRelations(db, { apply: true, now: () => STAMP });
      const before = allRelations(db);

      runBackfillArticleRelations(db, { apply: true, now: () => LATER });

      expect(allRelations(db)).toEqual(before);
      expect(
        allRelations(db).every((row) => row.created_at === STAMP && row.updated_at === STAMP),
      ).toBe(true);
      db.close();
    });

    it("15. точное совпадение состава распознаётся без запуска переноса", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addRelation(db, { sourceId: "id-one", targetId: "id-three", sortOrder: 0 });
      addRelation(db, { sourceId: "id-one", targetId: "id-two", sortOrder: 1 });
      addRelation(db, { sourceId: "id-two", targetId: "id-one", sortOrder: 0 });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("already-applied");
      expect(report.conflicts).toBe(0);
      expect(report.changed).toBe(0);
      expect(exitCodeFor(report.state)).toBe(0);
      db.close();
    });
  });

  describe("непереносимые данные останавливают весь прогон", () => {
    /** Исправная статья, чьи связи обязаны НЕ появиться из-за ошибки в соседней. */
    function seedHealthyPlusBroken(db: DatabaseSync, broken: () => void): void {
      addArticle(db, { id: "id-one", slug: "one", related: ["two"] });
      addArticle(db, { id: "id-two", slug: "two", related: [] });
      broken();
    }

    it("6. неразрешённый адрес блокирует перенос целиком", () => {
      const db = freshDatabase();
      seedHealthyPlusBroken(db, () =>
        addArticle(db, { id: "id-bad", slug: "bad", related: ["ghost"] }),
      );

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("blocked");
      expect(report.unresolved).toBe(1);
      expect(allRelations(db)).toHaveLength(0);
      expect(exitCodeFor(report.state)).toBe(1);
      db.close();
    });

    it("7. ссылка на себя блокирует перенос целиком", () => {
      const db = freshDatabase();
      seedHealthyPlusBroken(db, () =>
        addArticle(db, { id: "id-bad", slug: "bad", related: ["bad"] }),
      );

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("blocked");
      expect(report.selfLinks).toBe(1);
      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });

    it("8. повтор цели внутри одной статьи блокирует перенос целиком", () => {
      const db = freshDatabase();
      seedHealthyPlusBroken(db, () =>
        addArticle(db, { id: "id-bad", slug: "bad", related: ["two", "two"] }),
      );

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("blocked");
      expect(report.duplicates).toBe(1);
      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });

    it("9. цель-черновик блокирует перенос целиком", () => {
      const db = freshDatabase();
      seedHealthyPlusBroken(db, () => {
        addArticle(db, { id: "id-draft", slug: "draft", status: "draft" });
        addArticle(db, { id: "id-bad", slug: "bad", related: ["draft"] });
      });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("blocked");
      expect(report.draftTargets).toBe(1);
      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });

    it("10. битый JSON в колонке блокирует перенос целиком", () => {
      const db = freshDatabase();
      seedHealthyPlusBroken(db, () =>
        addArticle(db, { id: "id-bad", slug: "bad", related: "не json" }),
      );

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("blocked");
      expect(report.invalidJson).toBe(1);
      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });

    it("10b. значение не массива блокирует перенос целиком", () => {
      const db = freshDatabase();
      seedHealthyPlusBroken(db, () =>
        addArticle(db, { id: "id-bad", slug: "bad", related: '{"a":1}' }),
      );

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("blocked");
      expect(report.invalidJson).toBe(1);
      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });
  });

  describe("предсуществующие связи", () => {
    it("11. частично заполненный набор — это конфликт, а не дозапись", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addRelation(db, { sourceId: "id-one", targetId: "id-three", sortOrder: 0 });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("conflict");
      expect(report.conflicts).toBeGreaterThan(0);
      expect(allRelations(db)).toHaveLength(1);
      expect(exitCodeFor(report.state)).toBe(1);
      db.close();
    });

    it("12. лишняя связь статьи на статью — это конфликт", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addRelation(db, { sourceId: "id-one", targetId: "id-three", sortOrder: 0 });
      addRelation(db, { sourceId: "id-one", targetId: "id-two", sortOrder: 1 });
      addRelation(db, { sourceId: "id-two", targetId: "id-one", sortOrder: 0 });
      addRelation(db, { sourceId: "id-three", targetId: "id-one", sortOrder: 0 });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("conflict");
      expect(report.details.conflictUnexpected).toHaveLength(1);
      expect(allRelations(db)).toHaveLength(4);
      db.close();
    });

    it("13. другой порядок — это конфликт, а не совпадение", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addRelation(db, { sourceId: "id-one", targetId: "id-three", sortOrder: 1 });
      addRelation(db, { sourceId: "id-one", targetId: "id-two", sortOrder: 0 });
      addRelation(db, { sourceId: "id-two", targetId: "id-one", sortOrder: 0 });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("conflict");
      expect(allRelations(db)).toHaveLength(3);
      db.close();
    });

    it("14. роль primary вместо related — это конфликт", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addRelation(db, { sourceId: "id-one", targetId: "id-three", sortOrder: 0, role: "primary" });
      addRelation(db, { sourceId: "id-one", targetId: "id-two", sortOrder: 1 });
      addRelation(db, { sourceId: "id-two", targetId: "id-one", sortOrder: 0 });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("conflict");
      expect(allRelations(db)).toHaveLength(3);
      db.close();
    });

    it("16. связь статьи на продукт не мешает переносу", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addProduct(db, "id-product", "product");
      addRelation(db, { sourceId: "id-one", targetId: "id-product", targetType: "product" });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("applied");
      expect(report.existingArticleRelations).toBe(0);
      db.close();
    });

    it("17. связь статьи на продукт переживает перенос без изменений", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      addProduct(db, "id-product", "product");
      addRelation(db, { sourceId: "id-one", targetId: "id-product", targetType: "product" });
      const before = allRelations(db).filter((row) => row.target_type === "product");

      runBackfillArticleRelations(db, { apply: true, now: () => LATER });

      const after = allRelations(db).filter((row) => row.target_type === "product");
      expect(after).toEqual(before);
      expect(allRelations(db)).toHaveLength(4);
      db.close();
    });
  });

  describe("транзакция и неприкосновенность прежних данных", () => {
    it("18. отказ на середине вставки откатывает ВСЕ строки", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      // Падает только на последней по порядку вставке: если бы транзакция была на статью, две
      // первые строки уцелели бы и тест это увидел.
      db.exec(`CREATE TRIGGER backfill_boom BEFORE INSERT ON content_relations
                 WHEN NEW.source_id = 'id-two'
                 BEGIN SELECT RAISE(ABORT, 'boom'); END;`);

      expect(() => runBackfillArticleRelations(db, { apply: true })).toThrow();

      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });

    it("18b. повторная проверка внутри транзакции отменяет запись", () => {
      const real = freshDatabase();
      seedThreeArticles(real);

      // Данные портятся ПОСЛЕ первой проверки и уже внутри транзакции. Без второго прохода скрипт
      // записал бы план, посчитанный по устаревшему состоянию базы.
      let spoiled = false;
      const db = new Proxy(real, {
        get(target, property, receiver) {
          if (property === "exec") {
            return (sql: string) => {
              const result = target.exec(sql);
              if (sql === "BEGIN" && !spoiled) {
                spoiled = true;
                addArticle(target, { id: "id-bad", slug: "bad", related: ["ghost"] });
              }
              return result;
            };
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as unknown as DatabaseSync;

      expect(() => runBackfillArticleRelations(db, { apply: true })).toThrow(
        /между проверкой и записью/u,
      );

      expect(spoiled).toBe(true);
      expect(allRelations(real)).toHaveLength(0);
      real.close();
    });

    it("18c. ключ сравнения различает границы между полями", () => {
      const db = freshDatabase();
      // Идентификаторы подобраны так, что склейка БЕЗ разделителя делает две разные связи
      // неразличимыми: «a» + «bc» и «ab» + «c» дают одну и ту же строку. Если ключ перестанет
      // разделять поля, лишняя строка сойдёт за запланированную и конфликт исчезнет.
      addArticle(db, { id: "a", slug: "source", related: ["target"] });
      addArticle(db, { id: "bc", slug: "target", related: [] });
      addRelation(db, { sourceId: "ab", targetId: "c", sortOrder: 0 });

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(report.state).toBe("conflict");
      expect(report.details.conflictUnexpected).toHaveLength(1);
      expect(allRelations(db)).toHaveLength(1);
      db.close();
    });

    it("18d. отчёт описывает состояние, по которому шла запись", () => {
      const real = freshDatabase();
      addArticle(real, { id: "id-one", slug: "one", related: ["two"] });
      addArticle(real, { id: "id-two", slug: "two", related: [] });

      // Между двумя проверками появляется ещё одна статья со связью. Состояние остаётся `ready`,
      // но план внутри транзакции больше внешнего: записывается ДВЕ строки, а не одна. Если бы
      // отчёт брал числа из внешнего прохода, он сообщил бы про одну.
      let added = false;
      const db = new Proxy(real, {
        get(target, property, receiver) {
          if (property === "exec") {
            return (sql: string) => {
              const result = target.exec(sql);
              if (sql === "BEGIN" && !added) {
                added = true;
                addArticle(target, { id: "id-three", slug: "three", related: ["two"] });
              }
              return result;
            };
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as unknown as DatabaseSync;

      const report = runBackfillArticleRelations(db, { apply: true });

      expect(allRelations(real)).toHaveLength(2);
      expect(report.changed).toBe(2);
      expect(report.plannedRelations).toBe(2);
      expect(report.articles).toBe(3);
      real.close();
    });

    it("16b. связи статьи на кейс и на отдел тоже переживают перенос", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      db.prepare(
        `INSERT INTO cases (id, slug, title, short_title, file_number, created_at, updated_at)
         VALUES ('id-case', 'case', 'Кейс', 'Кейс', '02', ?, ?)`,
      ).run(STAMP, STAMP);
      db.prepare(
        `INSERT INTO departments (id, display_name, content, created_at, updated_at)
         VALUES ('id-department', 'Отдел', '{}', ?, ?)`,
      ).run(STAMP, STAMP);
      addRelation(db, { sourceId: "id-one", targetId: "id-case", targetType: "case" });
      addRelation(db, {
        sourceId: "id-one",
        targetId: "id-department",
        targetType: "department",
      });
      const foreign = allRelations(db).filter((row) => row.target_type !== "article");

      const report = runBackfillArticleRelations(db, { apply: true, now: () => LATER });

      expect(report.state).toBe("applied");
      expect(report.existingArticleRelations).toBe(0);
      expect(allRelations(db).filter((row) => row.target_type !== "article")).toEqual(foreign);
      expect(allRelations(db)).toHaveLength(5);
      db.close();
    });

    it("19. не меняет related_slugs ни одной статьи", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      const before = articleRows(db).map((row) => row.related_slugs);

      runBackfillArticleRelations(db, { apply: true });

      expect(articleRows(db).map((row) => row.related_slugs)).toEqual(before);
      db.close();
    });

    it("20. не меняет updated_at и прочие колонки статей", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      const before = articleRows(db);

      runBackfillArticleRelations(db, { apply: true });

      expect(articleRows(db)).toEqual(before);
      expect(articleRows(db).every((row) => row.updated_at === STAMP)).toBe(true);
      db.close();
    });

    it("21. dry-run ничего не пишет и сообщает готовность", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      const report = runBackfillArticleRelations(db, { apply: false });

      expect(report.mode).toBe("dry-run");
      expect(report.state).toBe("ready");
      expect(report.plannedRelations).toBe(3);
      expect(report.changed).toBe(0);
      expect(allRelations(db)).toHaveLength(0);
      expect(exitCodeFor(report.state)).toBe(0);
      db.close();
    });

    it("21c. в состоянии ready расхождений ноль, а не «весь план»", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      // Пустая таблица делает «недостающими» все запланированные связи разом. Если бы отчёт
      // считал их конфликтами, обычный первый прогон выглядел бы как база, требующая разбора.
      const dryRun = runBackfillArticleRelations(db, { apply: false });
      expect(dryRun.plannedRelations).toBe(3);
      expect(dryRun.conflicts).toBe(0);
      expect(dryRun.details.conflictMissing).toHaveLength(0);

      const applied = runBackfillArticleRelations(db, { apply: true });
      expect(applied.conflicts).toBe(0);
      expect(runBackfillArticleRelations(db, { apply: true }).conflicts).toBe(0);
      db.close();
    });

    it("21b. dry-run на базе, открытой только на чтение, не падает", () => {
      const db = freshDatabase();
      seedThreeArticles(db);
      // Настоящий readOnly-дескриптор из CLI воспроизводится здесь тем же запретом на запись:
      // любая попытка вставки в этом состоянии обязана была бы упасть, а dry-run не падает.
      db.exec("PRAGMA query_only = ON");

      const report = runBackfillArticleRelations(db, { apply: false });

      expect(report.state).toBe("ready");
      expect(allRelations(db)).toHaveLength(0);
      db.close();
    });

    it("отчёт содержит все обязательные поля", () => {
      const db = freshDatabase();
      seedThreeArticles(db);

      const report = runBackfillArticleRelations(db, { apply: false });

      expect(Object.keys(report)).toEqual(
        expect.arrayContaining([
          "mode",
          "state",
          "articles",
          "articlesWithLinks",
          "plannedRelations",
          "existingArticleRelations",
          "unresolved",
          "selfLinks",
          "duplicates",
          "draftTargets",
          "conflicts",
          "changed",
        ]),
      );
      db.close();
    });
  });
});
