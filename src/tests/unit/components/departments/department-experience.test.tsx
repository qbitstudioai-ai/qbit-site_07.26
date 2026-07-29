import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DepartmentExperience } from "@/components/departments/DepartmentExperience";
import { getDepartments } from "@/content/departments";

describe("DepartmentExperience (Step 6 — replaces the temporary Step 5 ActiveDepartmentPanel)", () => {
  const departments = getDepartments();
  const department = departments.find((d) => d.id === "sales")!;

  it("renders headline as a programmatically focusable h2 with a stable, predictable id", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: department.headline });
    expect(heading).toHaveAttribute("id", `department-heading-${department.id}`);
    expect((heading as HTMLElement).tabIndex).toBe(-1);
  });

  it("renders problem and exactly 5 pain points, defaulting to the first pain's gain (Step 7.3, OQ-P2)", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    expect(screen.getByText(department.problem)).toBeInTheDocument();
    expect(department.painPoints).toHaveLength(5);
    for (const point of department.painPoints) {
      expect(screen.getAllByText(point.pain).length).toBeGreaterThan(0);
    }
    // Оба варианта раскладки (PainGainPanel Desktop/Tablet, MobilePainGainAccordion Mobile)
    // рендерятся одновременно в DOM (видимость по CSS, Step 7 прецедент) — по умолчанию (без клика)
    // оба показывают выгоду именно первого пункта боли (OQ-P2).
    expect(screen.getAllByText(department.painPoints[0].gain).length).toBeGreaterThan(0);
  });

  it("selecting a pain point in PainGainPanel shows exactly its gain, and no other (Step 7.3)", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    const panelElement = screen.getByTestId("pain-gain-panel");
    const panel = within(panelElement);
    const thirdPain = department.painPoints[2];
    fireEvent.click(panel.getByRole("button", { name: thirdPain.pain }));

    // Сверка по textContent, а не getByText, по двум причинам сразу. Amendment 12 разбил печать на
    // посимвольные <span>, и у <p> больше нет ПРЯМЫХ текстовых узлов — а getByText сопоставляет
    // именно их, не всё поддерево. Плюс пояснение теперь состоит из ДВУХ слоёв (правка по skeptic
    // Phase B): видимые глифы, скрытые от дерева доступности, и один доступный текстовый узел,
    // скрытый визуально — поэтому textContent самого <p> содержит текст дважды, и сверяться надо со
    // слоями по отдельности.
    // Проверка при этом не ослаблена, а строже прежней: раньше утверждалось «узел с таким текстом
    // существует», теперь — что КАЖДЫЙ слой равен выгоде выбранной боли целиком (`toBe`), то есть
    // подмена, обрезка или рассинхрон слоёв тоже провалили бы тест.
    const visual = panelElement.querySelector("[data-typed-visual]");
    const accessible = panelElement.querySelector("[data-typed-accessible]");

    expect(visual?.textContent).toBe(thirdPain.gain);
    expect(accessible?.textContent).toBe(thirdPain.gain);
    expect(visual?.textContent).not.toContain(department.painPoints[0].gain);

    // Доступный слой скрыт от глаза, но НЕ от AT, а видимый — наоборот. Именно это разделение
    // даёт скринридеру целое предложение одним узлом вместо россыпи однобуквенных (AC9).
    expect(visual).toHaveAttribute("aria-hidden", "true");
    expect(accessible).not.toHaveAttribute("aria-hidden");

    // И полный текст лежит в DOM сразу, не дожидаясь конца анимации — на этом держится и aria-live,
    // и требование «критический контент не ждёт анимации» (CLAUDE.md Motion rules).
    expect(accessible?.textContent).toHaveLength(thirdPain.gain.length);
  });

  it("launches one measured impulse only for a different pain and keeps only the latest run", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    const panel = screen.getByTestId("pain-gain-panel");
    const pains = within(panel).getAllByRole("button");

    fireEvent.click(pains[0]);
    expect(panel.querySelector("[data-pain-solution-impulse]")).not.toBeInTheDocument();

    fireEvent.click(pains[2]);
    expect(panel.querySelectorAll("[data-pain-solution-impulse]")).toHaveLength(1);
    expect(panel.querySelector("[data-pain-solution-impulse]")).toHaveAttribute(
      "data-impulse-source",
      "2",
    );

    fireEvent.click(pains[4]);
    expect(panel.querySelectorAll("[data-pain-solution-impulse]")).toHaveLength(1);
    const latest = panel.querySelector("[data-pain-solution-impulse]");
    expect(latest).toHaveAttribute("data-impulse-source", "4");
    const latestRun = latest?.getAttribute("data-impulse-run");

    fireEvent.click(pains[4]);
    expect(panel.querySelector("[data-pain-solution-impulse]")).toHaveAttribute(
      "data-impulse-run",
      latestRun,
    );
  });

  it("expanding a pain point in the mobile accordion shows exactly its gain, collapsing the previous one (Step 7.3, OQ-P6)", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    const accordion = within(screen.getByTestId("mobile-pain-gain-accordion"));
    const secondPain = department.painPoints[1];
    fireEvent.click(accordion.getByRole("button", { name: secondPain.pain }));
    expect(accordion.getByText(secondPain.gain)).toBeInTheDocument();
    expect(accordion.queryByText(department.painPoints[0].gain)).not.toBeInTheDocument();
  });

  it("renders source-provided howItWorks copy after the matching support solution only", () => {
    const support = departments.find((candidate) => candidate.id === "support")!;
    render(
      <DepartmentExperience
        department={support}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );

    const howItWorks = support.painPoints[0].howItWorks!;
    expect(screen.getAllByText("Как работает")).toHaveLength(2);
    expect(screen.getAllByText(howItWorks)).toHaveLength(2);
  });

  // Amendment 10: CTA отдела — внешняя ссылка на Telegram-контакт, а не кнопка-заглушка.
  it("reserves the business-result slot and removes the central close action", () => {
    const { container } = render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    expect(container.querySelector("[data-customer-benefits]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Закрыть" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: department.ctaLabel })).not.toBeInTheDocument();
  });

  it("exposes an accessible region named after the department's overviewLabel", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    expect(screen.getByRole("region", { name: department.overviewLabel })).toBeInTheDocument();
  });

  it("does not restore the rejected BeforeAfterSequence for sales", () => {
    const { container } = render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
      />,
    );
    expect(screen.queryByRole("region", { name: "Как меняется работа" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-customer-benefits]")).toBeInTheDocument();
  });

  it("renders CarouselNavControls (Step 7) after the actions block, with wrap-around prev/next relative to the departments array", () => {
    const onSelectDepartment = vi.fn();
    const currentIndex = departments.findIndex((candidate) => candidate.id === department.id);
    const previousDepartment =
      departments[(currentIndex - 1 + departments.length) % departments.length];
    const nextDepartment = departments[(currentIndex + 1) % departments.length];

    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={onSelectDepartment}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `Предыдущий отдел: ${previousDepartment.overviewLabel}`,
      }),
    );
    expect(onSelectDepartment).toHaveBeenCalledWith(previousDepartment.id);

    fireEvent.click(
      screen.getByRole("button", { name: `Следующий отдел: ${nextDepartment.overviewLabel}` }),
    );
    expect(onSelectDepartment).toHaveBeenCalledWith(nextDepartment.id);
  });
});
