import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfficeSemanticMap } from "@/components/office/OfficeSemanticMap";
import { getDepartments } from "@/content/departments";
import { getOfficeZones } from "@/content/office-zones";

describe("OfficeSemanticMap", () => {
  const departments = getDepartments();
  const officeZones = getOfficeZones();

  it("renders exactly 5 accessible department buttons, scoped to the map nav", () => {
    render(<OfficeSemanticMap departments={departments} officeZones={officeZones} />);
    const nav = screen.getByRole("navigation", { name: "Отделы компании" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(5);

    for (const department of departments) {
      expect(
        within(nav).getByRole("button", { name: department.overviewLabel }),
      ).toBeInTheDocument();
    }
  });

  it("orders hotspots in the DOM by y ascending, then x ascending", () => {
    render(<OfficeSemanticMap departments={departments} officeZones={officeZones} />);
    const nav = screen.getByRole("navigation", { name: "Отделы компании" });
    const buttons = within(nav).getAllByRole("button");

    const expectedOrder = officeZones
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((zone) => zone.departmentId);

    const actualOrder = buttons.map((button) => {
      const label = button.getAttribute("aria-label");
      const department = departments.find((d) => d.overviewLabel === label);
      return department?.id;
    });

    expect(actualOrder).toEqual(expectedOrder);
  });

  it("computes hotspot position from office-zones.json, not a hardcoded value", () => {
    render(<OfficeSemanticMap departments={departments} officeZones={officeZones} />);
    for (const zone of officeZones) {
      const department = departments.find((d) => d.id === zone.departmentId);
      const button = screen.getByRole("button", { name: department?.overviewLabel });
      expect(button.style.left).toBe(`${zone.x}%`);
      expect(button.style.top).toBe(`${zone.y}%`);
      expect(button.style.width).toBe(`${zone.width}%`);
      expect(button.style.height).toBe(`${zone.height}%`);
    }
  });
});
