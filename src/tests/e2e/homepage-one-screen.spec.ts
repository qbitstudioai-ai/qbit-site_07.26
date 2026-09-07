import { expect, test, type Locator, type Page } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";
import { DESKTOPS, PHONE_LANDSCAPE, PHONE_PORTRAIT, TABLETS } from "./helpers/layout";
import {
  CONTENT_SELECTOR,
  collectOutOfFrameContent,
  collectScrollPorts,
  expectDocumentPinned,
  reachByUserScrolling,
} from "./helpers/one-screen";

/**
 * Страж одноэкранности главной.
 *
 * Переписан после skeptic FAIL 2026-09-07. Прежняя редакция была зелёной и при этом ничего не
 * охраняла — все её замеры шли от `documentElement`, а он на главной закрыт `.shell`
 * (`height: 100dvh; overflow: hidden`). Замерено тогда же: `<div style="height:5000px">` внутри
 * `<main>` на 390×844 оставлял `documentElement.scrollHeight` равным 844, а элемент, уехавший на
 * `left: 2000px`, не попадал в список нарушителей, потому что `body { overflow-x: hidden }`
 * объявлял «скролл-контейнером» вообще всё дерево.
 *
 * Что проверяется теперь (измерители — `helpers/one-screen.ts`):
 *
 *   1. Документ не прокручивается и оболочка занимает ровно экран — слабая, но честная охрана
 *      самого CSS-инварианта. Отдельно помечено, что это НЕОБХОДИМОЕ, а не достаточное условие.
 *   2. Инвентарь ФАКТИЧЕСКИХ скролл-портов (`main`, `.office`, `.experience`, колонки отдела):
 *      одноэкранность держится ими, и они обязаны жить внутри оболочки, а не быть документом.
 *   3. Ни один содержательный элемент не лежит за экраном без настоящего скролл-порта по своей
 *      оси. `overflow: hidden`/`clip` больше не оправдание — это виновник обрезки.
 *   4. Критическое содержимое достижимо: прокручиваются ТОЛЬКО контейнеры с `auto`/`scroll` и
 *      только в пределах их диапазона, после чего элемент обязан целиком попасть в экран.
 *      `scrollIntoViewIfNeeded()` не используется — он двигает и `overflow: hidden`-боксы, то есть
 *      отвечает на вопрос «дотянется ли скрипт», а не «дотянется ли пользователь».
 *   5. Negative controls (ниже): искусственная обрезка и искусственное переполнение обязаны быть
 *      замечены, а после снятия — исчезнуть. Без них у стража нет доказательства, что он вообще
 *      способен упасть.
 *
 * Замеры матрицы идут в reduced motion — в состоянии покоя. Отдельная группа проверяет переходы.
 */

const copy = getHomepageCopy();

const OVERVIEW_NAV = "Отделы компании";
const RAIL_NAV = "Панель отделов";

