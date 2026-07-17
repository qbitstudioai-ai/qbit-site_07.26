import { describe, expect, it } from "vitest";
import {
  departmentSchema,
  departmentsSchema,
  homepageCopySchema,
  officeZonesDataSchema,
} from "@/content/schema";

const validDepartment = {
  id: "sales",
  name: "Продажи",
  overviewLabel: "Продажи",
  overviewProblem: "problem",
  headline: "headline",
  problem: "problem",
  painPoints: [
    { pain: "a1", gain: "b1" },
    { pain: "a2", gain: "b2" },
    { pain: "a3", gain: "b3" },
    { pain: "a4", gain: "b4" },
    { pain: "a5", gain: "b5" },
  ],
  ctaLabel: "cta",
  solutionPath: "/solutions/sales",
  reference: "references/sales/02-sales-department.png",
};

function makeDepartment(id: string, overrides: Record<string, unknown> = {}) {
  const solutionPathById: Record<string, string> = {
    sales: "/solutions/sales",
    support: "/solutions/support",
    executive: "/solutions/management",
    hr: "/solutions/hr",
    logistics: "/solutions/logistics",
  };
  return {
    ...validDepartment,
    id,
    solutionPath: solutionPathById[id] ?? "/solutions/unknown",
    ...overrides,
  };
}

describe("departmentSchema — invalid fixtures", () => {
  it("rejects an object missing a required field", () => {
    const withoutName: Record<string, unknown> = { ...validDepartment };
    delete withoutName.name;
    expect(departmentSchema.safeParse(withoutName).success).toBe(false);
  });

  it("rejects an id outside the canonical enum", () => {
    expect(departmentSchema.safeParse(makeDepartment("marketing")).success).toBe(false);
  });

  it("rejects a non-array value for painPoints", () => {
    expect(
      departmentSchema.safeParse(makeDepartment("sales", { painPoints: "not-an-array" })).success,
    ).toBe(false);
  });

  it("rejects painPoints with fewer than 5 pairs", () => {
    expect(
      departmentSchema.safeParse(
        makeDepartment("sales", { painPoints: validDepartment.painPoints.slice(0, 4) }),
      ).success,
    ).toBe(false);
  });

  it("rejects painPoints with more than 5 pairs", () => {
    expect(
      departmentSchema.safeParse(
        makeDepartment("sales", {
          painPoints: [...validDepartment.painPoints, { pain: "a6", gain: "b6" }],
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a pain point missing the gain field", () => {
    const brokenPainPoints = [
      { pain: "a1" },
      ...validDepartment.painPoints.slice(1),
    ] as unknown as typeof validDepartment.painPoints;
    expect(
      departmentSchema.safeParse(makeDepartment("sales", { painPoints: brokenPainPoints })).success,
    ).toBe(false);
  });

  it("rejects a solutionPath that does not match the department id", () => {
    expect(
      departmentSchema.safeParse(
        makeDepartment("executive", { solutionPath: "/solutions/executive" }),
      ).success,
    ).toBe(false);
  });
});

describe("departmentsSchema — invalid fixtures", () => {
  const allFive = ["sales", "support", "executive", "hr", "logistics"].map((id) =>
    makeDepartment(id),
  );

  it("rejects a duplicate id", () => {
    const withDuplicate = [...allFive.slice(0, 4), makeDepartment("sales")];
    expect(departmentsSchema.safeParse(withDuplicate).success).toBe(false);
  });

  it("rejects an array of 4 departments", () => {
    expect(departmentsSchema.safeParse(allFive.slice(0, 4)).success).toBe(false);
  });

  it("rejects an array of 6 departments", () => {
    const sixth = makeDepartment("support", { id: "support" });
    expect(departmentsSchema.safeParse([...allFive, sixth]).success).toBe(false);
  });

  it("accepts exactly the canonical 5 departments", () => {
    expect(departmentsSchema.safeParse(allFive).success).toBe(true);
  });
});

describe("homepageCopySchema — invalid fixtures", () => {
  const validCopy = {
    headline: "h",
    subheadline: "s",
    primaryCta: "p",
    secondaryCta: "s2",
    interactionHint: "hint",
    valuePoints: ["a"],
    tagline: "tagline",
    returnToOfficeLabel: "return",
  };

  it("rejects an empty valuePoints array", () => {
    expect(homepageCopySchema.safeParse({ ...validCopy, valuePoints: [] }).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const withoutHeadline: Record<string, unknown> = { ...validCopy };
    delete withoutHeadline.headline;
    expect(homepageCopySchema.safeParse(withoutHeadline).success).toBe(false);
  });
});

describe("officeZonesDataSchema — invalid fixtures", () => {
  const validZone = { departmentId: "sales", x: 0, y: 0, width: 10, height: 10 };

  function makeZonesData(zones: unknown[]) {
    return { coordinateSystem: "relative-percent", note: "note", zones };
  }

  it("rejects duplicate departmentId across zones", () => {
    const data = makeZonesData([
      validZone,
      { ...validZone, departmentId: "support" },
      { ...validZone, departmentId: "executive" },
      { ...validZone, departmentId: "hr" },
      { ...validZone, departmentId: "sales" },
    ]);
    expect(officeZonesDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a zone count other than 5", () => {
    expect(officeZonesDataSchema.safeParse(makeZonesData([validZone])).success).toBe(false);
  });

  it("accepts a missing (optional) note", () => {
    const data = {
      coordinateSystem: "relative-percent",
      zones: [
        { departmentId: "sales", x: 0, y: 0, width: 1, height: 1 },
        { departmentId: "support", x: 0, y: 0, width: 1, height: 1 },
        { departmentId: "executive", x: 0, y: 0, width: 1, height: 1 },
        { departmentId: "hr", x: 0, y: 0, width: 1, height: 1 },
        { departmentId: "logistics", x: 0, y: 0, width: 1, height: 1 },
      ],
    };
    expect(officeZonesDataSchema.safeParse(data).success).toBe(true);
  });
});
