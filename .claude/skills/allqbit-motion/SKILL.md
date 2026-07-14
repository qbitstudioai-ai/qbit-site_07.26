---
name: allqbit-motion
description: Проектирует и проверяет motion-систему Allqbit, переходы overview/department, до/после и reduced motion.
---

# Allqbit Motion

Прочитать state machine, motion, performance и accessibility docs.

Правила:

- движение объясняет состояние;
- hero не задерживается;
- camera controlled;
- switch не возвращает overview;
- timelines очищаются;
- pointermove не обновляет React state;
- reduced motion параллелен;
- hidden tab останавливает необязательное.

Выход: trigger, from, to, duration, easing token, interruption и reduced alternative.
