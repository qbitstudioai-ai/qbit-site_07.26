export type DepartmentId = "sales" | "support" | "executive" | "hr" | "logistics";

export interface PainPoint {
  pain: string;
  gain: string;
  /** Дополнительная строка сценария из исходного контента; присутствует не у всех сценариев. */
  howItWorks?: string;
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
  hoverDescription: string;
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
  /**
   * Результат для бизнеса: основной результат первым, затем ровно три дополнительных результата.
   */
  customerBenefits: string[];
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

export interface HeroLink {
  label: string;
  href: string;
}

export interface HeroProjectScenario {
  metricPrefix?: string;
  metric: string;
  unit: string;
  qualifier?: string;
  title: string;
  description: string;
  detail?: string;
  effectLabel: string;
}

export interface HeroInfoPanel {
  title: string;
  subtitle: string;
  scenarios: HeroProjectScenario[];
  postscript: {
    label: string;
    text: string;
    ariaLabel: string;
  };
}

export interface OfficeOverviewStory {
  title: string;
  paragraphs: string[];
}

export interface OfficeOverviewCopy {
  instruction: string;
  ctaAccessibleLabel: string;
  leftStory: OfficeOverviewStory;
  rightStory: OfficeOverviewStory;
}

export interface HomepageCopy {
  eyebrow: string;
  headline: string;
  subheadline: string;
  headerPhone: string;
  headerPhoneHref: string;
  headerPhoneAccessibleLabel: string;
  primaryCta: string;
  /** Единый адрес контакта (Telegram) для всех CTA сайта: hero и CTA внутри отделов. */
  contactHref: string;
  secondaryCta: string;
  ctaNote: string;
  interactionHint: string;
  officeOverview: OfficeOverviewCopy;
  valuePoints: string[];
  heroLinks: HeroLink[];
  heroInfoPanel: HeroInfoPanel;
  tagline?: string;
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
