import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DepartmentNavigationRail } from "@/components/office/DepartmentNavigationRail";
import { OfficePhoto } from "@/components/office/OfficePhoto";
import { photoByDepartmentId } from "@/components/office/departmentPhotos";
import { getDepartments } from "@/content/departments";

// Уровень jsdom: реальной сети нет, поэтому onError диспатчится вручную. Настоящее поведение
// браузера при недоступном файле проверяется e2e (reduced-motion-and-fallback.spec.ts, route.abort).
// Ни один из двух уровней не выдаётся за другой — см. WORKPLAN.md Step 8, Risks.
describe("OfficePhoto", () => {
  it("renders a decorative image while loading succeeds", () => {
    const { container } = render(<OfficePhoto src={photoByDepartmentId.sales} />);
    expect(container.querySelectorAll('img[alt=""]')).toHaveLength(1);
    expect(container.querySelector("[data-photo-fallback]")).toBeNull();
  });

  it("swaps a failed photo for a neutral placeholder instead of a broken image", () => {
    const { container } = render(<OfficePhoto src={photoByDepartmentId.sales} />);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    const fallback = container.querySelector("[data-photo-fallback]");
    expect(fallback).not.toBeNull();
    // Плейсхолдер декоративен так же, как и само фото — он не должен появиться в дереве доступности.
    expect(fallback).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the caller's class on the placeholder so layout geometry survives the failure", () => {
    const { container } = render(
      <OfficePhoto src={photoByDepartmentId.sales} className="caller-geometry" />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("[data-photo-fallback]")).toHaveClass("caller-geometry");
  });
});

describe("DepartmentNavigationRail with a failed photo layer (Step 8, AC 2)", () => {
  const departments = getDepartments();

  it("keeps all 4 switch buttons and their labels usable when every thumbnail fails", () => {
    const { container } = render(
      <DepartmentNavigationRail
        departments={departments}
        activeDepartmentId="sales"
        onSelectDepartment={() => {}}
      />,
    );

    for (const img of container.querySelectorAll("img")) {
      fireEvent.error(img);
    }

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("[data-photo-fallback]")).toHaveLength(5);

    // Коммерческий путь не зависит от фотослоя: подписи и кнопки переключения на месте.
    const nav = screen.getByRole("navigation", { name: "Панель отделов" });
    expect(nav.querySelectorAll("button")).toHaveLength(4);
    for (const department of departments.filter((d) => d.id !== "sales")) {
      expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
    }
  });
});