/**
 * Реестр подтверждённых дефектов production.
 *
 * Механика: каждая запись проверяется ИНВЕРТИРОВАННО — пока дефект жив, тест зелёный; как только
 * вёрстку починят, проверка падает с текстом «реестр устарел», и запись обязана быть удалена.
 * Реестр не может тихо зарасти, поэтому его пустота — это утверждение, а не умолчание.
 *
 * НА 07.09.2026 ОБА РЕЕСТРА ПУСТЫ: три найденных стражем дефекта закрыты правками вёрстки.
 *
 * D1 — ЗАКРЫТ, `CustomerBenefits.module.css`, двумя правками по двум осям.
 *      Было: `.slot { flex: 0 0 132px }` держал коробку фиксированной высоты при
 *      `.result { height: 100%; overflow: hidden }`, а три колонки не помещались по ширине.
 *      • вертикаль — `@media (min-width: 768px) and (max-width: 900px)`: `flex-basis: auto`,
 *        `height: auto`. 820×1180 — было 130/299, стало 299/299; 844×390 — было 118/204, стало
 *        204/204; 768×1024 — CTA была вне экрана (990…1048 при высоте 1024), стала 956…1000.
 *      • горизонталь — `@media (min-width: 768px) and (max-width: 800px)`: две колонки вместо трёх,
 *        CTA во всю ширину второй строкой. 768×1024 — было clientWidth 459 против scrollWidth 492
 *        (CTA срезана справа на 33px), стало 459/459.
 *
 * D2 — ЗАКРЫТ, `DepartmentNavigationRail.module.css`, `@media (min-width: 768px) and
 *      (max-height: 700px)` → `.rail { flex: 1 1 auto; overflow-y: auto; overflow-x: hidden }`.
 *      Было: на 844×390 и 932×430 нижние пункты рельса («HR», «Ваша задача») стояли в 373…490 при
 *      высоте экрана 390/430 без единого `auto`/`scroll` предка — отдел HR открыть было нельзя.
 *      Стало: рельс прокручивается внутри себя (844×390 — 224/357, горизонтали нет), все шесть
 *      пунктов достижимы.
 *
 * D3 — ЗАКРЫТ, `DepartmentNavigationRail.tsx`: замер индикатора переведён в координаты содержимого
 *      (`+ rail.scrollTop`). Был побочным эффектом D2: индикатор вставал на `scrollTop` выше
 *      активного пункта (57px при scrollTop 58 на 844×390). Стало 1px на всех сценариях — это
 *      существовавшее и прежде смещение на толщину рамки `.rail`.
 */
const KNOWN_DEFECTS: {
  viewport: string;
  state: StateId;
  element: string;
  /** `unreachable` — элемент вообще не в экране; `clipped` — в экране, но подрезан контейнером. */
  expectation: "unreachable" | "clipped";
}[] = [];

/** Пуст с 07.09.2026: единственные записи были по D2, а D2 исправлен (см. комментарий выше). */
const KNOWN_OUT_OF_FRAME: { viewport: string; state: StateId; labelIncludes: string }[] = [];

type StateId = "hero" | "overview" | "department" | "task";

interface CriticalItem {
  label: string;
  locator: Locator;
}

/**
 * Четыре состояния главной, доводимые до покоя, и критическое содержимое каждого.
 *
 * «Критическое» — то, без чего состояние не выполняет свою работу: обещание (заголовок), путь
 * дальше (CTA, зоны отделов) и управление (отправка формы, закрытие раздела). Оформление сюда не
 * входит: обрезка фотосцены границей `overflow: hidden` — приём вёрстки, а не потеря содержимого.
 */
