/**
 * Формы данных раздела «Контакты».
 *
 * САМИ КОНТАКТЫ здесь больше не лежат: они хранятся в базе и правятся в `/admin/contacts`. Исходные
 * значения переехали в `data/seed/contacts.json`, чтение — `src/server/content/contacts.ts`.
 *
 * `label` — подпись канала, `value` — то, что видит человек, `href` — куда ведёт ссылка.
 * `external: true` означает переход на сторонний сайт (Telegram) в новой вкладке; `tel:`/`mailto:`
 * открываются нативным обработчиком и новой вкладки не требуют.
 */
export interface ContactChannel {
  id: string;
  /**
   * Роль канала: `phone`, `email`, `telegram-primary` (адрес, на который ведут CTA сайта),
   * `telegram`, `whatsapp`, `vk`, `address`, `hours`, `other`. Именно по роли, а не по
   * идентификатору, компоненты выбирают нужный канал — набор контактов редактируется владельцем
   * сайта, и жёсткий список id перестал бы совпадать после первой же правки.
   */
  kind: string;
  label: string;
  value: string;
  href: string;
  external: boolean;
  /** Доступное имя ссылки: «t.me/qbit_studioai» без контекста ничего не сообщает скринридеру. */
  accessibleLabel: string;
}

/** Тексты верхнего блока и рабочей панели страницы контактов. */
export interface ContactsCopy {
  eyebrow: string;
  heading: string;
  subheading: string;
  intro: string;
  contactsHeading: string;
  formHeading: string;
  formDescription: string;
  companyName: string;
  address: string;
  workingHours: string;
}
