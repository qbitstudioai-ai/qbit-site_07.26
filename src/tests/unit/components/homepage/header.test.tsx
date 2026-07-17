import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/homepage/Header";

describe("Header", () => {
  const tagline = "Помогаем экономить ДЕНЬГИ и ВРЕМЯ";

  it("renders the tagline", () => {
    render(<Header tagline={tagline} onReturnHome={() => {}} />);
    expect(screen.getByText(tagline)).toBeInTheDocument();
  });

  it("renders the brand", () => {
    render(<Header tagline={tagline} onReturnHome={() => {}} />);
    expect(screen.getByText("QBit-Studio-Ai")).toBeInTheDocument();
  });

  // Step 7.6, AC3/AC4: логотип — настоящая кнопка с единственным, неудвоенным доступным именем.
  it("exposes the logo as a button named exactly after the brand, not duplicated by the image alt", () => {
    render(<Header tagline={tagline} onReturnHome={() => {}} />);
    expect(screen.getByRole("button", { name: "QBit-Studio-Ai" })).toBeInTheDocument();
    // alt="" делает логотип декоративным — он не должен попадать в дерево доступности отдельно.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("calls onReturnHome when the logo is clicked (Step 7.6, AC1)", () => {
    const onReturnHome = vi.fn();
    render(<Header tagline={tagline} onReturnHome={onReturnHome} />);

    fireEvent.click(screen.getByRole("button", { name: "QBit-Studio-Ai" }));

    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  // type="button" — не submit: внутри <form> кнопка иначе отправляла бы форму вместо возврата
  // в hero. Заодно это то, что даёт Enter/Space-активацию нативно (AC3), без ручных обработчиков.
  it("is a real button element of type=button, keyboard-activatable natively (Step 7.6, AC3)", () => {
    render(<Header tagline={tagline} onReturnHome={() => {}} />);

    const button = screen.getByRole("button", { name: "QBit-Studio-Ai" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });
});
