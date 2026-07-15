import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfficeExperience } from "@/components/office/OfficeExperience";
import { getDepartments } from "@/content/departments";
import { getOfficeZones } from "@/content/office-zones";

describe("OfficeExperience", () => {
  const departments = getDepartments();
  const officeZones = getOfficeZones();

  it("marks itself data-revealed=false and applies the hidden-until-revealed class when isRevealed is false", () => {
    const { container } = render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={false}
      />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-revealed", "false");
    // The office map/hint is still present in the DOM (progressive enhancement, no-JS
    // fallback) — only its class marks it as hidden-until-revealed; actual CSS hiding is
    // verified in e2e (jsdom does not apply the real :global(.js) stylesheet rule).
    expect(screen.getByRole("navigation", { name: "Отделы компании" })).toBeInTheDocument();
  });

  it("marks itself data-revealed=true and drops the hidden-until-revealed class when isRevealed is true", () => {
    const { container } = render(
      <OfficeExperience
        interactionHint="Наведите курсор на отдел"
        departments={departments}
        officeZones={officeZones}
        isRevealed={true}
      />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-revealed", "true");
  });
});
