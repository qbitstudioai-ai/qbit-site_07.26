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

  it("renders every metric, anonymized result label and optional qualifier", () => {
    render(<HeroInfoPanel copy={panel} contactHref={contactHref} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    for (const scenario of panel.scenarios) {
      expect(screen.getByText(scenario.metric)).toBeInTheDocument();
      if (scenario.qualifier) {
        expect(screen.getByText(scenario.qualifier)).toBeInTheDocument();
      }
    }
    expect(screen.getAllByText("ОБЕЗЛИЧЕННЫЙ РЕЗУЛЬТАТ ВНЕДРЕНИЯ")).toHaveLength(3);
    expect(screen.queryByText("ПРОЕКТНЫЕ СЦЕНАРИИ")).not.toBeInTheDocument();
    expect(screen.queryByText("расчётный бизнес-эффект")).not.toBeInTheDocument();
    expect(screen.queryByText("потенциальной выручки")).not.toBeInTheDocument();
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
