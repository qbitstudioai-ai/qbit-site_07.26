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

  it("renders primaryCta as a button and secondaryCta as a link to #office-map", () => {
    render(<HeroCopy copy={copy} onActivate={() => {}} isHiddenAfterReveal={false} />);
    expect(screen.getByRole("button", { name: copy.primaryCta })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: copy.secondaryCta });
    expect(link).toHaveAttribute("href", "#office-map");
  });

  it("calls onActivate when primaryCta is clicked", () => {
    const onActivate = vi.fn();
    render(<HeroCopy copy={copy} onActivate={onActivate} isHiddenAfterReveal={false} />);

    fireEvent.click(screen.getByRole("button", { name: copy.primaryCta }));
    expect(onActivate).toHaveBeenCalledTimes(1);
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
