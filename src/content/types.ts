export type DepartmentId = "sales" | "support" | "executive" | "hr" | "logistics";

export interface PainPoint {
  pain: string;
  gain: string;
}

export interface Department {
  id: DepartmentId;
  name: string;
  overviewLabel: string;
  overviewProblem: string;
  headline: string;
  problem: string;
  painPoints: PainPoint[];
  ctaLabel: string;
  solutionPath: string;
  reference: string;
}

/** Раздел «Ваша задача» — шестой раздел офиса (Step 12.7): форма свободного описания задачи. */
export interface TaskSectionCopy {
  railLabel: string;
  overviewCtaLabel: string;
  headline: string;
  intro: string;
  fieldLabel: string;
  placeholder: string;
  submitLabel: string;
  sendingLabel: string;
  successMessage: string;
  errorMessage: string;
  tooShortMessage: string;
}

export interface HomepageCopy {
  headline: string;
  subheadline: string;
  primaryCta: string;
  /** Единый адрес контакта (Telegram) для всех CTA сайта: hero и CTA внутри отделов. */
  contactHref: string;
  secondaryCta: string;
  interactionHint: string;
  valuePoints: string[];
  tagline: string;
  returnToOfficeLabel: string;
  taskSection: TaskSectionCopy;
}

export interface OfficeZone {
  departmentId: DepartmentId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OfficeZonesData {
  coordinateSystem: string;
  note?: string | null;
  zones: OfficeZone[];
}
