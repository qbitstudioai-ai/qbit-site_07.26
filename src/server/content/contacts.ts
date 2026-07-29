import { cache } from "react";
import seedContacts from "../../../data/seed/contacts.json";
import seedPageContent from "../../../data/seed/page-content.json";
import type { ContactChannel, ContactsCopy } from "@/features/contacts/contactData";
import { getContacts as readContacts, listAllContacts } from "../repositories/contacts";
import { getPageContent } from "../repositories/pageContent";
import { safePageCopy } from "./pageContentSchemas";

/**
 * Публичный доступ к контактам — один источник для страницы `/contacts` и шапки сайта.
 *
 * Шапка берёт телефон и адрес CTA из этого же набора (`src/server/content/homepage.ts`), поэтому
 * правка номера в админ-панели меняет его сразу везде.
 */

const fallbackChannels: ContactChannel[] = seedContacts.map((contact) => ({
  id: contact.id,
  kind: contact.kind,
  label: contact.label,
  value: contact.value,
  href: contact.href,
  external: contact.isExternal,
  accessibleLabel: contact.accessibleLabel,
}));

export const getContactChannels = cache((): ContactChannel[] => {
  const stored = readContacts();
  // Пустая таблица — база не заполнена. Строки есть, но все скрыты — так решил владелец, и demo-
  // телефон в шапке всех страниц был бы ошибкой (найдено code review 2026-07-27).
  if (stored.length === 0) {
    return listAllContacts().length === 0 ? fallbackChannels : [];
  }

  return stored.map((contact) => ({
    id: contact.id,
    kind: contact.kind,
    label: contact.label,
    value: contact.value,
    href: contact.href,
    external: contact.isExternal,
    accessibleLabel: contact.accessibleLabel || `${contact.label}: ${contact.value}`,
  }));
});

export const getContactsPageCopy = cache((): ContactsCopy => {
  const fallback = seedPageContent.contacts as ContactsCopy;
  const merged = { ...fallback, ...getPageContent<Partial<ContactsCopy>>("contacts", fallback) };
  return safePageCopy("contacts", merged, fallback);
});
