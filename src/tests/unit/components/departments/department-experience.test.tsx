import { fireEvent, render, screen } from "@testing-library/react";
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
        onSelectDepartment={() => {}}
        onClose={() => {}}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: department.headline });
    expect(heading).toHaveAttribute("id", `department-heading-${department.id}`);
    expect((heading as HTMLElement).tabIndex).toBe(-1);
  });

  it("renders problem, at most 3 symptoms (docs/12), and all outcomes", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        onSelectDepartment={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(department.problem)).toBeInTheDocument();
    for (const symptom of department.symptoms.slice(0, 3)) {
      expect(screen.getByText(symptom)).toBeInTheDocument();
    }
    for (const outcome of department.outcomes) {
      expect(screen.getByText(outcome)).toBeInTheDocument();
    }
  });

  it("renders a visible CTA button and an explicit close button that calls onClose", () => {
    const onClose = vi.fn();
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
        onSelectDepartment={() => {}}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("button", { name: department.ctaLabel })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exposes an accessible region named after the department's overviewLabel", () => {
    render(
      <DepartmentExperience
        department={department}
        machineView="department-active"
        departments={departments}
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
