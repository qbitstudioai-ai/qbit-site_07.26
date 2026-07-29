"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Общее поведение всех редакторов админ-панели.
 *
 * Одна и та же логика нужна каждой форме: помнить исходное значение, знать про несохранённые
 * правки, отменять их, не давать отправить форму дважды, показывать результат сохранения,
 * предупреждать при уходе со страницы и сохранять по Ctrl+S / Cmd+S.
 *
 * Автосохранения «на каждый символ» здесь нет намеренно: правка текста на публичном сайте — явное
 * действие, и владелец сайта должен видеть, что именно и когда он опубликовал.
 */

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string; details?: FieldIssue[] };

export interface FieldIssue {
  path: string;
  message: string;
}

interface ApiErrorPayload {
  error?: string;
  details?: FieldIssue[];
}

export interface EditableForm<T> {
  value: T;
  setValue: (updater: T | ((current: T) => T)) => void;
  isDirty: boolean;
  saveState: SaveState;
  /** Ошибки по полям с сервера: ключ — путь поля, значение — текст. */
  fieldErrors: Record<string, string>;
  save: () => Promise<void>;
  reset: () => void;
  /** Заменяет и текущее, и исходное значение — например, после успешного сохранения. */
  commit: (next: T) => void;
}

/** Одинаковый разбор ответа для всех административных запросов. */
export async function readApiError(response: Response): Promise<{
  message: string;
  details?: FieldIssue[];
}> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    // Ответ без тела — например, обрыв соединения. Ниже подставляется общий текст.
  }

  if (response.status === 401) {
    return { message: "Сессия истекла. Войдите заново." };
  }

  return {
    message: payload.error ?? "Не удалось сохранить изменения",
    details: payload.details,
  };
}

export function useEditableForm<T>(
  initial: T,
  onSave: (value: T) => Promise<T | void>,
): EditableForm<T> {
  const [value, setValueState] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const isSavingRef = useRef(false);

  // Сравнение по сериализации: значения — простые объекты из формы, а поверхностное сравнение
  // считало бы правку внутри вложенного списка «отсутствием изменений».
  const isDirty = JSON.stringify(value) !== JSON.stringify(baseline);

  const setValue = useCallback((updater: T | ((current: T) => T)) => {
    setValueState((current) =>
      typeof updater === "function" ? (updater as (c: T) => T)(current) : updater,
    );
    setSaveState((state) => (state.status === "saved" ? { status: "idle" } : state));
  }, []);

  const commit = useCallback((next: T) => {
    setValueState(next);
    setBaseline(next);
  }, []);

  const save = useCallback(async () => {
    // Повторная отправка блокируется здесь, а не только атрибутом `disabled`: Ctrl+S не смотрит на
    // состояние кнопки.
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setSaveState({ status: "saving" });

    try {
      const result = await onSave(value);
      const next = (result ?? value) as T;
      setValueState(next);
      setBaseline(next);
      setSaveState({ status: "saved" });
    } catch (error) {
      const failure = error as { message?: string; details?: FieldIssue[] };
      setSaveState({
        status: "error",
        message: failure.message ?? "Не удалось сохранить изменения",
        details: failure.details,
      });
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, value]);

  const reset = useCallback(() => {
    setValueState(baseline);
    setSaveState({ status: "idle" });
  }, [baseline]);

  // Предупреждение при уходе со страницы с несохранёнными правками.
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Текст задаёт браузер; важно лишь, что обработчик отменил событие.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Ctrl+S / Cmd+S — привычный жест сохранения. Перехватывается только при наличии правок, чтобы
  // не отбирать у браузера «сохранить страницу», когда сохранять нечего.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      if (!isDirty) return;

      event.preventDefault();
      void save();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, save]);

  const fieldErrors: Record<string, string> = {};
  if (saveState.status === "error" && saveState.details) {
    for (const issue of saveState.details) fieldErrors[issue.path] = issue.message;
  }

  return { value, setValue, isDirty, saveState, fieldErrors, save, reset, commit };
}
