import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroCopy } from "@/components/homepage/HeroCopy";
import styles from "@/components/homepage/HeroCopy.module.css";
import { getHomepageCopy } from "@/content/homepage-copy";

describe("HeroCopy", () => {
  const copy = getHomepageCopy();

  it("renders exactly one h1 with the headline", () => {
    render(<HeroCopy copy={copy} onActivate={() => {}} isHiddenAfterReveal={false} />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(copy.headline);
  });

  it("renders the subheadline and all value points", () => {
    render(<HeroCopy copy={copy} onActivate={() => {}} isHiddenAfterReveal={false} />);
    expect(screen.getByText(copy.subheadline)).toBeInTheDocument();
    for (const point of copy.valuePoints) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
  });

  // Amendment 9: основной CTA ведёт наружу (Telegram-контакт), офис открывает только вторичный.
  it("renders primaryCta as an external link and secondaryCta as a link to #office-map", () => {
    render(<HeroCopy copy={copy} onActivate={() => {}} isHiddenAfterReveal={false} />);

    const primary = screen.getByRole("link", { name: copy.primaryCta });
    expect(primary).toHaveAttribute("href", copy.contactHref);
    expect(primary).toHaveAttribute("target", "_blank");
    // rel обязателен при target="_blank": без noopener открытая вкладка получает window.opener и
    // может подменить исходную страницу.
    expect(primary).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(primary).toHaveAttribute("rel", expect.stringContaining("noreferrer"));

    const secondary = screen.getByRole("link", { name: copy.secondaryCta });
    expect(secondary).toHaveAttribute("href", "#office-map");
  });

  it("does NOT open the office when primaryCta is clicked — it leaves the site instead", () => {
    const onActivate = vi.fn();
    render(<HeroCopy copy={copy} onActivate={onActivate} isHiddenAfterReveal={false} />);

    fireEvent.click(screen.getByRole("link", { name: copy.primaryCta }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("calls onActivate and prevents the native anchor jump when secondaryCta is clicked", () => {
    const onActivate = vi.fn();
    render(<HeroCopy copy={copy} onActivate={onActivate} isHiddenAfterReveal={false} />);

    const link = screen.getByRole("link", { name: copy.secondaryCta });
    const event = fireEvent.click(link);
    expect(onActivate).toHaveBeenCalledTimes(1);
    // fireEvent.click returns false if preventDefault() was called on a cancelable event.
    expect(event).toBe(false);
  });

  it("applies the hiddenAfterReveal class when isHiddenAfterReveal is true", () => {
    const { container } = render(
      <HeroCopy copy={copy} onActivate={() => {}} isHiddenAfterReveal={true} />,
    );
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section?.classList.contains(styles.hiddenAfterReveal)).toBe(true);
  });
});
