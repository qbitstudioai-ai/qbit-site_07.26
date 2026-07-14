import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  symptoms: ["a"],
  outcomes: ["b"],
  ctaLabel: "cta",
  solutionPath: "/solutions/sales",
  reference: "references/sales/02-sales-department.png",
};

describe("DepartmentHotspot", () => {
  it("has an accessible name equal to overviewLabel", () => {
    render(<DepartmentHotspot zone={zone} department={department} />);
    expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
  });

  it("keeps overviewProblem in the DOM, described via aria-describedby", () => {
    render(<DepartmentHotspot zone={zone} department={department} />);
    const button = screen.getByRole("button", { name: department.overviewLabel });
    const describedById = button.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();

    const description = document.getElementById(describedById as string);
    expect(description).not.toBeNull();
    expect(description).toHaveTextContent(department.overviewProblem);
  });

  it("positions itself from the zone prop, not a hardcoded value", () => {
    render(<DepartmentHotspot zone={zone} department={department} />);
    const button = screen.getByRole("button", { name: department.overviewLabel });
    expect(button.style.left).toBe(`${zone.x}%`);
    expect(button.style.top).toBe(`${zone.y}%`);
    expect(button.style.width).toBe(`${zone.width}%`);
    expect(button.style.height).toBe(`${zone.height}%`);
  });
});
