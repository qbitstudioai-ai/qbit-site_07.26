"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ContactChannel } from "./contactData";
import {
  CONTACT_ENDPOINT,
  CONTACT_ERROR_FOCUS,
  CONTACT_FIELD_ORDER,
  CONTACT_HONEYPOT_FIELD,
  CONTACT_LIMITS,
  type ContactFieldKey,
  type ContactFormValues,
  collectContactErrors,
} from "./contactSchema";
import styles from "./ContactsExperience.module.css";

type FormStatus = "idle" | "sending" | "success" | "error";

const EMPTY_VALUES: ContactFormValues = { name: "", phone: "", telegram: "", process: "" };

const SUCCESS_MESSAGE = "Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному контакту.";
const ERROR_MESSAGE =
  "Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами напрямую.";
const CONTACT_HINT = "Укажите телефон или Telegram — достаточно одного контакта.";

/**
 * Прямые контакты, которые показываются рядом с сообщением об ошибке отправки: личный Telegram и
 * телефон. Отбираются по РОЛИ канала, а не по идентификатору, — набор контактов редактируется в
 * админ-панели, и жёсткий список id перестал бы совпадать после первой же правки.
 */
function selectFallbackChannels(channels: readonly ContactChannel[]): ContactChannel[] {
  return channels.filter(
    (channel) => channel.kind === "telegram-primary" || channel.kind === "phone",
  );
}

/**
 * Форма заявки страницы контактов.
 *
 * Единственный клиентский компонент раздела: весь остальной текст страницы, включая прямые
 * контакты, приходит серверным HTML. Валидация здесь — та же схема, что и на сервере
 * (`contactSchema.ts`), поэтому форма не пропускает то, что сервер отвергнет.
 *
 * Отправка идёт на собственный роут `/api/contact`, а не на webhook n8n: адрес и секрет webhook
 * живут только в серверном окружении и в браузер не попадают ни в каком виде.
 */
