"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./admin.module.css";
import type { EditableForm } from "./useEditableForm";

/**
 * Элементы форм админ-панели: подпись, ошибка, подсказка, кнопки, редактор списка, подтверждение
 * удаления и панель сохранения.
 *
 * Собраны в одном модуле, потому что вместе они и образуют «язык» интерфейса: если панель
 * сохранения в одном разделе называет действие «Сохранить», а в другом «Применить», владелец сайта
 * каждый раз заново разбирается, что делает кнопка.
 */

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Служебная строка под подсказкой — например счётчик символов. */
  counter?: ReactNode;
  children: (props: { id: string; className: string; "aria-invalid"?: true }) => ReactNode;
}

export function Field({ label, required, hint, error, counter, children }: FieldProps) {
  const id = useId();
  const className = `${styles.input} ${error ? styles.inputError : ""}`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.requiredMark} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ id, className, ...(error ? { "aria-invalid": true as const } : {}) })}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      {counter}
      {error ? (
        <strong className={styles.fieldError} role="alert">
          {error}
        </strong>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  type?: "text" | "date" | "number" | "url";
  /**
   * Рекомендуемая длина значения. Включает счётчик символов под полем.
   *
   * Именно рекомендация, а не ограничение: `maxLength` здесь НЕ ставится и сохранение не
   * блокируется. Поле, которое молча перестаёт принимать текст, владелец сайта воспринимает как
   * поломку — а превышение рекомендации не делает страницу неправильной, лишь означает, что
   * выдача обрежет хвост строки.
   */
  recommendedLength?: number;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  recommendedLength,
  ...rest
}: TextFieldProps) {
  return (
    <Field
      label={label}
      {...rest}
      counter={
        recommendedLength ? (
          <CharacterCounter length={value.trim().length} recommended={recommendedLength} />
        ) : undefined
      }
    >
      {(props) => (
        <input
          {...props}
          type={type}
          value={value}
          placeholder={rest.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * Счётчик символов рядом с подсказкой.
 *
 * `aria-live="polite"`, а не молчаливый текст: длина заголовка — это то, ради чего поле и
 * заполняют, и пользователю скринридера она нужна так же, как зрячему. `polite` — чтобы объявление
 * не перебивало набор на каждой букве.
 */
function CharacterCounter({ length, recommended }: { length: number; recommended: number }) {
  return (
    <span className={styles.hint} aria-live="polite">
      {length} симв. — рекомендуется до {recommended}
      {length > recommended ? " (выдача обрежет хвост)" : ""}
    </span>
  );
}

// `recommendedLength` исключён: счётчик сделан для однострочных заголовков, и молча
// проигнорированный проп хуже отсутствующего.
interface TextAreaFieldProps extends Omit<TextFieldProps, "type" | "recommendedLength"> {
  rows?: number;
  monospace?: boolean;
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  monospace,
  ...rest
}: TextAreaFieldProps) {
  return (
    <Field label={label} {...rest}>
      {(props) => (
        <textarea
          {...props}
          className={`${styles.textarea} ${monospace ? styles.editorArea : ""} ${
            rest.error ? styles.inputError : ""
          }`}
          rows={rows}
          value={value}
          placeholder={rest.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  error?: string;
}

export function SelectField({ label, value, onChange, options, ...rest }: SelectFieldProps) {
  return (
    <Field label={label} {...rest}>
      {(props) => (
        <select
          {...props}
          className={styles.select}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={styles.checkboxField}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/**
 * Редактор списка однотипных пунктов: добавить, удалить, изменить порядок.
 *
 * Владелец сайта не должен править JSON руками — это прямое требование к панели. `renderItem`
 * получает элемент и функцию замены, поэтому один и тот же редактор обслуживает и простой список
 * строк, и пары «проблема → результат», и тарифы.
 */
interface ListEditorProps<T> {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, replace: (next: T) => void, index: number) => ReactNode;
  addLabel?: string;
  /** Если задано, добавление/удаление отключается — набор фиксирован по смыслу данных. */
  fixedLength?: number;
  hint?: string;
}

export function ListEditor<T>({
  label,
  items,
  onChange,
  createItem,
  renderItem,
  addLabel = "Добавить пункт",
  fixedLength,
  hint,
}: ListEditorProps<T>) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const replaceAt = (index: number, item: T) => {
    const next = [...items];
    next[index] = item;
    onChange(next);
  };

  const isFixed = typeof fixedLength === "number";

  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>{label}</legend>
      {hint ? <span className={styles.hint}>{hint}</span> : null}

      <div className={styles.listEditor}>
        {items.map((item, index) => (
          <div className={styles.listItem} key={index}>
            <div className={styles.listItemBody}>
              <span className={styles.listIndex}>{index + 1}</span>
              {renderItem(item, (next) => replaceAt(index, next), index)}
            </div>
            <div className={styles.listItemControls}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSmall}`}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Переместить пункт ${index + 1} вверх`}
              >
                ↑
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSmall}`}
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Переместить пункт ${index + 1} вниз`}
              >
                ↓
              </button>
              {!isFixed ? (
                <button
                  type="button"
                  className={`${styles.buttonDanger} ${styles.buttonSmall}`}
                  onClick={() => onChange(items.filter((_, position) => position !== index))}
                  aria-label={`Удалить пункт ${index + 1}`}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!isFixed ? (
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange([...items, createItem()])}
        >
          {addLabel}
        </button>
      ) : (
        <span className={styles.hint}>
          Количество пунктов фиксировано ({fixedLength}) — этого требует раскладка страницы.
        </span>
      )}
    </fieldset>
  );
}

/**
 * Панель сохранения: состояние правок, кнопки «Сохранить» и «Отменить изменения», сообщение об
 * ошибке или успехе. Одна на форму — владелец сайта всегда смотрит в одно и то же место.
 */
export function SaveBar<T>({
  form,
  publicHref,
  children,
}: {
  form: EditableForm<T>;
  publicHref?: string;
  children?: ReactNode;
}) {
  const { isDirty, saveState, save, reset } = form;

  return (
    <div className={styles.panel}>
      {saveState.status === "error" ? (
        <p className={styles.messageError} role="alert">
          {saveState.message}
        </p>
      ) : null}
      {saveState.status === "saved" ? (
        <p className={styles.messageSuccess} role="status">
          Изменения сохранены и опубликованы на сайте.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={() => void save()}
          disabled={saveState.status === "saving" || !isDirty}
        >
          {saveState.status === "saving" ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={reset}
          disabled={!isDirty || saveState.status === "saving"}
        >
          Отменить изменения
        </button>
        {publicHref ? (
          <a
            className={styles.buttonGhost}
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть на сайте ↗
          </a>
        ) : null}
        {children}

        <span className={styles.statusBar}>
          {isDirty ? (
            <span className={styles.statusDirty}>Есть несохранённые изменения</span>
          ) : (
            <span className={styles.statusSaved}>Всё сохранено</span>
          )}
          <span className={styles.hint}>Сохранить: Ctrl+S</span>
        </span>
      </div>
    </div>
  );
}

/** Подтверждение опасного действия. Удаление без явного «да» в этой панели невозможно. */
export function ConfirmDialog({
  title,
  text,
  confirmLabel = "Удалить",
  onConfirm,
  onCancel,
  isBusy,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <div className={styles.dialogBackdrop}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-label={title}>
        <p className={styles.dialogTitle}>{title}</p>
        <p className={styles.dialogText}>{text}</p>
        <div className={styles.actions}>
          <button
            ref={confirmRef}
            type="button"
            className={styles.buttonDanger}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? "Удаляем…" : confirmLabel}
          </button>
          <button type="button" className={styles.button} onClick={onCancel} disabled={isBusy}>
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
}

export { styles as adminStyles };
