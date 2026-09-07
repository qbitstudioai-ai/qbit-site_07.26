import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Измерители одноэкранности главной.
 *
 * Отдельный модуль, а не правка `helpers/layout.ts`: там `measureHorizontalOverflow` считает
 * «внутри скролл-контейнера» любого предка с `overflow-x` из {hidden, auto, scroll, clip}, и на неё
 * опираются `mobile-audit-regressions`, `office-overview` и ещё несколько спек по всем публичным
 * маршрутам. Смена её семантики поменяла бы смысл чужих проверок в одном шаге с этой правкой —
 * поэтому строгие измерители живут здесь, а `layout.ts` остаётся нетронутым (его матрицы экранов
 * переиспользуются).
 *
 * Чем эти измерители отличаются от прежних (skeptic FAIL, разбор от 2026-09-07):
 *
 *   1. Одноэкранность НЕ выводится из `documentElement.scrollHeight`. `.shell` — прямой потомок
 *      `body` с `height: 100dvh; overflow: hidden`, поэтому переполнение его потомков в scrollable
 *      overflow корня не попадает НИКОГДА. Замерено: `<div style="height:5000px">` внутри `<main>`
 *      на 390×844 оставляет `documentElement.scrollHeight` равным 844. Любая проверка вида
 *      «scrollHeight ≤ clientHeight» на главной неопровержима и ничего не охраняет.
 *      Здесь вместо этого перечисляются ФАКТИЧЕСКИЕ скролл-порты (`main`, `.office`, колонки
 *      отдела) и проверяется содержимое относительно них.
 *
 *   2. `overflow: hidden` и `overflow: clip` больше НЕ считаются оправданием. Раньше предок с
 *      `hidden` объявлял потомка «лежащим в скролл-контейнере», из-за чего элементная проверка была
 *      мертва: `body { overflow-x: hidden }` (globals.css) есть у всего дерева, и список нарушителей
 *      всегда оказывался пустым — замерено на элементе `position:absolute; left:2000px`, который
 *      поднимал `scrollWidth` до 2300 при `clientWidth` 390 и всё равно не попадал в список.
 *      Настоящий скролл-порт — только `auto` и `scroll`; `hidden`/`clip` — это обрезка.
 *
 *   3. Достижимость проверяется БЕЗ `scrollIntoViewIfNeeded()`. Тот прокручивает и
 *      `overflow: hidden`-боксы, чего пользователь сделать не может: на 768×1024 CTA отдела
 *      «доезжала» до экрана только потому, что браузер по просьбе теста прокручивал скрытый
 *      контейнер `CustomerBenefits.result` (`overflow-y: hidden`, clientHeight 130 против
 *      scrollHeight 299). Здесь прокручиваются ТОЛЬКО контейнеры с `auto`/`scroll` и только в
 *      пределах их собственного диапазона — ровно то, что доступно пальцу и колесу.
 */

/** Субпиксельный допуск. Дробный DPR даёт расхождение в единицу; нулевой допуск ломает замеры зря. */
export const PIXEL_TOLERANCE = 1;

/**
 * Что считается «содержимым».
 *
 * Проверяются семантические и интерактивные узлы — текст, заголовки, ссылки, кнопки, поля. Слои
 * оформления (фотосцена, градиенты, декоративные обёртки) намеренно не проверяются: их обрезка
 * границей `overflow: hidden` — это приём вёрстки (`SceneCrossfade .stack` — hidden +
 * border-radius), а не потеря содержимого. Правило «текст и управление достижимы, декор может быть
 * обрезан» — единственное, которое можно проверять строго и без ложных срабатываний на дизайне.
 */
export const CONTENT_SELECTOR =
  'a, button, input, textarea, select, summary, h1, h2, h3, h4, p, li, label, [role="button"], [role="link"]';

export interface DocumentFrame {
  innerWidth: number;
  innerHeight: number;
  /** Реально достигнутая прокрутка документа после попытки увести его в оба края. */
  reachedX: number;
  reachedY: number;
  /** Оболочка `.shell` — прямой потомок `body`, внутри которого лежит `main`. */
  shell: { top: number; right: number; bottom: number; left: number } | null;
}

