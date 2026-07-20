"use client";

import { useEffect, useReducer } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./TypedText.module.css";

interface TypedTextProps {
  /** Полный текст. Он ВСЕГДА присутствует в DOM целиком — анимируется только видимость символов. */
  text: string;
  /** Задержка между символами, мс. */
  stepMs?: number;
  /**
   * Пауза перед началом печати, мс (Step 15.5). Нужна потому, что окно пояснения появляется не
   * сразу, а ступенью каскада: без паузы текст набирался бы под ещё невидимым блоком и к моменту
   * его появления оказался бы уже готовым — печати пользователь не увидел бы вовсе.
   * Значение обязано совпадать с `animation-delay` соответствующей ступени в
   * PainGainPanel.module.css; оба берутся из констант в PainGainPanel.tsx.
   */
  startDelayMs?: number;
}

const DEFAULT_STEP_MS = 14;

/**
 * Печатающийся текст (Amendment 12).
 *
 * Компонент рендерит ДВА слоя одного и того же текста, и это не дублирование по недосмотру:
 *
 * 1. **Видимый слой** — посимвольные `<span>`, у которых анимируется `opacity`. Помечен
 *    `aria-hidden="true"`: для дерева доступности его нет. Строка НЕ наращивается через
 *    `text.slice(0, n)` намеренно — все символы занимают своё место с первого кадра, поэтому текст
 *    не перекомпоновывается по мере набора и окно физически не может дёрнуться (прямое требование
 *    пользователя, Amendment 12). Это свойство раскладки, а не подобранная высота.
 * 2. **Доступный слой** — один текстовый узел с полным предложением, скрытый визуально
 *    (`clip-path`, см. `.accessibleText`). Именно он попадает в дерево доступности и его объявляет
 *    `aria-live` родителя — на любой стадии анимации (`CLAUDE.md`: critical content must not depend
 *    on animation completion). Он же не меняется во время печати, поэтому живой регион не
 *    переобъявляет текст на каждом кадре.
 *
 * ВАЖНО для будущих правок: первая редакция обходилась ОДНИМ слоем, без `aria-hidden`, и утверждала,
 * что раз символы не выпадают из дерева (`opacity`, а не `display: none`), то скринридер получает
 * целое предложение. Это оказалось неверно и было опровергнуто замером AX-дерева через CDP:
 * предложение из 68 символов представлялось 68 однобуквенными StaticText-узлами, узла с полным
 * текстом не было ни одного. «Символы не выпадают из дерева» и «текст читается предложением» —
 * разные вещи. Не сворачивайте два слоя обратно в один: разделение здесь и есть исправление.
 *
 * Плата за это — `textContent` родителя содержит текст дважды, поэтому тесты целятся в конкретный
 * слой через `data-typed-visual` / `data-typed-accessible`, а не в сам `<p>`.
 *
 * При `prefers-reduced-motion: reduce` слоёв нет вовсе — возвращается обычный текст.
 */
/**
 * `useReducer`, а не `useState` — по той же причине и тем же приёмом, что в `OfficeMachine.tsx`:
 * правило `react-hooks/set-state-in-effect` запрещает setState внутри эффекта (в том числе из
 * колбэка таймера, объявленного в нём), но `dispatch` пропускает. Логика от этого не усложняется:
 * состояние здесь и так сводится к двум переходам — «начать заново» и «показать ещё символ».
 */
type TypingAction = { type: "restart" } | { type: "advance"; total: number };

function typedCountReducer(typedCount: number, action: TypingAction): number {
  if (action.type === "restart") return 0;
  return Math.min(typedCount + 1, action.total);
}

export function TypedText({ text, stepMs = DEFAULT_STEP_MS, startDelayMs = 0 }: TypedTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Сколько символов уже «напечатано». Начальное значение — весь текст: на сервере и до эффекта
  // разметка приходит готовой, а не пустой, поэтому без JavaScript пояснение видно целиком.
  const [typedCount, dispatch] = useReducer(typedCountReducer, text.length);

  useEffect(() => {
    // При reduced-motion состояние не трогается вовсе: ветка ниже возвращает обычный текст, и
    // typedCount на неё не влияет.
    if (prefersReducedMotion) return;

    // Печать начинается заново на каждый новый text — это и есть выбранное пользователем поведение
    // «прервать и печатать новое»: смена пункта боли меняет проп, эффект перезапускается, прежний
    // интервал снимается в cleanup. Отдельной логики отмены не нужно.
    dispatch({ type: "restart" });
    let shown = 0;
    let typing: ReturnType<typeof setInterval> | undefined;

    // Пауза перед стартом (Step 15.5). Символы всё это время уже в DOM, просто прозрачны — то есть
    // ожидание касается только визуальной печати, а доступный слой с полным текстом виден AT сразу,
    // как и раньше.
    const startTimer = setTimeout(() => {
      typing = setInterval(() => {
        shown += 1;
        dispatch({ type: "advance", total: text.length });
        if (shown >= text.length) clearInterval(typing);
      }, stepMs);
    }, startDelayMs);

    // Снимаются ОБА таймера: без очистки startTimer быстрое переключение боли оставило бы
    // отложенный старт от предыдущего текста, и он запустил бы вторую печать поверх новой.
    return () => {
      clearTimeout(startTimer);
      if (typing) clearInterval(typing);
    };
  }, [text, stepMs, startDelayMs, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <>{text}</>;
  }

  // Ключ включает сам символ, а не только индекс: при смене пояснения React иначе переиспользовал бы
  // span'ы по позиции и на долю секунды показывал бы смесь старого и нового текста.
  return (
    <>
      {/* Визуальный слой печати СКРЫТ ОТ ДЕРЕВА ДОСТУПНОСТИ. Первая редакция этого компонента
          обходилась без aria-hidden и утверждала в комментарии, что «скринридер получает целое
          предложение». Это оказалось неверно и было опровергнуто замером (skeptic Phase B, снимок
          AX-дерева через CDP): предложение из 68 символов представлялось 68 однобуквенными
          StaticText-узлами, узла с полным текстом не было ни одного. Символы из дерева
          действительно не выпадают (opacity, а не display) — но «не выпадают» и «читаются как
          предложение» это разные вещи. Поэтому глифы теперь чисто визуальные, а текст для AT
          отдаётся отдельным узлом ниже. */}
      <span aria-hidden="true" data-typed-visual="true">
        {Array.from(text).map((character, index) => (
          <span
            key={`${index}-${character}`}
            className={index < typedCount ? styles.typed : styles.pending}
          >
            {character}
          </span>
        ))}
      </span>
      {/* Доступная копия: ОДИН текстовый узел с полным предложением, визуально скрытый. Именно её
          читает скринридер и объявляет aria-live родителя — независимо от стадии анимации
          (AC9, CLAUDE.md: critical content must not depend on animation completion).
          Копия появляется в DOM с первого кадра и не меняется во время печати, поэтому живой регион
          не переобъявляет текст посимвольно. */}
      <span className={styles.accessibleText} data-typed-accessible="true">
        {text}
      </span>
    </>
  );
}
