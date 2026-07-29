import type { ContactsCopy } from "@/features/contacts/contactData";
import { ContactsEditor } from "@/features/admin/ContactsEditor";
import seedPageContent from "../../../../data/seed/page-content.json";
import { listAllContacts } from "@/server/repositories/contacts";
import { getPageContent } from "@/server/repositories/pageContent";

/**
 * Раздел «Контакты» — единый источник телефона, почты и мессенджеров для всего сайта.
 *
 * Здесь же тексты страницы контактов: заголовок, подзаголовок и подписи блоков.
 */
export default function AdminContactsPage() {
  const fallback = seedPageContent.contacts as ContactsCopy;
  const copy = { ...fallback, ...getPageContent<Partial<ContactsCopy>>("contacts", fallback) };

  return <ContactsEditor contacts={listAllContacts()} copy={copy} />;
}