export function ContactForm({ channels }: { channels: readonly ContactChannel[] }) {
  const fallbackChannels = selectFallbackChannels(channels);
  const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<ContactFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormValues, boolean>>>({});
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [honeypot, setHoneypot] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const telegramRef = useRef<HTMLInputElement>(null);
  const processRef = useRef<HTMLTextAreaElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  // Момент, с которого человек мог начать заполнять форму. Устанавливается в эффекте, а не при
  // инициализации состояния: во время серверного рендера это было бы время сервера.
  const startedAtRef = useRef<number | null>(null);

  const id = useId();
  const fieldId = (field: string) => `${id}-${field}`;
  const errorId = (field: string) => `${id}-${field}-error`;
  const contactHintId = `${id}-contact-hint`;
  const contactErrorId = `${id}-contact-error`;

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const isSending = status === "sending";

  // Ошибка показывается только после первой отправки или после ухода из поля — не во время ввода.
  const visibleError = (field: keyof ContactFormValues) =>
    wasSubmitted || touched[field] ? errors[field] : undefined;
  const contactError =
    wasSubmitted || (touched.phone && touched.telegram) ? errors.contact : undefined;

  function updateValue(field: keyof ContactFormValues, value: string) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    // Уже показанная ошибка снимается, как только ввод стал корректным: висящая красная строка над
    // исправленным полем — ложная тревога. Новые ошибки во время набора не появляются.
    if (Object.keys(errors).length > 0) {
      const nextErrors = collectContactErrors(nextValues);
      setErrors((previous) => {
        const merged: Partial<Record<ContactFieldKey, string>> = {};
        for (const key of CONTACT_FIELD_ORDER) {
          if (previous[key] && nextErrors[key]) merged[key] = nextErrors[key];
        }
        return merged;
      });
    }

    if (status === "error") setStatus("idle");
  }

  function handleBlur(field: keyof ContactFormValues) {
    setTouched((previous) => ({ ...previous, [field]: true }));
    setErrors(collectContactErrors(values));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    setWasSubmitted(true);
    const nextErrors = collectContactErrors(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // Фокус — на первое ошибочное поле в порядке чтения формы. Остальные значения не трогаются.
      const firstKey = CONTACT_FIELD_ORDER.find((key) => nextErrors[key]);
      if (firstKey) {
        const target = {
          name: nameRef,
          phone: phoneRef,
          telegram: telegramRef,
          process: processRef,
        }[CONTACT_ERROR_FOCUS[firstKey]];
        target.current?.focus();
      }
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          [CONTACT_HONEYPOT_FIELD]: honeypot,
          elapsedMs: startedAtRef.current === null ? null : Date.now() - startedAtRef.current,
        }),
      });

      // Успех — только ok-ответ. 503 (webhook не настроен), 502 и 400 попадают в ветку ошибки:
      // форма не имеет права рапортовать об отправке, которой не было.
      if (!response.ok) {
        setStatus("error");
        return;
      }

      setStatus("success");
      setValues(EMPTY_VALUES);
      setTouched({});
      setWasSubmitted(false);
      setErrors({});
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={isSending}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={fieldId("name")}>
          Ваше имя
        </label>
        <input
          ref={nameRef}
          id={fieldId("name")}
          name="name"
          className={styles.input}
          type="text"
          value={values.name}
          onChange={(event) => updateValue("name", event.target.value)}
          onBlur={() => handleBlur("name")}
          placeholder="Павел"
          autoComplete="name"
          maxLength={CONTACT_LIMITS.name}
          required
          aria-invalid={visibleError("name") ? true : undefined}
          aria-describedby={visibleError("name") ? errorId("name") : undefined}
        />
        {visibleError("name") ? (
          <p className={styles.fieldError} id={errorId("name")}>
            {visibleError("name")}
          </p>
        ) : null}
      </div>

      {/* Телефон и Telegram — одна смысловая группа: обязательна не каждая из них, а их пара. */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Как с вами связаться</legend>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={fieldId("phone")}>
              Телефон
            </label>
            <input
              ref={phoneRef}
              id={fieldId("phone")}
              name="phone"
              className={styles.input}
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(event) => updateValue("phone", event.target.value)}
              onBlur={() => handleBlur("phone")}
              placeholder="+7 900 000-00-00"
              autoComplete="tel"
              maxLength={CONTACT_LIMITS.phone}
              aria-invalid={visibleError("phone") || contactError ? true : undefined}
              aria-describedby={
                [
                  contactHintId,
                  visibleError("phone") ? errorId("phone") : null,
                  contactError ? contactErrorId : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            {visibleError("phone") ? (
              <p className={styles.fieldError} id={errorId("phone")}>
                {visibleError("phone")}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={fieldId("telegram")}>
              Telegram
            </label>
            <input
              ref={telegramRef}
              id={fieldId("telegram")}
              name="telegram"
              className={styles.input}
              type="text"
              value={values.telegram}
              onChange={(event) => updateValue("telegram", event.target.value)}
              onBlur={() => handleBlur("telegram")}
              placeholder="@username"
              autoComplete="off"
              maxLength={CONTACT_LIMITS.telegram}
              aria-invalid={visibleError("telegram") || contactError ? true : undefined}
              aria-describedby={
                [
                  contactHintId,
                  visibleError("telegram") ? errorId("telegram") : null,
                  contactError ? contactErrorId : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            {visibleError("telegram") ? (
              <p className={styles.fieldError} id={errorId("telegram")}>
                {visibleError("telegram")}
              </p>
            ) : null}
          </div>
        </div>

        <p className={styles.hint} id={contactHintId}>
          {CONTACT_HINT}
        </p>
        {contactError ? (
          <p className={styles.fieldError} id={contactErrorId}>
            {contactError}
          </p>
        ) : null}
      </fieldset>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={fieldId("process")}>
          Какой процесс хотите автоматизировать
        </label>
        <textarea
          ref={processRef}
          id={fieldId("process")}
          name="process"
          className={styles.textarea}
          value={values.process}
          onChange={(event) => updateValue("process", event.target.value)}
          onBlur={() => handleBlur("process")}
          placeholder="Например: менеджеры вручную переносят заявки из Telegram в CRM и тратят время на подготовку отчётов."
          maxLength={CONTACT_LIMITS.process}
          rows={3}
          required
          aria-invalid={visibleError("process") ? true : undefined}
          aria-describedby={visibleError("process") ? errorId("process") : undefined}
        />
        {visibleError("process") ? (
          <p className={styles.fieldError} id={errorId("process")}>
            {visibleError("process")}
          </p>
        ) : null}
      </div>

      {/* Honeypot: спрятан от людей и от скринридеров, но виден ботам, заполняющим все поля подряд.
          В payload для n8n значение не попадает — сервер использует его только как признак бота. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={fieldId(CONTACT_HONEYPOT_FIELD)}>Не заполняйте это поле</label>
        <input
          id={fieldId(CONTACT_HONEYPOT_FIELD)}
          name={CONTACT_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <button type="submit" className={styles.submit} disabled={isSending}>
        {isSending ? "Отправляем…" : "Отправить заявку"}
      </button>

      {/* Два постоянных live-региона: контейнер должен существовать в DOM ДО появления текста,
          иначе первое сообщение не будет объявлено. Успех — role="status", ошибка — role="alert". */}
      <div className={styles.statusRegion} role="status">
        {status === "success" ? (
          <p className={styles.success} ref={successRef} tabIndex={-1}>
            {SUCCESS_MESSAGE}
          </p>
        ) : null}
      </div>

      <div className={styles.statusRegion} role="alert">
        {status === "error" ? (
          <p className={styles.error}>
            {ERROR_MESSAGE}{" "}
            <span className={styles.errorContacts}>
              {fallbackChannels.map((channel) => (
                <a
                  key={channel.id}
                  className={styles.errorLink}
                  href={channel.href}
                  aria-label={channel.accessibleLabel}
                  {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {channel.value}
                </a>
              ))}
            </span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
