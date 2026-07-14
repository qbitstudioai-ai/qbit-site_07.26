# Performance Budget

## Критический путь

До первого осмысленного отображения нужны только HTML, hero, логотип, CTA, preview overview, кнопки отделов и критические стили.

## Предварительные бюджеты

- initial JS: цель ≤250 KB gzip до расширенной сцены;
- overview — responsive modern image;
- detail assets — только при намерении/выборе;
- не загружать все оригиналы сразу.

## WebGL

Только после HTML/SVG prototype. Ограничивать DPR, отключать дорогие эффекты, приостанавливать loop, освобождать ресурсы и иметь fallback.

## Pointer

- не обновлять React state на каждый pointermove;
- requestAnimationFrame;
- ограниченный диапазон;
- без layout reads/writes в цикле.

## Motion

Предпочитать transform и opacity. Избегать layout properties, больших blur, множества shadows и постоянных filters.

## Измерение

Lighthouse, Web Vitals, bundle analyzer, Playwright smoke и console monitoring.

## Приёмка

- hero доступен до detail scene;
- HTML controls работают при visual error;
- low-end fallback сохраняет CTA;
- нет постоянного тяжёлого loop в фоне;
- switch не перезагружает приложение.
