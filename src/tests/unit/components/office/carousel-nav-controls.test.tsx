import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarouselNavControls } from "@/components/office/CarouselNavControls";

describe("CarouselNavControls", () => {
  it("renders Previous/Next buttons with the given aria-labels", () => {
    render(
      <CarouselNavControls
        previousLabel="Предыдущий отдел: HR"
        nextLabel="Следующий отдел: Логистика"
        onPrevious={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Предыдущий отдел: HR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Следующий отдел: Логистика" })).toBeInTheDocument();
  });

  it("calls onPrevious/onNext, not a shared handler", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(
      <CarouselNavControls
        previousLabel="Предыдущий отдел: HR"
        nextLabel="Следующий отдел: Логистика"
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий отдел: HR" }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Следующий отдел: Логистика" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});
