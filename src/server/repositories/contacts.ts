import { getDatabase, nowIso, transaction } from "../db/client";
import { logActivity, saveRevision } from "./revisions";

/**
 * Репозиторий контактов — ЕДИНЫЙ источник телефона, почты и мессенджеров для всего сайта.
 *
 * До миграции номер жил в двух местах: в шапке (`data/homepage-copy.json`) и на странице контактов
 * (`contactData.ts`). Теперь это одна запись: шапка берёт телефон и адрес Telegram отсюда же
 * (см. `src/server/content/homepage.ts`). Правка в админ-панели меняет их одновременно.
 *
 * `kind` — роль канала, а не оформление:
 *   `phone`            — телефон, он же номер в шапке;
 *   `telegram-primary` — адрес, на который ведут все CTA сайта;
 *   `telegram`, `email`, `whatsapp`, `vk`, `address`, `hours`, `other` — прочие каналы.
 */

export const CONTACT_KINDS = [
  "phone",
  "phone-extra",
  "email",
  "telegram-primary",
  "telegram",
  "whatsapp",
  "vk",
  "address",
  "hours",
  "other",
] as const;

export type ContactKind = (typeof CONTACT_KINDS)[number];

export interface ContactRecord {
  id: string;
  kind: string;
  label: string;
  value: string;
  href: string;
  accessibleLabel: string;
  headerLabel: string;
  isExternal: boolean;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string;
}

function toContact(raw: unknown): ContactRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id),
    kind: String(row.kind),
    label: String(row.label),
    value: String(row.value),
    href: String(row.href),
    accessibleLabel: String(row.accessible_label ?? ""),
    headerLabel: String(row.header_label ?? ""),
    isExternal: Number(row.is_external) === 1,
    isPublished: Number(row.is_published) === 1,
    sortOrder: Number(row.sort_order),
    updatedAt: String(row.updated_at),
  };
}

const SELECT = `SELECT id, kind, label, value, href, accessible_label, header_label,
                       is_external, is_published, sort_order, updated_at FROM contacts`;

/** Опубликованные каналы в порядке отображения — то, что видит посетитель. */
export function getContacts(): ContactRecord[] {
  return getDatabase()
    .prepare(`${SELECT} WHERE is_published = 1 ORDER BY sort_order ASC, id ASC`)
    .all()
    .map(toContact);
}

/** Все каналы, включая скрытые — для админ-панели. */
export function listAllContacts(): ContactRecord[] {
  return getDatabase().prepare(`${SELECT} ORDER BY sort_order ASC, id ASC`).all().map(toContact);
}

export function getContactByKind(kind: string): ContactRecord | undefined {
  const row = getDatabase()
    .prepare(`${SELECT} WHERE kind = ? AND is_published = 1 ORDER BY sort_order ASC LIMIT 1`)
    .get(kind);
  return row ? toContact(row) : undefined;
}

export type ContactInput = Omit<ContactRecord, "updatedAt">;

/**
 * Полная замена набора контактов одной транзакцией: форма редактирует список целиком (добавление,
 * удаление, порядок), и построчные UPDATE/DELETE оставили бы промежуточные состояния, в которых
 * публичная страница успела бы прочитать половину списка.
 */
export function replaceContacts(items: readonly ContactInput[]): ContactRecord[] {
  return transaction(() => {
    const db = getDatabase();
    saveRevision("contacts", "all", listAllContacts());

    db.prepare("DELETE FROM contacts").run();
    const timestamp = nowIso();
    const insert = db.prepare(
      `INSERT INTO contacts (id, kind, label, value, href, accessible_label, header_label,
                             is_external, is_published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    items.forEach((item, index) => {
      insert.run(
        item.id,
        item.kind,
        item.label,
        item.value,
        item.href,
        item.accessibleLabel,
        item.headerLabel,
        item.isExternal ? 1 : 0,
        item.isPublished ? 1 : 0,
        item.sortOrder || (index + 1) * 10,
        timestamp,
        timestamp,
      );
    });

    logActivity("contacts", "all", "update", "Контакты обновлены");
    return listAllContacts();
  });
}

export function insertContactIfMissing(item: ContactInput): boolean {
  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM contacts WHERE id = ?").get(item.id)) return false;

  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO contacts (id, kind, label, value, href, accessible_label, header_label,
                           is_external, is_published, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.id,
    item.kind,
    item.label,
    item.value,
    item.href,
    item.accessibleLabel,
    item.headerLabel,
    item.isExternal ? 1 : 0,
    item.isPublished ? 1 : 0,
    item.sortOrder,
    timestamp,
    timestamp,
  );
  return true;
}
