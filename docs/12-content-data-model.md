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
  customerBenefits: string[]; // Amendment 21: выгоды для заказчика — единые на отдел, см. ниже
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

**Amendment 21 (2026-07-21):** поля `beforeSteps`/`automationSteps` и тип `ProcessStep` (Step 19/20,
диаграмма «до/после» `BeforeAfterSequence`) **удалены**. Вместо них — `customerBenefits: string[]`:
единый на отдел список выгод, которые заказчик получает от автоматизации ИМЕННО этого отдела (окно
`CustomerBenefits` «Ваша выгода», `docs/06`/`docs/07`). В отличие от `painPoints[].gain`
(привязан к конкретной боли 1:1), не зависит от выбранной боли. Схема (`src/content/schema.ts`):
массив непустых строк со значением по умолчанию `[]` (отдел без поля валиден и получает пустой
список). Сейчас пуст у всех пяти отделов НАМЕРЕННО — текст наполняется на этапе копирайта.

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
