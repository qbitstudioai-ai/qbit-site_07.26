import { getDatabase, nowIso } from "../db/client";

/**
 * История изменений и журнал действий.
 *
 * Перед КАЖДОЙ перезаписью текста админ-панель кладёт предыдущее состояние записи в
 * `content_revisions`. Это не система версий: восстановление делается вручную из JSON. Задача
 * узкая — случайно затёртый текст отдела или статьи не должен исчезать безвозвратно.
 *
 * `activity_log` — отдельная, более лёгкая таблица: она отвечает на вопрос «что менялось
 * последним» на главной админ-панели и не хранит содержимое.
 */

export interface RevisionRow {
  id: number;
  entityType: string;
  entityId: string;
  previousData: string;
  createdAt: string;
}

export interface ActivityRow {
  id: number;
  entity: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
}

/** Сколько версий храним на одну запись. Старые вытесняются, чтобы база не росла без предела. */
const REVISIONS_PER_ENTITY = 20;

export function saveRevision(entityType: string, entityId: string, previous: unknown): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO content_revisions (entity_type, entity_id, previous_data, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(entityType, entityId, JSON.stringify(previous ?? null), nowIso());

  db.prepare(
    `DELETE FROM content_revisions
      WHERE entity_type = ? AND entity_id = ?
        AND id NOT IN (
          SELECT id FROM content_revisions
           WHERE entity_type = ? AND entity_id = ?
           ORDER BY id DESC LIMIT ?
        )`,
  ).run(entityType, entityId, entityType, entityId, REVISIONS_PER_ENTITY);
}

export function listRevisions(entityType: string, entityId: string): RevisionRow[] {
  return getDatabase()
    .prepare(
      `SELECT id, entity_type, entity_id, previous_data, created_at
         FROM content_revisions
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY id DESC`,
    )
    .all(entityType, entityId)
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        id: Number(record.id),
        entityType: String(record.entity_type),
        entityId: String(record.entity_id),
        previousData: String(record.previous_data),
        createdAt: String(record.created_at),
      };
    });
}

export function logActivity(
  entity: string,
  entityId: string,
  action: string,
  summary: string,
): void {
  getDatabase()
    .prepare(
      `INSERT INTO activity_log (entity, entity_id, action, summary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(entity, entityId, action, summary, nowIso());
}

export function listRecentActivity(limit = 12): ActivityRow[] {
  return getDatabase()
    .prepare(
      `SELECT id, entity, entity_id, action, summary, created_at
         FROM activity_log ORDER BY id DESC LIMIT ?`,
    )
    .all(limit)
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        id: Number(record.id),
        entity: String(record.entity),
        entityId: String(record.entity_id),
        action: String(record.action),
        summary: String(record.summary),
        createdAt: String(record.created_at),
      };
    });
}

/** Момент последнего изменения любого контента — показывается на главной админ-панели. */
export function getLastContentUpdate(): string | null {
  const row = getDatabase()
    .prepare(
      `SELECT MAX(updated_at) AS last FROM (
         SELECT updated_at FROM departments
         UNION ALL SELECT updated_at FROM products
         UNION ALL SELECT updated_at FROM articles
         UNION ALL SELECT updated_at FROM contacts
         UNION ALL SELECT updated_at FROM documents
         UNION ALL SELECT updated_at FROM page_content
       )`,
    )
    .get() as { last?: string | null } | undefined;

  return row?.last ?? null;
}