/**
 * Рамка документа: прокручивается ли он вообще и занимает ли оболочка ровно экран.
 *
 * Это НЕОБХОДИМОЕ, но заведомо НЕДОСТАТОЧНОЕ условие одноэкранности: оно держится одной строкой
 * `.shell { height: 100dvh; overflow: hidden }` и не может упасть от переполнения содержимого.
 * Оставлено как охрана самой этой строки — за содержимое отвечают измерители ниже.
 */
export async function readDocumentFrame(page: Page): Promise<DocumentFrame> {
  return page.evaluate(() => {
    window.scrollTo(10_000, 10_000);
    const reachedX = window.scrollX;
    const reachedY = window.scrollY;
    window.scrollTo(0, 0);

    let shellElement: HTMLElement | null = document.querySelector("main");
    while (shellElement && shellElement.parentElement !== document.body) {
      shellElement = shellElement.parentElement;
    }
    const rect = shellElement?.getBoundingClientRect() ?? null;

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      reachedX,
      reachedY,
      shell: rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
          }
        : null,
    };
  });
}

export interface ScrollPort {
  label: string;
  overflowX: string;
  overflowY: string;
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  scrollableX: boolean;
  scrollableY: boolean;
}

/**
 * Инвентарь НАСТОЯЩИХ скролл-портов страницы: `auto`/`scroll` и при этом реально переполненных.
 *
 * Именно они, а не документ, держат одноэкранность: docs/08 («Низкий desktop», «Mobile ≤767»)
 * описывает внутренний скролл панели как штатный аварийный режим по высоте.
 */
export async function collectScrollPorts(page: Page): Promise<ScrollPort[]> {
  return page.evaluate(() => {
    const describe = (element: Element) => {
      const first = String(element.className || "").split(" ")[0];
      const cleaned = first.replace(/-module__[A-Za-z0-9_]+__/, ".");
      return `${element.tagName.toLowerCase()}${cleaned ? `.${cleaned}` : ""}`;
    };

    const ports = [];
    for (const element of document.querySelectorAll("body *")) {
      const style = getComputedStyle(element);
      const scrollableY =
        ["auto", "scroll"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1;
      const scrollableX =
        ["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1;
      if (!scrollableX && !scrollableY) continue;

      ports.push({
        label: describe(element),
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollableX,
        scrollableY,
      });
    }
    return ports;
  });
}

export interface OutOfFrameEntry {
  label: string;
  text: string;
  rect: { top: number; right: number; bottom: number; left: number };
  /** Ось, по которой элемент вышел за экран и не лежит ни в одном настоящем скролл-порту. */
  axis: "x" | "y" | "xy";
  /** Предки с `overflow: hidden`/`clip`, которые режут элемент. Раньше они его «оправдывали». */
  clippedBy: string[];
}

/**
 * Содержательные элементы, вышедшие за экран и НЕ лежащие в настоящем скролл-порту по этой оси.
 *
 * Ось важна: вертикальный скроллер оправдывает уход вниз, но не уход вбок. Предок с
 * `overflow: hidden`/`clip` не оправдывает ничего — он попадает в `clippedBy` как виновник обрезки.
 */
export async function collectOutOfFrameContent(
  page: Page,
  contentSelector: string,
): Promise<OutOfFrameEntry[]> {
  return page.evaluate((selector) => {
    const describe = (element: Element) => {
      const first = String(element.className || "").split(" ")[0];
      const cleaned = first.replace(/-module__[A-Za-z0-9_]+__/, ".");
      return `${element.tagName.toLowerCase()}${cleaned ? `.${cleaned}` : ""}`;
    };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const entries: {
      label: string;
      text: string;
      rect: { top: number; right: number; bottom: number; left: number };
      axis: "x" | "y" | "xy";
      clippedBy: string[];
    }[] = [];

    for (const element of document.querySelectorAll(selector)) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }
      // `aria-hidden` — обещание, что узел не является содержимым для пользователя.
      if (element.closest('[aria-hidden="true"]')) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const outX = rect.right > viewportWidth + 1 || rect.left < -1;
      const outY = rect.bottom > viewportHeight + 1 || rect.top < -1;
      if (!outX && !outY) continue;

      let scrollerX = false;
      let scrollerY = false;
      const clippedBy = [];
      let parent = element.parentElement;
      while (parent) {
        const parentStyle = getComputedStyle(parent);
        if (
          ["auto", "scroll"].includes(parentStyle.overflowX) &&
          parent.scrollWidth > parent.clientWidth + 1
        ) {
          scrollerX = true;
        }
        if (
          ["auto", "scroll"].includes(parentStyle.overflowY) &&
          parent.scrollHeight > parent.clientHeight + 1
        ) {
          scrollerY = true;
        }
        if (["hidden", "clip"].includes(parentStyle.overflowX)) {
          const box = parent.getBoundingClientRect();
          if (rect.right > box.right + 1 || rect.left < box.left - 1)
            clippedBy.push(describe(parent));
        }
        if (["hidden", "clip"].includes(parentStyle.overflowY)) {
          const box = parent.getBoundingClientRect();
          if (rect.bottom > box.bottom + 1 || rect.top < box.top - 1)
            clippedBy.push(describe(parent));
        }
        parent = parent.parentElement;
      }

      const offendingX = outX && !scrollerX;
      const offendingY = outY && !scrollerY;
      if (!offendingX && !offendingY) continue;

      entries.push({
        label: describe(element),
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
        rect: {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
        },
        axis: offendingX && offendingY ? "xy" : offendingX ? "x" : "y",
        clippedBy: [...new Set(clippedBy)],
      });
    }
    return entries;
  }, contentSelector);
}

