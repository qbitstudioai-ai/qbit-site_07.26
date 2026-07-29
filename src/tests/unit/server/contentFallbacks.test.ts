import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seedDepartments from "../../../../data/departments.json";

/**
 * Поведение публичных читателей при скрытом и при повреждённом контенте
 * (находки code review 2026-07-27: C-1, C-5, C-6).
 *
 * Тесты работают на ОТДЕЛЬНОЙ временной базе. Пользовательская `var/content.db` не открывается.
 */

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-content-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

/** Кладёт отделы в базу напрямую: репозиторий пишет только через админ-API. */
async function seedDepartmentRows(
  rows: Array<{ id: string; content: unknown; isPublished: boolean }>,
) {
  const { getDatabase, nowIso } = await import("@/server/db/client");
  const db = getDatabase();
  const statement = db.prepare(
    `INSERT INTO departments (id, display_name, content, sort_order, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  rows.forEach((row, index) => {
    const timestamp = nowIso();
    statement.run(
      row.id,
      `Отдел ${row.id}`,
      JSON.stringify(row.content),
      (index + 1) * 10,
      row.isPublished ? 1 : 0,
      timestamp,
      timestamp,
    );
  });
}

const validDepartments = seedDepartments as Array<Record<string, unknown>>;

describe("C-1/C-6: скрытые отделы", () => {
  it("пустая таблица — показываются исходные тексты (база ещё не заполнена)", async () => {
    const { getDepartments } = await import("@/server/content/departments");

    expect(getDepartments()).toHaveLength(validDepartments.length);
  });

  it("строки есть, но все скрыты — раздел пуст, seed НЕ подставляется", async () => {
    await seedDepartmentRows(
      validDepartments.map((department) => ({
        id: String(department.id),
        content: department,
        isPublished: false,
      })),
    );
    const { getDepartments } = await import("@/server/content/departments");

    expect(getDepartments()).toEqual([]);
  });

  it("скрыт один отдел — остальные отдаются, исключений нет", async () => {
    await seedDepartmentRows(
      validDepartments.map((department, index) => ({
        id: String(department.id),
        content: department,
        isPublished: index !== 0,
      })),
    );
    const { getDepartments } = await import("@/server/content/departments");

    const result = getDepartments();
    expect(result).toHaveLength(validDepartments.length - 1);
    expect(result.map((d) => d.id)).not.toContain(String(validDepartments[0].id));
  });
});

describe("C-5: корректный контент владельца доходит до читателя без подмены", () => {
  /**
   * Регрессия на дефект, найденный ревью 2026-07-28.
   *
   * Первая редакция проверки применяла к ОДНОМУ отделу схему КОЛЛЕКЦИИ (`z.array(...).length(5)` с
   * требованием всех пяти id по порядку). Такой разбор не проходит никогда, поэтому подменялся
   * seed-текстами весь пользовательский контент — правки из админ-панели переставали появляться на
   * сайте. Тестов на это не было, а в базе контент совпадает с seed, поэтому дефект был невидим.
   */
  it("отредактированный текст отдела отдаётся как есть, без обращения к seed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const edited = {
      ...validDepartments[0],
      headline: "Текст, отредактированный владельцем сайта",
    };
    await seedDepartmentRows([
      { id: String(validDepartments[0].id), content: edited, isPublished: true },
    ]);
    const { getDepartments } = await import("@/server/content/departments");

    const result = getDepartments();

    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe("Текст, отредактированный владельцем сайта");
    // Ни одной жалобы в лог: контент корректен, подменять его не на что.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("все пять отделов с корректным контентом проходят без единой подмены", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await seedDepartmentRows(
      validDepartments.map((department) => ({
        id: String(department.id),
        content: { ...department, headline: `Правка ${department.id}` },
        isPublished: true,
      })),
    );
    const { getDepartments } = await import("@/server/content/departments");

    const result = getDepartments();

    expect(result).toHaveLength(validDepartments.length);
    for (const department of result) {
      expect(department.headline).toBe(`Правка ${department.id}`);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("C-5: повреждённое содержимое отдела", () => {
  it("негодная запись заменяется исходным текстом ТОГО ЖЕ отдела, а не роняет чтение", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await seedDepartmentRows([
      {
        id: String(validDepartments[0].id),
        content: { painPoints: "не массив" },
        isPublished: true,
      },
      { id: String(validDepartments[1].id), content: validDepartments[1], isPublished: true },
    ]);
    const { getDepartments } = await import("@/server/content/departments");

    const result = getDepartments();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(String(validDepartments[0].id));
    expect(Array.isArray(result[0].painPoints)).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("пустая JSON-колонка не роняет чтение", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await seedDepartmentRows([
      { id: String(validDepartments[0].id), content: {}, isPublished: true },
    ]);
    const { getDepartments } = await import("@/server/content/departments");

    expect(() => getDepartments()).not.toThrow();
    expect(getDepartments()[0].painPoints.length).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("в лог не попадают значения полей", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await seedDepartmentRows([
      {
        id: String(validDepartments[0].id),
        content: { painPoints: "секретное-значение-не-для-лога" },
        isPublished: true,
      },
    ]);
    const { getDepartments } = await import("@/server/content/departments");
    getDepartments();

    const logged = spy.mock.calls.map((call) => String(call[0])).join(" ");
    expect(logged).not.toContain("секретное-значение-не-для-лога");
    spy.mockRestore();
  });
});
