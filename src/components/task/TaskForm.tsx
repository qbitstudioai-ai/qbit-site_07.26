"use client";

import { useId, useState } from "react";
import type { TaskSectionCopy } from "@/content/types";
import {
  TASK_MESSAGE_MAX_LENGTH,
  TASK_MESSAGE_MIN_LENGTH,
  isSubmittableTaskMessage,
} from "@/features/task-request/validation";
import styles from "./TaskForm.module.css";

interface TaskFormProps {
  copy: TaskSectionCopy;
  /** Прямой контакт — запасной путь, если отправка не удалась. */
  contactHref: string;
}

type SubmitStatus = "idle" | "sending" | "success" | "error" | "too-short";

export function TaskForm({ copy, contactHref }: TaskFormProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const fieldId = useId();
  const hintId = useId();

  const isSending = status === "sending";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    // Валидация теми же правилами, что и на сервере (общий модуль validation.ts) — чтобы форма не
    // пропускала то, что сервер отвергнет, и наоборот.
    if (!isSubmittableTaskMessage(message)) {
      setStatus("too-short");
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch("/api/task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      // Успехом считается ТОЛЬКО ok-ответ. 503 (бот не настроен), 429 и 502 попадают сюда же и
      // показываются как ошибка — форма не имеет права рапортовать об отправке, которой не было.
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={fieldId}>
        {copy.fieldLabel}
      </label>
      <textarea
        id={fieldId}
        className={styles.field}
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          // Сообщение об ошибке снимается, как только человек начал править ввод: висящая красная
          // строка над полем, которое уже исправили, — ложная тревога.
          if (status === "too-short" || status === "error") setStatus("idle");
        }}
        placeholder={copy.placeholder}
        maxLength={TASK_MESSAGE_MAX_LENGTH}
        rows={8}
        disabled={isSending}
        aria-describedby={hintId}
      />

      {/* Honeypot: спрятан от людей (в том числе от скринридеров — aria-hidden + tabIndex=-1), но
          виден ботам, которые заполняют все поля формы подряд. Сервер молча отбрасывает такие
          заявки. autoComplete="off" — чтобы браузер не подставил сюда что-нибудь за человека. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={`${fieldId}-website`}>Не заполняйте это поле</label>
        <input
          id={`${fieldId}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <p id={hintId} className={styles.hint}>
        {message.trim().length} / {TASK_MESSAGE_MAX_LENGTH}
        {message.trim().length > 0 && message.trim().length < TASK_MESSAGE_MIN_LENGTH
          ? ` — минимум ${TASK_MESSAGE_MIN_LENGTH} символов`
          : ""}
      </p>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isSending}>
          {isSending ? copy.sendingLabel : copy.submitLabel}
        </button>
      </div>

      {/* Состояние отправки объявляется скринридеру, а не только показывается цветом (CLAUDE.md
          Accessibility rules: «Meaning never relies only on colour»). role="status" + aria-live
          зачитывают изменение, не перебивая пользователя. Контейнер присутствует в DOM всегда —
          иначе первое сообщение не будет объявлено: aria-live отслеживает изменения ВНУТРИ узла,
          который уже существовал. */}
      <p className={styles.status} role="status" aria-live="polite">
        {status === "success" ? copy.successMessage : null}
        {status === "too-short" ? copy.tooShortMessage : null}
        {status === "error" ? (
          <>
            {copy.errorMessage}{" "}
            <a href={contactHref} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
          </>
        ) : null}
      </p>
    </form>
  );
}
