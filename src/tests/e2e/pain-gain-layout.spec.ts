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
const painListOf = (page: Page) => page.getByTestId("pain-gain-panel").locator("ul");

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
      const gainBox = (await gainOf(page).boundingBox())!;

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
      boxes.push((await gainOf(page).boundingBox())!);
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
    // При reduced-motion слоёв нет вовсе: возвращается обычный текст, а не «быстрая анимация».
    expect(await gainOf(page).locator("span").count()).toBe(0);
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
    const heading = page.getByRole("heading", { level: 2, name: departments[0].headline });
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

  test("под списком болей пояснения больше нет", async ({ page }) => {
    await openDepartment(page, "logistics");

    const painBox = (await painListOf(page).boundingBox())!;
    const gainBox = (await gainOf(page).boundingBox())!;

    // Прежняя раскладка ставила пояснение ПОД списком — то есть его верх был ниже низа списка.
    // Этот тест падал бы на прежней вёрстке и не даёт ей вернуться незамеченной.
    expect(gainBox.y).toBeLessThan(painBox.y + painBox.height);
  });
});
