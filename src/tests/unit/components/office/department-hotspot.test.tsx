import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DepartmentHotspot } from "@/components/office/DepartmentHotspot";
import type { Department, OfficeZone } from "@/content/types";

const zone: OfficeZone = { departmentId: "sales", x: 7, y: 58, width: 42, height: 36 };

const department: Department = {
  id: "sales",
  name: "Продажи",
  overviewLabel: "Продажи",
  overviewProblem: "Не терять заявки и не забывать клиентов",
  headline: "headline",
  problem: "problem",
  painPoints: [{ pain: "a", gain: "b" }],
  ctaLabel: "cta",
  solutionPath: "/solutions/sales",
  reference: "references/sales/02-sales-department.png",
};

describe("DepartmentHotspot", () => {
  it("has an accessible name equal to overviewLabel", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
  });

  it("keeps overviewProblem in the DOM, described via aria-describedby", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: department.overviewLabel });
    const describedById = button.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();

    const description = document.getElementById(describedById as string);
    expect(description).not.toBeNull();
    expect(description).toHaveTextContent(department.overviewProblem);
  });

  it("positions itself from the zone prop, not a hardcoded value", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: department.overviewLabel });
    expect(button.style.left).toBe(`${zone.x}%`);
    expect(button.style.top).toBe(`${zone.y}%`);
    expect(button.style.width).toBe(`${zone.width}%`);
    expect(button.style.height).toBe(`${zone.height}%`);
  });

  it("has a stable id derived from the department id, used for focus-return after closing (docs/11)", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: department.overviewLabel });
    expect(button.id).toBe(`hotspot-${department.id}`);
  });

  it("calls onSelect with the department id on click — Step 5 no-op inversion", () => {
    const onSelect = vi.fn();
    render(<DepartmentHotspot zone={zone} department={department} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: department.overviewLabel }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(department.id);
  });
});
