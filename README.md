# Allqbit — Project Status

Интерактивный сайт-«офис», продающий автоматизацию бизнес-процессов через понятные результаты:
меньше потерянных заявок, быстрее ответ клиенту, меньше рутины, понятные статусы, больше
видимости для руководства. Подробности — `CLAUDE.md` и `docs/`.

## Правила статусов

Каждый шаг имеет ровно один статус из списка: **Не приступили**, **В работе**, **Выполнено**.

Эта таблица — упрощённое зеркало `WORKPLAN.md`, где реальный прогресс хранится в 8-значном
статусном словаре (`PROPOSED / APPROVED / IN_PROGRESS / AWAITING_SKEPTIC / FAILED_REVIEW /
BLOCKED / PASSED / COMPLETED`). Источник истины — `WORKPLAN.md`; README отображает его через
mapping:

| Статус в WORKPLAN.md                               | Статус здесь  |
| -------------------------------------------------- | ------------- |
| `PROPOSED`, `APPROVED`, `BLOCKED`                  | Не приступили |
| `IN_PROGRESS`, `AWAITING_SKEPTIC`, `FAILED_REVIEW` | В работе      |
| `PASSED`, `COMPLETED`                              | Выполнено     |

В любой момент времени не более одного шага находится в статусе "В работе". Переход в
"Выполнено" происходит только после того, как пройдены все verification commands шага, получен
skeptic verdict `PASS`, и результат явно утверждён пользователем. Эта таблица обновляется в
README.md синхронно с каждым изменением статуса в `WORKPLAN.md` — одним и тем же коммитом.

## Статус шагов

| # | Шаг                                | Статус        |
| - | ---------------------------------- | ------------- |
| 1 | Repository and quality foundation  | Выполнено     |
| 2 | Typed content model                | Выполнено     |
| 3 | Semantic office overview           | Выполнено     |
| 4 | Homepage state machine             | Выполнено     |
| 5 | Department selection state machine | Не приступили |
| 6 | Desktop 10/90 shell                | Не приступили |
| 7 | Mobile touch flow                  | Не приступили |
| 8 | Reduced motion and fallback        | Не приступили |
| 9 | Browser acceptance tests           | Не приступили |

Полные критерии и детали каждого шага — `WORKPLAN.md`. История исполнения и доказательства —
`WORKLOG.md`. Архитектурные и технологические решения — `DECISIONS.md`.

## Как запустить проект

```bash
npm install
npm run dev
```

Приложение поднимается на `http://localhost:3100` (не 3000 — порт 3000 на этой машине занят
посторонним процессом, не относящимся к проекту; см. `WORKLOG.md`, Step 1).

Прочие команды: `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`,
`npm run format:check`, `npm run test`, `npm run test:e2e`.

## Источники истины

- Продукт и UX: `docs/`
- Структурированный контент: `data/`
- Визуальные референсы: `references/`
