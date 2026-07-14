# Acceptance Criteria

## Hero

Смысл и CTA видны сразу, офис не перекрывает текст, нет обязательной заставки, fallback сохраняет путь.

## Overview

Пять различимых отделов, hover и focus дают одинаковый смысл, touch не зависит от hover, active не только цветом.

## Department

Правильный контент, URL, focus, 10/90, Escape, no reload, accessible explanation.

## Switching

Без overview, visual/content синхронны, active thumbnail ясна, keyboard работает, assets не грузятся повторно без необходимости.

## Mobile

Нет literal 10/90, есть touch, back, CTA, нет обрезки и hover dependency.

## Reduced motion

Нет параллакса и перелётов, функции и причинность сохранены.

## Performance

Hero до detail assets, lazy load, нет console errors, loop останавливается, fallback работает.

## Accessibility

Keyboard path, visible focus, correct return, screen reader states, contrast, zoom 200%, axe без серьёзных нарушений.

## Quality gate

Formatter, lint, typecheck, unit, build, e2e, visual regression, desktop/mobile browser review.