const HOMEPAGE_STATES: {
  id: StateId;
  open: (page: Page) => Promise<void>;
  critical: (page: Page) => CriticalItem[];
}[] = [
  {
    id: "hero",
    async open(page) {
      await page.goto("/");
      await expect(page.locator("[data-hero-grid]")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    critical: (page) => [
      { label: "H1", locator: page.getByRole("heading", { level: 1 }) },
      { label: "основная CTA", locator: page.getByRole("link", { name: copy.primaryCta }) },
      { label: "контурная CTA", locator: page.getByRole("link", { name: copy.secondaryCta }) },
      { label: "подзаголовок", locator: page.getByText(copy.subheadline, { exact: true }) },
    ],
  },
  {
    id: "overview",
    async open(page) {
      await page.goto("/");
      // Единственный путь в overview — контурная CTA hero: чистого адреса у состояния нет
      // (`initialRevealed` включается только параметром `department`/`section`, см. app/page.tsx).
      await page.getByRole("link", { name: copy.secondaryCta }).click();
      await expect(page.getByRole("navigation", { name: OVERVIEW_NAV })).toBeVisible();
    },
    critical: (page) => [
      { label: "CTA обзора", locator: page.locator("#task-entry-button") },
      { label: "возврат в hero", locator: page.locator("[data-overview-controls] a").first() },
      {
        label: "первая зона отдела",
        locator: page.getByRole("navigation", { name: OVERVIEW_NAV }).getByRole("button").first(),
      },
      {
        label: "последняя зона отдела",
        locator: page.getByRole("navigation", { name: OVERVIEW_NAV }).getByRole("button").last(),
      },
    ],
  },
  {
    id: "department",
    async open(page) {
      await page.goto("/?department=sales");
      await expect(page.locator('[data-office-mode="section"]')).toBeVisible();
      await expectRailMatchesBreakpoint(page);
      // Раскрытие выгод — последняя анимация состояния. В reduced motion стадия `complete`
      // выставляется сразу (CustomerBenefits), поэтому дефолтного таймаута достаточно.
      await expect(page.locator('[data-reveal-stage="complete"]')).toBeVisible();
    },
    critical: (page) => [
      { label: "заголовок отдела", locator: page.getByRole("heading", { level: 2 }).first() },
      { label: "CTA отдела", locator: page.locator("[data-customer-benefits] a").first() },
    ],
  },
  {
    id: "task",
    async open(page) {
      await page.goto("/?section=task");
      await expect(page.locator('[data-office-mode="section"]')).toBeVisible();
      await expectRailMatchesBreakpoint(page);
      await expect(
        page.getByRole("heading", { level: 2, name: copy.taskSection.headline }),
      ).toBeVisible();
    },
    critical: (page) => [
      {
        label: "заголовок раздела",
        locator: page.getByRole("heading", { level: 2, name: copy.taskSection.headline }),
      },
      { label: "поле задачи", locator: page.locator("textarea").first() },
      { label: "кнопка отправки", locator: page.getByRole("button", { name: "Отправить заявку" }) },
      { label: "кнопка закрытия", locator: page.getByRole("button", { name: "Закрыть" }) },
    ],
  },
];

/**
 * Рельс 10/90 существует не везде, и тест обязан отражать это, а не обходить.
 *
 * На ≤767px `.railArea { display: none }` (OfficeExperience.module.css) — прямое следствие docs/08
 * «Mobile ≤767: не использовать буквальный 10/90». `toHaveCount(0)` работает потому, что
 * role-локатор не видит элементы, убранные из дерева доступности через `display: none`.
 */
async function expectRailMatchesBreakpoint(page: Page) {
  const width = page.viewportSize()!.width;
  const rail = page.getByRole("navigation", { name: RAIL_NAV });
  if (width >= 768) {
    await expect(rail, `рельс отделов обязан быть виден на ${width}px`).toBeVisible();
  } else {
    await expect(rail, `рельс 10/90 не должен появляться на ${width}px (docs/08)`).toHaveCount(0);
  }
}

/** Настоящие скролл-порты живут внутри оболочки; документ скролл-портом быть не должен. */
async function expectScrollPortsInsideShell(page: Page, context: string) {
  const escaped = await page.evaluate(() => {
    let shell: HTMLElement | null = document.querySelector("main");
    while (shell && shell.parentElement !== document.body) shell = shell.parentElement;

    const outside: string[] = [];
    for (const element of document.querySelectorAll("body *")) {
      const style = getComputedStyle(element);
      const scrollableY =
        ["auto", "scroll"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1;
      const scrollableX =
        ["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1;
      if (!scrollableX && !scrollableY) continue;
      if (shell && (element === shell || shell.contains(element))) continue;
      outside.push(element.tagName.toLowerCase());
    }
    return outside;
  });

  expect(escaped, `${context}: скролл-порт вне оболочки .shell`).toEqual([]);
}

function formatOutOfFrame(entry: Awaited<ReturnType<typeof collectOutOfFrameContent>>[number]) {
  return (
    `${entry.label} «${entry.text}» ось=${entry.axis} rect=${JSON.stringify(entry.rect)}` +
    `${entry.clippedBy.length ? ` обрезан: ${entry.clippedBy.join(", ")}` : ""}`
  );
}

/** Полный набор утверждений одноэкранности для одного состояния на одном вьюпорте. */
async function assertStateFitsOneScreen(page: Page, viewport: string, state: StateId) {
  const context = `${viewport} / ${state}`;

  await expectDocumentPinned(page, context);
  await expectScrollPortsInsideShell(page, context);

  const outOfFrame = await collectOutOfFrameContent(page, CONTENT_SELECTOR);
  const known = KNOWN_OUT_OF_FRAME.filter(
    (item) => item.viewport === viewport && item.state === state,
  );
  const unexpected = outOfFrame.filter(
    (entry) => !known.some((item) => entry.label.includes(item.labelIncludes)),
  );
  expect(
    unexpected.map(formatOutOfFrame),
    `${context}: содержимое за экраном вне пользовательского скролл-порта`,
  ).toEqual([]);
  for (const item of known) {
    expect(
      outOfFrame.some((entry) => entry.label.includes(item.labelIncludes)),
      `${context}: реестр известных дефектов устарел — «${item.labelIncludes}» больше не обрезается, запись D2 нужно удалить`,
    ).toBe(true);
  }
}

/** Достижимость критического содержимого с учётом реестра подтверждённых дефектов. */
async function assertCriticalContentReachable(page: Page, viewport: string, state: StateId) {
  const context = `${viewport} / ${state}`;
  const items = HOMEPAGE_STATES.find((entry) => entry.id === state)!.critical(page);

  for (const item of items) {
    await expect(item.locator, `${context}: «${item.label}» отсутствует в раскладке`).toHaveCount(
      1,
    );
    const report = await reachByUserScrolling(item.locator);
    const known = KNOWN_DEFECTS.find(
      (entry) =>
        entry.viewport === viewport && entry.state === state && entry.element === item.label,
    );

    if (known?.expectation === "unreachable") {
      expect(
        report.fullyVisible,
        `${context}: реестр известных дефектов устарел — «${item.label}» стала помещаться в экран, запись D1 нужно удалить`,
      ).toBe(false);
      continue;
    }

    if (known?.expectation === "clipped") {
      expect(
        report.fullyVisible,
        `${context}: «${item.label}» перестала помещаться в экран — это уже не D1, а новая регрессия`,
      ).toBe(true);
      expect(
        report.clippedBy.length,
        `${context}: реестр известных дефектов устарел — «${item.label}» больше не обрезается, запись D1 нужно удалить`,
      ).toBeGreaterThan(0);
      continue;
    }

    expect(
      report.fullyVisible,
      `${context}: «${item.label}» не помещается в экран после прокрутки пользовательских ` +
        `контейнеров — rect ${JSON.stringify(report.rect)} при экране ${report.viewport.width}×${report.viewport.height}` +
        `${report.scrolled.length ? `; прокручено: ${report.scrolled.join(", ")}` : "; прокручивать было нечего"}`,
    ).toBe(true);
    expect(
      report.clippedBy,
      `${context}: «${item.label}» обрезан контейнером без пользовательского скролла`,
    ).toEqual([]);
  }
}

// ── Матрица: четыре состояния на каждом поддерживаемом экране ────────────────────────────────────

const GROUPS = [
  { label: "desktop", sizes: DESKTOPS, touch: false },
  { label: "планшет", sizes: TABLETS, touch: true },
  { label: "телефон, портрет", sizes: PHONE_PORTRAIT, touch: true },
  { label: "телефон, альбом", sizes: PHONE_LANDSCAPE, touch: true },
];

for (const group of GROUPS) {
  test.describe(`Главная помещается в один экран: ${group.label}`, () => {
    test.use({ hasTouch: group.touch, isMobile: group.touch });

    for (const size of group.sizes) {
      test(`${size.name}: hero, обзор, отдел и «Ваша задача» помещаются в экран, содержимое достижимо`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width: size.width, height: size.height });

        for (const state of HOMEPAGE_STATES) {
          await state.open(page);
          await assertStateFitsOneScreen(page, size.name, state.id);
          await assertCriticalContentReachable(page, size.name, state.id);
        }
      });
    }
  });
}

// ── Negative controls: страж обязан уметь падать ─────────────────────────────────────────────────

/**
 * Без этой группы у стража нет доказательства работоспособности. Каждый тест вносит искусственную
 * регрессию, требует, чтобы измеритель её ЗАМЕТИЛ, снимает регрессию и требует, чтобы отчёт снова
 * стал чистым. Ровно так проверяется, что зелёный цвет остальных тестов что-то значит.
 *
 * Правится только страница в открытой вкладке (`addStyleTag` / `appendChild`) — production-код и
 * стили репозитория не трогаются.
 */
test.describe("Negative controls: искусственная регрессия обязана валить проверку", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("отнятый у main пользовательский скролл делает hero-CTA недостижимой", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.locator("[data-hero-grid]")).toBeVisible();

    const cta = page.getByRole("link", { name: copy.primaryCta });
    const clean = await reachByUserScrolling(cta);
    expect(clean.fullyVisible, "до регрессии hero-CTA обязана быть достижима").toBe(true);

    // Регрессия: `main` перестаёт быть скролл-портом. Пользователь больше не может доскроллить до
    // CTA — а `scrollIntoViewIfNeeded()` этого бы не заметил, потому что двигает и hidden-боксы.
    const patch = await page.addStyleTag({ content: "main { overflow: hidden !important; }" });
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (main) main.scrollTop = 0;
    });

    const broken = await reachByUserScrolling(cta);
    expect(broken.fullyVisible, "страж не заметил снятый пользовательский скролл").toBe(false);
    expect(broken.clippedBy.length, "страж не назвал виновника обрезки").toBeGreaterThan(0);

    await patch.evaluate((element) => (element as Element).remove());
    const restored = await reachByUserScrolling(cta);
    expect(restored.fullyVisible, "после снятия регрессии hero-CTA снова достижима").toBe(true);
    expect(restored.clippedBy).toEqual([]);
  });

  test("содержательный элемент, уехавший вбок, попадает в список нарушителей", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("[data-hero-grid]")).toBeVisible();

    expect(
      (await collectOutOfFrameContent(page, CONTENT_SELECTOR)).map(formatOutOfFrame),
      "до регрессии список нарушителей обязан быть пуст",
    ).toEqual([]);

    // Регрессия: ссылка уезжает за правый край. Горизонтального скролл-порта над ней нет — есть
    // только `overflow-x: hidden` у `.shell` и `body`, которые раньше её «оправдывали».
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.id = "negative-control-wide";
      link.href = "#";
      link.textContent = "Уехавшая ссылка";
      link.style.cssText = "position:relative; left:3000px; display:inline-block; width:200px;";
      document.querySelector("[data-hero-grid]")!.appendChild(link);
    });

    const broken = await collectOutOfFrameContent(page, CONTENT_SELECTOR);
    const offender = broken.find((entry) => entry.text.includes("Уехавшая ссылка"));
    expect(offender, "страж не заметил элемент за правым краем").toBeDefined();
    expect(offender!.axis, "ось нарушения определена неверно").toBe("x");
    expect(
      offender!.clippedBy.length,
      "страж обязан назвать hidden/clip-контейнеры виновниками, а не оправданием",
    ).toBeGreaterThan(0);

    await page.evaluate(() => document.getElementById("negative-control-wide")?.remove());
    expect(
      (await collectOutOfFrameContent(page, CONTENT_SELECTOR)).map(formatOutOfFrame),
      "после снятия регрессии список нарушителей снова пуст",
    ).toEqual([]);
  });

  test("обрезка блока выгод делает CTA отдела недостижимой", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?department=sales");
    await expect(page.locator('[data-reveal-stage="complete"]')).toBeVisible();

    const cta = page.locator("[data-customer-benefits] a").first();
    expect((await reachByUserScrolling(cta)).fullyVisible, "до регрессии CTA достижима").toBe(true);

    // Регрессия: содержимое обрезано без права прокрутки — ровно тот класс дефектов, который
    // прежняя редакция стража не отличала от нормы.
    const patch = await page.addStyleTag({
      content:
        "[data-customer-benefits] { max-height: 32px !important; overflow: hidden !important; }",
    });

    const broken = await reachByUserScrolling(cta);
    expect(broken.fullyVisible, "страж не заметил обрезанную CTA").toBe(false);
    expect(
      broken.clippedBy.some((entry) => entry.includes("overflow")),
      "страж не назвал обрезающий контейнер",
    ).toBe(true);

    await patch.evaluate((element) => (element as Element).remove());
    expect(
      (await reachByUserScrolling(cta)).fullyVisible,
      "после снятия регрессии CTA снова достижима",
    ).toBe(true);
  });

  test("высокий блок вне оболочки делает документ прокручиваемым", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("[data-hero-grid]")).toBeVisible();

    await expectDocumentPinned(page, "negative control / до регрессии");

    // Регрессия: содержимое появляется СОСЕДОМ оболочки. Именно этот класс — единственный, который
    // способна поймать проверка документа, и он обязан ловиться.
    await page.evaluate(() => {
      const block = document.createElement("div");
      block.id = "negative-control-tall";
      block.style.cssText = "height:3000px; width:10px;";
      document.body.appendChild(block);
    });

    const broken = await page.evaluate(() => {
      window.scrollTo(10_000, 10_000);
      const reachedY = window.scrollY;
      window.scrollTo(0, 0);
      return reachedY;
    });
    expect(broken, "страж не заметил прокручиваемый документ").toBeGreaterThan(0);

    await page.evaluate(() => document.getElementById("negative-control-tall")?.remove());
    await expectDocumentPinned(page, "negative control / после снятия регрессии");
  });
});

