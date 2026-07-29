import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroInfoPanel } from "@/components/homepage/HeroInfoPanel";
import { getHomepageCopy } from "@/content/homepage-copy";

describe("HeroInfoPanel", () => {
  const panel = getHomepageCopy().heroInfoPanel;
  const contactHref = getHomepageCopy().contactHref;

  it("renders one panel heading and three scenario headings below it", () => {
    render(<HeroInfoPanel copy={panel} contactHref={contactHref} />);
    expect(screen.getByRole("heading", { level: 2, name: panel.title })).toBeInTheDocument();
    for (const scenario of panel.scenarios) {
      expect(screen.getByRole("heading", { level: 3, name: scenario.title })).toBeInTheDocument();
    }
  });

  it("renders every metric, calculation label and optional qualifier", () => {
    render(<HeroInfoPanel copy={panel} contactHref={contactHref} />);
    for (const scenario of panel.scenarios) {
      expect(screen.getByText(scenario.metric)).toBeInTheDocument();
      expect(screen.getByText(scenario.effectLabel)).toBeInTheDocument();
      if (scenario.qualifier) {
        expect(screen.getByText(scenario.qualifier)).toBeInTheDocument();
      }
    }
  });

  it("renders the postscript as a labelled external Telegram link", () => {
    render(<HeroInfoPanel copy={panel} contactHref={contactHref} />);
    const postscript = screen.getByRole("link", { name: panel.postscript.ariaLabel });
    expect(postscript).toHaveAttribute("href", contactHref);
    expect(postscript).toHaveAttribute("target", "_blank");
    expect(postscript).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(postscript).toHaveTextContent(panel.postscript.label);
    expect(postscript).toHaveTextContent(panel.postscript.text);
    expect(postscript).toHaveTextContent("→");
    expect(postscript).not.toHaveTextContent("↗");
  });
});