export interface ReachabilityReport {
  rect: { top: number; right: number; bottom: number; left: number };
  viewport: { width: number; height: number };
  /** Настоящие скролл-порты, которые пришлось подвинуть, и на сколько. */
  scrolled: string[];
  /** Предки с `overflow: hidden`/`clip`, чей client-бокс элемент покидает даже после прокрутки. */
  clippedBy: string[];
  fullyVisible: boolean;
}

/**
 * Доводит элемент до экрана, прокручивая ТОЛЬКО настоящие скролл-порты, и докладывает результат.
 *
 * Заменяет `scrollIntoViewIfNeeded()`: тот прокручивает и `overflow: hidden`-боксы, то есть
 * отвечает на вопрос «может ли до элемента дотянуться скрипт», а не «может ли до него дотянуться
 * пользователь». Прокрутка идёт изнутри наружу и всегда зажимается собственным диапазоном
 * контейнера (`0 … scrollHeight - clientHeight`) — «до допустимого предела», не дальше.
 */
export async function reachByUserScrolling(locator: Locator): Promise<ReachabilityReport> {
  return locator.evaluate((element) => {
    const describe = (node: Element) => {
      const first = String(node.className || "").split(" ")[0];
      const cleaned = first.replace(/-module__[A-Za-z0-9_]+__/, ".");
      return `${node.tagName.toLowerCase()}${cleaned ? `.${cleaned}` : ""}`;
    };

    const scrolled: string[] = [];

    // Изнутри наружу: прокрутка внешнего контейнера не меняет смещения внутри внутреннего,
    // поэтому одного прохода достаточно.
    const ports: HTMLElement[] = [];
    let parent = element.parentElement;
    while (parent) {
      ports.push(parent);
      parent = parent.parentElement;
    }

    for (const port of ports) {
      const style = getComputedStyle(port);
      const box = port.getBoundingClientRect();
      // client-бокс без рамок: содержимое обрезается именно по нему.
      const clientTop = box.top + port.clientTop;
      const clientLeft = box.left + port.clientLeft;
      const clientBottom = clientTop + port.clientHeight;
      const clientRight = clientLeft + port.clientWidth;

      if (
        ["auto", "scroll"].includes(style.overflowY) &&
        port.scrollHeight > port.clientHeight + 1
      ) {
        const rect = element.getBoundingClientRect();
        let delta = 0;
        if (rect.bottom > clientBottom) delta = rect.bottom - clientBottom;
        else if (rect.top < clientTop) delta = rect.top - clientTop;
        if (delta !== 0) {
          const max = port.scrollHeight - port.clientHeight;
          const next = Math.min(Math.max(port.scrollTop + delta, 0), max);
          if (next !== port.scrollTop) {
            scrolled.push(`${describe(port)} scrollTop ${port.scrollTop}→${Math.round(next)}`);
            port.scrollTop = next;
          }
        }
      }

      if (["auto", "scroll"].includes(style.overflowX) && port.scrollWidth > port.clientWidth + 1) {
        const rect = element.getBoundingClientRect();
        let delta = 0;
        if (rect.right > clientRight) delta = rect.right - clientRight;
        else if (rect.left < clientLeft) delta = rect.left - clientLeft;
        if (delta !== 0) {
          const max = port.scrollWidth - port.clientWidth;
          const next = Math.min(Math.max(port.scrollLeft + delta, 0), max);
          if (next !== port.scrollLeft) {
            scrolled.push(`${describe(port)} scrollLeft ${port.scrollLeft}→${Math.round(next)}`);
            port.scrollLeft = next;
          }
        }
      }
    }

    // Что осталось после прокрутки: попал ли элемент в экран и не режет ли его скрытый контейнер.
    const rect = element.getBoundingClientRect();
    const clippedBy: string[] = [];
    for (const port of ports) {
      const style = getComputedStyle(port);
      const box = port.getBoundingClientRect();
      const clientTop = box.top + port.clientTop;
      const clientLeft = box.left + port.clientLeft;
      const clientBottom = clientTop + port.clientHeight;
      const clientRight = clientLeft + port.clientWidth;

      if (
        ["hidden", "clip"].includes(style.overflowY) &&
        (rect.bottom > clientBottom + 1 || rect.top < clientTop - 1)
      ) {
        clippedBy.push(`${describe(port)} (overflow-y: ${style.overflowY})`);
      }
      if (
        ["hidden", "clip"].includes(style.overflowX) &&
        (rect.right > clientRight + 1 || rect.left < clientLeft - 1)
      ) {
        clippedBy.push(`${describe(port)} (overflow-x: ${style.overflowX})`);
      }
    }

    const fullyVisible =
      rect.top >= -1 &&
      rect.left >= -1 &&
      rect.bottom <= window.innerHeight + 1 &&
      rect.right <= window.innerWidth + 1;

    return {
      rect: {
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrolled,
      clippedBy: [...new Set(clippedBy)],
      fullyVisible,
    };
  });
}

/**
 * Документ не прокручивается и оболочка занимает ровно экран.
 *
 * Осознанно слабая проверка (см. `readDocumentFrame`) — держит CSS-инвариант `.shell`, но ничего не
 * говорит о содержимом.
 */
export async function expectDocumentPinned(page: Page, context: string) {
  const frame = await readDocumentFrame(page);

  expect(
    frame.reachedY,
    `${context}: документ прокрутился по вертикали на ${frame.reachedY}px`,
  ).toBe(0);
  expect(
    frame.reachedX,
    `${context}: документ прокрутился по горизонтали на ${frame.reachedX}px`,
  ).toBe(0);

  expect(frame.shell, `${context}: оболочка .shell не найдена`).not.toBeNull();
  expect(
    frame.shell!.top,
    `${context}: верх оболочки на ${frame.shell!.top}px`,
  ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
  expect(
    frame.shell!.bottom,
    `${context}: низ оболочки ${frame.shell!.bottom}px при экране ${frame.innerHeight}px`,
  ).toBeLessThanOrEqual(frame.innerHeight + PIXEL_TOLERANCE);
  expect(
    frame.shell!.left,
    `${context}: левый край оболочки на ${frame.shell!.left}px`,
  ).toBeGreaterThanOrEqual(-PIXEL_TOLERANCE);
  expect(
    frame.shell!.right,
    `${context}: правый край оболочки ${frame.shell!.right}px при ширине экрана ${frame.innerWidth}px`,
  ).toBeLessThanOrEqual(frame.innerWidth + PIXEL_TOLERANCE);
}
