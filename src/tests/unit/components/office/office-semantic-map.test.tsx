import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficeSemanticMap } from "@/components/office/OfficeSemanticMap";
import { getDepartments } from "@/content/departments";
import { getOfficeZones } from "@/content/office-zones";

describe("OfficeSemanticMap", () => {
  const departments = getDepartments();
  const officeZones = getOfficeZones();

  it("renders exactly 5 accessible department buttons, scoped to the map nav", () => {
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
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
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
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
    render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
    for (const zone of officeZones) {
      const department = departments.find((d) => d.id === zone.departmentId);
      const button = screen.getByRole("button", { name: department?.overviewLabel });
      expect(button.style.left).toBe(`${zone.x}%`);
      expect(button.style.top).toBe(`${zone.y}%`);
      expect(button.style.width).toBe(`${zone.width}%`);
      expect(button.style.height).toBe(`${zone.height}%`);
    }
  });

  // Step 12: overview стал настоящей сценой офиса, а не карточками на токен-фоне.
  it("renders a scene photo behind the hotspot layer", () => {
    const { container } = render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
    expect(container.querySelector("picture")).not.toBeNull();
  });

  // Что подключена именно МАСТЕР-сцена overview, а не сцена какого-нибудь отдела, проверяется по
  // исходному тексту: в Vite image-импорты резолвятся в строки-URL, а не в StaticImageData, поэтому
  // `img.src` в jsdom пуст и отличить сцены по нему нельзя (тот же артефакт окружения и тот же приём
  // обхода, что в office-scenes.test.ts и content/departments.test.ts).
  it("wires the overview master scene, not a department scene", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/office/OfficeSemanticMap.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/sources=\{officeSceneById\.overview\}/);
  });

  it("keeps all 5 department buttons usable when the scene photo fails to load (Step 8 fallback)", () => {
    const { container } = render(
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={() => {}}
      />,
    );
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-photo-fallback]")).not.toBeNull();

    // Коммерческий путь overview не зависит от фотослоя вовсе.
    const nav = screen.getByRole("navigation", { name: "Отделы компании" });
    expect(within(nav).getAllByRole("button")).toHaveLength(5);
  });

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
    fireEvent.click(screen.getByRole("button", { name: salesDepartment.overviewLabel }));
    expect(onSelectDepartment).toHaveBeenCalledWith("sales");
  });
});
