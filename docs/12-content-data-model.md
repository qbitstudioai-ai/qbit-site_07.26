# Content and Data Model

## Department

```ts
type Department = {
  id: "sales" | "support" | "executive" | "hr" | "logistics";
  name: string;
  overviewLabel: string;
  overviewProblem: string;
  headline: string;
  problem: string;
  symptoms: string[];
  beforeSteps: ProcessStep[];
  automationSteps: ProcessStep[];
  outcomes: string[];
  ctaLabel: string;
  solutionPath: string;
  visual: DepartmentVisual;
};
```

## ProcessStep

```ts
type ProcessStep = {
  id: string;
  label: string;
  description: string;
  actor?: string;
  status?: "normal" | "warning" | "critical" | "success";
  visualAnchor?: string;
};
```

## Visual

Относительные координаты hotspot, overview/detail/fallback assets и optional camera target.

## Diagnostic

Роль, сфера, отделы, проблемы, summary, priority areas, suggested scenarios и next step.

## Calculator

Количество операций, длительность, частота, стоимость часа, доля автоматизации, период, формула и disclaimer.

## Правила

- максимум три симптома в основном UI;
- технический слой отделён;
- одинаковые термины называются одинаково;
- CTA содержит действие;
- outcome связан с проблемой.