// ── Переходы: раскладка не «дышит» по дороге ─────────────────────────────────────────────────────

interface TransitionSample {
  frames: number;
  maxDocumentOverflowY: number;
  maxDocumentOverflowX: number;
  maxShellOverflowY: number;
  maxShellOverflowX: number;
  maxShellOutOfFrame: number;
}

/**
 * Покадровый замер во время перехода. Цикл ОСТАНАВЛИВАЕТСЯ по окончании действия — прежняя
 * редакция оставляла по бесконечному `requestAnimationFrame` на каждый вызов.
 *
 * Меряется не только документ (он закрыт `.shell` и почти ничего не показывает), но и переполнение
 * самой оболочки: `.shell` — `overflow: hidden` без собственного скролла, поэтому её
 * `scrollHeight > clientHeight` означает, что содержимое вылезло из кадра мимо всех скролл-портов.
 * Плюс сама оболочка обязана оставаться приколоченной к экрану на каждом кадре.
 */
async function sampleDuringTransition(
  page: Page,
  action: () => Promise<void>,
): Promise<TransitionSample> {
  await page.evaluate(() => {
    const store = {
      frames: 0,
      maxDocumentOverflowY: 0,
      maxDocumentOverflowX: 0,
      maxShellOverflowY: 0,
      maxShellOverflowX: 0,
      maxShellOutOfFrame: 0,
      stopped: false,
    };
    (window as unknown as Record<string, unknown>).__oneScreenProbe = store;

    let shell: HTMLElement | null = document.querySelector("main");
    while (shell && shell.parentElement !== document.body) shell = shell.parentElement;

    const sample = () => {
      if (store.stopped) return;
      const root = document.documentElement;
      store.maxDocumentOverflowY = Math.max(
        store.maxDocumentOverflowY,
        root.scrollHeight - root.clientHeight,
      );
      store.maxDocumentOverflowX = Math.max(
        store.maxDocumentOverflowX,
        root.scrollWidth - root.clientWidth,
      );
      if (shell) {
        store.maxShellOverflowY = Math.max(
          store.maxShellOverflowY,
          shell.scrollHeight - shell.clientHeight,
        );
        store.maxShellOverflowX = Math.max(
          store.maxShellOverflowX,
          shell.scrollWidth - shell.clientWidth,
        );
        const rect = shell.getBoundingClientRect();
        store.maxShellOutOfFrame = Math.max(
          store.maxShellOutOfFrame,
          rect.bottom - window.innerHeight,
          -rect.top,
          rect.right - window.innerWidth,
          -rect.left,
        );
      }
      store.frames += 1;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await action();

  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __oneScreenProbe: TransitionSample & { stopped: boolean };
      }
    ).__oneScreenProbe;
    store.stopped = true;
    return {
      frames: store.frames,
      maxDocumentOverflowY: store.maxDocumentOverflowY,
      maxDocumentOverflowX: store.maxDocumentOverflowX,
      maxShellOverflowY: store.maxShellOverflowY,
      maxShellOverflowX: store.maxShellOverflowX,
      maxShellOutOfFrame: Math.round(store.maxShellOutOfFrame),
    };
  });
}

