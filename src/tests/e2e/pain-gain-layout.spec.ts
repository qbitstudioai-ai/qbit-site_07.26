import { expect, test, type Page } from "@playwright/test";
import { getDepartments } from "../../content/departments";

// Amendment 12 — пояснение к выбранной боли переехало из блока ПОД списком в отдельное окно СПРАВА,
// равное списку по высоте, с фиксированной геометрией и печатающимся текстом.
// Проверяется то, что нельзя увидеть в jsdom: реальная геометрия боксов и реальный ход анимации.

const departments = getDepartments();

async function openDepartment(page: Page, departmentId: string) {
  const department = departments.find((d) => d.id === departmentId)!;
  await page.goto(`/?department=${departmentId}`);
  await expect(page.getByRole("heading", { level: 2, name: department.headline })).toBeVisible();
  return department;
}

const gainOf = (page: Page) => page.getByTestId("pain-gain-panel").locator("p[aria-live]");
// Два слоя пояснения (Amendment 12, правка по skeptic Phase B): видимый — анимируемые глифы, скрытые
// от дерева доступности; доступный — один текстовый узел с полным предложением, скрытый визуально.
// Тесты целятся в конкретный слой, а не в <p>: его textContent содержит оба и равен тексту дважды.
const gainVisualOf = (page: Page) => gainOf(page).locator("[data-typed-visual]");
const gainAccessibleOf = (page: Page) => gainOf(page).locator("[data-typed-accessible]");
const painListOf = (page: Page) => page.getByTestId("pain-gain-panel").locator("section").first();
const gainCardOf = (page: Page) => page.getByTestId("pain-gain-panel").locator("[data-gain-panel]");

// Размеры, на которых проверяется раскладка. 1600×900 — комфортный desktop; 1366×768 — самое
// распространённое ноутбучное разрешение; 1280×800 — нижняя граница desktop-раскладки; 1024×768 —
// планшет. Список не декоративный: первая редакция Amendment 12 гоняла весь спек ТОЛЬКО на 1600×900
// и из-за этого не заметила, что фиксированная высота списка обрезает пятый пункт болей на всех
// остальных размерах (skeptic Phase B). Теперь ключевые проверки идут по всем четырём.
const VIEWPORTS = [
  { name: "desktop 1600x900", width: 1600, height: 900 },
  { name: "ноутбук 1366x768", width: 1366, height: 768 },
  { name: "нижняя граница desktop 1280x800", width: 1280, height: 800 },
  { name: "планшет 1024x768", width: 1024, height: 768 },
  // Step 15: узко-низкий планшет добавлен, потому что список выше всё ещё оставлял дыру. На
  // 1024×600 пятый пункт болей был обрезан на 121px — ДО Step 15 и мимо этого спека: размер уже
  // фигурировал в tablet-touch-flow.spec.ts (AC8), но там проверялся только скролл документа, а не
  // видимость болей. Причина устранена в PainGainPanel.module.css (`flex-shrink: 0`), размер
  // закрепляется здесь, чтобы регрессия не вернулась незамеченной.
  { name: "узко-низкий планшет 1024x600", width: 1024, height: 600 },
] as const;

