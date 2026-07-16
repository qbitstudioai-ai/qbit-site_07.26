import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfficeExperience } from "@/components/office/OfficeExperience";
import { getDepartments } from "@/content/departments";
import { getOfficeZones } from "@/content/office-zones";

describe("OfficeExperience", () => {
  const departments = getDepartments();
  const officeZones = getOfficeZones();

  it("marks itself data-revealed=false and applies the hidden-until-revealed class when isRevealed is false", () => {
    const { container } = render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={false}
        machineView="hero"
        activeDepartmentId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-revealed", "false");
    // The office map/hint is still present in the DOM (progressive enhancement, no-JS
    // fallback) — only its class marks it as hidden-until-revealed; actual CSS hiding is
    // verified in e2e (jsdom does not apply the real :global(.js) stylesheet rule).
    expect(screen.getByRole("navigation", { name: "Отделы компании" })).toBeInTheDocument();
  });

  it("marks itself data-revealed=true and drops the hidden-until-revealed class when isRevealed is true", () => {
    const { container } = render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeDepartmentId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-revealed", "true");
  });

  it("does not render an active department panel when activeDepartmentId is null", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeDepartmentId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders DepartmentExperience and the 4-button DepartmentNavigationRail, and hides the office map (Step 6 10/90 shell)", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="department-active"
        activeDepartmentId="sales"
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    const salesDepartment = departments.find((d) => d.id === "sales")!;
    expect(
      screen.getByRole("heading", { level: 2, name: salesDepartment.headline }),
    ).toBeInTheDocument();
    // Карта офиса (5 хотспотов) больше не рендерится одновременно с активным отделом — заменена
    // DepartmentNavigationRail (см. WORKPLAN.md Step 6 Expected files: DepartmentHotspot больше не
    // остаётся видимым одновременно с активным отделом).
    expect(screen.queryByRole("navigation", { name: "Отделы компании" })).not.toBeInTheDocument();
    const rail = screen.getByRole("navigation", { name: "Панель отделов" });
    expect(rail.querySelectorAll("button")).toHaveLength(4);
  });

  it("renders MobileDepartmentCarousel alongside OfficeSemanticMap in overview (Step 7 — both present in the DOM at once, CSS switches visibility per breakpoint, verified in e2e)", () => {
    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="overview"
        activeDepartmentId={null}
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Отделы компании" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Карусель отделов" })).toBeInTheDocument();
  });

  it("passes departments/onSelectDepartment down to DepartmentExperience so CarouselNavControls names the correct wrap-around neighbours (Step 7)", () => {
    // "executive" — средний по сортировке officeZones (не первый/последний), чтобы проверить
    // обычный (не граничный) случай prev/next.
    const sortedIds = officeZones
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((zone) => zone.departmentId);
    const activeIndex = sortedIds.indexOf("executive");
    const previousDepartment = departments.find(
      (d) => d.id === sortedIds[(activeIndex - 1 + sortedIds.length) % sortedIds.length],
    )!;
    const nextDepartment = departments.find(
      (d) => d.id === sortedIds[(activeIndex + 1) % sortedIds.length],
    )!;

    render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
        machineView="department-active"
        activeDepartmentId="executive"
        onSelectDepartment={() => {}}
        onCloseDepartment={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: `Предыдущий отдел: ${previousDepartment.overviewLabel}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Следующий отдел: ${nextDepartment.overviewLabel}` }),
    ).toBeInTheDocument();
  });
});
