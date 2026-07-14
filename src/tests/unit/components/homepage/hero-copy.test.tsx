import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroCopy } from "@/components/homepage/HeroCopy";
import { getHomepageCopy } from "@/content/homepage-copy";

describe("HeroCopy", () => {
  const copy = getHomepageCopy();

  it("renders exactly one h1 with the headline", () => {
    render(<HeroCopy />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(copy.headline);
  });

  it("renders the subheadline and all value points", () => {
    render(<HeroCopy />);
    expect(screen.getByText(copy.subheadline)).toBeInTheDocument();
    for (const point of copy.valuePoints) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
  });

  it("renders primaryCta as a button and secondaryCta as a link to #office-map", () => {
    render(<HeroCopy />);
    expect(screen.getByRole("button", { name: copy.primaryCta })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: copy.secondaryCta });
    expect(link).toHaveAttribute("href", "#office-map");
  });
});
