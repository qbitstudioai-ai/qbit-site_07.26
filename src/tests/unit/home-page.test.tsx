import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getDepartments } from "@/content/departments";

describe("HomePage", () => {
  it("renders exactly one h1 with the real headline", () => {
    render(<HomePage />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(getHomepageCopy().headline);
  });

  it("renders all 5 department hotspots with accessible names", () => {
    render(<HomePage />);
    const departments = getDepartments();
    for (const department of departments) {
      expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
    }
  });
});
