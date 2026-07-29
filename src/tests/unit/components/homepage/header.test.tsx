import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";

describe("Header", () => {
  const links = [
    { label: "Главная", href: "/" },
    { label: "О нас", href: "/how-we-work" },
    { label: "Продукт и Стоимость", href: "/products" },
    { label: "Блог", href: "/blog" },
    { label: "FAQ", href: "#" },
    { label: "Контакты", href: "#" },
    { label: "Вход", href: "/login" },
  ];
  const defaultProps = {
    links,
    phoneLabel: "+7 (937) 534-65-75",
    phoneHref: "tel:+79375346575",
    phoneAccessibleLabel: "Позвонить по номеру +7 937 534-65-75.",
    onReturnHome: () => {},
  };

  it("renders navigation in the required order and a semantic phone link", () => {
    render(<Header {...defaultProps} />);
    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(Array.from(navigation.querySelectorAll("a"), (link) => link.textContent)).toEqual(
      links.map((link) => link.label),
    );
    const phone = screen.getByRole("link", { name: defaultProps.phoneAccessibleLabel });
    expect(phone).toHaveAttribute("href", defaultProps.phoneHref);
    expect(phone).toHaveTextContent(defaultProps.phoneLabel);
    expect(screen.queryByText("Обсудить автоматизацию")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Продукт и Стоимость" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("exposes a disclosure button and closes the menu on Escape", () => {
    render(<Header {...defaultProps} />);
    const menuButton = screen.getByRole("button", { name: "Открыть меню" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    expect(screen.getByRole("button", { name: "Закрыть меню" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Открыть меню" })).toHaveFocus();
  });

  it("places the mobile disclosure content after its trigger and keeps placeholder focus visible", () => {
    render(<Header {...defaultProps} />);
    const menuButton = screen.getByRole("button", { name: "Открыть меню" });
    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });

    expect(
      menuButton.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(menuButton);
    const placeholder = screen.getByRole("link", { name: "FAQ" });
    placeholder.focus();
    fireEvent.click(placeholder);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(placeholder).toHaveFocus();
  });

  it("links the blog navigation item to the blog route", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByRole("link", { name: "Блог" })).toHaveAttribute("href", "/blog");
  });

  // Ссылка «Контакты» ведёт на существующий маршрут /contacts, а не на заглушку "#".
  // Проверяется на РЕАЛЬНЫХ данных меню, а не на локальной фикстуре: именно данные были дефектом.
  it("renders Контакты as a real, keyboard-reachable link to /contacts", () => {
    render(<Header {...defaultProps} links={getHomepageCopy().heroLinks} />);

    const contacts = screen.getByRole("link", { name: "Контакты" });
    expect(contacts).toHaveAttribute("href", "/contacts");

    // Клавиатурная доступность: настоящая ссылка с href попадает в порядок обхода
    // (tabIndex === 0) и получает фокус, в отличие от span[aria-disabled].
    expect(contacts.tabIndex).toBe(0);
    contacts.focus();
    expect(contacts).toHaveFocus();

    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(navigation.querySelectorAll('a[href="#"]')).toHaveLength(0);
    expect(navigation.querySelectorAll("a:not([href]), a[href='']")).toHaveLength(0);
  });

  it("returns the homepage state machine to hero when Главная is clicked on the homepage", () => {
    const onReturnHome = vi.fn();
    render(<Header {...defaultProps} onReturnHome={onReturnHome} />);

    const homeLink = screen.getByRole("link", { name: "Главная" });
    expect(homeLink).toHaveAttribute("href", "/");
    fireEvent.click(homeLink);

    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("keeps Главная as a real route link when the header is rendered on an inner page", () => {
    render(<Header {...defaultProps} onReturnHome={undefined} />);

    expect(screen.getByRole("link", { name: "Главная" })).toHaveAttribute("href", "/");
  });

  it("renders the brand", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText("QBit-Studio-Ai")).toBeInTheDocument();
  });

  it("exposes the logo as a button named exactly after the brand", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByRole("button", { name: "QBit-Studio-Ai" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("calls onReturnHome when the logo is clicked", () => {
    const onReturnHome = vi.fn();
    render(<Header {...defaultProps} onReturnHome={onReturnHome} />);

    fireEvent.click(screen.getByRole("button", { name: "QBit-Studio-Ai" }));

    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("uses a real type=button element for the brand", () => {
    render(<Header {...defaultProps} />);
    const button = screen.getByRole("button", { name: "QBit-Studio-Ai" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("uses a semantic home link when no state-machine callback is needed", () => {
    render(<Header {...defaultProps} onReturnHome={undefined} />);
    const brandLink = screen.getByRole("link", { name: "QBit-Studio-Ai" });
    expect(brandLink).toHaveAttribute("href", "/");
  });
});
