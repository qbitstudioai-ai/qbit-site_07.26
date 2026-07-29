"use client";

import { useCallback } from "react";
import type { ContactsCopy } from "@/features/contacts/contactData";
import styles from "./admin.module.css";
import {
  CheckboxField,
  Field,
  ListEditor,
  SaveBar,
  SelectField,
  TextAreaField,
  TextField,
} from "./formKit";
import { readApiError, useEditableForm } from "./useEditableForm";

/**
 * Редактор контактов.
 *
 * Здесь ОДИН набор контактов на весь сайт: этот же телефон стоит в шапке каждой страницы, этот же
 * Telegram открывают все кнопки «Ваша задача». До появления админ-панели номер лежал в двух местах
 * и правка в одном оставляла второй устаревшим — поэтому у полей есть роль (`kind`), и шапка берёт
 * канал по роли, а не по порядку в списке.
 */

export interface ContactRecordView {
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
}

const KIND_OPTIONS = [
  { value: "phone", label: "Телефон (он же в шапке сайта)" },
  { value: "phone-extra", label: "Дополнительный телефон" },
  { value: "email", label: "Электронная почта" },
  { value: "telegram-primary", label: "Telegram для кнопок сайта" },
  { value: "telegram", label: "Telegram (прочее)" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "vk", label: "ВКонтакте" },
  { value: "address", label: "Адрес" },
  { value: "hours", label: "Режим работы" },
  { value: "other", label: "Другое" },
] as const;

interface ContactsFormValue {
  items: ContactRecordView[];
  copy: ContactsCopy;
}

export function ContactsEditor({
  contacts,
  copy,
}: {
  contacts: ContactRecordView[];
  copy: ContactsCopy;
}) {
  const save = useCallback(async (value: ContactsFormValue) => {
    // Два независимых сохранения: список каналов и тексты страницы живут в разных таблицах.
    // Порядок важен — сначала контакты: именно они видны на всех страницах сайта.
    const contactsResponse = await fetch("/api/admin/contacts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: value.items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })),
      }),
    });
    if (!contactsResponse.ok) throw await readApiError(contactsResponse);

    const copyResponse = await fetch("/api/admin/pages/contacts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value.copy }),
    });
    if (!copyResponse.ok) throw await readApiError(copyResponse);

    return {
      items: value.items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })),
      copy: value.copy,
    };
  }, []);

  const form = useEditableForm<ContactsFormValue>({ items: contacts, copy }, save);
  const { value, setValue } = form;

  const updateCopy = <K extends keyof ContactsCopy>(key: K, next: ContactsCopy[K]) =>
    setValue((current) => ({ ...current, copy: { ...current.copy, [key]: next } }));

  return (
    <div>
      <SaveBar form={form} publicHref="/contacts" />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Способы связи</h2>
        <p className={styles.panelNote}>
          Порядок в этом списке — порядок на странице контактов. Канал с ролью «Телефон»
          показывается в шапке каждой страницы, канал с ролью «Telegram для кнопок сайта» открывают
          все кнопки «Ваша задача».
        </p>

        <ListEditor<ContactRecordView>
          label="Каналы"
          items={value.items}
          addLabel="Добавить контакт"
          createItem={() => ({
            id: `contact-${Date.now()}`,
            kind: "other",
            label: "",
            value: "",
            href: "",
            accessibleLabel: "",
            headerLabel: "",
            isExternal: false,
            isPublished: true,
            sortOrder: 0,
          })}
          onChange={(items) => setValue((current) => ({ ...current, items }))}
          renderItem={(item, replace) => (
            <>
              <div className={styles.fieldRow}>
                <SelectField
                  label="Роль канала"
                  value={item.kind}
                  options={KIND_OPTIONS}
                  onChange={(next) => replace({ ...item, kind: next })}
                />
                <Field label="Подпись" required>
                  {(props) => (
                    <input
                      {...props}
                      value={item.label}
                      onChange={(event) => replace({ ...item, label: event.target.value })}
                    />
                  )}
                </Field>
              </div>

              <div className={styles.fieldRow}>
                <Field label="Значение (что видит посетитель)" required>
                  {(props) => (
                    <input
                      {...props}
                      value={item.value}
                      onChange={(event) => replace({ ...item, value: event.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label="Ссылка"
                  required
                  hint="Телефон — tel:+7…, почта — mailto:…, мессенджер — https://…"
                >
                  {(props) => (
                    <input
                      {...props}
                      value={item.href}
                      onChange={(event) => replace({ ...item, href: event.target.value })}
                    />
                  )}
                </Field>
              </div>

              <div className={styles.fieldRow}>
                <Field
                  label="Подпись в шапке сайта"
                  hint="Пусто — берётся «значение». Нужно, если в шапке номер набран иначе."
                >
                  {(props) => (
                    <input
                      {...props}
                      value={item.headerLabel}
                      onChange={(event) => replace({ ...item, headerLabel: event.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label="Описание для скринридера"
                  hint="Например: «Позвонить по номеру +7 937 534-65-75»."
                >
                  {(props) => (
                    <input
                      {...props}
                      value={item.accessibleLabel}
                      onChange={(event) =>
                        replace({ ...item, accessibleLabel: event.target.value })
                      }
                    />
                  )}
                </Field>
              </div>

              <CheckboxField
                label="Открывать в новой вкладке (внешний сайт)"
                checked={item.isExternal}
                onChange={(checked) => replace({ ...item, isExternal: checked })}
              />
              <CheckboxField
                label="Показывать на сайте"
                checked={item.isPublished}
                onChange={(checked) => replace({ ...item, isPublished: checked })}
              />
            </>
          )}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Тексты страницы «Контакты»</h2>

        <div className={styles.fieldRow}>
          <TextField
            label="Надзаголовок"
            value={value.copy.eyebrow}
            onChange={(next) => updateCopy("eyebrow", next)}
          />
          <TextField
            label="Название компании"
            value={value.copy.companyName}
            onChange={(next) => updateCopy("companyName", next)}
          />
        </div>

        <TextField
          label="Заголовок"
          value={value.copy.heading}
          onChange={(next) => updateCopy("heading", next)}
        />
        <TextAreaField
          label="Подзаголовок"
          rows={2}
          value={value.copy.subheading}
          onChange={(next) => updateCopy("subheading", next)}
        />
        <TextAreaField
          label="Вводный текст"
          rows={2}
          value={value.copy.intro}
          onChange={(next) => updateCopy("intro", next)}
        />

        <div className={styles.fieldRow}>
          <TextField
            label="Заголовок блока контактов"
            value={value.copy.contactsHeading}
            onChange={(next) => updateCopy("contactsHeading", next)}
          />
          <TextField
            label="Заголовок блока заявки"
            value={value.copy.formHeading}
            onChange={(next) => updateCopy("formHeading", next)}
          />
        </div>

        <TextAreaField
          label="Описание формы заявки"
          rows={2}
          value={value.copy.formDescription}
          onChange={(next) => updateCopy("formDescription", next)}
        />

        <div className={styles.fieldRow}>
          <TextField
            label="Адрес"
            hint="Пока не выводится на странице — заполните, если понадобится показать."
            value={value.copy.address}
            onChange={(next) => updateCopy("address", next)}
          />
          <TextField
            label="Режим работы"
            hint="Пока не выводится на странице — заполните, если понадобится показать."
            value={value.copy.workingHours}
            onChange={(next) => updateCopy("workingHours", next)}
          />
        </div>
      </section>

      <SaveBar form={form} publicHref="/contacts" />
    </div>
  );
}
