import type { Department, DepartmentId } from "@/content/types";
import { getDatabase, nowIso, parseJsonColumn, transaction } from "../db/client";
import { logActivity, saveRevision } from "./revisions";

/**
 * Репозиторий отделов.
 *
 * Системный идентификатор (`sales`, `support`, `executive`, `hr`, `logistics`) — первичный ключ и
 * НЕ редактируется: к нему привязаны фотография сцены, маршрут `/solutions/*`, зоны офиса и
 * анимации. Редактируется только содержимое, которое хранится JSON-колонкой `content`: набор полей
 * отдела вложенный и неоднородный (пары «боль → выгода», шаги «до/после»), и раскладывать его по
 * отдельным таблицам значило бы усложнить схему без выигрыша — эти поля всегда читаются целиком.
 */

/** Часть отдела, которая приходит из админ-панели. Всё, кроме системного идентификатора. */
export type DepartmentContent = Omit<Department, "id">;

interface DepartmentRow {
  id: string;
  display_name: string;
  content: string;
  sort_order: number;
  is_published: number;
  updated_at: string;
}

function toDepartment(row: DepartmentRow): Department {
  const content = parseJsonColumn<DepartmentContent>(row.content, {} as DepartmentContent);
  return { ...content, id: row.id as DepartmentId, name: row.display_name };
}

export function getDepartments(): Department[] {
  return getDatabase()
    .prepare(
      `SELECT id, display_name, content, sort_order, is_published, updated_at
         FROM departments WHERE is_published = 1 ORDER BY sort_order ASC, id ASC`,
    )
    .all()
    .map((row) => toDepartment(row as unknown as DepartmentRow));
}

/** Все отделы, включая снятые с публикации — для админ-панели. */
export function listAllDepartments(): Array<
  Department & { isPublished: boolean; sortOrder: number; updatedAt: string }
> {
  return getDatabase()
    .prepare(
      `SELECT id, display_name, content, sort_order, is_published, updated_at
         FROM departments ORDER BY sort_order ASC, id ASC`,
    )
    .all()
    .map((raw) => {
      const row = raw as unknown as DepartmentRow;
      return {
        ...toDepartment(row),
        isPublished: row.is_published === 1,
        sortOrder: Number(row.sort_order),
        updatedAt: String(row.updated_at),
      };
    });
}

export function getDepartmentById(id: string): Department | undefined {
  const row = getDatabase()
    .prepare(
      `SELECT id, display_name, content, sort_order, is_published, updated_at
         FROM departments WHERE id = ?`,
    )
    .get(id) as unknown as DepartmentRow | undefined;

  return row ? toDepartment(row) : undefined;
}

export function departmentExists(id: string): boolean {
  return Boolean(getDatabase().prepare("SELECT 1 FROM departments WHERE id = ?").get(id));
}

/**
 * Перезапись содержимого отдела. Предыдущая версия уходит в `content_revisions` ДО записи — иначе
 * при ошибке в новом тексте старый было бы не вернуть.
 */
export function updateDepartment(
  id: string,
  content: DepartmentContent,
  options: { isPublished?: boolean } = {},
): Department {
  return transaction(() => {
    const previous = getDepartmentById(id);
    if (!previous) {
      throw new Error(`Отдел «${id}» не найден`);
    }
    saveRevision("department", id, previous);

    const db = getDatabase();
    db.prepare(
      `UPDATE departments
          SET display_name = ?, content = ?, is_published = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      content.name,
      JSON.stringify(content),
      options.isPublished === false ? 0 : 1,
      nowIso(),
      id,
    );

    logActivity("department", id, "update", `Отдел «${content.name}» обновлён`);
    return getDepartmentById(id) as Department;
  });
}

/** Используется seed-скриптом: создаёт запись, если её ещё нет. */
export function insertDepartmentIfMissing(
  id: string,
  content: DepartmentContent,
  sortOrder: number,
): boolean {
  if (departmentExists(id)) return false;

  const timestamp = nowIso();
  getDatabase()
    .prepare(
      `INSERT INTO departments (id, display_name, content, sort_order, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(id, content.name, JSON.stringify(content), sortOrder, timestamp, timestamp);

  return true;
}
