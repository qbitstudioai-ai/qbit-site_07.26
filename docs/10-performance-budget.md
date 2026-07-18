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

## Производные фотослоя (Step 10)

Пайплайн адаптивных производных: `npm run assets:images` (`scripts/generate-office-images.mjs`)
порождает из оригиналов `references/**` набор оптимизированных сцен в `src/assets/office-photos/`
(WebP + AVIF, ширины 768/1280/1536; OQ-A2-4). См. `references/README.md` про схему именования и
процесс.

Бюджет веса на производную (скрипт завершается с ошибкой при превышении):

| формат | 768px         | 1280px        | 1536px        |
| ------ | ------------- | ------------- | ------------- |
| WebP   | ≤ 140 000 Б   | ≤ 280 000 Б   | ≤ 350 000 Б   |
| AVIF   | ≤ 100 000 Б   | ≤ 200 000 Б   | ≤ 250 000 Б   |

Пороги заданы в байтах (значения `BUDGET_BYTES` в `scripts/generate-office-images.mjs`); скрипт в
отчёте печатает вес в KiB (÷1024), поэтому 350 000 Б отображается как ~341.8 КБ. Пороги выведены из
согласованного потолка ≤ ~350 КБ WebP / ≤ ~250 КБ AVIF на 1536px и масштабированы по площади для
меньших ширин. На текущих (черновых) сценах фактические веса — с запасом внутри бюджета
(1536: WebP ~215–240 КБ, AVIF ~118–132 КБ). Оригиналы `references/**/*.png` (3+ МБ) в клиент не входят
и браузером не запрашиваются.
