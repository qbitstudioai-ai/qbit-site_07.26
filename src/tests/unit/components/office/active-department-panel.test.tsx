import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveDepartmentPanel } from "@/components/office/ActiveDepartmentPanel";
import { getDepartments } from "@/content/departments";

describe("ActiveDepartmentPanel (temporary Step 5 minimal block — replaced wholesale in Step 6)", () => {
  const department = getDepartments().find((d) => d.id === "sales")!;

  it("renders headline as a programmatically focusable h2 with a stable, predictable id", () => {
    render(
      <ActiveDepartmentPanel
        department={department}
        machineView="department-active"
        onClose={() => {}}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: department.headline });
    expect(heading).toHaveAttribute("id", `department-heading-${department.id}`);
    expect((heading as HTMLElement).tabIndex).toBe(-1);
  });

  it("renders problem, at most 3 symptoms (docs/12), and all outcomes", () => {
    render(
      <ActiveDepartmentPanel
        department={department}
        machineView="department-active"
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
      <ActiveDepartmentPanel
        department={department}
        machineView="department-active"
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("button", { name: department.ctaLabel })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
