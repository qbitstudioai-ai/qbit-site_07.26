import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Общие измерения раскладки для мобильной приёмки (аудит 2026-07-28).
 *
 * Живёт в `helpers/`, а не в spec-файле: `testMatch` Playwright по умолчанию берёт только
 * `*.spec.ts`, поэтому модуль рядом с тестами не превращается в пустой набор тестов, а импортировать
 * его могут все спеки сразу.
 */

/** Обязательная матрица экранов мобильной приёмки. */
export const PHONE_PORTRAIT = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x640", width: 360, height: 640 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "393x852", width: 393, height: 852 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
] as const;

export const PHONE_LANDSCAPE = [
  { name: "568x320", width: 568, height: 320 },
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
  { name: "932x430", width: 932, height: 430 },
] as const;

export const TABLETS = [
  { name: "768x1024", width: 768, height: 1024 },
  { name: "820x1180", width: 820, height: 1180 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1180x820", width: 1180, height: 820 },
] as const;

export const DESKTOPS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
] as const;

/** Все публичные адреса сайта, включая состояния главной, адресуемые через query. */
export const PUBLIC_ROUTES = [
  "/",
  "/?department=sales",
  "/?department=support",
  "/?department=executive",
  "/?department=hr",
  "/?department=logistics",
  "/?section=task",
  "/how-we-work",
  "/products",
  "/blog",
  "/faq",
  "/contacts",
  "/documents",
  "/login",
] as const;

interface HorizontalOverflow {
  documentWidth: number;
  viewportWidth: number;
  /**
   * Элементы, выходящие за правый (или левый) край экрана и при этом НЕ лежащие ни в одном
   * контейнере с собственной горизонтальной прокруткой. Прокручиваемая таблица админ-панели сюда
   * не попадает намеренно: локализованный `overflow-x` внутри своего контейнера — это решение, а не
   * дефект (см. чек-лист §26).
   */
  offenders: string[];
}

/**
 * Измеряет горизонтальное переполнение страницы.
 *
 * Проверок две, и вторая не заменяет первую. `scrollWidth > innerWidth` ловит уже случившийся
 * горизонтальный скролл документа. Но `html, body { overflow-x: hidden }` (globals.css) его
 * подавляет — документ не прокручивается, а часть содержимого всё равно оказывается за краем и
 * недоступна. Поэтому вторая проверка идёт по элементам и отсеивает только тех, у кого выше по
 * дереву есть настоящий скролл-контейнер.
 */
export async function measureHorizontalOverflow(page: Page): Promise<HorizontalOverflow> {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders: string[] = [];
    const seen = new Set<string>();

    for (const element of document.querySelectorAll("body *")) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) continue;

      let parent = element.parentElement;
      let insideScroller = false;
      while (parent) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (["hidden", "auto", "scroll", "clip"].includes(overflowX)) {
          insideScroller = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (insideScroller) continue;

      const signature = `${element.tagName}.${element.className.toString().split(" ")[0]}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      offenders.push(`${signature} [${Math.round(rect.left)}..${Math.round(rect.right)}]`);
    }

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders: offenders.slice(0, 8),
    };
  });
}

/** Утверждение «страница не уезжает вбок» — в одном месте, чтобы формулировка не расходилась. */
export async function expectNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await measureHorizontalOverflow(page);
  expect(
    overflow.documentWidth,
    `${context}: документ шире экрана (${overflow.documentWidth} > ${overflow.viewportWidth})`,
  ).toBeLessThanOrEqual(overflow.viewportWidth);
  expect(overflow.offenders, `${context}: элементы за краем экрана вне скролл-контейнера`).toEqual(
    [],
  );
}

/** Размер мишени в CSS-пикселях. Возвращает null, если элемента нет в раскладке. */
export async function targetSize(locator: Locator) {
  const box = await locator.boundingBox();
  return box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
}
