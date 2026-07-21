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

// Step 19: шаг процесса «до»/«после» (docs/12 «ProcessStep»). status ограничен перечнем docs/12 —
// произвольная строка (напр. "danger" вместо "critical") должна падать на валидации контента.
const processStepSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  description: nonEmptyString,
  actor: nonEmptyString.optional(),
  status: z.enum(["normal", "warning", "critical", "success"]).optional(),
  visualAnchor: nonEmptyString.optional(),
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
    // Step 19: ОПЦИОНАЛЬНЫ (заполнены только для «Продаж», пилот Этапа 3 — остальные отделы на
    // Этапах 4–7). min(1) при наличии: пустой массив «до/после» бессмыслен. Парность «оба или ни
    // одного» проверяется в superRefine ниже — половинчатая «до/после» невалидна.
    beforeSteps: z.array(processStepSchema).min(1).optional(),
    automationSteps: z.array(processStepSchema).min(1).optional(),
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
    // «До/после» — это трансформация, у неё две стороны. Наличие одной без другой означало бы
    // сломанную последовательность, которую BeforeAfterSequence (Step 20) не сможет отрисовать.
    const hasBefore = department.beforeSteps !== undefined;
    const hasAfter = department.automationSteps !== undefined;
    if (hasBefore !== hasAfter) {
      ctx.addIssue({
        code: "custom",
        path: [hasBefore ? "automationSteps" : "beforeSteps"],
        message: `department "${department.id}": beforeSteps и automationSteps задаются вместе (либо оба, либо ни одного)`,
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

export const taskSectionCopySchema = z.object({
  railLabel: nonEmptyString,
  overviewCtaLabel: nonEmptyString,
  headline: nonEmptyString,
  intro: nonEmptyString,
  fieldLabel: nonEmptyString,
  placeholder: nonEmptyString,
  submitLabel: nonEmptyString,
  sendingLabel: nonEmptyString,
  successMessage: nonEmptyString,
  errorMessage: nonEmptyString,
  tooShortMessage: nonEmptyString,
});

export const homepageCopySchema = z.object({
  headline: nonEmptyString,
  subheadline: nonEmptyString,
  primaryCta: nonEmptyString,
  // ЕДИНЫЙ адрес контакта (Telegram) для всех CTA сайта: основной CTA в hero и CTA внутри каждого
  // отдела ("Разобрать работу поддержки" и т.д.). Одно поле, а не по адресу на кнопку — контакт у
  // компании один, и дублирование означало бы, что при смене его забудут в половине мест.
  // Имя нейтральное (не primaryCtaHref) именно потому, что потребителей несколько.
  // Хранится в данных, а не в компоненте, по правилу CLAUDE.md "Keep content separate from
  // components": смена контакта не должна требовать правки React. Валидируется как URL — опечатка
  // должна падать на валидации контента, а не превращаться в битую ссылку у посетителя.
  contactHref: z.string().url(),
  secondaryCta: nonEmptyString,
  interactionHint: nonEmptyString,
  valuePoints: nonEmptyStringArray,
  tagline: nonEmptyString,
  returnToOfficeLabel: nonEmptyString,
  taskSection: taskSectionCopySchema,
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