test.describe("Amendment 12 — окно пояснения справа от списка болей", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
  });

  // Регресс на дефект, внесённый первой редакцией Amendment 12: список болей получил жёсткую высоту,
  // и на всех вьюпортах кроме 1600×900 пятый пункт уходил под обрез без визуального признака
  // прокрутки. Пять болей — главный элемент взаимодействия экрана отдела, их обрезка недопустима.
  for (const viewport of VIEWPORTS) {
    test(`все пять болей видны целиком: ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const department of departments) {
        await openDepartment(page, department.id);

        const list = painListOf(page);
        // Контейнер не переполнен: содержимое помещается без внутренней прокрутки.
        const overflow = await list.evaluate((node) => ({
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        }));
        expect(
          overflow.scrollHeight,
          `${department.id} @ ${viewport.name}: список болей обрезан (${overflow.scrollHeight} > ${overflow.clientHeight})`,
        ).toBeLessThanOrEqual(overflow.clientHeight + 1);

        // И каждая из пяти кнопок реально лежит внутри видимой части списка.
        const listBox = (await list.boundingBox())!;
        for (const point of department.painPoints) {
          const box = (await page
            .getByTestId("pain-gain-panel")
            .getByRole("button", { name: point.pain })
            .boundingBox())!;
          expect(
            box.y + box.height,
            `${department.id} @ ${viewport.name}: пункт «${point.pain.slice(0, 30)}…» ниже границы списка`,
          ).toBeLessThanOrEqual(listBox.y + listBox.height + 1);
        }
      }
    });
  }

  test("во всех пяти отделах пояснение стоит справа от списка и равно ему по высоте", async ({
    page,
  }) => {
    for (const department of departments) {
      await openDepartment(page, department.id);

      const painBox = (await painListOf(page).boundingBox())!;
      const gainBox = (await gainCardOf(page).boundingBox())!;

      // Справа, а не под списком: левый край пояснения правее правого края списка болей.
      expect(
        gainBox.x,
        `${department.id}: пояснение не справа от списка (x=${gainBox.x}, список кончается на ${painBox.x + painBox.width})`,
      ).toBeGreaterThanOrEqual(painBox.x + painBox.width);

      // Равная высота — механизм CSS Grid (stretch). Допуск 2px на субпиксельное округление.
      expect(
        Math.abs(gainBox.height - painBox.height),
        `${department.id}: высоты разошлись (боли ${painBox.height}, пояснение ${gainBox.height})`,
      ).toBeLessThanOrEqual(2);

      // И вершины выровнены — иначе «равная высота» ещё не означает, что окна стоят рядом.
      expect(Math.abs(gainBox.y - painBox.y)).toBeLessThanOrEqual(2);
    }
  });

  test("геометрия окна не зависит от длины текста: переключение болей не меняет бокс", async ({
    page,
  }) => {
    // hr содержит и самое длинное пояснение из всех 25 (86 символов), поэтому если геометрия вообще
    // способна поехать от длины текста, она поедет здесь.
    const department = await openDepartment(page, "hr");
    const panel = page.getByTestId("pain-gain-panel");

    const boxes: { width: number; height: number; x: number; y: number }[] = [];
    for (const point of department.painPoints) {
      await panel.getByRole("button", { name: point.pain }).click();
      // Ждём, пока текст допечатается, — измерять надо устоявшееся состояние.
      await expect
        .poll(async () => (await gainVisualOf(page).textContent())?.length ?? 0)
        .toBe(point.gain.length);
      boxes.push((await gainCardOf(page).boundingBox())!);
    }

    const first = boxes[0];
    for (const [index, box] of boxes.entries()) {
      expect(box.width, `ширина уехала на пункте ${index}`).toBeCloseTo(first.width, 0);
      expect(box.height, `высота уехала на пункте ${index}`).toBeCloseTo(first.height, 0);
      expect(box.x, `окно сдвинулось по x на пункте ${index}`).toBeCloseTo(first.x, 0);
      expect(box.y, `окно сдвинулось по y на пункте ${index}`).toBeCloseTo(first.y, 0);
    }
  });

  test("текст печатается: сначала видна часть символов, затем все", async ({ page }) => {
    const department = await openDepartment(page, "sales");
    const panel = page.getByTestId("pain-gain-panel");
    const third = department.painPoints[2];

    await panel.getByRole("button", { name: third.pain }).click();

    // Промежуточное состояние: часть символов ещё прозрачна. Считаем именно видимые символы, а не
    // длину строки, — полный текст в DOM лежит с самого начала (в этом суть реализации).
    const visibleCount = () =>
      gainVisualOf(page).evaluate(
        (node) =>
          Array.from(node.querySelectorAll("span")).filter(
            (span) => getComputedStyle(span).opacity !== "0",
          ).length,
      );

    await expect.poll(visibleCount, { timeout: 3000 }).toBeGreaterThan(0);
    await expect.poll(visibleCount, { timeout: 3000 }).toBe(third.gain.length);

    // Полный текст доступен независимо от стадии анимации — на этом держится aria-live.
    // Проверяется ДОСТУПНЫЙ слой: именно он попадает в дерево доступности одним узлом.
    expect(await gainAccessibleOf(page).textContent()).toBe(third.gain);
  });

  test("prefers-reduced-motion: текст появляется сразу, без посимвольной анимации", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const department = await openDepartment(page, "sales");
    const panel = page.getByTestId("pain-gain-panel");
    const second = department.painPoints[1];

    await panel.getByRole("button", { name: second.pain }).click();

    // Текст на месте немедленно и целиком, и он НЕ разбит на посимвольные span — при reduced-motion
    // анимации нет вовсе, а не «проигрывается быстро».
    await expect(gainOf(page)).toHaveText(second.gain);

    // При reduced-motion слоёв TypedText нет вовсе: возвращается обычный текст, а не «быстрая
    // анимация». Проверка целится в оба слоя по их data-атрибутам.
    //
    // Прежняя редакция требовала `locator("span").count() === 0` — «внутри вообще ни одного span».
    // Step 15.5 добавил в живой регион span-обёртку, которая перезапускает анимацию появления при
    // выборе другой боли (ключ по индексу; сам <p> перемонтировать нельзя — это узел aria-live, и
    // его замена теряет объявление в части скринридеров). Обёртка к посимвольной анимации отношения
    // не имеет, поэтому утверждение сужено до того, что тест и охраняет, а не ослаблено: ни одного
    // слоя TypedText быть не должно. Проверка `toHaveText` выше при этом продолжает ловить
    // задвоение текста, ради которого «ни одного span» и писалось.
    expect(await gainOf(page).locator("[data-typed-visual], [data-typed-accessible]").count()).toBe(
      0,
    );
    expect(await gainVisualOf(page).count()).toBe(0);
  });

  // Сторож на второй слой: доступная копия обязана оставаться НЕВИДИМОЙ. Если стили .accessibleText
  // когда-нибудь отвалятся, пояснение начнёт показываться дважды — и ни одна другая проверка этого
  // не заметит: геометрия окна задана сеткой и от содержимого не зависит, поэтому дублирование
  // даже не сдвинет бокс. Дефекта сейчас нет, это защита на будущее.
  test("доступная копия пояснения не видна глазом, но присутствует в разметке", async ({
    page,
  }) => {
    const department = await openDepartment(page, "sales");

    const accessible = gainAccessibleOf(page);
    await expect(accessible).toHaveCount(1);
    expect(await accessible.textContent()).toBe(department.painPoints[0].gain);

    // Габарит схлопнут до 1px — копия не занимает места в раскладке и не читается как второй текст.
    const box = (await accessible.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(2);
    expect(box.height).toBeLessThanOrEqual(2);

    // И она не выброшена из дерева доступности — иначе исчез бы весь смысл этого слоя.
    await expect(accessible).not.toHaveAttribute("aria-hidden", "true");
  });

  // Регресс на дефект, найденный пользователем при визуальной проверке Step 13: при открытии
  // страницы по прямому адресу вокруг заголовка отдела рисовался янтарный прямоугольник, который
  // пропадал после первого клика мышью. Причина — программный фокус на h2 (для скринридера) плюс
  // глобальное правило :focus-visible: Chromium считает программный фокус «видимым», пока не было
  // ввода мышью. Именно поэтому тест грузит страницу напрямую и НЕ трогает мышь — при клике дефект
  // не воспроизводится вовсе.
  test("заголовок отдела не обведён рамкой при открытии по прямому адресу", async ({ page }) => {
    await page.goto("/?department=sales");
    const sales = departments.find((department) => department.id === "sales")!;
    const heading = page.getByRole("heading", { level: 2, name: sales.headline });
    await expect(heading).toBeVisible();

    // Фокус на заголовке сохраняется — это объявление контекста скринридеру, его убирать нельзя.
    await expect(heading).toBeFocused();

    // А вот рамки быть не должно ни в одном из свойств, которыми она рисуется.
    const outline = await heading.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style === "none" || outline.width === "0px").toBe(true);

    // И заголовок по-прежнему вне Tab-последовательности: именно это делает отсутствие рамки
    // безопасным — дойти до него клавиатурой невозможно.
    expect(await heading.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(-1);
  });

  // Amendment 32: графика остаётся функцией — маркер показывает выбранную боль, а одноразовый
  // измеряемый импульс связывает именно её с решением.
  test("активная боль запускает измеряемый импульс к решению, а маркеры не объявляются скринридеру", async ({
    page,
  }) => {
    const department = await openDepartment(page, "sales");
    const panel = page.getByTestId("pain-gain-panel");

    await expect(panel.locator("[data-pain-solution-impulse]")).toHaveCount(0);
    const selected = panel.getByRole("button", { name: department.painPoints[3].pain });
    await selected.click();
    const impulse = panel.locator("[data-pain-solution-impulse]");
    await expect(impulse).toHaveCount(1);
    await expect(impulse).toHaveAttribute("data-impulse-source", "3");

    /**
     * Замер делается ПОСЛЕ того, как положение кнопки установилось.
     *
     * У кнопки есть `:hover { transform: translateX(2px) }` с переходом 200 мс, а курсор наводит
     * сам клик. Геометрия импульса снимается синхронно в обработчике, то есть до конца перехода;
     * догоняет её пересчёт по `transitionend` в `PainGainPanel`. Сравнение сразу после клика
     * заставало систему в середине этого движения и давало расхождение до 2 px — то самое, из-за
     * которого спек падал.
     *
     * Допуск НЕ ослаблен и остаётся 0,5 px: ждём устойчивого состояния, а не разрешаем промах.
     */
    const startOffset = async () => {
      const panelBox = (await panel.boundingBox())!;
      const sourceBox = (await selected.boundingBox())!;
      const startX = await impulse.evaluate((node) =>
        Number(node.getAttribute("data-impulse-start-x")),
      );
      return Math.abs(panelBox.x + startX - (sourceBox.x + sourceBox.width));
    };
    await expect.poll(startOffset, { timeout: 900 }).toBeLessThan(0.5);

    const panelBox = (await panel.boundingBox())!;
    const sourceBox = (await selected.boundingBox())!;
    const gainBox = (await gainCardOf(page).boundingBox())!;
    const coordinates = await impulse.evaluate((node) => ({
      startY: Number(node.getAttribute("data-impulse-start-y")),
      endX: Number(node.getAttribute("data-impulse-end-x")),
    }));
    expect(panelBox.y + coordinates.startY).toBeCloseTo(sourceBox.y + sourceBox.height / 2, 0);
    expect(panelBox.x + coordinates.endX).toBeCloseTo(gainBox.x + 1, 0);

    // Маркер выбранной боли стоит только у выбранного пункта — иначе форма не отличала бы состояние.
    const markersInList = painListOf(page).locator("svg");
    await expect(markersInList).toHaveCount(1);

    // Переключение переносит маркер, а не добавляет второй.
    await panel.getByRole("button", { name: department.painPoints[2].pain }).click();
    await expect(markersInList).toHaveCount(1);

    // Вся графика декоративна: смысл несут aria-pressed и aria-live, а не глифы.
    for (const svg of await panel.locator("svg").all()) {
      expect(await svg.getAttribute("aria-hidden")).toBe("true");
    }

    // И имя кнопки не зависит от состояния — маркер в него не просачивается.
    await expect(
      panel.getByRole("button", { name: department.painPoints[2].pain }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("под списком болей пояснения больше нет", async ({ page }) => {
    await openDepartment(page, "logistics");

    const painBox = (await painListOf(page).boundingBox())!;
    const gainBox = (await gainCardOf(page).boundingBox())!;

    // Прежняя раскладка ставила пояснение ПОД списком — то есть его верх был ниже низа списка.
    // Этот тест падал бы на прежней вёрстке и не даёт ей вернуться незамеченной.
    expect(gainBox.y).toBeLessThan(painBox.y + painBox.height);
  });
});

// Step 15.5 — каскад появления четырёх блоков экрана отдела (запрос пользователя со скриншотом).
// Проверяется то, что видно только в браузере: реальная вычисленная opacity во времени. Числа
// сверяются с задержками 0/1/2/3 с из stagedReveal-ступеней, но не прибиваются к ним гвоздём:
// утверждается порядок и факт «ещё не видно / уже видно», а не конкретный кадр анимации.
test.describe("Step 15.5 — каскад появления блоков экрана отдела", () => {
  const OPACITY_OF = (page: Page) =>
    page.evaluate(() => {
      const panel = document.querySelector('[data-testid="pain-gain-panel"]');
      const opacityOf = (el: Element | null | undefined) =>
        el ? Number(getComputedStyle(el).opacity) : -1;
      return {
        // Целимся в классы СТУПЕНЕЙ, а не в `[class*="copy"]`/`[class*="actions"]`: подстрока по
        // хешированным именам CSS-модулей поймала бы любой соседний класс с той же подстрокой
        // (замечание skeptic Phase B).
        copy: opacityOf(document.querySelector('[class*="stageCopy"]')),
        pains: opacityOf(panel?.querySelector("section")),
        gain: opacityOf(panel?.querySelector("[data-gain-panel]")),
        actions: opacityOf(document.querySelector('[class*="stageActions"]')),
      };
    });

  // Порядок ступеней проверяется РЕКОРДЕРОМ В СТРАНИЦЕ, а не выборками по часам из теста.
  // Первая редакция читала opacity через 300 мс после goto и была хрупкой: под шестью параллельными
  // воркерами загрузка плавает, и к моменту выборки каскад успевал уйти вперёд (поймано реальным
  // падением «боли не должны быть видны на 0.3 с»). Рекордер снимает opacity каждые 40 мс внутри
  // страницы и запоминает, КОГДА каждая ступень впервые дошла до 1. Утверждается порядок этих
  // моментов — то есть ровно то, что и есть каскад, — без привязки к абсолютному времени.
  const recordCascade = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as { __cascade?: Record<string, number> };
      w.__cascade = {};
      const t0 = performance.now();
      const timer = setInterval(() => {
        const panel = document.querySelector('[data-testid="pain-gain-panel"]');
        const at = (name: string, el: Element | null | undefined) => {
          if (!el || w.__cascade![name] !== undefined) return;
          if (Number(getComputedStyle(el).opacity) === 1)
            w.__cascade![name] = performance.now() - t0;
        };
        at("copy", document.querySelector('[class*="stageCopy"]'));
        at("pains", panel?.querySelector("section"));
        at("gain", panel?.querySelector("[data-gain-panel]"));
        at("actions", document.querySelector('[class*="stageActions"]'));
        if (Object.keys(w.__cascade!).length === 4) clearInterval(timer);
      }, 40);
    });

  const readCascade = (page: Page) =>
    page.evaluate(() => (window as unknown as { __cascade: Record<string, number> }).__cascade);

  test("блоки появляются друг за другом: заголовок → боли → пояснение → кнопки", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?department=sales");
    await recordCascade(page);

    // Задержки читаются СРАЗУ, до завершения каскада: защёлка (data-cascade-done) выставляет
    // `animation: none`, и после неё computed animation-delay у всех ступеней равен 0s — чтение
    // «в конце» показывало бы обнулённые значения, а не заданные (поймано падением
    // `Expected "1s", Received "0s"`).
    // Сам шаг в 1 секунду проверяется ДЕТЕРМИНИРОВАННО — по вычисленным animation-delay, а не по
    // разнице моментов из рекордера. Рекордер подключается уже после загрузки страницы, поэтому
    // первая ступень к его старту нередко успевает завершиться, и измеренный им «разрыв» относится
    // к моменту подключения, а не к началу каскада (поймано падением «шаг copy → pains = 320мс»).
    // Порядок он доказывает надёжно, абсолютные интервалы — нет. Требование пользователя «задержка
    // 1 секунда» живёт в CSS, там его и проверяем.
    const delays = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="pain-gain-panel"]');
      const delayOf = (el: Element | null | undefined) =>
        el ? getComputedStyle(el).animationDelay : null;
      return {
        copy: delayOf(document.querySelector('[class*="stageCopy"]')),
        pains: delayOf(panel?.querySelector("section")),
        gain: delayOf(panel?.querySelector("[data-gain-panel]")),
        actions: delayOf(document.querySelector('[class*="stageActions"]')),
      };
    });
    expect(delays.copy).toBe("0.08s");
    expect(delays.pains).toBe("0.7s");
    expect(delays.gain).toBe("1.4s");
    expect(delays.actions).toBe("2s");

    // Ожидание привязано к ПОЯСНЕНИЮ — последней анимируемой ступени (Amendment 17: кнопки видимы
    // с первого кадра, поэтому сигналом конца каскада служить не могут).
    await expect.poll(async () => (await OPACITY_OF(page)).gain, { timeout: 8000 }).toBe(1);
    const at = await readCascade(page);

    // Три ступени каскада состоялись.
    for (const stage of ["copy", "pains", "gain"]) {
      expect(at[stage], `ступень «${stage}» так и не дошла до opacity 1`).toBeGreaterThanOrEqual(0);
    }

    // И состоялись ИМЕННО В ЭТОМ ПОРЯДКЕ — это и есть каскад, а не одновременное появление.
    expect(at.copy, "заголовок должен опережать боли").toBeLessThan(at.pains);
    expect(at.pains, "боли должны опережать пояснение").toBeLessThan(at.gain);

    // Кнопки в каскад НЕ входят и видимы с первого кадра (Amendment 17). Задержка 3s у них остаётся
    // (проверена выше) как якорь времени для защёлки, но прозрачность не анимируется.
    expect((await OPACITY_OF(page)).actions, "кнопки обязаны быть видимы сразу").toBe(1);
  });

  test("выбор другой боли не перезапускает каскад: остальные блоки остаются видимыми", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const department = await openDepartment(page, "sales");
    // Дожидаемся конца каскада, иначе проверка «остались видимыми» ничего не значит.
    await expect.poll(async () => (await OPACITY_OF(page)).actions, { timeout: 6000 }).toBe(1);

    const third = department.painPoints[2];
    await page.getByTestId("pain-gain-panel").getByRole("button", { name: third.pain }).click();
    await page.waitForTimeout(250);

    const during = await OPACITY_OF(page);
    expect(during.copy, "заголовок обязан остаться видимым").toBe(1);
    expect(during.pains, "список болей обязан остаться видимым").toBe(1);
    expect(during.actions, "кнопки обязаны остаться видимыми").toBe(1);
    // Само окно пояснения тоже остаётся на месте — заново появляется его СОДЕРЖИМОЕ, поэтому
    // геометрия не дёргается (инвариант Amendment 12).
    expect(during.gain, "окно пояснения не должно исчезать целиком").toBe(1);

    const revealed = page.getByTestId("pain-gain-panel").locator("p[aria-live] > span").first();
    expect(
      Number(await revealed.evaluate((el) => getComputedStyle(el).opacity)),
      "текст пояснения должен появиться заново, а не остаться от прошлой боли",
    ).toBeLessThan(1);
    await expect
      .poll(async () => Number(await revealed.evaluate((el) => getComputedStyle(el).opacity)), {
        timeout: 2500,
      })
      .toBe(1);
  });

  test("«Назад к офису» доступна до конца каскада, а CTA ещё не показана", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const department = await openDepartment(page, "sales");

    // Проверяется именно НЕЗАВЕРШЁННЫЙ каскад — иначе тест ничего не охраняет. Признаком служит
    // пояснение: со Step 17 кнопки видимы с первого кадра и признаком незавершённости быть не могут.
    expect((await OPACITY_OF(page)).gain).toBeLessThan(1);
    // Якорь каскада остаётся видимым по вычисленному состоянию, но CTA ждёт результат 10 секунд.
    expect((await OPACITY_OF(page)).actions).toBe(1);
    await expect(page.getByRole("link", { name: department.ctaLabel })).toHaveCount(0);

    // После пяти болей первым доступным путём выхода становится «Назад к офису».
    for (let i = 0; i < department.painPoints.length; i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Назад к офису" })).toBeFocused();

    // И кнопка реально срабатывает. `click({ force: true })` здесь НЕ используется сознательно
    // (замечание skeptic Phase B): force обходит actionability-проверки Playwright целиком и
    // доказывал бы лишь вызов обработчика, а не то, что контрол действительно доступен.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  // Регресс на дефект, найденный skeptic Phase B (BLOCKING-1): первая редакция завершала каскад
  // ОБРАТИМЫМ CSS-условием `:has(button:focus-visible)`. Когда фокус УХОДИЛ, условие переставало
  // выполняться, анимация стартовала заново вместе с backwards-fill, и уже показанные блоки гасли
  // ещё на 3 секунды — при обычном Tab к рельсу, неограниченное число раз. Все прежние проверки
  // измеряли только направление «фокус пришёл» и этого не видели.
  test("после отыгранного каскада блоки не гаснут ни при каком движении фокуса", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const department = await openDepartment(page, "sales");
    await expect.poll(async () => (await OPACITY_OF(page)).actions, { timeout: 6000 }).toBe(1);

    // Проходим Tab-ом весь экран отдела и уходим дальше в рельс — фокус и приходит на контролы
    // панели, и покидает её.
    for (let i = 0; i < department.painPoints.length + 4; i++) {
      await page.keyboard.press("Tab");
      const state = await OPACITY_OF(page);
      expect(state.copy, `заголовок погас после Tab #${i + 1}`).toBe(1);
      expect(state.pains, `боли погасли после Tab #${i + 1}`).toBe(1);
      expect(state.gain, `пояснение погасло после Tab #${i + 1}`).toBe(1);
      expect(state.actions, `кнопки погасли после Tab #${i + 1}`).toBe(1);
    }

    // Смешанный ввод: после клавиатуры обычный клик мышью по боли. На нём дефект проявлялся ярче
    // всего — CTA оставались невидимыми больше 3 секунд.
    await page.getByTestId("pain-gain-panel").getByRole("button").nth(1).click();
    await page.waitForTimeout(300);
    const after = await OPACITY_OF(page);
    expect(after.copy).toBe(1);
    expect(after.pains).toBe(1);
    expect(after.actions).toBe(1);
  });

  // Путь, который не покрывал ни один тест: защёлка срабатывает ПОСРЕДИ незавершённого каскада, а
  // затем фокус уходит. Именно это направление skeptic назвал последним непроверенным — в раунде 1
  // ровно такая комбинация давала многократное гашение. Замером установлено, что теперь она
  // безопасна, и здесь это закрепляется.
  test("защёлка посреди каскада: показанное не гаснет, пояснение приходит по расписанию", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, "sales");

    // Каскад ещё идёт: пояснение не проявлено. Кнопки со Step 17 видимы с первого кадра, поэтому
    // маркером незавершённости служит пояснение, а не они.
    await page.waitForTimeout(400);
    expect((await OPACITY_OF(page)).gain).toBeLessThan(1);

    // Tab на контрол защёлкивает каскад досрочно.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
    const latched = await OPACITY_OF(page);
    expect(latched.copy, "заголовок после защёлки").toBe(1);
    expect(latched.pains, "боли после защёлки").toBe(1);
    expect(latched.actions, "кнопки после защёлки").toBe(1);

    // ВНИМАНИЕ: со Step 17 `.gainInitial` ВКЛЮЧЁН в защёлку (см. PainGainPanel.module.css), поэтому
    // проверка ниже больше не сторожит «пояснение залипло невидимым» — такой сценарий стал
    // недостижим. Она оставлена как проверка того, что пояснение всё-таки доезжает до видимости
    // после досрочной защёлки. Прежняя формулировка про «намеренно не входит» была верна до
    // Step 17 и снята, чтобы не вводила в заблуждение: оно приходит по
    // своей ступени и НЕ залипает в невидимом состоянии.
    await expect.poll(async () => (await OPACITY_OF(page)).gain, { timeout: 4000 }).toBe(1);

    // И теперь фокус уходит — в раунде 1 здесь начиналось повторное гашение.
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    const after = await OPACITY_OF(page);
    expect(after.copy).toBe(1);
    expect(after.pains).toBe(1);
    expect(after.gain).toBe(1);
    expect(after.actions).toBe(1);
  });

  // Прямое требование Risks шага: «key по department.id + проверка e2e ИМЕННО НА ПЕРЕКЛЮЧЕНИИ, а не
  // только на открытии». Такой проверки не было (skeptic, NB-1), и дыра была опасной: удаление
  // key={activeDepartment.id} в OfficeExperience.tsx сломало бы каскад для заголовка и кнопок, НЕ
  // уронив ни одного теста, — причём частично, потому что у PainGainPanel есть собственный key и
  // боли продолжали бы анимироваться. Выглядело бы как случайный сбой тайминга, а не как поломка.
  test("переключение отдела через рельс проигрывает каскад заново", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDepartment(page, "sales");
    // Дожидаемся конца ПЕРВОГО каскада перед переключением — иначе тест мерил бы наложение двух.
    // Сигналом служит пояснение: кнопки со Step 17 видимы сразу и условие выполнялось бы мгновенно.
    await expect.poll(async () => (await OPACITY_OF(page)).gain, { timeout: 6000 }).toBe(1);

    const hr = departments.find((d) => d.id === "hr")!;
    await page
      .getByRole("navigation", { name: "Панель отделов" })
      .getByRole("button", { name: hr.overviewLabel })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: hr.headline })).toBeVisible();
    await recordCascade(page);

    // Ожидание привязано к ПОЯСНЕНИЮ — последней анимируемой ступени. Прежде здесь стояли кнопки,
    // но со Step 17 они видимы с первого кадра (решение пользователя 2026-07-20), поэтому как
    // сигнал «каскад закончился» они больше не годятся: условие выполнялось бы мгновенно, и
    // рекордер читался бы пустым.
    await expect.poll(async () => (await OPACITY_OF(page)).gain, { timeout: 8000 }).toBe(1);
    const at = await readCascade(page);
    expect(at.copy, "заголовок нового отдела должен опережать боли").toBeLessThan(at.pains);
    expect(
      at.pains,
      "боли обязаны появиться заново, а не остаться от прошлого отдела",
    ).toBeLessThan(at.gain);
  });

  // Мобильный эквивалент каскада был в scope, но без сторожа (skeptic, NB-2). Блоков здесь три:
  // PainGainPanel скрыт, вместо него аккордеон, поэтому кнопки стоят на 2 с, а не на 3.
  test("мобильный каскад: заголовок → аккордеон → кнопки, без скролла документа", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openDepartment(page, "sales");

    const mobileOpacity = () =>
      page.evaluate(() => {
        const op = (el: Element | null | undefined) =>
          el ? Number(getComputedStyle(el).opacity) : -1;
        return {
          copy: op(document.querySelector('[class*="stageCopy"]')),
          accordion: op(document.querySelector('[data-testid="mobile-pain-gain-accordion"]')),
          actions: op(document.querySelector('[class*="stageActions"]')),
        };
      });

    // Со Step 17 кнопки видны с ПЕРВОГО кадра и на мобильном тоже (решение пользователя
    // 2026-07-20): невидимая, но кликабельная мишень была дефектом, а оба технических лекарства
    // отвергнуты замером — см. разбор в stagedReveal.module.css. Аккордеон при этом по-прежнему
    // приходит ступенью.
    const early = await mobileOpacity();
    expect(early.actions, "кнопки обязаны быть видимы сразу, а не в конце каскада").toBe(1);
    expect(early.accordion, "аккордеон — ступень каскада, сразу его быть не должно").toBeLessThan(
      1,
    );

    await expect.poll(async () => (await mobileOpacity()).accordion, { timeout: 4000 }).toBe(1);

    const scroll = await page.evaluate(() => ({
      sh: document.documentElement.scrollHeight,
      ih: window.innerHeight,
    }));
    expect(scroll.sh).toBeLessThanOrEqual(scroll.ih);
  });

  test("prefers-reduced-motion: каскада нет — все четыре блока видны сразу", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?department=sales");
    await page.waitForTimeout(250);

    // Регресс на реальный дефект: глобальное правило reduced-motion обнуляло animation-duration, но
    // НЕ animation-delay, поэтому без правки globals.css именно пользователь с reduced motion ждал
    // бы 3 секунды пустого экрана — результат, обратный смыслу настройки.
    const state = await OPACITY_OF(page);
    expect(state.copy).toBe(1);
    expect(state.pains).toBe(1);
    expect(state.gain).toBe(1);
    expect(state.actions).toBe(1);
  });
});

