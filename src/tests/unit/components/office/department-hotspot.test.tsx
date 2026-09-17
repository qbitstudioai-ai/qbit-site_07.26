import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DepartmentHotspot } from "@/components/office/DepartmentHotspot";
import { getDepartments } from "@/content/departments";
import type { Department, OfficeZone } from "@/content/types";

const zone: OfficeZone = { departmentId: "sales", x: 7, y: 58, width: 42, height: 36 };

const department: Department = {
  id: "sales",
  name: "Продажи",
  overviewLabel: "Продажи",
  overviewProblem: "Не терять заявки и не забывать клиентов",
  hoverDescription: "Заявки, CRM и упущенные возможности",
  headline: "headline",
  problem: "problem",
  painPoints: [{ pain: "a", gain: "b" }],
  customerBenefits: ["primary", "extra 1", "extra 2", "extra 3"],
  ctaLabel: "cta",
  solutionPath: "/solutions/sales",
  reference: "references/sales/02-sales-department.png",
};

describe("DepartmentHotspot", () => {
  it("has an accessible name equal to overviewLabel", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    expect(screen.getByRole("link", { name: department.overviewLabel })).toBeInTheDocument();
  });

  it("keeps hoverDescription in the DOM, described via aria-describedby", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    const describedById = link.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();

    const description = document.getElementById(describedById as string);
    expect(description).not.toBeNull();
    expect(description).toHaveTextContent(department.hoverDescription);
  });

  it("renders four decorative corner markers instead of a permanent rectangular border", () => {
    const { container } = render(
      <DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />,
    );
    expect(container.querySelectorAll("[data-corner-marker]")).toHaveLength(4);
  });

  it("positions itself from the zone prop, not a hardcoded value", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    expect(link.style.left).toBe(`${zone.x}%`);
    expect(link.style.top).toBe(`${zone.y}%`);
    expect(link.style.width).toBe(`${zone.width}%`);
    expect(link.style.height).toBe(`${zone.height}%`);
  });

  it("has a stable id derived from the department id, used for focus-return after closing (docs/11)", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    expect(link.id).toBe(`hotspot-${department.id}`);
  });

  it("is a crawlable link to the department's own solutionPath (DEPT-SEO.2B)", () => {
    render(<DepartmentHotspot zone={zone} department={department} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/solutions/sales");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("takes href from solutionPath for all five published departments — executive → /solutions/management", () => {
    const expected: Record<string, string> = {
      sales: "/solutions/sales",
      support: "/solutions/support",
      executive: "/solutions/management",
      hr: "/solutions/hr",
      logistics: "/solutions/logistics",
    };
    const published = getDepartments();
    expect(published.map((d) => d.id).sort()).toEqual(Object.keys(expected).sort());

    for (const publishedDepartment of published) {
      const { unmount } = render(
        <DepartmentHotspot
          zone={{ ...zone, departmentId: publishedDepartment.id }}
          department={publishedDepartment}
          onSelect={() => {}}
        />,
      );
      const link = screen.getByRole("link", { name: publishedDepartment.overviewLabel });
      expect(link.getAttribute("href"), publishedDepartment.id).toBe(
        publishedDepartment.solutionPath,
      );
      expect(link.getAttribute("href"), publishedDepartment.id).toBe(
        expected[publishedDepartment.id],
      );
      expect(link.getAttribute("href")).not.toBe("/solutions/executive");
      expect(link.id).toBe(`hotspot-${publishedDepartment.id}`);
      expect(link.getAttribute("aria-describedby")).toBe(
        `department-problem-${publishedDepartment.id}`,
      );
      unmount();
    }
  });

  it("calls onSelect with the department id on click and prevents navigation", () => {
    const onSelect = vi.fn();
    render(<DepartmentHotspot zone={zone} department={department} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    // fireEvent возвращает false, если обработчик вызвал preventDefault.
    expect(fireEvent.click(link)).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(department.id);
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)(
    "leaves %s-click to the browser: no onSelect, no preventDefault",
    (modifier) => {
      const onSelect = vi.fn();
      render(<DepartmentHotspot zone={zone} department={department} onSelect={onSelect} />);
      const link = screen.getByRole("link", { name: department.overviewLabel });
      expect(fireEvent.click(link, { [modifier]: true })).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  it("Space selects the department and prevents the default (page scroll)", () => {
    const onSelect = vi.fn();
    render(<DepartmentHotspot zone={zone} department={department} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    expect(fireEvent.keyDown(link, { key: " ", code: "Space" })).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(department.id);
  });

  it("Enter keydown does not call onSelect by hand — activation goes through the native click", () => {
    const onSelect = vi.fn();
    render(<DepartmentHotspot zone={zone} department={department} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: department.overviewLabel });
    expect(fireEvent.keyDown(link, { key: "Enter", code: "Enter" })).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
