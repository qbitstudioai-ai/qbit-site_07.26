"use client";

import { useCallback, useEffect, useState } from "react";
import { type DocumentItem, loadDocuments } from "./documents";

export type DocumentsState =
  { status: "loading" } | { status: "ready"; documents: DocumentItem[] } | { status: "error" };

/**
 * Шов между источником данных и интерфейсом.
 *
 * Сейчас страница рендерится на сервере и передаёт готовый список — тогда хук сразу отдаёт
 * `ready`, и пользователь не видит ни скелетона, ни мигания. Когда каталог переедет в
 * админ-панель, страница перестанет передавать `initialDocuments`, и тот же хук начнёт грузить
 * данные через `loadDocuments()`, показывая `loading` и `error` состояниями, которые уже
 * отрисовывает `DocumentsExperience`. Компоненты при этом не меняются.
 */
export function useDocuments(initialDocuments?: DocumentItem[] | null): {
  state: DocumentsState;
  reload: () => void;
} {
  const hasInitialData = Array.isArray(initialDocuments);
  const [state, setState] = useState<DocumentsState>(() =>
    hasInitialData ? { status: "ready", documents: initialDocuments } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hasInitialData) return;

    let cancelled = false;

    loadDocuments().then(
      (documents) => {
        if (!cancelled) setState({ status: "ready", documents });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt, hasInitialData]);

  // Возврат в `loading` живёт здесь, а не в эффекте: это реакция на действие пользователя, и
  // синхронный setState внутри эффекта означал бы лишний каскадный рендер на каждом монтировании.
  const reload = useCallback(() => {
    if (hasInitialData) return;
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, [hasInitialData]);

  return { state, reload };
}
