"use client";

import { useCallback, useMemo, useState } from "react";
import type { Department, PainPoint } from "@/content/types";
import styles from "./admin.module.css";
import { CheckboxField, Field, ListEditor, SaveBar, TextAreaField, TextField } from "./formKit";
import { readApiError, useEditableForm } from "./useEditableForm";

/**
 * Редактор текстов отдела.
 *
 * Поля здесь не придуманы «под админку», а собраны из того, что реально показывает страница
 * отдела: подпись в офисе и проблема в обзоре, заголовок, блок «что происходит сейчас», пять пар
 * «проблема → результат» (это и есть «после внедрения»), четыре пункта «выгода для Вас» и подпись
 * кнопки, ведущей в раздел «Ваша задача».
 *
 * Количество пар и пунктов выгоды фиксировано (5 и 4): столько мест предусмотрено раскладкой
 * экрана отдела, и лишний пункт было бы некуда поставить. Поэтому редактор списка здесь работает
 * без добавления и удаления — только правка и порядок.
 */

export interface DepartmentRecord extends Department {
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string;
}

type DepartmentFormValue = Omit<DepartmentRecord, "sortOrder" | "updatedAt">;

function toFormValue(department: DepartmentRecord): DepartmentFormValue {
  // `sortOrder` и `updatedAt` в форму не попадают: порядок отделов задан схемой контента (к нему
  // привязаны зоны офиса), а дату изменения ставит сервер.
  const rest = { ...department } as Partial<DepartmentRecord>;
  delete rest.sortOrder;
  delete rest.updatedAt;
  return rest as DepartmentFormValue;
}

