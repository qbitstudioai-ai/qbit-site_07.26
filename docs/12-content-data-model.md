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

**Правка 2026-07-16 (пользователь сверил визуал department-active с планом — см. `docs/03-office-
map.md` "Режим 10/90", правка той же даты):** первое и последнее правило выше пересмотрены. Вместо
"максимум три симптома" + отдельный несвязанный список `outcomes` — новая структура: **ровно пять
пар** "боль → выгода" на отдел (левая колонка 20% — боль, правая колонка 80% — соответствующая ей
выгода при выборе). Раньше "outcome связан с проблемой" было мягкой рекомендацией по смыслу текста;
теперь это структурное требование — каждая выгода жёстко привязана к своей боли (1:1), а не общий
список результатов отдела. Требует правки типа `Department` (см. "## Department" выше — `symptoms`/
`outcomes` как независимые `string[]` заменяются на единый список пар, например
`painPoints: { pain: string; gain: string }[]`, длина ровно 5), схемы валидации и содержимого
`data/departments.json` для всех 5 отделов. Реализация — `WORKPLAN.md` Step 7.3, не начата на момент
этой правки.
