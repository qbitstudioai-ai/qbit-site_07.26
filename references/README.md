# Visual References

## Общий вид
`office-overview/01-company-overview.png` — мастер-референс общей сцены: верхний ракурс, open space, стеклянные помещения, тёплый современный офис.

## Продажи
`sales/02-sales-department.png` — рабочие острова, экраны, звонки, переговорная. Метафора: движение лида к сделке.

## Поддержка
`support/03-support-department.png` — ряды рабочих мест, гарнитуры, очередь, эскалация. Метафора: движение вопроса к решению.

## Дирекция
`executive/04-executive-department.png` — кабинет, стратегическая переговорная, большой экран, спокойный свет. Метафора: движение данных к решению.

## HR
`hr/05-hr-department.png` — ожидание, интервью, рабочая группа, документы, стойка. Метафора: путь кандидата к выходу и адаптации.

## Логистика
`logistics/06-logistics-department.png` — карты, маршруты, доска, коробки, документы и operational desk. Метафора: движение операции между этапами.

## Логотип
`logo/Logo111.svg` — проверить, является ли содержимое чистым вектором. При необходимости перерисовать.

## Исследование
`source/allqbit-site-research-and-copy.md`

## Производные ассеты (Step 10)

Оригиналы `references/**/*.png` (1536×1024, 3.2–3.6 МБ) **никогда не импортируются в клиент и не
запрашиваются браузером** (оптимизация тяжёлых PNG на лету исчерпывала эфемерные порты под e2e — см.
`src/components/office/departmentPhotos.ts`). Браузер получает только лёгкие производные из
`src/assets/office-photos/`, которые порождает воспроизводимый скрипт:

```bash
npm run assets:images   # node scripts/generate-office-images.mjs
```

Из каждого оригинала выше генерируются (детерминированно, на одной версии `sharp`):

- **адаптивные сцены** `<id>-<width>.<webp|avif>` для `id ∈ {overview, sales, support, executive, hr,
  logistics}`, `width ∈ {768, 1280, 1536}` — WebP + AVIF (OQ-A2-4), раздаются через ручной
  `<picture>`/srcset (подключается в Steps 12/13);
- **миниатюры рельса** `<id>-thumbnail.webp` (160×160, center-cover) для пяти отделов;
- **legacy общий фон** `office-background.webp` (мастер-сцена overview @1536; имя сохранено ради
  текущего потребителя `OfficeExperience`, пока Step 12 не подключит адаптивную overview-сцену).

Замена черновых оригиналов на финальные (OQ-A2-7) = перекладка файлов в `references/**` + повторный
`npm run assets:images`. Скрипт проверяет performance-budget и завершается с ошибкой при превышении
(см. `docs/10-performance-budget.md`).
