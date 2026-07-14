# Accessibility

## Семантика

Один h1, логичная иерархия, отделы как buttons/links, доступное имя nav, active state программно, labels и связанные ошибки.

## Keyboard

- Tab по отделам;
- Enter/Space открывает;
- Escape закрывает;
- после закрытия focus возвращается;
- скрытые элементы не фокусируются.

## Focus

Видимый contrast focus-ring, отсутствие потери focus при transition, правильный order.

## Motion

`prefers-reduced-motion`, нет вспышек, критическая информация не зависит от движения, последовательность имеет текстовый эквивалент.

## Canvas/WebGL

Параллельный HTML-слой с названием, проблемой, кнопкой, статусом, результатом и CTA.

## Contrast

Минимум WCAG AA. Статусы различаются цветом, текстом и формой.

## Screen reader

Объявлять открытие/смену отдела, результат расчёта, ошибки и успешную отправку. Не объявлять декор.

## Тесты

Keyboard-only, VoiceOver/NVDA, zoom 200%, reduced motion, high contrast, axe и ручной focus order.
