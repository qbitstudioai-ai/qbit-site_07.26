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
        onClose={() => {}}
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
        onClose={() => {}}
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
        onClose={() => {}}
      />,
    );
    const panel = within(screen.getByTestId("pain-gain-panel"));
    const thirdPain = department.painPoints[2];
    fireEvent.click(panel.getByRole("button", { name: thirdPain.pain }));
    expect(panel.getByText(thirdPain.gain)).toBeInTheDocument();
    expect(panel.queryByText(department.painPoints[0].gain)).not.toBeInTheDocument();
  });

  it("expanding a pain point in the mobile accordion shows exactly its gain, collapsing the previous one (Step 7.3, OQ-P6)", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
        onClose={() => {}}
      />,
    );
    const accordion = within(screen.getByTestId("mobile-pain-gain-accordion"));
    const secondPain = department.painPoints[1];
    fireEvent.click(accordion.getByRole("button", { name: secondPain.pain }));
    expect(accordion.getByText(secondPain.gain)).toBeInTheDocument();
    expect(accordion.queryByText(department.painPoints[0].gain)).not.toBeInTheDocument();
  });

  // Amendment 10: CTA отдела — внешняя ссылка на Telegram-контакт, а не кнопка-заглушка.
  it("renders the department CTA as an external contact link, plus a close button that calls onClose", () => {
    const onClose = vi.fn();
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
        onClose={onClose}
      />,
    );
    const cta = screen.getByRole("link", { name: department.ctaLabel });
    expect(cta).toHaveAttribute("href", "https://t.me/Promt_Pavel");
    expect(cta).toHaveAttribute("target", "_blank");
    // rel обязателен при target="_blank": без noopener открытая вкладка получает window.opener.
    expect(cta).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(cta).toHaveAttribute("rel", expect.stringContaining("noreferrer"));

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exposes an accessible region named after the department's overviewLabel", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("region", { name: department.overviewLabel })).toBeInTheDocument();
  });

  it("renders CarouselNavControls (Step 7) after the actions block, with wrap-around prev/next relative to the departments array", () => {
    const onSelectDepartment = vi.fn();
    // sales — первый в data/departments.json (см. src/content/departments.ts) — не единственный
    // осмысленный случай, но граничный (prev должен обернуться на последний элемент массива).
    const previousDepartment = departments[departments.length - 1];
    const nextDepartment = departments[1];

    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        contactHref="https://t.me/Promt_Pavel"
        onSelectDepartment={onSelectDepartment}
        onClose={() => {}}
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
