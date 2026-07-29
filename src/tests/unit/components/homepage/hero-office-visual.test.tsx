import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroOfficeVisual } from "@/components/homepage/HeroOfficeVisual";

describe("HeroOfficeVisual", () => {
  it("renders only the integrated scene with a meaningful image alternative", () => {
    render(<HeroOfficeVisual />);

    expect(screen.getByRole("img")).toHaveAccessibleName(/переход.+к организованным/i);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
