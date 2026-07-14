# Homepage State Machine

## Основная схема

```text
boot
  ↓
loading-essential
  ↓
hero
  ↓ (ACTIVATE_CTA)
overview
  ↔ department-preview
  ↓
department-opening
  ↓
department-active
  ↔ department-switching
  ↓
department-active
  ↓
department-closing
  ↓
overview
```

Дополнительные состояния:

```text
diagnostic-open
diagnostic-step
diagnostic-result
contact-open
error-fallback
reduced-motion
```

## hero

Начальное состояние страницы. Видны фон офиса (без выделенных зон отделов), заголовок,
подзаголовок, короткие обещания, основная и вторичная CTA. Пять отделов и подсказка ("Наведите
курсор на отдел") ещё не показаны — им нечего подсказывать, пока зоны не раскрыты. Прямой URL с
`?department=<id>` пропускает `hero` и открывает сразу `overview` (см. `ROUTE_CHANGE`), чтобы
шаринг ссылки на конкретный отдел не требовал лишнего клика.

Выход: `ACTIVATE_CTA` (клик по основной ИЛИ вторичной CTA) — переход в `overview`. Обе CTA ведут к
одному и тому же раскрытию офиса на этом этапе продукта: у основной CTA нет отдельного
diagnostic-назначения, пока не реализован Step 8; когда диагностика появится, основная CTA
получит собственный путь (`OPEN_DIAGNOSTIC`), а вторичная останется чистым раскрытием карты.

Без JavaScript (progressive enhancement): раскрытие недоступно как отдельное действие — `hero` и
`overview` рендерятся одновременно единым статичным HTML (все пять отделов видны сразу), чтобы
контент и клавиатурная доступность не зависели от исполнения скриптов.

## overview

Видны весь офис, hero, CTA, пять отделов и подсказка. Доступны hover, focus, touch, прямой URL и
диагностика.

## department-preview

Запускается hover/focus. Зона подсвечивается, остальные приглушаются, появляется короткая проблема. Выход: pointer leave, blur, Escape или выбор отдела.

## department-opening

Фиксирует отдел, показывает левую панель, лениво загружает detail assets и переносит focus в заголовок открытого отдела.

## department-active

Доступны сцена, проблема, до/после, outcome, CTA, смена отдела, возврат и Escape. URL отражает активный отдел.

## department-switching

Оболочка 10/90 сохраняется. Меняются контент, сцена, active thumbnail и URL. Не происходит возврата в overview и полной перезагрузки.

## department-closing

Возвращает overview, очищает временные эффекты и возвращает focus на исходную кнопку.

## error-fallback

При ошибке визуального слоя показывается статичный overview с пятью HTML-кнопками. Коммерческий путь остаётся рабочим.

## События

```text
APP_READY
ACTIVATE_CTA
HOVER_DEPARTMENT
FOCUS_DEPARTMENT
LEAVE_DEPARTMENT
SELECT_DEPARTMENT
OPEN_COMPLETE
SWITCH_DEPARTMENT
SWITCH_COMPLETE
CLOSE_DEPARTMENT
CLOSE_COMPLETE
OPEN_DIAGNOSTIC
ESCAPE
ROUTE_CHANGE
MOTION_PREFERENCE_CHANGE
VISIBILITY_CHANGE
SCENE_ERROR
```

## Инварианты

- активен максимум один отдел;
- выбранный отдел синхронизирован с URL;
- pointer и keyboard приводят к одинаковым смысловым состояниям;
- CTA доступна без исследования;
- reduced motion сохраняет функции;
- ошибка сцены не блокирует контент.
