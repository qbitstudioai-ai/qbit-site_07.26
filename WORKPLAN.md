# WORKPLAN

## Status

`PROPOSED`

Этот файл является шаблоном стартового плана. Перед разработкой planner должен заменить его конкретным планом задачи.

## Task

Создать первый low-fidelity прототип интерактивной главной страницы Allqbit.

## Approval

- User approved: `NO`
- Approved at:
- Approved scope:

## Step 1 — Repository and quality foundation

- Status: `PROPOSED`
- Objective: Инициализировать минимальный Next.js/TypeScript проект с quality scripts.
- In scope: package manager, lint, format, typecheck, unit test, Playwright, базовая структура.
- Out of scope: интерактивный офис и финальный дизайн.
- Acceptance criteria:
  1. Проект запускается.
  2. Проверки имеют явные scripts.
  3. Build проходит.
- Skeptic verdict:

## Step 2 — Typed content model

- Status: `PROPOSED`
- Objective: Создать типизированный источник данных для пяти отделов.
- In scope: types/schema, data adapter, validation tests.
- Out of scope: UI.
- Acceptance criteria:
  1. Все пять отделов валидируются.
  2. Контент не дублируется в компонентах.
- Skeptic verdict:

## Step 3 — Semantic office overview

- Status: `PROPOSED`
- Objective: Создать доступный overview с пятью отделами.
- In scope: HTML/SVG map, buttons, hero, fallback.
- Out of scope: detailed scenes.
- Acceptance criteria:
  1. Отделы доступны клавиатурой.
  2. Hero виден без сложного visual layer.
- Skeptic verdict:

## Step 4 — Homepage state machine

- Status: `PROPOSED`
- Objective: Реализовать overview, preview, opening, active, switching и closing.
- Acceptance criteria:
  1. Состояния явные.
  2. В один момент активен один отдел.
  3. URL синхронизирован.
- Skeptic verdict:

## Step 5 — Desktop 10/90 shell

- Status: `PROPOSED`
- Objective: Реализовать выбор, панель отделов и основное поле.
- Acceptance criteria:
  1. Переключение не возвращает overview.
  2. Escape закрывает отдел.
  3. Focus возвращается.
- Skeptic verdict:

## Step 6 — Mobile touch flow

- Status: `PROPOSED`
- Objective: Создать самостоятельный touch-интерфейс.
- Acceptance criteria:
  1. Нет зависимости от hover.
  2. CTA доступна.
  3. Есть явная навигация назад.
- Skeptic verdict:

## Step 7 — Reduced motion and fallback

- Status: `PROPOSED`
- Objective: Реализовать reduced-motion и visual fallback.
- Acceptance criteria:
  1. Функции сохраняются.
  2. Visual layer error не блокирует контент.
- Skeptic verdict:

## Step 8 — Browser acceptance tests

- Status: `PROPOSED`
- Objective: Зафиксировать основные потоки Playwright.
- Acceptance criteria:
  1. Desktop, keyboard, mobile, URL и reduced-motion flows проходят.
  2. Console не содержит критических ошибок.
- Skeptic verdict:

## Mandatory note

Этот план не считается утверждённым. Planner и skeptic должны проверить его, после чего основная сессия должна представить финальную версию пользователю.
