import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DepartmentNavigationRail } from "@/components/office/DepartmentNavigationRail";
import { getDepartments } from "@/content/departments";

describe("DepartmentNavigationRail", () => {
  const departments = getDepartments();

  it("renders exactly 4 clickable buttons for the non-active departments", () => {
    render(
      <DepartmentNavigationRail
        departments={departments}
        activeDepartmentId="sales"
        onSelectDepartment={() => {}}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Панель отделов" });
    expect(nav.querySelectorAll("button")).toHaveLength(4);
    for (const department of departments.filter((d) => d.id !== "sales")) {
      expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
    }
  });

  it("marks the active department with aria-current and does not render it as a button (not only color)", () => {
    render(
      <DepartmentNavigationRail
        departments={departments}
        activeDepartmentId="sales"
        onSelectDepartment={() => {}}
      />,
    );
    const sales = departments.find((d) => d.id === "sales")!;
    expect(screen.queryByRole("button", { name: sales.overviewLabel })).not.toBeInTheDocument();
    const current = screen.getByText(sales.overviewLabel).closest('[aria-current="true"]');
    expect(current).not.toBeNull();
  });

  it("renders a photo thumbnail for every department, including the active one (Step 7.3, OQ-P1)", () => {
    const { container } = render(
      <DepartmentNavigationRail
        departments={departments}
        activeDepartmentId="sales"
        onSelectDepartment={() => {}}
      />,
    );
    // 5 отделов — 5 миниатюр (next/image рендерит реальный <img>, decorative alt="").
    expect(container.querySelectorAll('img[alt=""]')).toHaveLength(5);
  });

  it("calls onSelectDepartment with the clicked department's id", () => {
    const onSelectDepartment = vi.fn();
    render(
      <DepartmentNavigationRail
        departments={departments}
        activeDepartmentId="sales"
        onSelectDepartment={onSelectDepartment}
      />,
    );
    const hr = departments.find((d) => d.id === "hr")!;
    fireEvent.click(screen.getByRole("button", { name: hr.overviewLabel }));
    expect(onSelectDepartment).toHaveBeenCalledTimes(1);
    expect(onSelectDepartment).toHaveBeenCalledWith("hr");
  });
});
