import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getDepartments } from "@/content/departments";

describe("HomePage", () => {
  it("renders exactly one h1 with the real headline", async () => {
    render(await HomePage({ searchParams: Promise.resolve({}) }));
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(getHomepageCopy().headline);
  });

  it("marks the office section as not yet revealed when no ?department= is given at boot", async () => {
    const { container } = render(await HomePage({ searchParams: Promise.resolve({}) }));
    // Actual CSS hiding (:global(.js) .hiddenUntilRevealed) is not applied by jsdom/Vitest —
    // see OfficeExperience unit test and e2e "office-overview" spec for the visual/a11y-tree
    // verification. Here we only check the structural fact the reveal logic depends on.
    const officeSection = container.querySelector("[data-revealed]");
    expect(officeSection).toHaveAttribute("data-revealed", "false");
  });

  it("flips data-revealed to true after clicking the primary CTA, with all 5 hotspots present", async () => {
    const { container } = render(await HomePage({ searchParams: Promise.resolve({}) }));
    const copy = getHomepageCopy();
    fireEvent.click(screen.getByRole("button", { name: copy.primaryCta }));

    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "true");
    const departments = getDepartments();
    for (const department of departments) {
      expect(screen.getByRole("button", { name: department.overviewLabel })).toBeInTheDocument();
    }
  });

  it("boots already revealed (data-revealed=true) when a ?department= param is present", async () => {
    const { container } = render(
      await HomePage({ searchParams: Promise.resolve({ department: "sales" }) }),
    );
    expect(container.querySelector("[data-revealed]")).toHaveAttribute("data-revealed", "true");
  });
});