function expectTransitionStayedInFrame(sample: TransitionSample, context: string) {
  expect(sample.frames, `${context}: покадровый замер не собрал ни одного кадра`).toBeGreaterThan(
    0,
  );
  expect(
    sample.maxDocumentOverflowY,
    `${context}: документ перерастал экран по вертикали на ${sample.maxDocumentOverflowY}px`,
  ).toBeLessThanOrEqual(1);
  expect(
    sample.maxDocumentOverflowX,
    `${context}: документ перерастал экран по горизонтали на ${sample.maxDocumentOverflowX}px`,
  ).toBeLessThanOrEqual(1);
  expect(
    sample.maxShellOverflowY,
    `${context}: содержимое вылезало из оболочки по вертикали на ${sample.maxShellOverflowY}px`,
  ).toBeLessThanOrEqual(1);
  expect(
    sample.maxShellOverflowX,
    `${context}: содержимое вылезало из оболочки по горизонтали на ${sample.maxShellOverflowX}px`,
  ).toBeLessThanOrEqual(1);
  expect(
    sample.maxShellOutOfFrame,
    `${context}: оболочка уезжала за край экрана на ${sample.maxShellOutOfFrame}px`,
  ).toBeLessThanOrEqual(1);
}

for (const size of [
  { name: "desktop 1440x900", width: 1440, height: 900, touch: false },
  { name: "планшет 768x1024", width: 768, height: 1024, touch: true },
  { name: "телефон 390x844", width: 390, height: 844, touch: true },
  // Ландшафт телефона — самый тесный случай по высоте из поддерживаемых.
  { name: "телефон 667x375", width: 667, height: 375, touch: true },
]) {
  test.describe(`Переход hero → обзор → отдел не растягивает кадр: ${size.name}`, () => {
    /**
     * Собственный таймаут группы. Переход идёт с ВКЛЮЧЁННЫМ моушеном, а `CustomerBenefits`
     * показывает результат через `RESULT_DELAY_MS` (10 000 мс) и CTA ещё через 760 мс — то есть
     * содержимое добавляется в раскладку почти через одиннадцать секунд после открытия отдела.
     * Измерено против production-сборки: 11.7–12.6 с на тест. Дефолтные 30 с оставляли ~17 с
     * запаса при том, что playwright.config.ts прямо документирует `page.goto` до 30 с против
     * холодного сервера под шестью воркерами — гейт замигал бы раньше, чем сломался продукт.
     */
    test.describe.configure({ timeout: 90_000 });
    test.use({ hasTouch: size.touch, isMobile: size.touch });

    test("ни один кадр перехода не выносит содержимое за кадр", async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const reveal = await sampleDuringTransition(page, async () => {
        await page.getByRole("link", { name: copy.secondaryCta }).click();
        await expect(page.getByRole("navigation", { name: OVERVIEW_NAV })).toBeVisible();
      });
      expectTransitionStayedInFrame(reveal, `${size.name}: hero → обзор`);

      const open = await sampleDuringTransition(page, async () => {
        await page
          .getByRole("navigation", { name: OVERVIEW_NAV })
          .getByRole("button")
          .first()
          .click();
        await expect(page.locator('[data-office-mode="section"]')).toBeVisible();
        await expectRailMatchesBreakpoint(page);
        // Ожидание доведено до конца раскрытия выгод: самый опасный момент перехода — не первый
        // кадр, а добавление результата и CTA через одиннадцать секунд после открытия отдела.
        await expect(page.locator('[data-reveal-stage="complete"]')).toBeVisible({
          timeout: 20_000,
        });
      });
      expectTransitionStayedInFrame(open, `${size.name}: обзор → отдел`);

      // Переход закончился — состояние покоя обязано удовлетворять тем же правилам, что и матрица.
      await assertStateFitsOneScreen(page, size.name, "department");
    });
  });
}