export function DepartmentsEditor({ departments }: { departments: DepartmentRecord[] }) {
  const [activeId, setActiveId] = useState(departments[0]?.id);
  const [records, setRecords] = useState(departments);

  const active = records.find((department) => department.id === activeId) ?? records[0];

  if (!active) {
    return <p className={styles.messageEmpty}>Данные ещё не добавлены</p>;
  }

  return (
    <div className={styles.splitLayout}>
      <nav className={styles.panel} aria-label="Список отделов">
        <h2 className={styles.panelTitle}>Отделы</h2>
        <p className={styles.panelNote}>Выберите отдел, чтобы отредактировать его тексты.</p>
        <div className={styles.recordList}>
          {records.map((department) => (
            <button
              key={department.id}
              type="button"
              className={`${styles.recordLink} ${
                department.id === active.id ? styles.recordLinkActive : ""
              }`}
              onClick={() => setActiveId(department.id)}
            >
              {department.name}
              <span className={styles.recordMeta}>
                {department.id}
                {department.isPublished ? "" : " · скрыт"}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <DepartmentForm
        // key по идентификатору: смена отдела должна начинать редактирование с чистого состояния,
        // а не переносить несохранённые правки предыдущего.
        key={active.id}
        department={active}
        onSaved={(saved) =>
          setRecords((current) =>
            current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)),
          )
        }
      />
    </div>
  );
}

function DepartmentForm({
  department,
  onSaved,
}: {
  department: DepartmentRecord;
  onSaved: (department: DepartmentFormValue) => void;
}) {
  const initial = useMemo(() => toFormValue(department), [department]);

  const save = useCallback(
    async (value: DepartmentFormValue) => {
      const { id, ...payload } = value;
      const response = await fetch(`/api/admin/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw await readApiError(response);

      onSaved(value);
      return value;
    },
    [onSaved],
  );

  const form = useEditableForm(initial, save);
  const { value, setValue, fieldErrors } = form;

  const update = <K extends keyof DepartmentFormValue>(key: K, next: DepartmentFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  return (
    <div>
      <SaveBar form={form} publicHref={`/?department=${value.id}`} />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Название и подписи</h2>
        <p className={styles.panelNote}>
          Системный идентификатор отдела — <code>{value.id}</code>. Он не меняется: к нему привязаны
          фотография сцены, зона на карте офиса и адрес решения.
        </p>

        <div className={styles.fieldRow}>
          <TextField
            label="Название отдела"
            required
            value={value.name}
            error={fieldErrors.name}
            onChange={(next) => update("name", next)}
          />
          <TextField
            label="Подпись в офисе"
            required
            hint="Короткая надпись на карте офиса."
            value={value.overviewLabel}
            error={fieldErrors.overviewLabel}
            onChange={(next) => update("overviewLabel", next)}
          />
        </div>

        <TextAreaField
          label="Проблема в обзоре"
          required
          rows={2}
          hint="Одна строка, которую посетитель видит до выбора отдела."
          value={value.overviewProblem}
          error={fieldErrors.overviewProblem}
          onChange={(next) => update("overviewProblem", next)}
        />

        <TextAreaField
          label="Описание при наведении"
          required
          rows={2}
          value={value.hoverDescription}
          error={fieldErrors.hoverDescription}
          onChange={(next) => update("hoverDescription", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Что происходит сейчас</h2>
        <p className={styles.panelNote}>Заголовок экрана отдела и описание текущего процесса.</p>

        <TextAreaField
          label="Заголовок"
          required
          rows={2}
          value={value.headline}
          error={fieldErrors.headline}
          onChange={(next) => update("headline", next)}
        />
        <TextAreaField
          label="Как работа идёт сейчас"
          required
          rows={3}
          value={value.problem}
          error={fieldErrors.problem}
          onChange={(next) => update("problem", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>После внедрения</h2>
        <p className={styles.panelNote}>
          Пять пар «проблема → результат». Левая колонка — что мешает сейчас, правая — что меняется
          после автоматизации. Количество пар фиксировано раскладкой экрана.
        </p>

        <ListEditor<PainPoint>
          label="Пары «проблема → результат»"
          items={value.painPoints}
          fixedLength={5}
          createItem={() => ({ pain: "", gain: "" })}
          onChange={(items) => update("painPoints", items)}
          renderItem={(item, replace) => (
            <>
              <Field label="Проблема сейчас" required>
                {(props) => (
                  <textarea
                    {...props}
                    className={styles.textarea}
                    rows={2}
                    value={item.pain}
                    onChange={(event) => replace({ ...item, pain: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Результат после внедрения" required>
                {(props) => (
                  <textarea
                    {...props}
                    className={styles.textarea}
                    rows={2}
                    value={item.gain}
                    onChange={(event) => replace({ ...item, gain: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Как это работает (необязательно)">
                {(props) => (
                  <textarea
                    {...props}
                    className={styles.textarea}
                    rows={2}
                    value={item.howItWorks ?? ""}
                    onChange={(event) =>
                      replace({ ...item, howItWorks: event.target.value || undefined })
                    }
                  />
                )}
              </Field>
            </>
          )}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Выгода для Вас</h2>
        <p className={styles.panelNote}>
          Четыре результата для бизнеса. Первый — основной, он выделен на экране отдела.
        </p>

        <ListEditor<string>
          label="Результаты"
          items={value.customerBenefits}
          fixedLength={4}
          createItem={() => ""}
          onChange={(items) => update("customerBenefits", items)}
          renderItem={(item, replace) => (
            <Field label="Результат" required>
              {(props) => (
                <textarea
                  {...props}
                  className={styles.textarea}
                  rows={2}
                  value={item}
                  onChange={(event) => replace(event.target.value)}
                />
              )}
            </Field>
          )}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Кнопка и публикация</h2>

        <TextField
          label="Текст кнопки"
          required
          hint="Кнопка ведёт в раздел «Ваша задача»."
          value={value.ctaLabel}
          error={fieldErrors.ctaLabel}
          onChange={(next) => update("ctaLabel", next)}
        />

        <CheckboxField
          label="Показывать отдел на сайте"
          checked={value.isPublished}
          onChange={(checked) => update("isPublished", checked)}
        />

        <details>
          <summary className={styles.label}>Служебные поля</summary>
          <p className={styles.hint}>
            Меняются редко. Адрес решения связывает отдел со страницей раздела, пометка — внутренняя
            подпись источника текста.
          </p>
          <div className={styles.fieldRow}>
            <TextField
              label="Адрес решения"
              required
              value={value.solutionPath}
              error={fieldErrors.solutionPath}
              onChange={(next) => update("solutionPath", next)}
            />
            <TextField
              label="Служебная пометка"
              required
              value={value.reference}
              error={fieldErrors.reference}
              onChange={(next) => update("reference", next)}
            />
          </div>
        </details>
      </section>

      <SaveBar form={form} publicHref={`/?department=${value.id}`} />
    </div>
  );
}
