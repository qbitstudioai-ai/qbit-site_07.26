import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/homepage/Header";

describe("Header", () => {
  const tagline = "Помогаем экономить ДЕНЬГИ и ВРЕМЯ";

  it("renders the tagline", () => {
    render(<Header tagline={tagline} />);
    expect(screen.getByText(tagline)).toBeInTheDocument();
  });

  it("renders the brand", () => {
    render(<Header tagline={tagline} />);
    expect(screen.getByText("QBit-Studio-Ai")).toBeInTheDocument();
  });
});
