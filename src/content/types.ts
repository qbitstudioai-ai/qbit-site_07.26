export type DepartmentId = "sales" | "support" | "executive" | "hr" | "logistics";

export interface PainPoint {
  pain: string;
  gain: string;
}

/** Статус шага процесса — драйвер визуального акцента в `BeforeAfterSequence` (Step 20). */
export type ProcessStepStatus = "normal" | "warning" | "critical" | "success";

/**
 * Шаг процесса «до»/«после» (docs/12 «ProcessStep»). Используется для последовательности «до/после»
 * (`BeforeAfterSequence`, Step 20): `beforeSteps` — как работа идёт сейчас (ручной процесс с
 * потерями), `automationSteps` — как та же работа идёт после автоматизации.
 */
export interface ProcessStep {
  id: string;
  label: string;
  description: string;
  /** Кто выполняет шаг (менеджер / система / руководитель) — показывает сдвиг ручного труда. */
  actor?: string;
  status?: ProcessStepStatus;
  /** Необязательная привязка к точке сцены (docs/12) — не используется на этом шаге. */
  visualAnchor?: string;
}

export interface Department {
  id: DepartmentId;
  name: string;
  overviewLabel: string;
  overviewProblem: string;
  headline: string;
  problem: string;
  painPoints: PainPoint[];
  /**
   * Шаги процесса «до/после» (Step 19). ОПЦИОНАЛЬНЫ: заполнены только для «Продаж» (пилот Этапа 3),
   * остальные отделы получают их на Этапах 4–7. Либо оба поля присутствуют, либо ни одного —
   * половинчатая «до/после» без одной из сторон невалидна (см. схему).
   */
  beforeSteps?: ProcessStep[];
  automationSteps?: ProcessStep[];
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
