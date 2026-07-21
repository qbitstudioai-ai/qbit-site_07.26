import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeforeAfterSequence } from "@/components/departments/BeforeAfterSequence";
import type { ProcessStep } from "@/content/types";

// Синтетические шаги, НЕ из data/departments.json: компонент обязан быть data-driven и работать для
// любого отдела (обобщаемость под Этапы 4–7), а не только для «Продаж».
const beforeSteps: ProcessStep[] = [
  {
    id: "b1",
    label: "Заявки в разных местах",
    description: "Приходят в разные каналы.",
    actor: "Клиент",
    status: "warning",
  },
  {
    id: "b2",
    label: "Ручной перенос",
    description: "Менеджер переносит вручную.",
    actor: "Менеджер",
    status: "critical",
  },
];
const automationSteps: ProcessStep[] = [
  {
    id: "a1",
    label: "Единый список",
    description: "Заявки собираются сами.",
    actor: "Система",
    status: "success",
  },
  {
    id: "a2",
    label: "Статус и ответственный",
    description: "У каждой заявки есть статус.",
    actor: "Система",
    status: "success",
  },
];

function renderSequence(props?: Partial<React.ComponentProps<typeof BeforeAfterSequence>>) {
  return render(
    <BeforeAfterSequence
      beforeSteps={beforeSteps}
      automationSteps={automationSteps}
      headingId="before-after-heading-test"
      {...props}
    />,
  );
}

describe("BeforeAfterSequence (Step 20)", () => {
  it("exposes a region labelled by its heading", () => {
    renderSequence();
    const region = screen.getByRole("region", { name: "Как меняется работа" });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Как меняется работа" })).toHaveAttribute(
      "id",
      "before-after-heading-test",
    );
  });

  // AC1: оба состояния и весь их текст присутствуют в дереве доступности ОДНОВРЕМЕННО, без переключения
  // и без зависимости от анимации — «до» и «после» видны рядом.
  it("renders BOTH the before and after states with all step text present at once", () => {
    renderSequence();
    // Текстовые заголовки колонок несут смысл «до»/«после» (не только цвет).
    expect(screen.getByText("Сейчас")).toBeInTheDocument();
    expect(screen.getByText("После автоматизации")).toBeInTheDocument();

    for (const step of [...beforeSteps, ...automationSteps]) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
      expect(screen.getByText(step.description)).toBeInTheDocument();
    }
  });

  // Обе колонки — упорядоченные списки (последовательность процесса), по числу шагов из props.
  it("renders each phase as an ordered list matching the step count (data-driven)", () => {
    renderSequence();
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(beforeSteps.length);
    expect(within(lists[1]).getAllByRole("listitem")).toHaveLength(automationSteps.length);
  });

  it("renders the actor label of a step when present", () => {
    renderSequence();
    // actor встречается у нескольких шагов — проверяем присутствие хотя бы одного «Система».
    expect(screen.getAllByText("Система").length).toBeGreaterThan(0);
    expect(screen.getByText("Клиент")).toBeInTheDocument();
  });

  // Маркеры статуса декоративны: смысл несёт колонка (текст) и форма, а СR-дубль статуса через
  // маркер не нужен и не должен зашумлять дерево доступности.
  it("marks status glyphs as decorative (aria-hidden), not as images", () => {
    const { container } = renderSequence();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
    // Ни одна svg не выставлена как img-роль — статус не становится отдельным объявлением.
    expect(container.querySelectorAll('svg[role="img"]').length).toBe(0);
  });

  // Обобщаемость: другой набор данных (иной отдел) рендерится тем же компонентом без правок.
  it("works for an arbitrary department's data, not a hardcoded one", () => {
    renderSequence({
      beforeSteps: [{ id: "x1", label: "Другой шаг", description: "Иной процесс." }],
      automationSteps: [{ id: "y1", label: "Другой результат", description: "Иной итог." }],
    });
    expect(screen.getByText("Другой шаг")).toBeInTheDocument();
    expect(screen.getByText("Другой результат")).toBeInTheDocument();
  });
});
