import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficeSemanticMap } from "@/components/office/OfficeSemanticMap";
import { getDepartments } from "@/content/departments";
import { getOfficeZones } from "@/content/office-zones";

describe("OfficeSemanticMap", () => {
  const departments = getDepartments();
  const officeZones = getOfficeZones();

  it("renders exactly 5 accessible department links, scoped to the map nav", () => {
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Отделы компании" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);

    for (const department of departments) {
      expect(within(nav).getByRole("link", { name: department.overviewLabel })).toBeInTheDocument();
    }
  });

  it("orders hotspots in the DOM by y ascending, then x ascending", () => {
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Отделы компании" });
    const links = within(nav).getAllByRole("link");

    const expectedOrder = officeZones
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((zone) => zone.departmentId);

    const actualOrder = links.map((link) => {
      const label = link.getAttribute("aria-label");
      const department = departments.find((d) => d.overviewLabel === label);
      return department?.id;
    });

    expect(actualOrder).toEqual(expectedOrder);
  });

  it("computes hotspot position from office-zones.json, not a hardcoded value", () => {
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
    for (const zone of officeZones) {
      const department = departments.find((d) => d.id === zone.departmentId);
      const link = screen.getByRole("link", { name: department?.overviewLabel });
      expect(link.style.left).toBe(`${zone.x}%`);
      expect(link.style.top).toBe(`${zone.y}%`);
      expect(link.style.width).toBe(`${zone.width}%`);
      expect(link.style.height).toBe(`${zone.height}%`);
    }
  });

  // Три сторожа фотослоя overview («сцена есть», «сцена именно мастер-, а не отдела», «зоны живы при
  // провале загрузки») ПЕРЕЕХАЛИ в office-experience.test.tsx, а не сняты: со Step 18 кадр рисует
  // общий сцен-слой, живущий через оба состояния офиса, и этот компонент отвечает только за зоны
  // поверх кадра. Требования те же — проверяются у нового владельца, иначе переезд молча снял бы
  // сторожей вместе с кодом. Два из трёх при переезде УСИЛЕНЫ: вместо регулярки по исходному тексту
  // они теперь смотрят на отрисованный DOM.

  it("clicking a hotspot calls onSelectDepartment with that department's id (Step 5 no-op inversion)", () => {
    const onSelectDepartment = vi.fn();
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={onSelectDepartment}
      />,
    );
    const salesDepartment = departments.find((d) => d.id === "sales")!;
    fireEvent.click(screen.getByRole("link", { name: salesDepartment.overviewLabel }));
    expect(onSelectDepartment).toHaveBeenCalledWith("sales");
  });
});
