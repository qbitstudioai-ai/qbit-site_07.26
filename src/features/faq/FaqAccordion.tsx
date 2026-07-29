"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./FaqExperience.module.css";

/**
 * Запас времени на завершение раскрытия. CSS-переход `::details-content` длится 280 ms, анимация
 * проявления — 260 ms; после этого высота ответа окончательная и по ней можно считать прокрутку.
 *
 * Значение связано с длительностями в `FaqExperience.module.css` только этим комментарием: если их
 * увеличат, поднять и эту константу, иначе второй проход отработает до конечной высоты.
 */
const REVEAL_SETTLE_MS = 320;

/**
 * Контроллер списка вопросов. Отвечает ТОЛЬКО за поведение — разметка приходит с сервера через
 * `children`, поэтому все 14 вопросов и ответов остаются в SSG-HTML, а не создаются на клиенте.
 *
 * Что он добавляет к нативным `<details>`:
 *   1. Эксклюзивность, не зависящую от поддержки атрибута `name` (Safari <17.2, Firefox <130).
 *      Атрибут `name` при этом сохранён: без JavaScript он даёт то же поведение в браузерах,
 *      которые его понимают, а в остальных страница просто работает как обычный набор `<details>`.
 *   2. Подскролл к раскрытому вопросу, если тот вышел за границы видимой области.
 *
 * Обработчик слушает нативное событие `toggle` в ФАЗЕ ПЕРЕХВАТА: `toggle` не всплывает, но фаза
 * перехвата проходит через предков в любом случае. Это позволяет обойтись одним слушателем на весь
 * список вместо четырнадцати.
 *
 * От зацикливания защищает проверка `!item.open`: закрытие соседей само порождает `toggle`, но у
 * закрытого элемента обработчик выходит сразу. Флаг `isSyncing` оставлен как дополнительный барьер
 * на случай синхронной доставки события — по спецификации `toggle` ставится в очередь асинхронно,
 * поэтому в норме до его проверки дело не доходит.
 */
export function FaqAccordion({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    let isSyncing = false;
    let frame: number | undefined;
    let settleTimer: number | undefined;

    const scrollBehavior = (): ScrollBehavior =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

    /**
     * Десктопная раскладка узнаётся по фактическому режиму прокрутки самого списка, а не по ширине
     * окна: в раскладке «на доске» у него `overflow-y: auto`, в мобильном потоке — `visible`.
     */
    const isInternalScroller = () => {
      const { overflowY } = window.getComputedStyle(list);
      return overflowY === "auto" || overflowY === "scroll";
    };

    /**
     * Минимальный сдвиг, при котором элемент попадает в видимую область: если элемент выше самой
     * области, выравниваем по его верху, иначе подтягиваем ровно на величину выхода за край и не
     * выталкиваем при этом строку вопроса наверх.
     */
    const scrollDelta = (
      itemTop: number,
      itemBottom: number,
      viewTop: number,
      viewBottom: number,
    ) => {
      const overflowTop = itemTop - viewTop;
      const overflowBottom = itemBottom - viewBottom;

      if (itemBottom - itemTop >= viewBottom - viewTop || overflowTop < 0) return overflowTop;
      if (overflowBottom > 0) return Math.min(overflowBottom, overflowTop);
      return 0;
    };

    const reveal = (item: HTMLDetailsElement) => {
      const itemBox = item.getBoundingClientRect();

      if (isInternalScroller()) {
        // Десктоп: прокручивается ТОЛЬКО внутренний список, документ не трогаем.
        const listBox = list.getBoundingClientRect();
        const delta = scrollDelta(itemBox.top, itemBox.bottom, listBox.top, listBox.bottom);
        if (Math.abs(delta) < 1) return;
        list.scrollBy({ top: delta, behavior: scrollBehavior() });
        return;
      }

      // Мобильный: обычная прокрутка документа и только если элемент действительно не виден.
      const delta = scrollDelta(itemBox.top, itemBox.bottom, 0, window.innerHeight);
      if (Math.abs(delta) < 1) return;
      window.scrollBy({ top: delta, behavior: scrollBehavior() });
    };

    const scheduleReveal = (item: HTMLDetailsElement) => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);

      // Первый проход — сразу, чтобы реакция не запаздывала; второй — когда раскрытие доедет до
      // конечной высоты и станет понятен реальный размер ответа.
      frame = window.requestAnimationFrame(() => reveal(item));
      settleTimer = window.setTimeout(() => reveal(item), REVEAL_SETTLE_MS);
    };

    const handleToggle = (event: Event) => {
      const item = event.target;
      if (!(item instanceof HTMLDetailsElement) || !list.contains(item)) return;
      // Закрытие обрабатывать нечего: повторное нажатие закрывает вопрос нативно.
      if (isSyncing || !item.open) return;

      isSyncing = true;
      for (const other of list.querySelectorAll<HTMLDetailsElement>("details[open]")) {
        if (other !== item) other.open = false;
      }
      isSyncing = false;

      scheduleReveal(item);
    };

    list.addEventListener("toggle", handleToggle, true);

    return () => {
      list.removeEventListener("toggle", handleToggle, true);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, []);

  return (
    <div className={styles.list} ref={listRef}>
      {children}
    </div>
  );
}