test.describe("Step 17 — швы каскада, найденные milestone review", () => {
  // AC2 Step 17 (решение пользователя 2026-07-20): кнопки видны с первого кадра, каскад остаётся у
  // трёх остальных блоков.
  //
  // Прежде блок держал opacity 0 всю задержку при сохранённом попадании указателем — измерено,
  // реальный клик по пустому месту открывал Telegram. Оба технических лекарства отвергнуты замером:
  //   • `pointer-events: none` — роняет 4 теста Step 15/Step 16 по существу (их приёмка требует,
  //     чтобы критический контент оставался доступен во время анимации);
  //   • приглушённый старт вместо невидимого — роняет axe: контраст 1.29:1 при opacity 0.4 и 3.6:1
  //     даже при 0.85 против нормы 4.5:1, потому что CTA проходит контраст с малым запасом и ЛЮБАЯ
  //     прозрачность выводит её за WCAG AA.
  //
  // Проверяются ОБА условия сразу, покадрово: мишень никогда не бывает невидимой И никогда не
  // перестаёт принимать указатель. Второе — сторож против повторного внесения `pointer-events: none`,
  // правки, которая выглядит очевидной и ломает приёмку двух шагов.
  test("до результата нет невидимой CTA, а Back остаётся кликабельной", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const department = await openDepartment(page, "sales");
    await expect(page.getByRole("link", { name: department.ctaLabel })).toHaveCount(0);
    const back = page.getByRole("button", { name: "Назад к офису" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByRole("navigation", { name: "Отделы компании" })).toBeVisible();
  });

  // Находка motion Major 3: `.panel` переключается медиазапросом через `display`, а повторный показ
  // ПЕРЕЗАПУСКАЕТ анимацию с backwards-fill. Проверяются ОБА состояния панели: до выбора боли
  // (рамка, `.gainInitial`) и после выбора (текст ответа, `.gainTextReveal`). Первая редакция этого
  // теста меряла только рамку и не выбирала боль — то есть не видела дефект в основном рабочем
  // состоянии панели, где skeptic его и замерил (текст исчезал на 1.2 с).
  for (const withChoice of [false, true]) {
    test(`ресайз через 768px не гасит окно результата (${withChoice ? "боль выбрана" : "до выбора"})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDepartment(page, "sales");

      await page.waitForFunction(
        () => document.querySelector('[data-cascade-done="true"]') !== null,
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(3600);

      if (withChoice) {
        await painListOf(page).getByRole("button").nth(1).click();
        // Дать тексту проявиться полностью до ресайза.
        await page.waitForTimeout(2200);
      }

      await page.setViewportSize({ width: 380, height: 780 });
      await page.waitForTimeout(200);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(150);

      // Меряется САМ анимируемый элемент: рамка <p> до выбора, внутренний <span> после.
      const opacity = await page.evaluate((chosen) => {
        const panel = document.querySelector("[data-gain-panel]") as HTMLElement | null;
        if (!panel) return -1;
        const target = chosen ? (panel.querySelector("span") as HTMLElement | null) : panel;
        if (!target) return -1;
        let value = 1;
        let node: HTMLElement | null = target;
        while (node) {
          value *= Number(getComputedStyle(node).opacity);
          node = node.parentElement;
        }
        return value;
      }, withChoice);

      expect(
        opacity,
        `окно результата погасло до ${opacity} после ресайза — пользователь потерял прочитанный ответ`,
      ).toBeGreaterThan(0.95);
    });
  }
});
