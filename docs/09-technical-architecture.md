# Technical Architecture

## Стек

- Next.js App Router;
- TypeScript;
- React;
- GSAP;
- Zustand;
- CSS Modules или Tailwind;
- SVG/DOM;
- React Three Fiber только при необходимости;
- Playwright;
- Vitest/Jest;
- ESLint;
- Prettier.

## Server layer

HTML, metadata, тексты, SEO-страницы, данные, fallback и формы без сложной клиентской логики.

## Client layer

State machine, hover/focus/touch, анимация, loading detail assets, 10/90, calculator и modal states.

## Не помещать в Canvas

Заголовки, кнопки, меню, формы, CTA, подписи, калькулятор и критические статусы.

## Возможная структура

```text
src/
├── app/
├── components/
│   ├── homepage/
│   ├── office/
│   ├── departments/
│   ├── diagnostic/
│   ├── forms/
│   └── ui/
├── features/
│   ├── office-machine/
│   ├── savings-calculator/
│   └── lead-capture/
├── content/
├── lib/
├── hooks/
├── styles/
└── tests/
```

## Компоненты

```text
HomepageShell
├── Header
├── HeroCopy
├── OfficeExperience
│   ├── OfficeVisualLayer
│   ├── OfficeSemanticMap
│   ├── DepartmentHotspot[]
│   ├── DepartmentPreview
│   └── DepartmentNavigationRail
├── DepartmentExperience
│   ├── DepartmentScene
│   ├── DepartmentCopy
│   ├── CustomerBenefits
│   ├── OutcomePanel
│   └── DepartmentCTA
├── DiagnosticFlow
└── FallbackExperience
```

## State

Хранить viewMode, activeDepartmentId, previewDepartmentId, transitionStatus, motionMode, inputMode, loaded assets и diagnostic state. Контент в state не хранить.

## Routing

Главная:

```text
/
/?department=sales
/?department=support
/?department=executive
/?department=hr
/?department=logistics
```

Внутренние страницы:

```text
/solutions
/solutions/sales
/solutions/support
/solutions/management
/solutions/hr
/solutions/logistics
/audit
/cases
/blog
/contacts
/login
```

`/contacts` и `/login` реализованы как `noindex`-заглушки в общем route layout с единым Header.
Остальные перечисленные внутренние маршруты остаются целевой архитектурой и не должны имитироваться
фиктивным контентом до отдельного этапа.

## Assets

Responsive images, modern formats, preview/detail/fallback, lazy loading, preload только overview.

## Animation

Единый orchestration layer, lifecycle cleanup, lazy timelines, transition controller отделён от content, reduced-motion branch сразу.

## Открытые решения

Visual technique, WebGL, accent colour, CRM, analytics, CMS, hosting и localization.
