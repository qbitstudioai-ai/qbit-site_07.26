import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileDepartmentCarousel } from "@/components/office/MobileDepartmentCarousel";
import { getDepartments } from "@/content/departments";

describe("MobileDepartmentCarousel", () => {
  const departments = getDepartments();

  it("renders exactly one department card at a time, with label/problem always in the DOM (no hover/focus needed)", () => {
    render(<MobileDepartmentCarousel departments={departments} onSelectDepartment={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Карусель отделов" });
    expect(nav.querySelectorAll("button").length).toBe(3); // card + Prev + Next
    const card = screen.getByRole("button", { name: departments[0].overviewLabel });
    expect(card).toHaveTextContent(departments[0].overviewProblem);
  });

  it("uses a stable id for the card, independent of which department is shown", () => {
    render(<MobileDepartmentCarousel departments={departments} onSelectDepartment={() => {}} />);
    const card = screen.getByRole("button", { name: departments[0].overviewLabel });
    expect(card.id).toBe("mobile-department-carousel-card");

    fireEvent.click(screen.getByRole("button", { name: /Следующий отдел/ }));
    const nextCard = screen.getByRole("button", { name: departments[1].overviewLabel });
    expect(nextCard.id).toBe("mobile-department-carousel-card");
  });

  it("Next/Previous change the shown card locally without calling onSelectDepartment", () => {
    const onSelectDepartment = vi.fn();
    render(
      <MobileDepartmentCarousel
        departments={departments}
        onSelectDepartment={onSelectDepartment}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Следующий отдел/ }));
    expect(screen.getByRole("button", { name: departments[1].overviewLabel })).toBeInTheDocument();
    expect(onSelectDepartment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Предыдущий отдел/ }));
    expect(screen.getByRole("button", { name: departments[0].overviewLabel })).toBeInTheDocument();
    expect(onSelectDepartment).not.toHaveBeenCalled();
  });

  it("wraps around at both boundaries (Previous from index 0 goes to the last department, Next from the last goes to index 0)", () => {
    render(<MobileDepartmentCarousel departments={departments} onSelectDepartment={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Предыдущий отдел/ }));
    expect(
      screen.getByRole("button", { name: departments[departments.length - 1].overviewLabel }),
    ).toBeInTheDocument();

    for (let i = 0; i < departments.length; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Следующий отдел/ }));
    }
    expect(
      screen.getByRole("button", { name: departments[departments.length - 1].overviewLabel }),
    ).toBeInTheDocument();
  });

  it("tapping the current card calls onSelectDepartment with the department actually shown, not always the first", () => {
    const onSelectDepartment = vi.fn();
    render(
      <MobileDepartmentCarousel
        departments={departments}
        onSelectDepartment={onSelectDepartment}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Следующий отдел/ }));
    fireEvent.click(screen.getByRole("button", { name: /Следующий отдел/ }));
    fireEvent.click(screen.getByRole("button", { name: departments[2].overviewLabel }));
    expect(onSelectDepartment).toHaveBeenCalledTimes(1);
    expect(onSelectDepartment).toHaveBeenCalledWith(departments[2].id);
  });

  it("Prev/Next aria-labels name the target department, not a generic label", () => {
    render(<MobileDepartmentCarousel departments={departments} onSelectDepartment={() => {}} />);
    expect(
      screen.getByRole("button", {
        name: `Предыдущий отдел: ${departments[departments.length - 1].overviewLabel}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Следующий отдел: ${departments[1].overviewLabel}` }),
    ).toBeInTheDocument();
  });
});
