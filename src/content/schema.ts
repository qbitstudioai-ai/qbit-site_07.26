import { z } from "zod";
import type { DepartmentId } from "./types";

export const DEPARTMENT_IDS = ["sales", "support", "executive", "hr", "logistics"] as const;

export const SOLUTION_PATH_BY_DEPARTMENT_ID: Record<DepartmentId, string> = {
  sales: "/solutions/sales",
  support: "/solutions/support",
  executive: "/solutions/management",
  hr: "/solutions/hr",
  logistics: "/solutions/logistics",
};

const departmentIdSchema = z.enum(DEPARTMENT_IDS);

const nonEmptyString = z.string().min(1);
const nonEmptyStringArray = z.array(nonEmptyString).min(1);

// Step 7.3: заменяет раздельные symptoms (max 3 в UI)/outcomes (5, несвязанные) — ровно 5 пар
// "боль → выгода" 1:1 (docs/12-content-data-model.md, правка 2026-07-16).
const painPointSchema = z.object({
  pain: nonEmptyString,
  gain: nonEmptyString,
});

export const departmentSchema = z
  .object({
    id: departmentIdSchema,
    name: nonEmptyString,
    overviewLabel: nonEmptyString,
    overviewProblem: nonEmptyString,
    headline: nonEmptyString,
    problem: nonEmptyString,
    painPoints: z.array(painPointSchema).length(5),
    ctaLabel: nonEmptyString,
    solutionPath: nonEmptyString,
    reference: nonEmptyString,
  })
  .superRefine((department, ctx) => {
    const expectedPath = SOLUTION_PATH_BY_DEPARTMENT_ID[department.id];
    if (department.solutionPath !== expectedPath) {
      ctx.addIssue({
        code: "custom",
        path: ["solutionPath"],
        message: `solutionPath for "${department.id}" must be "${expectedPath}", got "${department.solutionPath}"`,
      });
    }
  });

export const departmentsSchema = z
  .array(departmentSchema)
  .length(DEPARTMENT_IDS.length)
  .superRefine((departments, ctx) => {
    const ids = departments.map((department) => department.id);
    const uniqueIds = new Set<string>(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "department ids must be unique" });
    }
    const expected = new Set<string>(DEPARTMENT_IDS);
    const missing = [...expected].filter((id) => !uniqueIds.has(id));
    if (missing.length > 0) {
      ctx.addIssue({ code: "custom", message: `missing department ids: ${missing.join(", ")}` });
    }
  });

export const homepageCopySchema = z.object({
  headline: nonEmptyString,
  subheadline: nonEmptyString,
  primaryCta: nonEmptyString,
  secondaryCta: nonEmptyString,
  interactionHint: nonEmptyString,
  valuePoints: nonEmptyStringArray,
  tagline: nonEmptyString,
  returnToOfficeLabel: nonEmptyString,
});

export const officeZoneSchema = z.object({
  departmentId: departmentIdSchema,
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const officeZonesDataSchema = z
  .object({
    coordinateSystem: nonEmptyString,
    note: nonEmptyString.optional().nullable(),
    zones: z.array(officeZoneSchema).length(DEPARTMENT_IDS.length),
  })
  .superRefine((data, ctx) => {
    const ids = data.zones.map((zone) => zone.departmentId);
    const uniqueIds = new Set<string>(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["zones"],
        message: "zone departmentIds must be unique",
      });
    }
    const expected = new Set<string>(DEPARTMENT_IDS);
    const missing = [...expected].filter((id) => !uniqueIds.has(id));
    if (missing.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["zones"],
        message: `missing zone departmentIds: ${missing.join(", ")}`,
      });
    }
  });
