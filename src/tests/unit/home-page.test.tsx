import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the Allqbit placeholder heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Allqbit" })).toBeInTheDocument();
  });
});
