import { describe, expect, it } from "vitest";
import { getHomepageCopy } from "@/content/homepage-copy";

describe("homepage-copy adapter", () => {
  it("returns the expected shape from real data", () => {
    const copy = getHomepageCopy();
    expect(copy.headline).toBeTypeOf("string");
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(copy.subheadline.length).toBeGreaterThan(0);
    expect(copy.primaryCta.length).toBeGreaterThan(0);
    expect(copy.secondaryCta.length).toBeGreaterThan(0);
    expect(copy.interactionHint.length).toBeGreaterThan(0);
    expect(Array.isArray(copy.valuePoints)).toBe(true);
    expect(copy.valuePoints.length).toBeGreaterThan(0);
    for (const point of copy.valuePoints) {
      expect(point.length).toBeGreaterThan(0);
    }
  });
});
