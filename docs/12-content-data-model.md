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
  painPoints: PainPoint[]; // ровно 5 пар "боль → выгода" (Step 7.3, см. "Правила" ниже)
  beforeSteps?: ProcessStep[]; // Step 19: опционально, заполнено для sales — см. примечание ниже
  automationSteps?: ProcessStep[]; // опционально; либо оба поля, либо ни одного
  ctaLabel: string;
  solutionPath: string;
  visual: DepartmentVisual;
};

type PainPoint = {
  pain: string;
  gain: string;
};
```

`visual` остаётся известным, зафиксированным расхождением между этим документом и реально
реализованными данными (`DECISIONS.md`, 2026-07-14 "типизировать docs/12 как есть").

**Step 19 (Этап 3):** `beforeSteps`/`automationSteps` ЧАСТИЧНО реализованы и переведены в
ОПЦИОНАЛЬНЫЕ. Прежде они были объявлены здесь обязательными, но в данных отсутствовали (то самое
расхождение). Теперь они заполнены для отдела `sales` (пилот Этапа 3, `data/departments.json`) и
типизированы как опциональные в `src/content/types.ts`/`schema.ts`: остальные четыре отдела получают
их на Этапах 4–7 и до тех пор остаются валидными без этих полей. Схема требует, чтобы поля задавались
ПАРОЙ (либо оба, либо ни одного) — половинчатая «до/после» без одной из сторон невалидна.

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

- ровно пять пар "боль → выгода" на отдел, каждая выгода жёстко привязана к своей боли (1:1), не
  общий список результатов отдела;
- технический слой отделён;
- одинаковые термины называются одинаково;
- CTA содержит действие.

**Правка 2026-07-16, реализовано Step 7.3 (2026-07-17):** первое и последнее правило исходной версии
этого списка ("максимум три симптома" + отдельный несвязанный список `outcomes`, "outcome связан с
проблемой" как мягкая рекомендация) заменены структурой выше — левая колонка 20% (Desktop/Tablet) —
боль, правая колонка 80% — соответствующая ей выгода при выборе; на Mobile (≤767px) — отдельный
столбик/аккордеон (`WORKPLAN.md` Step 7.3, OQ-P6). `Department.symptoms`/`outcomes` (независимые
`string[]`) заменены на `painPoints: { pain: string; gain: string }[]`, длина ровно 5 (см.
"## Department" выше, `src/content/schema.ts`); `data/departments.json` заполнен для всех 5 отделов.