// ── Внутренние панели остаются рабочими ──────────────────────────────────────────────────────────

/**
 * Одноэкранность держится ВНУТРЕННИМ скроллом панели, а не обрезкой содержимого. Docs/08 («Низкий
 * desktop», «Mobile ≤767») описывает внутренний скролл как штатный аварийный режим по высоте.
 * Здесь проверяется, что этот механизм на месте и что он не утекает в документ.
 */
test.describe("Внутренние панели переживают одноэкранность", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("667x375: обзор офиса скроллится внутри панели, а не документом (docs/08, Amendment 13)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/");
    await page.getByRole("link", { name: copy.secondaryCta }).click();
    await expect(page.getByRole("navigation", { name: OVERVIEW_NAV })).toBeVisible();

    const panel = page.locator("[data-office-mode]");

    // На ≤1279px панель обзора получает `overflow-y: auto` (OfficeExperience.module.css). Именно
    // этим внутренним скроллом docs/08 объясняет, как в ландшафте достаётся карусель под сценой.
    const overflowY = await panel.evaluate((element) => getComputedStyle(element).overflowY);
    expect(overflowY, "панель обзора обязана иметь собственный скролл на узких экранах").toBe(
      "auto",
    );

    const ports = await collectScrollPorts(page);
    expect(
      ports.length,
      "переполнение обязано поглощаться настоящим скролл-портом, а не обрезкой",
    ).toBeGreaterThan(0);

    const scrolled = await panel.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return { scrollTop: element.scrollTop, documentScrollY: window.scrollY };
    });
    expect(scrolled.scrollTop, "панель обзора не прокрутилась").toBeGreaterThan(0);
    expect(scrolled.documentScrollY, "внутренняя прокрутка обзора утекла в документ").toBe(0);

    await expectDocumentPinned(page, "667x375 / обзор после внутренней прокрутки");
  });

  test("375x667: прокрутка панели отдела не утекает в документ", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/?department=sales");
    await expect(page.locator('[data-reveal-stage="complete"]')).toBeVisible();

    const ports = await collectScrollPorts(page);
    expect(
      ports.some((port) => port.scrollableY),
      "у отдела на телефоне обязан быть вертикальный скролл-порт",
    ).toBe(true);

    const scrolled = await page.evaluate(() => {
      const port = [...document.querySelectorAll("main *")].find((element) => {
        const style = getComputedStyle(element);
        return (
          ["auto", "scroll"].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        );
      }) as HTMLElement | undefined;
      if (!port) return null;
      port.scrollTop = port.scrollHeight;
      return { scrollTop: port.scrollTop, documentScrollY: window.scrollY };
    });

    expect(scrolled, "скролл-порт отдела не найден").not.toBeNull();
    expect(scrolled!.scrollTop, "панель отдела не прокрутилась").toBeGreaterThan(0);
    expect(scrolled!.documentScrollY, "внутренняя прокрутка отдела утекла в документ").toBe(0);

    await expectDocumentPinned(page, "375x667 / отдел после внутренней прокрутки");
  });
});
