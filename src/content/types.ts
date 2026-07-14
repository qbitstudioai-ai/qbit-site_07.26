export type DepartmentId = "sales" | "support" | "executive" | "hr" | "logistics";

export interface Department {
  id: DepartmentId;
  name: string;
  overviewLabel: string;
  overviewProblem: string;
  headline: string;
  problem: string;
  symptoms: string[];
  outcomes: string[];
  ctaLabel: string;
  solutionPath: string;
  reference: string;
}

export interface HomepageCopy {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  interactionHint: string;
  valuePoints: string[];
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
