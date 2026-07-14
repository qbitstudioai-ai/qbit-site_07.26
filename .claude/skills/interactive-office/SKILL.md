---
name: interactive-office
description: Проектирует или реализует interactive office Allqbit: hotspots, state machine, 10/90, URL state и switching.
---

# Interactive Office

Прочитать office map, state machine, responsive, architecture и `data/office-zones.json`.

Требования:

- HTML/SVG hotspots;
- semantic buttons;
- relative coordinates;
- single source of truth;
- URL sync;
- visual/semantic separation;
- direct links/history/fallback.

Не помещать controls только в Canvas, не хранить pointer position в global React state, не создавать отдельную state logic для каждого отдела, не делать hover обязательным.

Проверить mouse, keyboard, touch, direct URL, back/forward, Escape, resize, orientation, reduced motion и scene error.
