# WORKPLAN

## Task

Создать первый low-fidelity прототип интерактивной главной страницы Allqbit.

## Goal

Пошагово, с обязательным skeptic-review каждого шага и явным утверждением пользователя,
получить рабочий low-fidelity прототип интерактивного офиса: full-office overview, пять
интерактивных зон, hover/focus/touch, выбор отдела, 10/90-раскладка, переключение отделов,
возврат к overview, клавиатурная доступность, mobile touch flow, reduced-motion поведение —
без финального 3D-арта, персонажей, backend, CRM и калькулятора (см. "Первое milestone" в
CLAUDE.md).

## Source requirements

- `CLAUDE.md` (Mandatory strict execution protocol, Architecture/Copy/Motion/Responsive/
  Accessibility/Performance rules, Quality gate, First milestone)
- `docs/00-product-brief.md` … `docs/16-open-questions.md` (`docs/17–19` — process-protocol
  duplicates of `CLAUDE.md`, удалены 2026-07-16, см. `DECISIONS.md` "Аудит и облегчение workflow")
- `data/departments.json`, `data/homepage-copy.json`, `data/office-zones.json`
- `references/` (визуальные референсы пяти отделов, overview, логотип)
- Пользовательские сообщения: запрос на планирование с обязательным ведением статуса в
  `README.md` тремя метками (Не приступили/В работе/Выполнено) и строго последовательным
  исполнением по одному шагу

## Approval

- Plan status: `APPROVED`
- User approved: `YES`
- Approved at: 2026-07-14
- Approved scope: весь скелет из 8 шагов утверждён как последовательность; **детальный план
  каждого шага 2–8 будет заново пройден через planner → skeptic review плана → отдельное
  утверждение пользователя непосредственно перед своим стартом** — сейчас утверждено начало
  исполнения только Step 1 в полном объёме, описанном ниже.
- **Пересмотрено 2026-07-16 (аудит workflow, см. `DECISIONS.md`):** правило выше — источник
  токен-затратного цикла "re-plan перед каждым шагом", устранённого этой правкой. Начиная с этой
  даты: любой ещё не начатый шаг (Step 7.2/7.3/7.5/8/9) реализуется напрямую по уже написанному в
  этом файле объёму — без повторного вызова `planner`, если только не меняется scope или skeptic не
  проваливает один и тот же шаг подряд несколько раз (`CLAUDE.md` "Mandatory strict execution
  protocol", пункт 5). Уже утверждённые/пройденные шаги (1–7) это правило не переоткрывает.
- Amendment 3 (2026-07-15): скелет шагов расширен с 8 до 9 по прямому решению пользователя (OQ-D
  = (b) — "Разбить на два шага", см. `DECISIONS.md`, 2026-07-15 "Step 5: разбиение на два
  отдельных шага WORKPLAN (OQ-D, Amendment 3)"). Единый черновик "Step 5 — Desktop 10/90 shell"
  формально разбит на "Step 5 — Department selection state machine" и "Step 6 — Desktop 10/90
  shell"; бывшие Step 6/7/8 сдвинуты на Step 7/8/9. Полная формальная запись — см. `Plan
  amendments` → `Amendment 3` ниже.
- Amendment 4 (2026-07-16): по решению пользователя (OQ-M1 = (c), см. `DECISIONS.md` 2026-07-16
  "Step 7: ответы на OQ-M1–OQ-M4") между Step 7 и Step 8 добавлен новый шаг "Step 7.5 — Tablet
  touch flow" под нелинейной меткой (Step 8/Step 9 не переименованы — обоснование см. `Plan
  amendments` → `Amendment 4`). "Step 7 — Mobile touch flow" одновременно переработан под
  OQ-M3 = (b) (горизонтальная карусель вместо вертикального списка). Скелет теперь — 9
  канонически пронумерованных шагов + Step 7.5. Полная формальная запись — см. `Plan amendments`
  → `Amendment 4` ниже.
- Amendment 5 (2026-07-16): по решению пользователя (`AskUserQuestion`, «Прятать и на Tablet
  (Recommended)», см. `DECISIONS.md` 2026-07-16 "OQ-T1 переопределён") исходный ответ OQ-T1 = (b)
  ("показывать как есть") для уже `APPROVED` "Step 7.5 — Tablet touch flow" отменён:
  `interactionHint` теперь скрывается на Tablet тоже, тем же безусловным CSS-правилом, что вводит
  черновой "Step 7.2 — Overview full-screen (hide hero)". Затронуты Objective/In scope/Expected
  files/Acceptance criterion 12/"Open questions" Step 7.5 — старый текст сохранён для истории,
  помечен переопределённым, не удалён. Полная формальная запись — см. `Plan amendments` →
  `Amendment 5` ниже.
- Amendment 6 (2026-07-17): по прямому запросу пользователя при визуальной проверке шапки между
  Step 7.5 и Step 8 добавлен новый шаг "Step 7.6 — Header: clickable logo + tagline
  scale/centering" (та же нелинейная схема нумерации, что у Steps 7.2–7.5; Step 8/Step 9 не
  переименованы). Шаг пересматривает решения по шапке, введённые `COMPLETED` Step 7.4, открыто —
  через Amendment, не правкой закрытого шага задним числом. Полная формальная запись — см. `Plan
  amendments` → `Amendment 6` ниже.

## Step 1 — Repository and quality foundation

- Status: `COMPLETED` (пользователь подтвердил результат лично — открыл `npm run dev` в браузере,
  2026-07-14: "принимаю")
- Objective: Инициализировать минимальный проект Next.js (App Router) + TypeScript с полным
  набором quality scripts (format, lint, typecheck, unit test, build, e2e) и git-репозиторием,
  без продуктового UI, контента или дизайна интерактивного офиса.
- In scope:
  - `git init` + baseline-коммит до начала изменений (сделано: коммит `4080a7b`).
  - Next.js (App Router) + TypeScript, package manager — npm (см. `DECISIONS.md`, 2026-07-14).
  - Структура каталогов `src/{app,components,features,content,lib,hooks,styles,tests}` согласно
    docs/09-technical-architecture.md.
  - Placeholder `src/app/layout.tsx`, `src/app/page.tsx` (без реального copy/дизайна офиса).
  - ESLint + Prettier.
  - Vitest (см. `DECISIONS.md`) + один smoke unit-тест в `src/tests/unit/`.
  - Playwright + `npx playwright install` + один smoke e2e-тест в `src/tests/e2e/` (см.
    `DECISIONS.md` — расположение согласовано с docs/09, без отдельного top-level `e2e/`).
  - Заготовка design tokens (цвета/типографика/spacing) — без финального арт-дирекшна (см.
    `DECISIONS.md`, scope Step 1).
  - `package.json` scripts: `format`, `format:check`, `lint`, `typecheck`, `test`, `build`,
    `test:e2e`.
  - `README.md` — новый файл, статус-таблица шагов, синхронизированная с этим WORKPLAN.md.
  - Ревизия `.gitignore` при необходимости (не перезаписывать бездумно).
- Out of scope:
  - Интерактивный офис, five hotspots, hero copy, state machine, department content.
  - GSAP, Zustand, любая клиентская интерактивность офиса.
  - CI pipeline (см. `DECISIONS.md` — вынесен в отдельный будущий шаг).
  - Визуальный regression test (относится к более поздним milestone-проверкам).
  - Правка `MANIFEST.json` (известное расхождение, см. `DECISIONS.md` — не исправляется в Step 1).
- Dependencies: нет (первый шаг всего плана).
- Expected files:
  - `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`
  - `.eslintrc*`/`eslint.config.mjs`, `.prettierrc*`, `.prettierignore`
  - `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/favicon.ico`
    (стандартный вывод `create-next-app` App Router — часть In scope "Next.js + TypeScript init")
  - `public/` (placeholder, `.gitkeep` — пустой каталог для будущих статических ассетов)
  - `src/{components,features,content,lib,hooks,styles}/` (placeholder)
  - `src/tests/unit/`, `vitest.config.ts`
  - `src/tests/e2e/`, `playwright.config.ts`
  - design tokens файл (`src/styles/tokens.*`)
  - `README.md` (новый)
  - `.gitignore` (возможная правка — сделана: добавлена строка `.claude/scheduled_tasks.lock`)
  - `DECISIONS.md`, `WORKPLAN.md`, `WORKLOG.md` (процессные файлы)
- Acceptance criteria:
  1. `git log` показывает baseline-коммит до Step 1 и коммит(ы) Step 1.
  2. `npm install` — без ошибок.
  3. `npx playwright install --with-deps chromium` — без ошибок.
  4. `npm run format:check` — exit 0.
  5. `npm run lint` — exit 0, без подавленных warnings.
  6. `npm run typecheck` — exit 0.
  7. `npm run test` — exit 0, минимум один smoke unit-тест проходит.
  8. `npm run build` — exit 0.
  9. `npm run test:e2e` — exit 0 хотя бы на Chromium.
  10. `npm run dev` — страница рендерится, без console errors в браузере.
  11. `README.md` существует, содержит mapping-таблицу статусов и таблицу шагов; Step 1 = "В
      работе" на момент завершения реализации (до skeptic PASS + user approval).
  12. `DECISIONS.md` содержит записи обо всех решениях Step 1 (npm, Vitest, design tokens
      in/CI out, README mapping, MANIFEST.json known issue, git init, расположение e2e-тестов).
  13. Ни один файл вне "Expected files" не изменён (`git diff --stat` относительно `4080a7b`).
- Verification commands:
  ```bash
  npm install
  npx playwright install --with-deps chromium
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  npm run dev   # ручная проверка, затем остановить процесс
  ```
- Manual checks:
  - Открыть `http://localhost:3100`, убедиться, что страница рендерится и в консоли браузера
    нет ошибок.
  - `npm run build && npm run start`, открыть production-сборку локально.
  - `git diff --stat 4080a7b` — подтвердить, что изменения ограничены Expected files.
  - Визуально проверить `README.md`: таблица читаема, статус-метки строго из трёх значений,
    mapping на 8-значный enum WORKPLAN.md присутствует.
- Risks:
  - Версионный дрейф Next.js/ESLint (flat config vs legacy) на момент фактической установки —
    не влияет на архитектуру, может незначительно изменить формат конфиг-файлов.
  - Смоук e2e-тест может неявно закрепить конкретный placeholder-текст, который придётся менять
    в Step 3 (semantic office overview) — низкий риск, т.к. Step 1 не про финальный контент.
  - **Known issue без owner-шага** (аналогично MANIFEST.json ниже): порт 3000 на машине
    разработки постоянно занят посторонним, не относящимся к репозиторию Next.js-процессом (PID
    меняется между сессиями) с сайтом другого проекта ("Qbit-Studio-AI"). Playwright по умолчанию
    переиспользует уже слушающий сервер (`reuseExistingServer: !CI`), из-за чего e2e-тест
    изначально проверял чужой сайт вместо нашего. Устранено закреплением порта 3100 за
    dev/start/e2e этого проекта (см. Amendment 1 ниже и `DECISIONS.md`). Остаточный риск: если
    порт 3100 тоже окажется занят, ошибка повторится в том же виде — preflight-проверка занятости
    порта или переход на динамически выделяемый свободный порт **не реализованы и не назначены**
    ни одному из шагов (на момент записи — 2–8; после Amendment 3, см. `DECISIONS.md` 2026-07-15,
    — 2–9); при повторном возникновении потребуется отдельное решение пользователя, аналогично
    тому, как не решён вопрос с MANIFEST.json.
- Rollback: `git reset --hard 4080a7b` только после явного разрешения пользователя (Safety-правила
  CLAUDE.md — деструктивные git-команды требуют подтверждения каждый раз), либо `git revert`
  диапазона коммитов Step 1. Все файлы Step 1, включая README.md, откатываются без исключений.
- Skeptic verdict: `PASS` (финальный review, после 1× FAIL и 1× BLOCKED в ходе correction loop —
  полная история в `WORKLOG.md`).
- Skeptic findings: закрыты все замечания трёх раундов review — (1) host-несоответствие
  `127.0.0.1`/`localhost` в dev-режиме (реальная console-ошибка HMR, Next.js 16
  `allowedDevOrigins`); (2) отсутствие явной amendment-записи для правки порта; (3) отсутствие
  владельца/tracking для риска порта 3100; (4) неполный "Manual verification" в `WORKLOG.md`;
  (5) неполный перечень "Expected files"; (6) самопровозглашённое `APPROVED` для Amendment 1 без
  реального согласования пользователя — потребовало прямого вопроса пользователю и правки записи
  на честную. См. `WORKLOG.md` для полной истории всех трёх review-раундов.
- Completion evidence: `WORKLOG.md`, Entry 1 + Correction iteration 1 и 2; финальный прогон всех
  verification commands — все exit 0 (см. также независимый повторный прогон skeptic в финальном
  review); `git log` — коммиты `4080a7b`…`6b4a680`.

## Step 2 — Typed content model

- Status: `COMPLETED` (пользователь утвердил результат, 2026-07-14)
- Objective: Создать типизированный, runtime-валидируемый источник данных для трёх существующих
  JSON-файлов главной страницы (`data/departments.json`, `data/homepage-copy.json`,
  `data/office-zones.json`) — типы, zod-схему и adapter-функции, без изменения самих данных и без
  UI, потребляющего эти данные.
- In scope:
  - `src/content/types.ts` — типы `DepartmentId`, `Department`, `HomepageCopy`, `OfficeZone`,
    `OfficeZonesData`, строго по полям, реально присутствующим в данных (см. решение
    "типизировать как есть" в `DECISIONS.md`, 2026-07-14) — без `beforeSteps`, `automationSteps`,
    `visual` из `docs/12` (их нет в `data/departments.json`).
  - `src/content/schema.ts` — zod-схема (см. `DECISIONS.md`, 2026-07-14):
    - `Department`: ровно 5 записей, `id` — enum `sales | support | executive | hr | logistics`
      без дублей и пропусков; `name`, `overviewLabel`, `overviewProblem`, `headline`, `problem`,
      `ctaLabel` — непустые строки; `symptoms`/`outcomes` — непустые массивы непустых строк
      (без верхнего предела — `docs/12` "максимум три симптома" это правило показа в UI, не
      ограничение данных); `reference` — непустая строка (путь; существование файла на диске не
      проверяется — вне scope); `solutionPath` — **строгое перечисление** фактических значений из
      данных, сверенное с `docs/09-technical-architecture.md`: `/solutions/sales`,
      `/solutions/support`, `/solutions/management` (для `id: "executive"` — не
      `/solutions/executive`), `/solutions/hr`, `/solutions/logistics`. Схема явно связывает
      каждый `id` с ожидаемым `solutionPath` (а не проверяет общий паттерн `/solutions/<slug>`).
    - `HomepageCopy`: `headline`, `subheadline`, `primaryCta`, `secondaryCta`, `interactionHint` —
      непустые строки; `valuePoints` — непустой массив непустых строк. Структура зафиксирована по
      факту `data/homepage-copy.json` (в `docs/12` для `HomepageCopy` нет отдельного описания —
      это тоже часть решения "все три файла", см. `DECISIONS.md`).
    - `OfficeZonesData`/`OfficeZone`: top-level объект содержит `coordinateSystem: string`,
      `note: string` (опционально/nullable — это провизорная пометка, не должна вызывать отказ
      валидации, если временно отсутствует) и `zones: OfficeZone[]`; схема не использует `.strict()`
      на top-level, чтобы не падать на некритичных дополнительных полях в будущем, но явно
      описывает известные поля, а не принимает объект целиком без проверки. `OfficeZone`:
      `departmentId` — тот же enum `DepartmentId`, `x/y/width/height` — числа; ровно 5 записей,
      покрывающих все 5 `departmentId` без дублей.
  - `src/content/departments.ts` — adapter: `getDepartments(): Department[]`,
    `getDepartmentById(id: DepartmentId): Department | undefined`,
    `getDepartmentIds(): DepartmentId[]`.
  - `src/content/homepage-copy.ts` — adapter: `getHomepageCopy(): HomepageCopy`.
  - `src/content/office-zones.ts` — adapter: `getOfficeZones(): OfficeZone[]`,
    `getOfficeZoneByDepartment(id: DepartmentId): OfficeZone | undefined`.
  - Валидация выполняется при первом импорте соответствующего adapter-модуля (throw с понятным
    сообщением при провале — fail fast). **Архитектурное ограничение (см. `DECISIONS.md`):**
    adapter-модули `src/content/*.ts` — server-only; не импортируются напрямую в `'use client'`-
    компоненты в последующих шагах (иначе zod и валидация попадут в client-бандл — Performance
    rules CLAUDE.md). Это ограничение фиксируется как комментарий-инвариант в коде adapter'ов и
    как пункт Risks ниже, обязательный к проверке в milestone review (`frontend-architect`) на
    шагах, которые впервые импортируют adapter в компонент.
  - Vitest unit-тесты (`src/tests/unit/content/`):
    - `departments.test.ts` — реальные данные проходят схему; `getDepartments()` возвращает ровно
      5 объектов с уникальными `id` из канонического enum; каждый `solutionPath` соответствует
      ожидаемому по `id` (включая `executive → /solutions/management`).
    - `homepage-copy.test.ts` — реальные данные проходят схему; `getHomepageCopy()` возвращает
      ожидаемую форму.
    - `office-zones.test.ts` — реальные данные проходят схему (включая наличие `coordinateSystem`/
      `note`); `getOfficeZones()` возвращает ровно 5 зон; cross-consistency: набор `departmentId`
      в `office-zones.json` совпадает с набором `id` в `departments.json`.
    - `invalid-fixtures.test.ts` — инлайновые (не из `data/`) невалидные объекты отклоняются
      схемой: отсутствующее обязательное поле; `id` вне enum; дублирующийся `id`; неверный тип
      поля-массива; массив из 4 или 6 отделов; неверный/непредусмотренный `solutionPath` для
      данного `id`.
  - `package.json`/`package-lock.json` — добавление зависимости `zod`.
- Out of scope:
  - Любые UI-компоненты/страницы, потребляющие этот контент — `src/app/page.tsx` не меняется;
    потребление начинается со Step 3.
  - `beforeSteps`, `automationSteps`, полный `visual` (`docs/12`) — физически отсутствуют в
    `data/departments.json`; решение "типизировать как есть" зафиксировано в `DECISIONS.md`,
    2026-07-14 — это осознанное known issue, не молчаливое упущение.
  - Правка содержимого `data/*.json` — файлы остаются источником истины в неизменном виде.
  - Правка `docs/12-content-data-model.md` для приведения в соответствие с реальными данными.
  - Схемы `Diagnostic`/`Calculator` из `docs/12` — не относятся к контенту главной страницы.
  - Проверка существования файлов `reference`/`references/**` на диске (asset integrity).
  - CI pipeline (см. `DECISIONS.md`, Step 1).
- Dependencies: Step 1 (`COMPLETED`).
- Expected files:
  - `src/content/types.ts`, `src/content/schema.ts`
  - `src/content/departments.ts`, `src/content/homepage-copy.ts`, `src/content/office-zones.ts`
  - `src/tests/unit/content/departments.test.ts`, `src/tests/unit/content/homepage-copy.test.ts`,
    `src/tests/unit/content/office-zones.test.ts`, `src/tests/unit/content/invalid-fixtures.test.ts`
  - `package.json`, `package-lock.json` (добавлен `zod`)
  - `DECISIONS.md`, `WORKPLAN.md`, `README.md`, `WORKLOG.md` (процессные файлы)
- Acceptance criteria:
  1. `getDepartments()` возвращает ровно 5 объектов с уникальными `id`, покрывающими ровно
     `sales | support | executive | hr | logistics`; каждый проходит zod-схему.
  2. Каждый `solutionPath` соответствует своему `id` согласно `docs/09` (в т.ч.
     `executive → /solutions/management`) — проверено тестом, не только описанием схемы.
  3. Схема отклоняет все invalid-fixtures, перечисленные в "In scope" — реальным unit-тестом
     (`.safeParse().success === false` / `.toThrow()`), не только компилятором TypeScript.
  4. `getHomepageCopy()` типизирован и покрыт unit-тестом на реальных данных.
  5. `getOfficeZones()`/`getOfficeZoneByDepartment()` возвращают ровно 5 зон; cross-consistency
     между `office-zones.json` и `departments.json` покрыта unit-тестом.
  6. `src/app/page.tsx` не изменён относительно состояния после Step 1.
  7. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
     `npm run test:e2e` — все exit 0.
  8. `git diff --stat` относительно коммита закрытия Step 1 ограничен списком Expected files.
  9. `DECISIONS.md` содержит записи о всех трёх решениях Step 2 (валидатор, границы шага,
     docs/12 vs данные), с реальным согласованием пользователя, а не проставленные исполнителем
     самостоятельно (см. прецедент BLOCKED в Step 1).
- Verification commands:
  ```bash
  npm install    # добавление zod
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  npm run dev    # регрессионная ручная проверка, см. Manual checks
  ```
- Manual checks:
  - `git diff --stat` относительно коммита закрытия Step 1 — подтвердить, что изменения
    ограничены Expected files; `data/`, `docs/`, `references/` не тронуты.
  - Открыть `http://localhost:3100` после `npm run dev` — убедиться, что placeholder-страница
    Step 1 не изменилась (регрессия на "Out of scope: UI").
  - Вручную просмотреть вывод Vitest для новых тестов — подтвердить, что invalid-fixture тесты
    реально проверяют отказ, а не пропускают проверку молча.
  - Вручную сверить `src/content/types.ts` с `docs/12` — подтвердить, что отсутствующие поля
    (`beforeSteps`/`automationSteps`/`visual`) сознательно не смоделированы (см. Out of scope), а
    не потеряны по невнимательности.
- Risks:
  - **Known issue (решено, не отложено):** типы Step 2 не покрывают `beforeSteps`/
    `automationSteps`/`visual` из `docs/12` — начиная со Step 5 ("Department selection state
    machine") и далее Step 6 ("Desktop 10/90 shell", после Amendment 3 — см. `DECISIONS.md`
    2026-07-15), где по Core concept CLAUDE.md нужно показывать "текущий процесс/сценарий
    автоматизации", это будет видимым ограничением типов, а не скрытым. Дозаполнение
    `data/departments.json` — отдельная
    контентная задача, не назначенная сейчас конкретному шагу (решение пользователя, 2026-07-14).
  - **Server/client граница:** adapter-модули `src/content/*.ts` спроектированы как server-only;
    если в Step 4/5 кто-то по невнимательности импортирует их в `'use client'`-компонент, zod и
    валидация попадут в client-бандл. Смягчение: явный комментарий-инвариант в коде + проверка на
    milestone review (`frontend-architect`) при первом реальном потреблении (Step 3+).
  - Новая npm-зависимость (`zod`) — стандартный, широко используемый пакет; риск низкий.
  - `office-zones.json` содержит провизорную пометку `note` ("Предварительные зоны...") — схема
    должна пропускать это поле, не падать на нём и не заставлять его быть обязательным навсегда;
    при обновлении зон в будущем (после утверждения финальной сцены) схема не должна требовать
    правки только из-за исчезновения `note`.
- Rollback: `git revert` диапазона коммитов Step 2 (аддитивный шаг: новые файлы + одна новая
  зависимость `zod`; `data/*.json` не меняются, риска потери контента нет). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя, как в Step 1.
- Skeptic verdict: `PASS` (с первого раунда review исполнения — без FAIL/BLOCKED, в отличие от
  Step 1).
- Skeptic findings: замечаний Blocker/Critical/Major нет. Minor (не блокирует): `note` в
  `office-zones` протестирован только для отсутствующего значения, не для явного `null`; вся
  реализация — в одном коммите, поэтому промежуточные TS/ESLint-исправления не видны по отдельным
  коммитам (не является нарушением протокола, финальное состояние независимо проверено чистым).
- Completion evidence: `WORKLOG.md`, Entry 2; независимый повторный прогон всех 6 verification
  commands skeptic — все exit 0 (35/35 unit-тестов, 1/1 e2e); `git diff --stat 2bb6f6d 9915d42` —
  16 файлов, все в рамках Expected files.

## Step 3 — Semantic office overview

- Status: `COMPLETED` (пользователю предложено лично посмотреть `npm run dev` на
  `http://localhost:3100`, включая low-height fallback при уменьшении высоты окна, и задан прямой
  вопрос об утверждении закрытия Step 3; ответ пользователя, 2026-07-14: "продолжай")
- Objective: Создать доступный, полностью server-rendered semantic overview главной страницы:
  hero (headline/subheadline/primary+secondary CTA/valuePoints/interactionHint из
  `homepage-copy.json`) и HTML-карту офиса с пятью доступными hotspot-кнопками отделов
  (позиционированными по `office-zones.json`, с `overviewLabel` как постоянно видимой подписью и
  `overviewProblem`, раскрывающимся по hover/focus — см. `DECISIONS.md`, 2026-07-14). Overview —
  конечная точка Step 3: активация hotspot'а (клик/Enter/Space) в этом шаге не открывает отдел и
  не меняет состояние приложения — это закреплено за Step 4/5.
- In scope:
  - **Границы шага.** Step 3 реализует только состояние `overview` из
    `docs/05-homepage-state-machine.md` плюс CSS-часть `department-preview` (раскрытие
    `overviewProblem` по hover/focus — реализуемо чистым CSS, без JS-состояния и без полноценной
    state machine). Полная state machine (opening/active/switching/closing), URL-синхронизация
    `?department=<id>`, 10/90-раскладка — Step 4/5. Активация hotspot'а (клик/Enter/Space) в
    Step 3 — no-op (нативная `<button type="button">` без `onClick`, без навигации). Query string
    `?department=<id>` не читается и не влияет на рендер (проверяется тестом).
  - **Компонентная структура** (`src/components/homepage/`, `src/components/office/` — по дереву
    `docs/09-technical-architecture.md`), все компоненты — Server Components, без `'use client'`
    (hover/focus — чистые CSS-псевдоклассы `:hover`/`:focus-within`; JS-состояние не требуется):
    - `src/components/homepage/HomepageShell.tsx` — композиция `Header` + `<main>` (`HeroCopy` +
      `OfficeExperience`); вызывается из `src/app/page.tsx`.
    - `src/components/homepage/Header.tsx` — минимальный `<header>` с текстовым брендом
      "Allqbit" (без сайтового навигационного меню — вне scope этого шага). Присутствие `Header`
      как соседа `HeroCopy` подтверждено деревом компонентов `docs/09` (строки 56–59).
    - `src/components/homepage/HeroCopy.tsx` — рендерит ровно один `<h1>` (`headline`),
      `subheadline`, `valuePoints` (`<ul>`), `primaryCta` (видимая, сфокусируемая, но
      функционально no-op — реального адресата диагностики/lead capture нет ни в этом шаге, ни во
      всём текущем (на момент этого шага — 8-шаговом, ныне 9-шаговом после Amendment 3, см.
      `DECISIONS.md` 2026-07-15) milestone, CLAUDE.md "First milestone": без backend/CRM),
      `secondaryCta` — рабочая внутристраничная ссылка (`href="#office-map"`) на карту офиса
      (входит в scope Step 3, в отличие от `primaryCta`, у которой нет адресата вовсе).
    - `src/components/office/OfficeExperience.tsx` — тонкий server-контейнер; рендерит
      `interactionHint` ("Наведите курсор на отдел") как статичную подпись над картой и
      `OfficeSemanticMap`. Архитектурный шов для будущего client state (Step 4), без собственной
      логики сейчас.
    - `src/components/office/OfficeSemanticMap.tsx` — `<nav aria-label="Отделы компании">` со
      списком (`<ul id="office-map">`) 5 `DepartmentHotspot`. Сопоставляет `getOfficeZones()` и
      `getDepartmentById(zone.departmentId)`; при отсутствии соответствия — `throw` (fail-fast, по
      аналогии с adapter'ами Step 2). Порядок DOM/Tab — сортировка зон по `y` (возр.), затем `x`
      (возр.) — визуально осмысленный reading order; техническое решение planner'а, не требующее
      отдельного вопроса (низкий риск, легко изменить).
    - `src/components/office/DepartmentHotspot.tsx` — `<li><button type="button">` с
      `aria-label={overviewLabel}`; видимый текст `overviewLabel` — всегда; `overviewProblem` —
      визуально и программно раскрывается по `:hover`/`:focus-within` (см. `DECISIONS.md`):
      текст присутствует в DOM (не добавляется динамически через JS), скрыт визуально до
      hover/focus через CSS-технику, не убирающую его из accessibility tree (не
      `display:none`/`visibility:hidden` — например, position/opacity-based reveal, чтобы
      скринридер мог озвучить `overviewProblem` как часть accessible description кнопки
      независимо от visual hover-состояния: `aria-describedby` на сам `overviewProblem`-элемент).
      Позиционирование — абсолютное CSS (`left/top/width/height` в `%`, взятые из
      `office-zones.json`, `coordinateSystem: "relative-percent"`, без конвертации) внутри
      контейнера с плейсхолдер-прямоугольником (условная замена финальной сцены art-direction
      milestone, `docs/13` Этап 2).
    - **`OfficeVisualLayer` не создаётся в Step 3** (сознательное отклонение от буквального
      дерева `docs/09`, которое перечисляет его соседом `OfficeSemanticMap`). Обоснование:
      (a) визуальная техника (`docs/09` "Открытые решения: Visual technique, WebGL") не выбрана —
      создание любого декоративного слоя сейчас означало бы неявный выбор техники в обход
      открытого вопроса; (b) Step 3 acceptance criterion "Hero виден без сложного visual layer"
      прямо поддерживает минимализм; (c) CLAUDE.md "First milestone: No final 3D art". Owner
      будущего решения — см. Risks (владелец: на момент этого шага — перед стартом Step 7; **после
      Amendment 3 (`DECISIONS.md` 2026-07-15) — перед стартом Step 8**, а не "без owner").
    - `reference` (PNG-пути к детальным сценам отделов) не используется в Step 3 — это ассеты
      будущей `DepartmentScene`, не overview-иконки (Performance budget `docs/10`: не грузить все
      оригиналы сразу).
  - **Стили (CSS Modules — см. `DECISIONS.md`, 2026-07-14)**: `*.module.css` рядом с каждым
    компонентом; никаких новых npm-зависимостей.
  - **`src/app/globals.css`**: `@import "../styles/tokens.css";` (см. `DECISIONS.md`,
    2026-07-14 — Plan Amendment 2, формально зафиксировано ниже в "Plan amendments"); глобальное
    `@media (prefers-reduced-motion: reduce)`, обнуляющее длительность CSS-переходов; видимый
    `:focus-visible` стиль с контрастным outline.
  - **`src/styles/tokens.css`**: обновить комментарий-заголовок (больше не "ждёт арт-дирекшна").
  - Обновление существующих Step 1 smoke-тестов, которые проверяют placeholder-текст "Allqbit"
    (предвиденный риск, зафиксированный в Step 1 Risks):
    - `src/tests/unit/home-page.test.tsx` — переписать ассерты под новый hero-контент.
    - `src/tests/e2e/home-page.spec.ts` — удалить, заменить на
      `src/tests/e2e/office-overview.spec.ts` (базовый рендер) и
      `src/tests/e2e/office-overview-keyboard.spec.ts` (клавиатурная навигация +
      progressive enhancement + reduced-motion + query string).
  - Новые unit-тесты (Vitest + Testing Library):
    `src/tests/unit/components/homepage/hero-copy.test.tsx`,
    `src/tests/unit/components/office/office-semantic-map.test.tsx`,
    `src/tests/unit/components/office/department-hotspot.test.tsx`.
- Out of scope:
  - `department-preview` (JS-часть)/`opening`/`active`/`switching`/`closing` состояния, Zustand,
    URL-синхронизация `?department=<id>`, 10/90-раскладка, `DepartmentNavigationRail`,
    `DepartmentExperience`, `DepartmentScene`, `BeforeAfterSequence`, `OutcomePanel`,
    `DepartmentCTA` — на момент этого шага ожидалось в Step 4/5; **по факту (после решений Step 4
    OQ-2 и Amendment 3, `DECISIONS.md` 2026-07-15): состояния/переходы выбора отдела — Step 5
    ("Department selection state machine"), раскладка/`DepartmentNavigationRail`/`DepartmentCopy`/
    `OutcomePanel`/`DepartmentCTA` — Step 6 ("Desktop 10/90 shell"), `DepartmentScene`/
    `BeforeAfterSequence` решением по OQ-C не создаются вовсе**.
  - `OfficeVisualLayer`, WebGL/Canvas, GSAP, motion orchestration — не вводятся.
  - Реальный адресат `primaryCta` (диагностика/lead capture, `docs/13` Этап 8) — вне scope всего
    текущего (на момент этого шага — 8-шагового, ныне 9-шагового после Amendment 3) milestone.
  - Использование `reference` PNG-путей отделов.
  - Полноценный error-fallback state (`docs/05`, `FallbackExperience`) — на момент этого шага
    закреплён за Step 7; **после Amendment 3 — за Step 8**. В Step 3 "fallback" означает: (a)
    progressive enhancement — hero и 5 кнопок реально в статичном server-rendered HTML, доступны с
    клавиатуры без JavaScript (проверяется тестом с `javaScriptEnabled: false`); (b)
    `prefers-reduced-motion` отключает CSS-переходы.
  - Mobile/tablet-раскладка (`docs/08`) — на момент этого шага Step 6; **после Amendment 3 —
    Step 7**. Ручная проверка Step 3 — desktop ≥1280px.
  - Site-wide навигационное меню в `Header`.
  - Автоматизированное axe-сканирование — **не добавляется в Step 3, владелец назначен**: ручная
    проверка расширением axe DevTools сейчас; автоматизация (`@axe-core/playwright` или аналог) —
    на момент этого шага была закреплена за Step 8 ("Browser acceptance tests"); **после
    Amendment 3 — за Step 9** (то же название), не оставлена без owner'а.
  - Правка `docs/09-technical-architecture.md` (отсутствие `OfficeVisualLayer` в первом
    milestone) — known issue в `DECISIONS.md`, не правка approved-документа.
  - Правка `data/*.json`, `MANIFEST.json`, CI pipeline.
- Dependencies: Step 2 (`COMPLETED`). Известный content gap Step 2 (`beforeSteps`/
  `automationSteps`/`visual` отсутствуют) не блокирует Step 3 — используются только `id`,
  `overviewLabel`, `overviewProblem`.
- Expected files:
  - `src/app/page.tsx` (переписан: вместо placeholder рендерит `<HomepageShell />`)
  - `src/app/globals.css` (импорт токенов — Amendment 2, reduced-motion, focus-visible)
  - `src/styles/tokens.css` (обновлён комментарий-заголовок)
  - `src/components/homepage/HomepageShell.tsx` (+ `.module.css`)
  - `src/components/homepage/Header.tsx` (+ `.module.css`)
  - `src/components/homepage/HeroCopy.tsx` (+ `.module.css`)
  - `src/components/office/OfficeExperience.tsx` (+ `.module.css`)
  - `src/components/office/OfficeSemanticMap.tsx` (+ `.module.css`)
  - `src/components/office/DepartmentHotspot.tsx` (+ `.module.css`)
  - `src/components/.gitkeep` — удалён (первый реальный контент каталога)
  - `src/tests/unit/home-page.test.tsx` (обновлён)
  - `src/tests/unit/components/homepage/hero-copy.test.tsx`,
    `src/tests/unit/components/office/office-semantic-map.test.tsx`,
    `src/tests/unit/components/office/department-hotspot.test.tsx` (новые)
  - `src/tests/e2e/office-overview.spec.ts`, `src/tests/e2e/office-overview-keyboard.spec.ts`
    (новые); `src/tests/e2e/home-page.spec.ts` — удалён
  - `docs/05-homepage-state-machine.md` (правка — явное, раскрытое исключение из обычного правила
    "docs/ не трогать в Step 3", см. `DECISIONS.md` 2026-07-14 "Изменение docs/05..." и
    "honesty-правка docs/05 после skeptic FAIL")
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md` (процессные)
- Acceptance criteria:
  1. Страница `/` рендерит ровно один `<h1>`, текст которого равен `headline` из
     `homepage-copy.json`.
  2. `subheadline`, `primaryCta`, `secondaryCta`, все `valuePoints` присутствуют как видимый
     текст в server-rendered HTML сразу (без анимации/загрузки).
  3. Внутри карты офиса присутствуют ровно 5 доступных кнопок (`getByRole('button')`, scoped к
     контейнеру карты) с accessible name = `overviewLabel` каждого из 5 отделов.
  4. `overviewLabel` виден всегда; `overviewProblem` доступен идентично через hover И через focus
     (клавиатура) — не только визуально по мыши; текст присутствует в accessible tree независимо
     от hover-состояния (проверяется unit-тестом на CSS-классы/`aria-describedby`, не только на
     наличие текста в DOM).
  5. Положение (`left/top/width/height` в %) каждого hotspot вычислено из `office-zones.json`, не
     хардкод (unit-тест на реальных данных).
  6. Клавиатура: `Tab` последовательно фокусирует все 5 кнопок в порядке сортировки по `y`, затем
     `x`; каждая в фокусе имеет видимый focus-индикатор; `Enter`/`Space` не вызывает
     навигацию/console error/изменение URL.
  7. `prefers-reduced-motion: reduce` — вычисленная длительность CSS-переходов Step 3 равна ~0.
  8. При отключённом JavaScript (`javaScriptEnabled: false`) hero и все 5 кнопок присутствуют в
     DOM и фокусируемы по Tab.
  9. Query string `?department=<любой валидный id>` не меняет отрендеренный HTML overview.
  10. Ни один компонент Step 3 не содержит `'use client'`; adapter'ы `src/content/*`
      импортируются только в server-компонентах.
  11. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  12. `git diff --stat` относительно коммита закрытия Step 2 ограничен списком Expected files.
  13. `DECISIONS.md` содержит записи о всех трёх решениях Step 3 (CSS-подход, показ
      overviewProblem, tokens.css) с реальным согласованием пользователя.
  14. **(добавлено при коррекции, см. `DECISIONS.md` 2026-07-14 "исправление отсутствия
      full-viewport без скролла").** На desktop-viewport ≥1280px высотой ≥720px (`docs/08`)
      `document.documentElement.scrollHeight` не превышает `window.innerHeight` — страница
      целиком помещается в один экран без вертикального скролла (проверяется e2e-тестом на
      нескольких характерных десктопных разрешениях).
  15. **(добавлено после skeptic FAIL round 2, см. `DECISIONS.md` 2026-07-14 "low-height fallback
      для docs/08 'Низкий desktop'").** На desktop-viewport высотой <700px: (a) заголовок,
      основная и вторичная CTA остаются полностью в пределах viewport, не обрезаются; (b) каждый
      из 5 хотспотов, после прокрутки в видимую область панели офиса, имеет высоту ≥44px
      (не сжимается пропорционально нехватке высоты без предела); (c) документ в целом по-прежнему
      не скроллится (`scrollHeight <= innerHeight`) — скроллится только панель офиса внутри себя.
      Проверяется e2e-тестом на 1280×500.
- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  npm run dev   # ручная проверка, см. Manual checks, затем остановить процесс
  ```
- Manual checks:
  - Открыть `http://localhost:3100` на desktop-ширине (≥1280px): hero виден сразу; видно 5
    подписанных зон; hover/focus раскрывает `overviewProblem`; в консоли браузера нет ошибок.
  - Клавиатурная проверка: `Tab` последовательно обходит 5 кнопок, фокус визуально заметен и
    раскрывает `overviewProblem`; `Enter`/`Space` не производит видимого перехода.
  - `prefers-reduced-motion: reduce` в DevTools — подтвердить отсутствие анимационных переходов.
  - Отключить JavaScript в DevTools, перезагрузить `/` — hero и 5 кнопок видны и доступны с
    клавиатуры.
  - Проверить масштаб 200% — критический контент не обрезается.
  - Прогнать расширение axe DevTools вручную на `/` — зафиксировать отсутствие серьёзных
    нарушений или занести как known issue (не блокируя шаг, если не Blocker/Critical).
  - `git diff --stat` относительно коммита закрытия Step 2 — подтвердить, что изменения
    ограничены Expected files.
- Risks:
  - **Известный owner-риск (не "без owner"):** зоны `office-zones.json` провизорны
    (`"note": "Предварительные зоны. Уточнить после утверждения финальной общей сцены."`). Step 3
    вычисляет из них конкретный Tab-порядок и CSS-позиции, закреплённые в e2e-тестах
    (`office-overview-keyboard.spec.ts`). При уточнении зон на art-direction milestone (`docs/13`
    Этап 2) эти тесты и Tab-порядок почти наверняка потребуют пересмотра — это ожидаемая, а не
    случайная будущая правка; owner — art-direction milestone, не Step 3.
  - **`OfficeVisualLayer` без владельца до Step 7 (на момент этого шага; после Amendment 3,
    `DECISIONS.md` 2026-07-15, — до Step 8):** отсутствие декоративного визуального слоя в
    Step 3 оставляет вопрос "что вообще является visual layer, для которого этот будущий шаг
    делает fallback" открытым до его старта — явно зафиксировано здесь, будет решаться перед
    планированием этого шага, не сейчас.
  - Малые зоны (`office-zones.json`: HR width 26/height 32, executive width 35/height 24) при hover-
    раскрытии `overviewProblem` могут визуально не помещаться на узких desktop-ширинах (1280px) —
    low-fidelity trade-off, уточняется на art-direction milestone; проверяется ручным check, не
    блокирует приёмку при отсутствии обрезки заголовка/подписи.
  - Замена Step 1 smoke-тестов (`home-page.test.tsx`/`home-page.spec.ts`) — предвиденный в Step 1
    риск; смягчается явным перечислением в Expected files.
  - `primaryCta` — видимая, но no-op кнопка; может выглядеть как баг при поверхностном
    тестировании — смягчается явной пометкой в коде и Out of scope.
- Rollback: `git revert` диапазона коммитов Step 3 (аддитивно относительно Step 2: новые
  компоненты/тесты + точечные правки `page.tsx`/`globals.css`/`tokens.css`; `data/*.json`,
  `docs/*` не меняются). Деструктивный `git reset --hard` — только с явного разрешения
  пользователя.
- Skeptic verdict: **round 1** `PASS` (первый раунд review исполнения, до демонстрации пользователю)
  → **round 2** `FAIL` (после correction iteration 1/no-scroll фикса — Blocker: docs/05 вводила в
  заблуждение про JS-путь; Major: no-scroll фикс без low-height floor, Major: DECISIONS.md framing
  скрывал trade-off) → **round 3** `PASS` (финальный, после correction iteration 2 — все findings
  round 2 независимо подтверждены как устранённые).
- Skeptic findings:
  - Round 1: Blocker/Critical/Major — нет. Minor: визуальный CSS-toggle `overviewProblem` не
    покрыт автотестом; zoom 200% проверялся эмуляцией `document.body.style.zoom`; axe DevTools
    вручную не прогонялся (owner: на момент этого шага — Step 8; после Amendment 3 — Step 9).
  - Round 2 (`FAIL`): Blocker — `docs/05` вводящая в заблуждение формулировка про no-JS fallback;
    Major — no-scroll фикс не имел нижнего предела высоты (24.7px хотспот на 1280×500); Major —
    `DECISIONS.md` не раскрывала этот trade-off. Все три устранены в correction iteration 2.
  - Round 3 (`PASS`, финальный): Blocker/Major/Critical — нет, все findings round 2 независимо
    перепроверены как реально устранённые (не только заявлены): docs/05 честно описывает разрыв
    документ/код; хотспоты на 1280×500 измерены в 81.6–122.4px (было 24.7px); `.office` реально
    скроллится внутренне (`scrollTop` перемещается 0→170), `.shell` не тронут и по-прежнему не
    допускает постраничный скролл; 4 прежних no-scroll теста и весь остальной e2e-набор — без
    регрессии. Minor (не блокирует): acceptance criteria 14/15 не покрывают явно диапазон
    701–719px высоты — эмпирически проверено skeptic'ом отдельно, дефектов не найдено, чисто
    формулировочная неточность.
- Completion evidence: `WORKLOG.md`, Entry 3 (все 3 раунда review + 2 correction iterations);
  независимый повторный прогон всех 6 verification commands в каждом раунде (финально: 45/45 unit,
  11/11 e2e); `git diff --stat 02405b1 24257e7` (Step 3 первичная реализация, 27 файлов) и
  `git diff --stat b22902a 925816e` (round 2 коррекция, 8 файлов) — всё в рамках Expected files;
  grep на `'use client'` — 0 реальных директив; независимые измерения реальной geometry (хотспоты,
  заголовок, CTA, scroll-механизм) на 12+ комбинациях viewport, включая низкие высоты (500–719px),
  проведённые skeptic'ом самостоятельно через живой production-сервер, не только через
  предоставленные тесты.

## Step 4 — Homepage state machine

- Status: `COMPLETED` (пользователь нашёл реальный hydration-mismatch console error в dev-режиме
  (пропущен и исполнителем, и skeptic'ом — оба проверяли только production-сборку); исправлено
  (`91a4226`) и подтверждено skeptic'ом за 3 раунда review исполнения (round 1 `PASS` → находка
  пользователя → round 2 `FAIL` bookkeeping → round 3 `PASS`, финальный) — см. `WORKLOG.md`, Entry 4;
  закрытие явно утверждено пользователем, 2026-07-15: «Я подтверждаю. Закрывай Step 4»)
- Objective: Реализовать переход `hero → overview` по клику любой CTA (`ACTIVATE_CTA`) — при
  включённом JavaScript пять отделов по умолчанию скрыты и раскрываются только после клика по
  `primaryCta` ИЛИ `secondaryCta`; без JavaScript ничего не меняется относительно уже
  реализованного и протестированного Step 3 (все пять отделов видны и доступны с клавиатуры сразу).
  Состояние (`hero`/`overview`) реализуется через `useState`/`useReducer` внутри одного нового
  client-компонента, без новой npm-зависимости (решение пользователя по OQ-1, см. `DECISIONS.md`
  2026-07-15). Явное состояние выбора конкретного отдела (`SELECT_DEPARTMENT`/`CLOSE_DEPARTMENT`/
  `ESCAPE`) в Step 4 **не реализуется вовсе** (решение пользователя по OQ-2 = (c), см.
  `DECISIONS.md`) — хотспоты после раскрытия `overview` остаются no-op при клике/Enter/Space, как в
  Step 3; вся логика выбора отдела и переходы `opening/active/switching/closing` целиком
  переносятся в **тогдашний** "Step 5" (см. Risks — расширенный scope Step 5 явно зафиксирован
  здесь, чтобы не потеряться при планировании того шага). **После Amendment 3 (`DECISIONS.md`
  2026-07-15) это разделено: state machine/выбор отдела — новый Step 5 ("Department selection
  state machine"); настоящая панель (`DepartmentNavigationRail`) и 10/90-раскладка — новый Step 6
  ("Desktop 10/90 shell")** — упоминание "панель" в исходной формулировке этого предложения
  относилось к тогда ещё не разделённому единому будущему шагу, а не к реальной
  `DepartmentNavigationRail`, которая появится только в Step 6. Прямой URL `?department=<id>` при
  первой загрузке
  пропускает `hero` и показывает раскрытый `overview` (буквально по `docs/05`), но **не открывает
  сам отдел автоматически** — реальное автоматическое открытие конкретного отдела по ссылке
  (изначально запрошенное пользователем поведение) переносится в Step 5 вместе с остальной логикой
  выбора отдела (решение пользователя по конфликту OQ-2/OQ-3, см. `DECISIONS.md` 2026-07-15).
  Полная 10/90-раскладка, `DepartmentNavigationRail`, `DepartmentScene`/`BeforeAfterSequence`/
  `OutcomePanel`, mobile touch flow, GSAP-анимации — вне scope Step 4 (на момент закрытия этого
  шага — Step 5/6/7 по тогда утверждённому 8-шаговому скелету; **после Amendment 3, см.
  `DECISIONS.md` 2026-07-15, скелет стал 9-шаговым: 10/90-раскладка/`DepartmentNavigationRail` —
  теперь Step 6, `DepartmentScene`/`BeforeAfterSequence` решением по OQ-C вовсе не создаются ни в
  одном шаге, mobile touch flow — теперь Step 7**). Диагностика/`contact-open` — вне scope всего
  текущего (на момент закрытия Step 4 — 8-шагового, ныне 9-шагового после Amendment 3) milestone
  целиком (см. уже утверждённую формулировку Step 3; `docs/13` Этап 8 — отдельная будущая
  макро-фаза, не один из Steps 1–9).
- In scope:
  - **`hero → overview` по `ACTIVATE_CTA`.** Обе CTA (`primaryCta`, `secondaryCta`) при включённом
    JS вызывают одно и то же раскрытие (уже решено, см. `DECISIONS.md` 2026-07-14 "Изменение
    docs/05..."; не переоткрывается). `secondaryCta` перестаёт быть чистым
    `<a href="#office-map">` без побочного эффекта — обработчик должен и предотвратить переход по
    фрагменту, и раскрыть `overview` (нативный anchor-scroll ведёт в пустоту, пока элемент скрыт).
  - **Ничего не ломать в no-JS fallback.** Без JavaScript hero и все 5 кнопок должны остаться видимы
    и доступны с клавиатуры сразу, как сейчас (Step 3, `office-overview-keyboard.spec.ts`
    `"works with JavaScript disabled"`) — это не подлежит регрессии.
  - **`department-preview`** (раскрытие `overviewProblem` по hover/focus) уже реализовано в Step 3
    чистым CSS — Step 4 не переписывает и не дублирует эту логику. Если рефакторинг
    `DepartmentHotspot` в client-компонент неизбежно потребует переноса разметки, поведение
    `:hover`/`:focus` + `aria-describedby` должно быть побайтово сохранено и перепроверено тем же
    классом тестов, что и в Step 3.
  - **Server/client граница (уже зафиксированное ограничение Step 2, не новое решение):**
    `src/content/*.ts` (zod-adapter'ы) остаются server-only. Новый `'use client'`-компонент
    (состояние `hero`/`overview` через `useState`/`useReducer`) получает данные (`HomepageCopy`,
    `Department[]`, `OfficeZone[]`) только как plain-serializable props от компонента-предка без
    директивы `'use client'`, а не через прямой импорт adapter'ов. Практическое следствие:
    `HomepageShell.tsx`/`HeroCopy.tsx`/`OfficeExperience.tsx` разделяются на server-обёртку
    (получает данные через adapter'ы) + client-часть (держит состояние раскрытия и передаёт
    `isRevealed`/`onActivate` вниз по дереву).
  - **Расположение состояния** — `src/features/office-machine/` (уже указан в дереве каталогов
    `docs/09` "Возможная структура" как owner фичи "state machine"); единственное состояние в этом
    шаге — `hero`/`overview` через `useState`/`useReducer` (решение по OQ-1).
  - **Keyboard/focus для hero → overview:** скрытые до `ACTIVATE_CTA` хотспоты не должны быть в
    Tab-последовательности, пока скрыты (не полагаться на визуальное `opacity:0`, если элемент при
    этом остаётся focusable); после раскрытия — Tab обходит все 5 в том же порядке, что в Step 3.
    `Enter`/`Space` на видимом hotspot остаётся no-op, как в Step 3 (см. `docs/11-accessibility.md`
    "Keyboard" — Escape/Enter-открывает относятся к выбору отдела, которого в Step 4 нет; это
    поведение переносится в Step 5 вместе с остальной логикой выбора).
  - **`prefers-reduced-motion` — сохранение функции, не только длительности.** Step 3 уже обнулил
    CSS transition duration глобально. Раскрытие `hero → overview` по CLAUDE.md Motion rules
    ("critical content must not depend on animation completion") должно быть функционально
    завершено сразу после клика (элемент реально в DOM, focusable, кликабелен), независимо от
    визуальной анимации.
  - **URL при boot.** При наличии `?department=<id>` (валидного или нет) в query string при первой
    загрузке не показывать `hero` — сразу показывается раскрытый `overview` (`docs/05`: "...чтобы
    шаринг ссылки на конкретный отдел не требовал лишнего клика"). Сам отдел не открывается
    автоматически в Step 4 (решение по конфликту OQ-2/OQ-3, см. `DECISIONS.md` 2026-07-15) —
    реальное автоматическое открытие конкретного отдела по ссылке реализует Step 5.
  - **Регрессионное обновление существующих Step 3 тестов:**
    - `src/tests/e2e/office-overview.spec.ts`: `"renders the hero and all 5 department hotspots"` —
      делится на "hero виден сразу, хотспоты скрыты до клика" и "после `ACTIVATE_CTA` видны все 5";
      low-height (1280×500) тест — тоже сначала выполняет `ACTIVATE_CTA`; `"ignores the
      ?department= query string..."` — переписывается: теперь `?department=<любой id>` пропускает
      `hero` и показывает раскрытый `overview` сразу (не "не влияет на рендер", как было в Step 3, —
      это намеренная, честно задокументированная инверсия, а не тихая регрессия теста).
    - `src/tests/e2e/office-overview-keyboard.spec.ts`: Tab-порядок и reduced-motion-тест — должны
      сначала выполнить `ACTIVATE_CTA` (клик/Enter на CTA), прежде чем измерять хотспоты;
      `"Enter/Space on a hotspot is a no-op"` — остаётся в силе без инверсии, только дополняется
      предварительным `ACTIVATE_CTA`-шагом (хотспоты по-прежнему no-op — выбор отдела не входит в
      Step 4).
    - `src/tests/unit/components/homepage/hero-copy.test.tsx`,
      `src/tests/unit/components/office/department-hotspot.test.tsx`,
      `src/tests/unit/components/office/office-semantic-map.test.tsx` — обновляются под новый
      `isRevealed`-подобный проп (видимость после `ACTIVATE_CTA`); `onSelect`/`onClick` для выбора
      отдела не добавляется (вне scope Step 4).
  - **Новые unit-тесты для `office-machine`** (`src/tests/unit/features/office-machine/*`):
    начальное состояние — `hero` (отделы скрыты); `ACTIVATE_CTA` → `overview` (отделы раскрыты).
    Единственное состояние в этом шаге — `SELECT_DEPARTMENT` не тестируется, потому что не
    реализуется.
  - Новые/обновлённые e2e-тесты: скрытие хотспотов до клика при включённом JS, реальное раскрытие по
    клику любой CTA, отсутствие console errors и заметного "мигания" видимых-затем-скрытых хотспотов
    при первой загрузке с включённым JS (см. Risks), low-height fallback после раскрытия `overview`.
- Out of scope:
  - Явное состояние выбора отдела целиком (`SELECT_DEPARTMENT`/`CLOSE_DEPARTMENT`/`ESCAPE`,
    `opening`/`active`/`switching`/`closing`), автоматическое открытие конкретного отдела по прямому
    URL, обновление URL при выборе отдела, полная 10/90-раскладка, `DepartmentNavigationRail`,
    содержимое отдела (сцена, до/после, outcome-панель, `DepartmentCTA`) — **на момент закрытия
    Step 4 целиком переходило в тогдашний "Step 5"** (решение пользователя по OQ-2/OQ-3, см.
    `DECISIONS.md` 2026-07-15; см. также Risks ниже про расширенный scope Step 5). **После
    Amendment 3 (`DECISIONS.md` 2026-07-15, "Step 5: разбиение на два отдельных шага") этот объём
    разделён: state machine/выбор отдела — Step 5 ("Department selection state machine"); полная
    10/90-раскладка, `DepartmentNavigationRail`, `DepartmentCopy`/`OutcomePanel`/`DepartmentCTA` —
    Step 6 ("Desktop 10/90 shell"); `DepartmentScene`/`BeforeAfterSequence` решением по OQ-C не
    создаются вовсе ни в одном шаге.**
  - `beforeSteps`/`automationSteps`/структурированный `visual` — физически отсутствуют в
    `data/departments.json` (известный, принятый gap Step 2); Step 4 не полагается на них.
  - GSAP, любые motion-timeline библиотеки, Zustand — не вводятся (решения по OQ-1 и по уже
    принятому исключению GSAP); переходы состояния реализуются `useState`/`useReducer` +
    show/hide через классы/атрибуты, не анимационным движком.
  - Полноценный `error-fallback` (`FallbackExperience`) — на момент закрытия Step 4 это был Step 7
    ("Reduced motion and fallback"); **после Amendment 3 (`DECISIONS.md` 2026-07-15) — Step 8**,
    часть текущего (ныне 9-шагового) milestone.
  - Диагностика (`OPEN_DIAGNOSTIC`, `diagnostic-*`), `contact-open` — вне scope всего текущего
    (на момент закрытия Step 4 — 8-шагового, ныне 9-шагового после Amendment 3, Steps 1–9), не
    только Step 4; см. уже утверждённую формулировку Step 3.
    Появляются только в `docs/13` Этап 8 — отдельной будущей макро-фазе, не одном из Steps 1–9.
  - Mobile/tablet-раскладка и touch-специфика (`docs/08` Tablet/Mobile) — на момент закрытия Step 4
    это был Step 6; **после Amendment 3 — Step 7**; ручная проверка
    Step 4 — desktop ≥1280px, как в Step 3.
  - Правка `data/departments.json`, `MANIFEST.json`, CI pipeline.
- Dependencies: Step 3 (`COMPLETED`). OQ-1/OQ-2/OQ-3 получили ответ пользователя 2026-07-15 (см.
  `DECISIONS.md`) — открытых вопросов для этого шага больше нет.
- Expected files:
  - `src/features/office-machine/*` — новый модуль состояния (`useState`/`useReducer`, без новой
    npm-зависимости).
  - `src/components/homepage/HomepageShell.tsx` (+ `.module.css`) — разделение на server-обёртку
    (данные) + client-часть (состояние `hero`/`overview`); чтение `searchParams` для определения
    boot-поведения при `?department=<id>`.
  - `src/components/homepage/HeroCopy.tsx` (+ `.module.css`) — CTA-обработчики (`onClick` на обе
    CTA, вызывающие `ACTIVATE_CTA`).
  - `src/components/office/OfficeExperience.tsx`, `OfficeSemanticMap.tsx`, `DepartmentHotspot.tsx`
    (+ `.module.css`) — видимость хотспотов зависит от `isRevealed`-подобного пропа; `onClick`
    хотспота остаётся no-op, как в Step 3 (выбор отдела не входит в Step 4).
  - `src/app/page.tsx` — проброс `searchParams` вниз для чтения `?department=<id>` при boot.
  - `src/app/layout.tsx` — **условно**: только если выбранная техника анти-flash требует
    блокирующего inline-скрипта в `<head>`; при выборе `<noscript>`-дублирования — не требуется
    (инженерный выбор исполнения, не пользовательское решение — см. Risks).
  - Обновления существующих тестов, перечисленных в In scope выше (unit + e2e).
  - Новые unit-тесты `src/tests/unit/features/office-machine/*`.
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md` (процессные).
- Acceptance criteria:
  1. При включённом JavaScript хотспоты не видны и не focusable до клика по `primaryCta` ИЛИ
     `secondaryCta`; после клика — все 5 видны, focusable, `overviewLabel`/`overviewProblem`
     идентичны Step 3 (регрессии нет).
  2. Без JavaScript поведение полностью идентично текущему Step 3 (все существующие
     `javaScriptEnabled: false`-тесты продолжают проходить без изменений в своих ожиданиях).
  3. Нет заметного "мигания" видимых-затем-скрытых хотспотов при первой загрузке с включённым JS, и
     нет hydration-mismatch предупреждений в консоли браузера.
  4. Скрытые до `ACTIVATE_CTA` хотспоты не встречаются в Tab-последовательности; после раскрытия —
     все 5 доступны по Tab в прежнем порядке; `Enter`/`Space` на видимом hotspot остаётся no-op.
  5. `?department=<id>` (валидный или нет) при первой загрузке пропускает `hero` и показывает
     раскрытый `overview`; сам отдел не открывается автоматически (это — задача Step 5).
  6. `?department=<невалидный id>` не приводит к ошибке/пустой странице — деградирует к обычному
     раскрытому `overview`.
  7. `prefers-reduced-motion: reduce` — раскрытие `hero → overview` функционально завершено сразу
     после клика независимо от визуальной анимации (не только длительность перехода).
  8. Low-height fallback (`docs/08`, `@media (max-height: 700px)`, 1280×500) продолжает работать
     после раскрытия `overview`: заголовок/CTA не обрезаны, документ не скроллится целиком.
  9. Ни один client-компонент не импортирует `src/content/*` напрямую (grep-проверка, по прецеденту
     Step 3 "grep на `'use client'`").
  10. Существующие Step 3 тесты, чьи ожидания намеренно инвертированы или дополнены Step 4, реально
      обновлены корректно — не удалены без честной замены и не оставлены описывать устаревшее
      поведение (см. In scope, "Регрессионное обновление...").
  11. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  12. `git diff --stat` относительно коммита закрытия Step 3 ограничен списком Expected files.
  13. `DECISIONS.md` содержит записи по OQ-1/OQ-2/OQ-3 и по конфликту OQ-2/OQ-3 с реальным
      согласованием пользователя, а не проставленные исполнителем.
- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  npm run dev    # ручная проверка, см. Manual checks, затем остановить процесс
  ```
- Manual checks:
  - Открыть `http://localhost:3100`: hero виден сразу, хотспоты не видны; клик по `primaryCta` и
    отдельно по `secondaryCta` (в двух разных прогонах) раскрывает все 5 отделов; hover/focus
    по-прежнему раскрывает `overviewProblem` как в Step 3.
  - Клавиатура: Tab до раскрытия не достигает hotspot'ов; после раскрытия — достигает всех 5 в том
    же порядке, что в Step 3; Enter/Space на hotspot остаётся no-op.
  - Прямой переход на `http://localhost:3100/?department=sales` — подтвердить: `hero` пропущен,
    `overview` раскрыт сразу, отдел `sales` НЕ открыт автоматически (это ожидаемо — реализуется в
    Step 5).
  - `prefers-reduced-motion: reduce` в DevTools — раскрытие `hero → overview` по-прежнему
    функционально.
  - Отключить JavaScript, перезагрузить `/` — поведение идентично Step 3 (все 5 видны сразу).
  - Проверить 1280×500 (low-height) после раскрытия `overview` — заголовок/CTA не обрезаны.
  - `git diff --stat` относительно коммита закрытия Step 3 — подтвердить рамки Expected files.
- Risks:
  - **Server/client рефакторинг существующих Step 3 компонентов** — первый в проекте случай, когда
    компоненты, спроектированные как чистые Server Components, должны получить клиентскую
    интерактивность; реальный риск случайно протащить `src/content/*` (zod) в client-бандл —
    смягчается grep-проверкой (acceptance criterion 9) и `frontend-architect` review на milestone.
  - **Техника анти-flash не решена planner'ом сознательно** (нетривиальный инженерный выбор, не
    вопрос уровня пользователя): (a) блокирующий inline-скрипт в `<head>`, переключающий класс
    `<html>` синхронно до первой отрисовки — стандартный паттерн, но первое появление raw-`<script>`
    в проекте, требует проверки на отсутствие hydration warnings; (b) дублирование разметки через
    `<noscript>` — не требует скрипта, но дублирует контент и требует держать два представления
    синхронными. Оставлено исполнителю на момент реализации, обязательна проверка skeptic на
    отсутствие flash и hydration-mismatch предупреждений в обоих e2e-прогонах (JS on/off).
  - **Регрессия на уже сформулированных Step 3 тестах**, описывающих поведение, которое Step 4
    целенаправленно меняет (в частности, `"ignores the ?department= query string"`, теперь честно
    инвертированный) — риск того, что при коррекции эти тесты будут молча ослаблены/удалены вместо
    честной замены, повторяя класс проблемы из Step 3 round 2. Явно перечислены в In scope/Expected
    files, чтобы не повториться.
  - **Существенно расширенный scope Step 5** (важно не потерять при планировании того шага):
    решение пользователя оставить Step 4 минимальным (OQ-2 = (c)) и отложить авто-открытие отдела
    по ссылке (OQ-3-конфликт) означает, что Step 5 ("Desktop 10/90 shell") теперь должен реализовать
    **одновременно**: (а) полную 10/90-раскладку и панель отделов (уже было в его исходной
    формулировке), (б) полную state machine выбора отдела с нуля (`SELECT_DEPARTMENT`/
    `CLOSE_DEPARTMENT`/`ESCAPE`/`opening`/`active`/`switching`/`closing`, включая Enter/Space
    инверсию текущего no-op теста), (в) реальное автоматическое открытие конкретного отдела по
    прямому URL (`?department=<id>` → сразу `department-active`, что потребует honesty-правки
    `docs/05` по прецеденту Step 3, так как текущая формулировка документа этого не описывает). Это
    больший объём работы для одного будущего шага, чем предполагала исходная грубая формулировка
    Step 5 в этом файле — при детальном планировании Step 5 (planner + skeptic review плана) это
    нужно явно учесть, возможно разбив Step 5 на явно выделенные под-этапы верификации.
    **Разрешено при планировании (2026-07-15): именно это и произошло** — planner вынес вопрос
    разбиения как OQ-D, пользователь выбрал формальное разбиение (Amendment 3, см.
    `DECISIONS.md`): "Step 5" из этого абзаца теперь называется **"Step 6 — Desktop 10/90 shell"**,
    а state machine выбора отдела ((б)/(в) из перечисления выше) стала отдельным **новым
    "Step 5 — Department selection state machine"**.
  - **Low-height fallback (Step 3 correction) взаимодействие с hidden-by-default хотспотами** —
    `min-height: 340px` на `.zoneList` при `max-height: 700px` рассчитан для уже видимых хотспотов;
    нужно перепроверить, что раскрытие после `ACTIVATE_CTA` на 1280×500 не ломает уже
    зафиксированные измерения (81.6–122.4px).
  - Scope creep: соблазн реализовать реальную 10/90-раскладку или выбор отдела "заодно" — явно
    отклоняется ссылкой на решение пользователя и уже утверждённый (на тот момент 8-шаговый, ныне
    9-шаговый после Amendment 3) скелет (Step 5/Step 6 — отдельные шаги).
- Rollback: `git revert` диапазона коммитов Step 4 (аддитивно относительно Step 3: новый
  state-модуль + точечные правки существующих компонентов/тестов). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя, как в предыдущих шагах.
- Skeptic verdict (review плана, Phase A): **rounds 1–6** — полная история черновика с открытыми
  вопросами, финальный `PASS` в round 6 (`94a0ebc`) — см. предыдущую версию этой секции в git
  history для полного текста round 1–6. **round 7** (review финализированной версии плана после
  ответов пользователя на OQ-1/OQ-2/OQ-3 и разрешения конфликта OQ-2/OQ-3) — `FAIL`: строка Status
  всё ещё утверждала, что план "не может получить APPROVED до ответа пользователя", хотя ответы уже
  были получены и зафиксированы во всей остальной секции — исправлено в `78feaa3`. **round 8**
  (проверка точечного исправления round 7) — `FAIL`: исправленная строка Status и сами эти поля
  (Skeptic verdict/findings) всё ещё описывали round 7 как "ожидающийся"/"ожидает вызова", хотя он
  уже состоялся и вернул `FAIL` — исправлено в `8aaa78f`. **round 9** (финальная проверка
  согласованности bookkeeping-полей Status/Skeptic verdict/Skeptic findings/Completion evidence
  после round 8) — `PASS`: все поля независимо подтверждены согласованными друг с другом и с
  реальной `git log` историей; содержательная часть плана (не тронутая с round 7) остаётся в силе.
- Skeptic findings (Phase A): round 7 — Major (устаревшая формулировка Status); round 8 — Major
  (несогласованность нумерации раундов в тех же полях); round 9 — Blocker/Critical/Major/Minor нет.
  Оба класса находок round 7/8 устранены точечными правками без изменения scope/содержания плана;
  round 9 подтвердил отсутствие рецидива той же ошибки.
- Skeptic verdict (review исполнения, Phase B, коммит `820b87a`): `PASS` — с первого раунда review
  исполнения, без FAIL/BLOCKED. Независимо перепроверены: grep-подтверждение единственного
  `'use client'`-файла в проекте и отсутствия прямых импортов `src/content/*` из него;
  `git diff HEAD~1 -- DepartmentHotspot.tsx` пуст (файл действительно не менялся); архитектурная
  надёжность anti-flash техники (порядок `<head>`: `<link rel="stylesheet">` перед блокирующим
  `<script>` — рендеринг блокируется до применения `.js`-класса, не полагается на удачный тайминг);
  независимый повторный прогон всех 6 verification commands + `test:e2e --repeat-each=5` (80/80,
  строже заявленного `--repeat-each=3`); все 13 acceptance criteria проверены по отдельности с
  конкретными доказательствами; `git diff --stat f3f2b58 820b87a` (20 файлов, в рамках Expected
  files плюс 2 честно раскрytых отклонения); `package.json`/`package-lock.json` diff пуст
  (подтверждён отказ от Zustand, OQ-1).
- Skeptic findings (Phase B): Blocker/Critical/Major — нет. Minor: (1) тест
  `office-experience.test.tsx` по названию заявляет проверку CSS-класса `hiddenUntilRevealed`, но
  фактически проверяет только атрибут `data-revealed` — компенсируется e2e-тестами, функционального
  пробела нет; (2) несущественная неточность в промпте review (упоминание "4 записей DECISIONS.md"
  вместо фактических 3 — ответ на OQ-3 включён в запись про конфликт OQ-2/OQ-3) — не дефект
  реализации.
- Completion evidence: `WORKLOG.md`, Entry 4; независимый повторный прогон всех 6 verification
  commands (55/55 unit, 16/16 e2e, дополнительно 80/80 при `--repeat-each=5`); `git diff --stat
  f3f2b58 820b87a`; grep на `'use client'` и на импорты `@/content/*` — подтверждена корректность
  server/client границы; `git diff HEAD~1 -- DepartmentHotspot.tsx` пуст; `package.json`/
  `package-lock.json` diff пуст.

### Open questions (Step 4) — RESOLVED 2026-07-15

Все три вопроса заданы пользователю напрямую через `AskUserQuestion` 2026-07-15. Ответы:
**OQ-1 = (a)** `useState`/`useReducer`; **OQ-2 = (c)** Step 4 не реализует выбор отдела вовсе;
**OQ-3 (для boot-поведения Step 4) = (a)** пропустить только `hero`, отдел не открывается
автоматически. Пользователь изначально выбрал OQ-3 = (b) (сразу открывать отдел по ссылке), что
противоречило уже выбранному OQ-2 = (c) — плану самому пришлось указать на этот конфликт
пользователю перед тем, как зафиксировать ответ (см. `DECISIONS.md` 2026-07-15, "конфликт
OQ-2/OQ-3"); пользователь разрешил конфликт, оставив OQ-2 = (c) и перенеся реальное
автоматическое открытие отдела по ссылке в Step 5. Полный текст вопросов и вариантов сохранён
ниже для истории/трассируемости — решения уже зафиксированы в основной секции Step 4 выше и в
`DECISIONS.md`, дальнейших действий по этому разделу не требуется.

**OQ-1. Библиотека состояния для `office-machine`.**
`docs/09` перечисляет Zustand в "Стек" без альтернативы, но Step 1 явно отнёс Zustand к
"Out of scope" как то, что появится позже вместе с "любой клиентской интерактивностью офиса" — то
есть именно сейчас. Варианты:
- (a) `useState`/`useReducer` внутри одного нового client-компонента — без новой зависимости,
  минимальный риск, но потребует рефакторинга при росте состояния в будущих Этапах.
- (b) React Context + `useReducer` — без новой зависимости, избегает prop-drilling через дерево
  `HomepageShell → OfficeExperience → OfficeSemanticMap → DepartmentHotspot`, но полностью
  самописный код без готовых паттернов подписки/селекторов.
- (c) Zustand — новая npm-зависимость (по прецеденту `zod`, требует отдельного согласования и
  записи в `DECISIONS.md`, а не молчаливого добавления "раз упомянут в docs/09"); внешний store,
  проще расширять для будущих Diagnostic/Calculator состояний, но вводится раньше, чем того требует
  нынешний объём состояния (`viewMode` + `activeDepartmentId` + `previewDepartmentId`-заглушка).

**OQ-2. Граница Step 4 / Step 5 по глубине состояний выбора отдела.** _(Добавлен вариант (c) после
`FAIL` review плана — skeptic указал, что исходные (a)/(b) оба уже молча предполагали, что
`SELECT_DEPARTMENT` входит в Step 4, хотя буквальная, уже утверждённая формулировка Step 5
("Реализовать выбор, панель отделов и основное поле") прямо назначает "выбор" именно Step 5.)_
- (a) Step 4 реализует ПОЛНЫЙ набор состояний из `docs/05` (`opening → active ↔ switching →
  closing`), включая переходы, но с намеренно минимальным, не финальным UI-отличием
  `overview`/`active` (например, простой неоформленный блок с `department.headline`/`problem`/
  `outcomes`, без 10/90-разбивки, без `DepartmentNavigationRail`/сцены); Step 5 переоформляет уже
  работающую state machine в реальную 10/90-раскладку, не трогая логику переходов.
- (b) Step 4 реализует ТОЛЬКО `hero → overview` (`ACTIVATE_CTA`) плюс упрощённый бинарный
  `SELECT_DEPARTMENT`/`CLOSE_DEPARTMENT` (без промежуточных `opening`/`closing`-подсостояний и без
  какого-либо видимого контента отдела); Step 5 реализует поверх уже существующего бинарного
  состояния одновременно и 10/90-раскладку, и полноценные `opening/switching/closing`-переходы.
- (c) Step 4 не реализует выбор отдела вовсе — ограничивается только `hero ↔ overview` (раскрытие
  пяти скрытых хотспотов по `ACTIVATE_CTA`); хотспоты после раскрытия остаются no-op при клике/
  Enter/Space, как в Step 3, до тех пор, пока Step 5 не реализует `SELECT_DEPARTMENT`/
  `CLOSE_DEPARTMENT`/URL-sync/`opening`/`active`/`switching`/`closing` с нуля вместе с
  10/90-раскладкой.

(Замечание по всем трём вариантам, для справки, не как аргумент в пользу одного из них: `docs/05`
описывает полный набор `opening/active/switching/closing`, а уже утверждённая формулировка Step 5
— "Реализовать выбор, панель отделов и основное поле" — упоминает "выбор" как часть Step 5. Вариант
(a) реализует состояния `docs/05` раньше, чем их обычно ожидал бы читатель Step 5; вариант (c)
реализует ровно то распределение, которое буквально следует из формулировки Step 5; вариант (b) —
промежуточный. Ни одно из этих совпадений само по себе не делает вариант более или менее
правильным — это вопрос того, где на практике удобнее провести границу между шагами, а не вопрос
соответствия документам.)

**OQ-3. Поведение прямого URL `?department=<id>` при первой загрузке (`boot`).**
Буквальный текст `docs/05` (раздел `hero`): "Прямой URL с `?department=<id>` пропускает `hero` и
открывает сразу `overview`" — дословно НЕ говорит, что сам отдел при этом автоматически открывается
(`department-active`), только что пропускается экран `hero`. Это создаёт напряжение с инвариантом
того же документа "выбранный отдел синхронизирован с URL" и с правилом CLAUDE.md "Make departments
directly addressable by URL", которые интуитивно предполагают, что ссылка на конкретный отдел
должна открывать именно его. Варианты:
- (a) буквально по тексту: пропустить `hero`, показать `overview`, отдел НЕ открывается
  автоматически — пользователь всё равно должен кликнуть.
- (b) пропустить и `hero`, и `overview`: сразу открыть `department-active` для указанного `id` —
  требует уточняющей правки `docs/05` (по прецеденту "honesty-правки" из Step 3), поскольку текущая
  формулировка это не описывает. **Применимо только если OQ-2 ≠ (c)** — если Step 4 не реализует
  выбор отдела вовсе (OQ-2 = (c)), открыть `department-active` физически нечем, и вариант (a)
  остаётся единственно возможным независимо от ответа на этот вопрос.

## Step 5 — Department selection state machine

- Status: `COMPLETED` (пользователь явно подтвердил закрытие, 2026-07-16: «Подтверждаю закрытие
  Step 5. Продолжай согласно плану.» — недвусмысленное согласие, в отличие от истолкованного
  approval на старт реализации ниже)
- Status history: `PASSED` (реализация выполнена; все verification commands реально прогнаны
  (см. `WORKLOG.md`, Entry 5) — format:check/lint/typecheck/test (86/86)/build/test:e2e (27/27,
  затем `--repeat-each=3` → 81/81) — все exit 0; отдельная обязательная dev-mode проверка (`npm run
  dev`) — 0 подозрительных console-сообщений. В ходе первого прогона `test:e2e` найден и исправлен
  реальный CSS-баг (сжатие `.zoneList` ниже кликабельного размера при появлении временного блока
  отдела — см. WORKLOG Entry 5 "Найденный и исправленный реальный баг"). Skeptic review исполнения
  прошёл 2 раунда (round 1 `FAIL` → фикс → round 2 `PASS`, финальный) — см. Skeptic verdict (Phase
  B) ниже. Предъявлено пользователю и явно утверждено закрытие. **Полная формулировка
  трактовки одобрения на старт реализации** (перенесено сюда,
  чтобы перекрёстная ссылка из `WORKLOG.md` Entry 5 указывала на реально существующий текст, а не
  в пустоту — находка skeptic review исполнения, см. Skeptic findings (Phase B) ниже): план
  Step 5/Step 6 был представлен пользователю с прямым вопросом "Подтверждаете начало реализации
  Step 5?"; пользователь ответил, 2026-07-15: «Я до сих пор не вижу оформление. Если это до сих
  пор должно быть так. то продолжаем.» Это не буквальный ответ на заданный вопрос — пользователь
  поднял отдельный, уже ранее в этой сессии обсуждённый вопрос (отсутствие визуального оформления
  ожидаемо для текущего low-fidelity milestone, CLAUDE.md "First milestone", что уже было
  подтверждено пользователю до этого момента) и обусловил продолжение работы этим. Основная сессия
  истолковала "то продолжаем" как согласие продолжить (то есть начать реализацию Step 5) при
  выполнении уже подтверждённого условия — это единственная содержательная интерпретация фразы в
  контексте прямого вопроса, на который она отвечает, но это интерпретация, а не буквальное "да",
  и честно зафиксирована как таковая, а не представлена как недвусмысленное согласие.)
- Objective: Реализовать полную state machine выбора отдела с нуля (`SELECT_DEPARTMENT`/
  `CLOSE_DEPARTMENT`/`ESCAPE`, переходы `opening → active ↔ switching → closing` по
  `docs/05-homepage-state-machine.md`) — весь объём "выбора отдела", явно перенесённый сюда
  решением пользователя при планировании Step 4 (OQ-2 = (c) + разрешение конфликта OQ-2/OQ-3, см.
  `DECISIONS.md` 2026-07-15): Step 4 сознательно не реализовал ничего из выбора отдела, поэтому
  этот шаг строит его целиком, а не расширяет существующий код. Хотспоты (клик/Enter/Space),
  остававшиеся no-op в Step 3/4, инвертируются в этом шаге — становятся реальным
  `SELECT_DEPARTMENT`/`SWITCH_DEPARTMENT` с нативной семантикой `<button>`. Также реализуется
  реальное автоматическое открытие конкретного отдела по прямому URL `?department=<id>` при первой
  загрузке (не только пропуск `hero`, который уже делает Step 4) и синхронизация URL при
  последующем клиентском выборе/переключении/закрытии отдела без полной перезагрузки страницы.

  Переходы `opening/switching/closing` реализуются CSS-классами, управляемыми состоянием редьюсера
  — тем же паттерном, что уже использован для `hero ↔ overview` в Step 4 (решение пользователя по
  OQ-A, см. `DECISIONS.md` 2026-07-15 "Step 5: механизм переходов opening/switching/closing
  (OQ-A)"; GSAP не вводится). Синхронизация URL реализуется сырым `history.pushState`/
  `replaceState`, без `next/navigation` `useRouter`/`useSearchParams` (решение пользователя по
  OQ-B, см. `DECISIONS.md` 2026-07-15 "Step 5: механизм синхронизации URL... (OQ-B)").

  Это требует ещё одной honesty-правки `docs/05` (по прецеденту Step 3, "honesty-правка docs/05
  после skeptic FAIL") — текущая формулировка раздела `hero` документа описывает только пропуск
  `hero` при прямом URL, не автооткрытие самого отдела; кроме того, разделы `department-opening`/
  `department-active`/`department-switching`/`department-closing` документа буквально описывают
  уже готовую 10/90-оболочку ("Оболочка 10/90 сохраняется"), которой в этом шаге ещё не существует
  (10/90-раскладка — отдельный, следующий "Step 6 — Desktop 10/90 shell"). Правка выполняется как
  часть этого шага, а не тихо откладывается, и явно раскрывает оба разрыва документ/код.

  Содержимое отдела в этом шаге — намеренно минимальный, неоформленный блок: простой контейнер с
  `headline`/`problem`/`symptoms` (не более 3 показанных — `docs/12` "максимум три симптома в
  основном UI", данные уже содержат ровно 3)/`outcomes[]`/CTA и явной кнопкой «Закрыть», без
  10/90-раскладки и без `DepartmentNavigationRail` — полноценная 10/90-раскладка,
  `DepartmentNavigationRail` и компонентное дерево `DepartmentExperience`/`DepartmentCopy`/
  `OutcomePanel`/`DepartmentCTA` формально перенесены в отдельный "Step 6 — Desktop 10/90 shell"
  (решение пользователя по OQ-D, "Amendment 3", см. `DECISIONS.md` 2026-07-15; см. также
  Dependencies шага "Step 6 — Desktop 10/90 shell" ниже). Решение о глубине содержимого
  90%-области (OQ-C — только `DepartmentCopy`/`OutcomePanel`/`DepartmentCTA`, без
  `DepartmentScene`/`BeforeAfterSequence`) относится к архитектуре компонентного дерева именно
  Step 6, а не к этому шагу: минимальный блок этого шага не пытается предвосхитить ту архитектуру —
  это временный, явно одноразовый код, который Step 6 полностью заменяет, а не расширяет.

  Учтено процессное требование, добавленное после инцидента Step 4 (реальный, пропущенный и
  исполнителем, и skeptic'ом hydration-mismatch баг, видимый только в `npm run dev`, а не в
  production-сборке): Verification commands и Manual checks этого шага обязательно включают
  отдельную, реально выполняемую проверку консоли браузера именно в dev-режиме (не только
  `npm run build && npm run start`), см. ниже.
- In scope:
  - **Состояние (`src/features/office-machine/reducer.ts`, переписывается).** Полный набор
    состояний из `docs/05`, наблюдаемых извне: `hero`, `overview`, `department-opening`,
    `department-active`, `department-switching`, `department-closing`. Действия: уже существующее
    `ACTIVATE_CTA`, плюс новые `SELECT_DEPARTMENT(id)`, `OPEN_COMPLETE`, `SWITCH_DEPARTMENT(id)`,
    `SWITCH_COMPLETE`, `CLOSE_DEPARTMENT`, `CLOSE_COMPLETE`, `ESCAPE`. Состояние хранит
    `activeDepartmentId: DepartmentId | null` и id хотспота, на который нужно вернуть focus при
    закрытии (`docs/11` "после закрытия focus возвращается").
  - **Инверсия no-op хотспотов.** `DepartmentHotspot` получает реальный `onClick`: из `overview` —
    диспетчерит `SELECT_DEPARTMENT`; при уже активном другом отделе — диспетчерит
    `SWITCH_DEPARTMENT`; клик по хотспоту уже активного отдела — no-op (отдел не переоткрывается
    сам на себя). Нативный `<button type="button">` уже обеспечивает идентичное поведение
    `Enter`/`Space` без отдельного `onKeyDown`. Существующий e2e-тест "Enter/Space on a hotspot is
    a no-op" инвертируется честно (переписывается, не удаляется молча) — по прямому прецеденту,
    уже описанному в Step 4 Risks.
  - **Временный способ доступа к переключению между отделами без `DepartmentNavigationRail`.** Так
    как `DepartmentNavigationRail` и 10/90-раскладка — Step 6, а `department-switching`
    (переключение без возврата в overview) всё же должно быть реально тестируемо уже в этом шаге,
    все 5 хотспотов overview остаются одновременно видимыми и кликабельными рядом с минимальным
    блоком содержимого активного отдела (без скрытия карты, без 10/90-разбивки) — технический
    выбор исполнения (низкий риск, полностью заменяется `DepartmentNavigationRail`/10-90
    раскладкой в Step 6, по прецеденту "технических решений planner'а, не требующих отдельного
    вопроса" — Step 3 сортировка хотспотов), необходимый только для того, чтобы состояние
    `department-switching` было реально доступно и проверяемо в этом шаге, а не предвосхищение
    архитектуры Step 6.
  - **Минимальное содержимое отдела** — простой, неоформленный блок (не отдельный именованный
    компонент из дерева `docs/09`, временный код, целиком заменяемый в Step 6): `headline`,
    `problem`, `symptoms` (максимум 3), `outcomes[]` (список), `ctaLabel` (видимая, но no-op
    кнопка — нет реального адресата лида/CRM ни в этом шаге, ни во всём текущем 9-шаговом
    milestone, как и `primaryCta`), явная кнопка «Закрыть».
  - **Явная кнопка «Закрыть»** внутри активного отдела — доступна мышью/клавиатурой, производит
    тот же эффект, что и `Escape` (не полагаться только на `Escape`, чтобы не создавать
    зависимость от одной модальности управления).
  - **Escape.** Глобальный обработчик, пока активен отдел: диспетчерит закрытие, возвращает в
    `overview`, переносит focus на исходную кнопку-хотспот (`docs/11`).
  - **Focus при `department-opening`.** Focus переносится на заголовок открытого отдела
    (программно фокусируемый, например `tabindex="-1"` + `.focus()`), как того требует `docs/05`.
  - **Focus при закрытии.** Focus программно возвращается на кнопку-хотспот, которая изначально
    открыла отдел — редьюсер хранит её id для этой цели.
  - **Контент не зависит от завершения анимации** (Motion rules CLAUDE.md: "critical content must
    not depend on animation completion") — `headline`/`problem`/`symptoms`/`outcomes`/CTA/кнопка
    «Закрыть» присутствуют в DOM и интерактивны сразу по диспетчу `SELECT_DEPARTMENT`/
    `SWITCH_DEPARTMENT`, независимо от завершения визуального перехода `opening`/`switching`/
    `closing`.
  - **Переходы `opening`/`switching`/`closing` — CSS-классы, управляемые редьюсером** (решение
    OQ-A): момент завершения перехода определяется через `transitionend` для диспетча
    `OPEN_COMPLETE`/`SWITCH_COMPLETE`/`CLOSE_COMPLETE`; ориентировочная длительность — по
    `docs/07-motion-system.md` ("Уровень Transition": overview → department 650–1000мс,
    department switch 450–800мс, close 550–900мс) — ориентир, не строгий acceptance-критерий.
  - **URL при boot.** `src/app/page.tsx` продолжает читать `searchParams` на сервере; при валидном
    `?department=<id>` (сверяется с `getDepartmentIds()`) клиентская машина стартует сразу в
    `department-active` для этого id, без видимого перехода `hero`/`overview` и без анимации
    `opening` (открытие по прямой ссылке — не пользовательское действие, аналогично тому, как
    Step 4 уже не анимирует пропуск `hero` при boot). При невалидном/несуществующем `id` —
    деградация к обычному раскрытому `overview` (регресс уже существующего acceptance criterion
    Step 4, перепроверяется против нового кода).
  - **URL при клиентском выборе/переключении/закрытии** (механизм — решение OQ-B,
    `history.pushState`/`replaceState`): `SELECT_DEPARTMENT`/`SWITCH_DEPARTMENT` устанавливают
    `?department=<id>` в адресной строке без полной перезагрузки страницы; `CLOSE_DEPARTMENT`/
    `ESCAPE` убирают параметр, возвращая `/`. Поддержка кнопок «назад»/«вперёд» браузера явно вне
    scope (см. Out of scope) — сознательно поднятое, а не тихо забытое ограничение.
  - **Двойная honesty-правка `docs/05-homepage-state-machine.md`**: (a) раздел `hero` — прямой URL
    с валидным `?department=<id>` теперь честно описан как открывающий сам `department-active`, а
    не только `overview`; (b) разделы `department-opening`/`department-active`/
    `department-switching`/`department-closing` — добавляется пометка "Статус реализации
    (актуально после Step 5)", честно фиксирующая, что state machine/URL-sync/focus management
    реальны, а "Оболочка 10/90" (буквальная формулировка раздела `department-switching`) — ещё не
    реализована (временный минимальный блок вместо неё; реализуется в Step 6).
  - **`prefers-reduced-motion`.** Переходы `opening`/`switching`/`closing` — без параллакса/
    камерных перелётов, заменяются коротким fade либо мгновенным переключением (`docs/07`
    "Reduced motion"); все функциональные критерии (focus, URL, доступность контента) идентичны с
    включённой и выключенной анимацией.
  - **Базовая регрессия no-scroll invariant.** На desktop ≥1280×800 нет полного документного
    скролла в `department-active` (общий инвариант из Steps 3/4, для нового временного блока);
    полная регрессия low-height fallback (`docs/08` "Низкий desktop", <700px) для финальной
    раскладки — задача Step 6 (временный минимальный блок этого шага не обязан точно
    воспроизводить бюджет высоты финальной 10/90-раскладки — явно поднятое, не молчаливое
    ограничение).
  - **Server/client граница** (уже зафиксированное ограничение Step 2, не новое решение) —
    `src/content/*.ts` остаются server-only; вся новая клиентская логика (редьюсер, URL-sync)
    получает данные только как сериализуемые props, не через прямой импорт adapter'ов.
  - **Новые/обновлённые unit-тесты:** `src/tests/unit/features/office-machine/reducer.test.ts` —
    расширяется на все новые состояния/действия (переходы `opening→active`, `active↔switching`,
    `active→closing→overview`, инварианты: активен максимум один отдел, `ESCAPE` эквивалентен
    закрытию по результату); новые unit-тесты для временного минимального блока содержимого
    отдела.
  - **Новые/обновлённые e2e-тесты**: выбор отдела кликом; выбор отдела клавиатурой (`Enter`/
    `Space` — честная инверсия существующего теста); переключение между двумя отделами без
    возврата в `overview` и без полной перезагрузки (`docs/05` "Не происходит возврата в overview
    и полной перезагрузки"); `Escape` закрывает и возвращает focus; явная кнопка «Закрыть» даёт
    тот же результат; прямой URL с валидным `?department=<id>` открывает отдел сразу для всех 5
    id; невалидный `?department=<id>` деградирует к `overview` без ошибки; `prefers-reduced-motion`
    — переходы функционально работают без анимации; отсутствие console/hydration-mismatch ошибок —
    отдельно в `npm run dev` и отдельно в production-сборке (см. Verification commands).
- Out of scope:
  - Полная 10/90-раскладка, `DepartmentNavigationRail`, реальное компонентное дерево
    `DepartmentExperience`/`DepartmentCopy`/`OutcomePanel`/`DepartmentCTA` (архитектура по OQ-C) —
    целиком "Step 6 — Desktop 10/90 shell" (см. Dependencies этого шага в разделе Step 6).
  - `DepartmentScene`/`BeforeAfterSequence`, `beforeSteps`/`automationSteps`/полный `visual`
    (`docs/12`) — по-прежнему физически отсутствуют в `data/departments.json` (известный gap
    Step 2, без владельца-шага); ни один вариант, реализуемый здесь, не предполагает их наличие.
  - `docs/14` "active не только цветом" для `DepartmentNavigationRail` — не применимо, так как
    rail не существует в этом шаге (переносится в Step 6 вместе с самим компонентом).
  - Регрессионная проверка low-height fallback (<700px) для финальной 10/90-раскладки — Step 6
    (см. In scope выше "Базовая регрессия no-scroll invariant").
  - GSAP — не вводится (решение OQ-A = (b), CSS-классы).
  - `next/navigation` `useRouter`/`useSearchParams` — не используется (решение OQ-B = (b), сырой
    `history.pushState`/`replaceState`).
  - Диагностика (`OPEN_DIAGNOSTIC`, `diagnostic-*`), `contact-open` — вне scope всего текущего
    9-шагового milestone (уже установлено Steps 3/4).
  - Mobile/tablet-раскладка и touch-специфика (`docs/08` Tablet/Mobile) — Step 7 ("Mobile touch
    flow"); ручная проверка этого шага — desktop ≥1280px, как в Steps 3/4.
  - `OfficeVisualLayer`, WebGL/Canvas — по-прежнему не вводятся (owner: перед стартом Step 8
    ("Reduced motion and fallback"); решение Step 3 Risks не пересматривается здесь).
  - Реальная навигация `DepartmentCTA`/хотспотов на `/solutions/*` — эти страницы не существуют
    (`docs/13` Этап 9); `solutionPath` из данных не используется для навигации в этом шаге.
  - Полноценный `error-fallback`/`FallbackExperience` (`docs/05`) — Step 8, как и раньше.
  - Автоматизированное axe-сканирование — по-прежнему owner Step 9 ("Browser acceptance tests").
  - Поддержка кнопок «назад»/«вперёд» браузера (`popstate`) после клиентской смены отдела — явно
    поднятое, не молчаливое ограничение; естественный кандидат для Step 9 или отдельного будущего
    шага.
  - Дозаполнение `data/departments.json` — контентная задача, не назначенная ни одному шагу (уже
    известное решение пользователя, Step 2 Risks/`DECISIONS.md`).
  - Правка `MANIFEST.json`, CI pipeline.
- Dependencies: Step 4 (`COMPLETED`). OQ-A/OQ-B/OQ-C/OQ-D получили ответ пользователя 2026-07-15
  (см. `DECISIONS.md`) — открытых вопросов для этого шага больше нет.
- Expected files:
  - `src/features/office-machine/reducer.ts` (переписывается — новые состояния/действия).
  - `src/features/office-machine/OfficeMachine.tsx` (обновляется — Escape-listener, передача
    `activeDepartmentId`/обработчиков вниз, инициализация из `?department=<id>`).
  - Новый модуль URL-синхронизации (например, `src/features/office-machine/url-sync.ts` или хук
    `useDepartmentUrlSync`) — `history.pushState`/`replaceState` (решение OQ-B).
  - `src/components/office/DepartmentHotspot.tsx` (+ `.module.css`) — реальный `onClick`,
    active-состояние.
  - `src/components/office/OfficeExperience.tsx`, `OfficeSemanticMap.tsx` (+ `.module.css`) —
    временный минимальный блок содержимого отдела рядом с по-прежнему видимыми 5 хотспотами;
    CSS-классы переходов `opening`/`switching`/`closing`.
  - Новый `src/components/office/ActiveDepartmentPanel.tsx` (+ `.module.css`) — сам временный
    минимальный блок содержимого отдела (**добавлено ретроактивной honesty-аннотацией по итогам
    round 2 skeptic review исполнения** — изначально в этом списке был описан только сам факт
    "временный минимальный блок" абзацем выше, без явного имени файла).
  - `src/app/page.tsx` — вычисление/валидация `activeDepartmentId` из `searchParams` через
    `getDepartmentIds()`.
  - `src/components/homepage/HomepageShell.tsx` — проброс `initialDepartmentId` вниз (**добавлено
    той же ретроактивной аннотацией** — вытекает из правки `page.tsx` выше, но не была явно
    названа).
  - `docs/05-homepage-state-machine.md` — двойная honesty-правка (см. In scope).
  - Обновления существующих тестов, перечисленных в In scope (unit + e2e), включая честную
    инверсию теста "Enter/Space on a hotspot is a no-op".
  - Новые unit/e2e тесты, перечисленные в In scope.
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md` (процессные).
- Acceptance criteria:
  1. Клик мышью по любому из 5 хотспотов в `overview` реально открывает соответствующий отдел
     (`department-active`): `headline`/`problem`/`symptoms`/`outcomes`/CTA/кнопка «Закрыть» видны
     и доступны; полной перезагрузки/навигации документа не происходит.
  2. `Enter`/`Space` на сфокусированном хотспоте производит идентичный эффект, что и клик мышью —
     честная инверсия существующего теста "Enter/Space on a hotspot is a no-op" (не удалён молча).
  3. Активен максимум один отдел одновременно (`docs/05`, инвариант).
  4. Клик по хотспоту другого отдела, пока активен первый, переключает отдел напрямую
     (`SWITCH_DEPARTMENT`): содержимое/URL меняются, `overview` не показывается в промежутке, нет
     полной перезагрузки (`docs/05` `department-switching`).
  5. `Escape`, пока активен отдел, закрывает его и возвращает в `overview`; focus программно
     возвращается на кнопку-хотспот, которая изначально открыла отдел (`docs/11`).
  6. Явная кнопка «Закрыть» внутри активного отдела производит тот же результат, что и `Escape`.
  7. При открытии отдела (`department-opening`) focus переносится на заголовок отдела; заголовок
     программно фокусируем и реально получает DOM-focus (`document.activeElement`).
  8. Содержимое активного отдела присутствует в DOM и интерактивно сразу по диспетчу
     `SELECT_DEPARTMENT`/`SWITCH_DEPARTMENT`, независимо от завершения визуального перехода
     (Motion rules CLAUDE.md).
  9. Прямой переход на `http://localhost:3100/?department=<id>` открывает соответствующий отдел
     сразу при первой загрузке, без дополнительного клика — проверено для всех 5 валидных id.
  10. Прямой переход с невалидным/несуществующим `?department=<id>` деградирует к обычному
      раскрытому `overview` без ошибки, пустой страницы или console error.
  11. Клиентский выбор/переключение отдела обновляет видимый URL на `?department=<id>` без полной
      перезагрузки страницы (нет `load`-события документа/запроса нового HTML); закрытие убирает
      параметр, возвращая `/`, также без перезагрузки.
  12. `prefers-reduced-motion: reduce`: переходы `opening`/`switching`/`closing` — мгновенные или
      короткий fade без параллакса/камерных перелётов; все функциональные критерии выше остаются
      истинными идентично.
  13. Нет вертикального скролла документа на desktop ≥1280×800 в состояниях `hero`, `overview` и
      `department-active` (регресс acceptance criterion Step 3/4 — базовая проверка для временного
      блока; полная low-height regression <700px — задача Step 6).
  14. `Escape`/кнопка «Закрыть» из `department-active` возвращают ровно в `overview` (все 5
      хотспотов видимы/раскрыты), не в `hero`.
  15. Ни один client-компонент не импортирует `src/content/*` напрямую (grep-проверка, тот же
      инвариант, что в Steps 3/4).
  16. Существующие регрессионные тесты Step 3/4 (раскрытие `hero → overview`, исключение скрытых
      хотспотов из Tab-последовательности до раскрытия, no-scroll/reduced-motion для
      `hero → overview`) продолжают проходить без ослабления ожиданий — единственный намеренно
      инвертированный тест перечислен в criterion 2.
  17. Headless-проверка консоли браузера против `npm run dev` (не только против
      `npm run build && npm run start`) не показывает console/page errors на всём потоке выбора
      отдела (открыть/переключить/закрыть/Escape/прямой URL/невалидный URL).
  18. `docs/05-homepage-state-machine.md` честно описывает реальные переходы
      `opening/active/switching/closing`, реальное автооткрытие отдела по прямому URL, и честно
      отмечает отсутствие 10/90-оболочки до Step 6 (не оставлен описывающим только
      Step-4-эры/добуквенное "Оболочка 10/90 сохраняется" поведение).
  19. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  20. `git diff --stat` относительно коммита закрытия Step 4 ограничен списком Expected files.
  21. `DECISIONS.md` уже содержит записи по OQ-A/OQ-B/OQ-C/OQ-D с реальным согласованием
      пользователя (зафиксировано 2026-07-15, до старта этого шага) — новых записей не требуется,
      если при исполнении не возникнет новых, не предвиденных развилок.
- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  ```
  Плюс отдельная, обязательная, реально выполняемая проверка dev-режима (не заменяется прогоном
  выше — `npm run test:e2e` по `playwright.config.ts` запускает только `npm run build && npm run
  start`, продовую сборку; см. прецедент пропущенного hydration-mismatch бага, Step 4 Correction
  iteration):
  ```bash
  npm run dev
  # headless Playwright (одноразовый скрипт по прецеденту Step 4, либо постоянный отдельный
  # test:e2e:dev с собственным playwright-конфигом, указывающим на "next dev" — конкретный
  # механизм решается при исполнении) против http://localhost:3100: пройти полный поток (открыть
  # отдел, переключить, закрыть, Escape, прямой ?department=<id>, невалидный id) и зафиксировать
  # console/pageerror — ожидается [].
  # Остановить dev-сервер после проверки.
  ```
  Фактический вывод обеих проверок (dev и prod) обязателен в `WORKLOG.md` — заявление "проверено"
  без приведённого вывода не считается доказательством (`docs/17` "Skeptic gate").
- Manual checks:
  - Открыть `http://localhost:3100`, раскрыть `overview`, кликнуть по каждому из 5 хотспотов по
    очереди — подтвердить: отдел открывается, `headline`/`problem`/`symptoms`/`outcomes`/CTA/
    «Закрыть» видны и доступны.
  - Кликнуть по хотспоту другого отдела, пока один уже активен — подтвердить переключение без
    промежуточного возврата в overview, без полной перезагрузки (вкладка Network в DevTools),
    URL меняется на `?department=<новый id>`.
  - Клавиатура: Tab до хотспота → Enter открывает отдел; Tab внутри отдела достигает кнопки
    «Закрыть»; Escape закрывает и возвращает focus на исходный хотспот; повторить для явной кнопки
    «Закрыть».
  - Прямой переход на `http://localhost:3100/?department=<id>` для всех 5 id — подтвердить
    немедленное открытие нужного отдела без клика.
  - `http://localhost:3100/?department=не-существующий-id` — подтвердить деградацию к обычному
    overview без ошибки.
  - `prefers-reduced-motion: reduce` в DevTools — переходы происходят мгновенно/коротким fade,
    весь функционал (focus/URL/контент) идентичен.
  - Обе обязательные console-проверки (dev и production) — см. Verification commands.
  - `git diff --stat` относительно коммита закрытия Step 4 — подтвердить рамки Expected files.
- Risks:
  - **Временный "ugly-but-functional" способ переключения без rail** (все 5 хотспотов остаются
    видимыми рядом с минимальным блоком) может выглядеть как баг при демонстрации пользователю,
    если не объяснено заранее — смягчается явной пометкой "временно, заменяется в Step 6" в
    In scope/Objective.
  - **URL-sync — новый класс риска гидратации/рассинхронизации сервер/клиент**, аналогичного
    классу, который уже один раз (Step 4) был пропущен именно потому, что проверялась только
    production-сборка — отсюда обязательная, явно вынесенная dev-mode проверка в Verification
    commands этого шага.
  - **Отклонение от плана: `transitionend` → фиксированный JS-таймер** (найдено skeptic review
    исполнения; см. `DECISIONS.md` 2026-07-15 "Step 5: отклонение от плана..."): `ActiveDepartment
    Panel.module.css` использует CSS `animation`, а не `transition`, поэтому `transitionend`
    (согласованный по OQ-A механизм) не мог сработать; книгоучёт `OPEN_COMPLETE`/`SWITCH_COMPLETE`/
    `CLOSE_COMPLETE` реализован через `setTimeout` (800/600/700мс). Риск: если Step 6 изменит
    CSS-технику перехода (например, вернётся к `transition`), таймеры в `OfficeMachine.tsx` нужно
    будет вручную сверить/обновить — ничто не связывает их автоматически с реальной
    CSS-длительностью. Owner: явно учесть при планировании/реализации Step 6.
  - **Двойная honesty-правка `docs/05`** — риск повторения того же класса skeptic-находки, что уже
    случался в Step 3 (round 2 `FAIL` за вводящую в заблуждение формулировку) — смягчается тем,
    что правка сделана проактивно, в рамках этого же шага, а не постфактум.
  - **Server/client рефакторинг** — риск случайно протащить `src/content/*` (zod) в client-бандл —
    смягчается grep-проверкой (acceptance criterion 15) и `frontend-architect` review на
    milestone.
  - **Content gap (`docs/12` vs `data/departments.json`)** — без `beforeSteps`/`automationSteps`
    минимальный блок этого шага показывает только неструктурированный `problem`-текст — тот же
    известный gap Step 2, не решается здесь и не должен решаться здесь.
  - **Возврат/вперёд браузера не поддерживается** (см. Out of scope) — при демонстрации
    пользователю может выглядеть как баг, если явно не объяснено заранее.
  - **Escape-listener — потенциальный будущий конфликт** с модальными состояниями
    (`diagnostic-*`, `contact-open`), которые появятся значительно позже (`docs/13` Этап 8, вне
    текущего milestone) — не блокирует этот шаг, но стоит отметить для будущего рефакторинга.
  - Scope creep: соблазн уже сейчас реализовать реальную 10/90-раскладку "заодно" — явно
    отклоняется ссылкой на решение пользователя (OQ-D, Amendment 3) и на существование отдельного
    следующего шага ("Step 6 — Desktop 10/90 shell").
- Rollback: `git revert` диапазона коммитов Step 5 (аддитивно относительно Step 4: редьюсер
  переписывается, но данные/adapter'ы не меняются; новые модули добавляются). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя, как в предыдущих шагах.
- Skeptic verdict (review плана, Phase A): **round 1** (review плана после разбиения, Amendment 3) — `FAIL`: устаревшие
  перекрёстные ссылки на номера/названия шагов по дореформенной нумерации внутри уже `COMPLETED`
  секций Step 3/Step 4 (например, "Step 5 (\"Desktop 10/90 shell\")", "Step 7 (\"Reduced motion and
  fallback\")", "8-шаговый milestone") — часть из них стала не просто устаревшей, а буквально
  ложной после разбиения; не задокументировано как known issue. Скорректировано точечно (см.
  `DECISIONS.md` 2026-07-15 "Коррекция: устаревшие перекрёстные ссылки..."). **round 2** — `FAIL`:
  та же коррекция была применена только к `WORKPLAN.md`/`README.md`, но не к `WORKLOG.md`
  (Entry 3/Entry 4 — записи именно про Step 3/Step 4, содержавшие тот же класс устаревших/ложных
  ссылок, что создавало прямое противоречие между `WORKPLAN.md` и `WORKLOG.md` как два
  source-of-truth документа). Исправлено той же аннотированной техникой в `WORKLOG.md` (см.
  `DECISIONS.md` 2026-07-15, дополнение к записи "Коррекция..."). **round 3** — `FAIL`: тот же
  класс находки — на этот раз в `DECISIONS.md` (третий source-of-truth документ, ни разу не
  подметавшийся ни round 1, ни round 2): "Step 5 (Desktop 10/90 shell)" в записи Step 2 Risks,
  "10/90-панели в Step 5" в записи low-height fallback, "`src/components/departments/` в Step 5"
  в записи OQ-C, "low-fidelity Steps 1–8" — все теперь аннотированы "было X → после Amendment 3 —
  Y"; добавлен явный дисклеймер перед историческими записями OQ-2/OQ-3 (Step 4 planning),
  поясняющий, что они используют "Step 5" в дореформенном значении. **round 4** — `FAIL`: тот же
  класс находки — на этот раз в риск-записях Step 1 (`WORKPLAN.md` Risks) и симметричной записи
  `WORKLOG.md` Entry 1 ("не назначены ни одному из шагов 2–8"), плюс попутно найдены и исправлены
  ещё 2 места в `DECISIONS.md` (Step 3 CSS-подход: "шагов 4–8"/"Steps 5–8") при собственном
  дополнительном независимом просмотре — все аннотированы той же техникой. **round 5** — `FAIL`:
  ещё одно вхождение — в Objective самого Step 4 ("вся логика выбора отдела, панель... целиком
  переносятся в Step 5") бare-упоминание без названия шага в скобках, из-за чего не было поймано
  предыдущими паттерн-ориентированными проходами; исправлено уточнением, что "панель" относилась к
  тогда ещё не разделённому шагу, с явной пометкой, что реальная `DepartmentNavigationRail` —
  теперь Step 6. **round 6** (построчное, не только grep-чтение) — `FAIL`: bare "сверх текущих 8"
  в записи `DECISIONS.md` "Scope Step 1: design tokens/CI pipeline" — аннотировано; попутно
  уточнена смежная неоднозначность "диагностика Step 8" → явно "`docs/13` Этап 8" (не WORKPLAN-шаг,
  предшествующая Amendment 3 неточность самой формулировки, не вызванная разбиением). **round 7**
  (построчное чтение всех 4 процессных файлов целиком, с явной задачей оценить, не достиг ли цикл
  диминишинг-ретёрнс) — `PASS`: новых буквально ложных утверждений о текущем состоянии не найдено;
  один пограничный кандидат (формулировка `Dependencies` Step 6) разобран и признан
  самосогласованным с проектным соглашением, не самостоятельной ложью — Minor, не блокирует. Цикл
  коррекции (6 раундов, коммиты `e42e90a`/`8884f31`/`4bc8ec7`/`04a228e`/`d875bf3`/`d341225`)
  завершён. Предыдущий review плана единого нераздельного черновика "Step 5 — Desktop 10/90 shell"
  вернул `PASS` (тот, более ранний round 1) — этот более ранний verdict утратил силу после
  формального разбиения на два шага, так как форма плана изменилась; текущий round 7 — актуальный,
  финальный verdict для плана в его нынешней, разбитой форме.
- Skeptic findings (Phase A): round 1 (после разбиения) — Blocker/Critical/Major: 1 (устаревшие/ложные
  перекрёстные ссылки на номера шагов в `WORKPLAN.md`, см. выше) — исправлено; Minor: (1)
  Tab-порядок между оставшимися хотспотами overview и временным минимальным блоком активного
  отдела не специфицирован; (2) клавиатурное переключение между уже открытыми отделами не покрыто
  отдельным acceptance criterion (только начальный выбор) — оба Minor не блокируют, к исправлению
  до начала реализации не обязательны. round 7 (финальный) — Blocker/Critical/Major нет; Minor: (3)
  формулировка `Dependencies` Step 6 ("Step 5 ... (`COMPLETED`)") при ещё не начатом Step 5 читается
  двусмысленно вне контекста остального предложения — признано самосогласованным проектным
  соглашением (условие-гейт, не заявление о текущем статусе), не блокирует.
- Skeptic verdict (review исполнения, Phase B): **round 1** — `FAIL` (Major×2, Minor×1):
  (1) отклонение от согласованного механизма OQ-A (`transitionend` → фактически `setTimeout`, так
  как `ActiveDepartmentPanel.module.css` использует `animation`, не `transition`) не было
  зафиксировано как решение — нарушение AC21 ("новых записей не требуется, если... не возникнет
  новых, не предвиденных развилок" — развилка возникла и не была раскрыта); (2) `WORKLOG.md` Entry 5
  ссылался на "полную формулировку трактовки" одобрения пользователя в `WORKPLAN.md` Step 5 Status,
  но там её не было (потеряна при более раннем редактировании поля Status на `AWAITING_SKEPTIC`) —
  битая перекрёстная ссылка, тот же класс проблемы, что уже 6 раз находился в цикле коррекции
  Amendment 3; (3) Minor — вывод dev-mode console-проверки в WORKLOG был пересказом, а не
  буквальным выводом команды, как того явно требует план ("заявление 'проверено' без приведённого
  вывода не считается доказательством"). Независимо перепрогнаны `format:check`/`lint`/`typecheck`
  (чисто), `test` (86/86), `build` (успешно), `test:e2e` (27/27), плюс собственный headless
  dev-mode прогон skeptic'а (0 подозрительных сообщений) — technical/функциональная часть
  подтверждена независимо, ни один Major не касался работоспособности кода. Все три находки
  устранены точечно: (1) зафиксировано в `DECISIONS.md` 2026-07-15 "Step 5: отклонение от плана...",
  добавлен риск в Risks выше; (2) восстановлена и расширена полная формулировка трактовки в Status
  этой секции (выше); (3) добавлен буквальный вывод dev-mode прогона в `WORKLOG.md` Entry 5.
  **round 2** (финальный, независимый построчный просмотр всей секции Step 5, не только списка
  находок round 1) — `PASS`: все три находки round 1 подтверждены устранёнными; `git diff --stat
  05296d8 de2d941` подтверждён ограниченным `DECISIONS.md`/`WORKLOG.md`/`WORKPLAN.md` (production-
  код не тронут); независимо перепрогнаны `test` (86/86)/`typecheck`/`lint`/`format:check` — чисто.
  Minor (не блокирует, устранено этой же правкой): (a) в `WORKLOG.md` Entry 5 отсутствовали
  подразделы "### Skeptic review"/"### Correction iteration" по прецеденту Entry 3/4 — добавлены;
  (b) заявленное число файлов в `git diff --stat` ("21") не сходилось с реальным подсчётом (27,
  из них 23 — Step 5) — пересчитано, `ActiveDepartmentPanel.tsx`/`.module.css` и
  `HomepageShell.tsx` добавлены в Expected files ретроактивной honesty-аннотацией.
- Skeptic findings (Phase B): round 1 — 2 Major + 1 Minor (см. выше), все устранены; round 2 —
  Blocker/Critical/Major нет; 2 Minor (см. verdict выше), устранены этой же правкой.
- Completion evidence: `WORKLOG.md`, Entry 5 (включая подразделы "Skeptic review"/"Correction
  iteration") — полный список изменённых файлов (27 в diff, 23 относятся к Step 5), реальный вывод
  всех 6 verification commands (86/86 unit, 27/27 e2e, затем `--repeat-each=3` → 81/81, flakiness
  не обнаружена) и буквального вывода dev-mode console-проверки; найденный и исправленный в
  процессе реальный CSS-баг (сжатие `.zoneList`); `git diff --stat 4192279`; независимый повторный
  прогон skeptic (round 1 и round 2) всех verification commands + собственный dev-mode прогон —
  подтверждено дважды. Закрытие: пользователь, 2026-07-16, «Подтверждаю закрытие Step 5. Продолжай
  согласно плану.» — см. `WORKLOG.md`, Entry 5, "Closure".

## Step 6 — Desktop 10/90 shell

- Status: `COMPLETED` (пользователь явно подтвердил старт реализации, 2026-07-16, в ответ на прямой
  вопрос "Подтверждаете начало реализации Step 6 — Desktop 10/90 shell по плану, изложенному в
  WORKPLAN.md?": «Да, начинай Step 6» — недвусмысленное согласие, зафиксировано до начала кода.
  Реализация выполнена, все verification commands реально прогнаны (см. `WORKLOG.md`, Entry 6) —
  format:check/lint/typecheck/test (90/90)/build/test:e2e (34/34, затем `--repeat-each=3` на
  изменённых/новых spec-файлах → 90/90) — все exit 0; отдельная обязательная dev-mode проверка
  (`npm run dev`) — 0 подозрительных console-сообщений. Функциональная реализация независимо
  подтверждена корректной ещё в первом раунде review исполнения (Phase B) и не менялась ни разу за
  все последующие раунды. Phase B review прошёл 5 раундов (round 1–4 `FAIL`, round 5 `BLOCKED`), все
  пять — исключительно bookkeeping-дефекты в самих процессных документах (`WORKPLAN.md`/
  `WORKLOG.md`), не в коде; skeptic на round 5 прямо порекомендовал не открывать round 6 в прежнем
  виде без решения пользователя. Вопрос задан пользователю напрямую через `AskUserQuestion`,
  2026-07-16; ответ: «Принять текущее состояние и закрыть Step 6 (рекомендация)» — см. `DECISIONS.md`
  2026-07-16 "Step 6: остановка Phase B correction loop после round 5 BLOCKED" для полной
  формулировки. **Честно зафиксировано: Step 6 закрыт без формального `PASS` от skeptic (Phase B
  review остановился на round 5 `BLOCKED`, не был доведён до чистого `PASS`)** — это явное решение
  пользователя, принятое с полным знанием этого факта, а не самопровозглашённое исполнителем
  завершение и не молчаливое отклонение от обычного правила протокола "не начинать следующий шаг без
  PASS".)
- Objective: Реализовать полную 10/90-раскладку (`docs/08-responsive-behavior.md` "Desktop
  ≥1280": "10/90"; Core concept CLAUDE.md; `docs/03-office-map.md` "Режим 10/90") поверх уже
  работающей state machine выбора отдела, реализованной в "Step 5 — Department selection state
  machine": выбранный отдел разворачивается в основную область ~90%, остальные четыре — в
  `DepartmentNavigationRail` (~10%), без изменения уже реализованной в Step 5 логики переходов
  состояний (`SELECT_DEPARTMENT`/`SWITCH_DEPARTMENT`/`CLOSE_DEPARTMENT`/`ESCAPE`, переходы
  `opening→active↔switching→closing` через CSS-классы по решению OQ-A, URL-sync через
  `history.pushState`/`replaceState` по решению OQ-B) — этот шаг не переделывает эту логику,
  только раскладку и визуальное представление содержимого. Временный "ugly-but-functional" способ
  переключения отделов из Step 5 (все 5 хотспотов остаются одновременно видимыми рядом с
  минимальным блоком) заменяется здесь реальным `DepartmentNavigationRail` (`docs/03` "Режим
  10/90": "Левая панель 10–14%: возврат; пять миниатюр; активное состояние; клавиатурная
  навигация"). Реальное содержимое 90%-области реализуется по решению пользователя (OQ-C, см.
  `DECISIONS.md` 2026-07-15 "Step 5: глубина содержимого 90%-области (OQ-C)"): только
  `DepartmentCopy`/`OutcomePanel`/`DepartmentCTA` (`headline`/`problem`/`symptoms`/`outcomes`/
  CTA), без `DepartmentScene`/`BeforeAfterSequence` — по прецеденту того, как Step 3 сознательно
  пропустил `OfficeVisualLayer`. Активный отдел в rail обозначается не только цветом (`docs/14`
  "Overview": "active не только цветом"). Также выполняется регрессионная проверка low-height
  fallback (`docs/08` "Низкий desktop", `@media (max-height: 700px)`) для новой раскладки — задача,
  явно отложенная сюда из Step 5.

  Учтено то же процессное требование, что и в Step 5 (обязательная dev-mode console-проверка, не
  только production-сборка) — раскладка меняется существенно, риск нового класса
  hydration/визуальных проблем сопоставим.
- In scope:
  - **10/90 grid-раскладка**, заменяющая временную стековую презентацию Step 5. По дереву
    `docs/09-technical-architecture.md`: `HomepageShell` при активном отделе рендерит
    `OfficeExperience` (содержит `DepartmentNavigationRail`, ~10%) и новый `DepartmentExperience`
    (~90%) как соседние top-level-компоненты (не вложенный в `OfficeExperience`, как в дереве
    `docs/09`), связанные общим grid/flex-контейнером. Точная точка врезки контейнера (в
    `HomepageShell` или в `OfficeExperience`) — техническая деталь исполнения, не требующая
    отдельного вопроса пользователю (низкий риск, по прецеденту Step 3 "сортировка хотспотов").
  - **`DepartmentNavigationRail`** (новый, `src/components/office/DepartmentNavigationRail.tsx` +
    `.module.css`) — список из 4 доступных кнопок для оставшихся отделов, каждая диспетчерит уже
    существующий (из Step 5) `SWITCH_DEPARTMENT`. Активный отдел обозначен не только цветом
    (`docs/14`) — например, текстом/`aria-current="true"`/иконкой. Заменяет временный "все 5
    хотспотов видимы" механизм Step 5 — старые 5 хотспотов overview больше не показываются
    одновременно с активным отделом.
  - **Реальное содержимое отдела** (`src/components/departments/` — новый каталог по дереву
    `docs/09`): `DepartmentExperience.tsx` (контейнер), `DepartmentCopy.tsx` (`headline`/
    `problem`/`symptoms`, максимум 3 — `docs/12` "максимум три симптома в основном UI", данные уже
    содержат ровно 3), `OutcomePanel.tsx` (`outcomes[]`), `DepartmentCTA.tsx` (кнопка с
    `ctaLabel`, видимая, но no-op — нет реального адресата лида/CRM ни в этом шаге, ни во всём
    текущем 9-шаговом milestone; не навигирует на `solutionPath`, так как `/solutions/*` не
    существуют, `docs/13` Этап 9). `DepartmentScene.tsx`/`BeforeAfterSequence.tsx` **не
    создаются** (решение OQ-C = (b)) — явное, раскрытое ограничение, не молчаливое упущение.
    Заменяет временный неоформленный блок Step 5 полностью (не расширяет его).
  - **Tab-порядок между 90%-областью и rail.** Явно решается здесь (было отмечено как
    Minor-уточнение в предыдущем review нераздельного черновика Step 5): при активном отделе Tab
    обходит сначала содержимое 90%-области (заголовок → symptoms/outcomes → CTA → кнопка
    «Закрыть»), затем 4 элемента rail — контент важнее навигации по визуальному весу и по
    аналогии с уже принятым порядком overview (Step 3: сортировка по `y`, затем `x`). Технический
    выбор исполнения, низкий риск, легко изменить.
  - **Перенос Escape/фокус-менеджмента без изменений** — уже реализованы в Step 5; этот шаг
    только проверяет, что они продолжают работать при новой раскладке (заголовок отдела и кнопка
    «Закрыть» физически перемещаются в новый `DepartmentExperience`, но их роль в focus management
    не меняется).
  - **Контент не зависит от завершения анимации** (Motion rules CLAUDE.md) — перепроверяется для
    нового дерева `DepartmentCopy`/`OutcomePanel`/`DepartmentCTA`: контент присутствует в DOM и
    интерактивен сразу по диспетчу, независимо от завершения визуального перехода.
  - **Регрессия low-height fallback** (`docs/08` "Низкий desktop", `@media (max-height: 700px)`,
    введено в Step 3/4) — перепроверяется для нового 10/90 layout: заголовок/CTA не обрезаны,
    документ не скроллится целиком (только внутренний скролл соответствующей панели при нехватке
    места); это отдельная, более строгая проверка, чем базовая "нет скролла на ≥720px" из Step 5,
    так как геометрия 10/90 принципиально другая, чем временный стек Step 5.
  - **`prefers-reduced-motion`** — перепроверка того, что уже реализованные в Step 5 CSS-классовые
    переходы корректно работают в контексте новой 10/90 CSS-структуры (сам механизм не меняется).
  - **Server/client граница** (не новое решение) — `src/content/*.ts` остаются server-only; новые
    компоненты `src/components/departments/*` получают данные только как сериализуемые props.
  - **Новые/обновлённые unit-тесты:** `DepartmentNavigationRail`, `DepartmentCopy`/`OutcomePanel`/
    `DepartmentCTA` — рендер реальных данных, `aria-current`/не-только-цвет индикация активного
    элемента rail.
  - **Новые/обновлённые e2e-тесты**: 10/90-геометрия (выбранный отдел ~90%, rail ~10%, измерено
    через `boundingClientRect`); переключение через клик по элементу rail (без промежуточного
    `overview`, без полной перезагрузки — та же проверка, что уже была в Step 5, теперь через
    реальный rail, а не через видимые хотспоты); Tab-порядок 90%-область → rail; low-height
    fallback (1280×500) с активным отделом и новой раскладкой; отсутствие console/
    hydration-mismatch ошибок — отдельно в `npm run dev` и отдельно в production-сборке.
- Out of scope:
  - Логика переходов состояний (`SELECT_DEPARTMENT`/`SWITCH_DEPARTMENT`/`CLOSE_DEPARTMENT`/
    `ESCAPE`, `opening/active/switching/closing`, URL-sync, честная правка `docs/05`) — уже
    реализована в Step 5, не переделывается здесь.
  - `DepartmentScene`/`BeforeAfterSequence`, `beforeSteps`/`automationSteps`/полный `visual`
    (`docs/12`) — по-прежнему физически отсутствуют в данных (известный gap Step 2); решение
    OQ-C = (b) их явно исключает.
  - Диагностика (`OPEN_DIAGNOSTIC`, `diagnostic-*`), `contact-open` — вне scope всего текущего
    9-шагового milestone.
  - Mobile/tablet-раскладка и touch-специфика (`docs/08` Tablet/Mobile) — Step 7 ("Mobile touch
    flow"); ручная проверка этого шага — desktop ≥1280px.
  - `OfficeVisualLayer`, WebGL/Canvas — по-прежнему не вводятся (owner: перед стартом Step 8
    ("Reduced motion and fallback")).
  - Реальная навигация `DepartmentCTA` на `/solutions/*` — эти страницы не существуют (`docs/13`
    Этап 9).
  - Полноценный `error-fallback`/`FallbackExperience` — Step 8.
  - Автоматизированное axe-сканирование — по-прежнему owner Step 9 ("Browser acceptance tests").
  - Поддержка кнопок «назад»/«вперёд» браузера (`popstate`) — уже поднятое в Step 5 ограничение,
    не пересматривается здесь.
  - Дозаполнение `data/departments.json` — контентная задача без владельца-шага.
  - Правка `MANIFEST.json`, CI pipeline.
- Dependencies: "Step 5 — Department selection state machine" (`COMPLETED`) — этот шаг строит
  раскладку строго поверх уже реализованной и принятой пользователем state machine выбора отдела;
  не может начинаться раньше завершения Step 5.
- Expected files:
  - `src/components/office/OfficeExperience.tsx`, `OfficeSemanticMap.tsx` (+ `.module.css`) —
    переключение временной стековой презентации Step 5 на реальную 10/90 CSS-структуру.
  - Новый `src/components/office/DepartmentNavigationRail.tsx` (+ `.module.css`).
  - Новый каталог `src/components/departments/`: `DepartmentExperience.tsx`, `DepartmentCopy.tsx`,
    `OutcomePanel.tsx`, `DepartmentCTA.tsx` (+ `.module.css` каждый).
  - `src/components/office/DepartmentHotspot.tsx` (+ `.module.css`) — точечная правка (хотспот
    больше не остаётся видимым одновременно с активным отделом — временное поведение Step 5
    убирается).
  - Обновления существующих тестов Step 5, перечисленных в In scope.
  - Новые unit/e2e тесты, перечисленные в In scope.
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md` (процессные).
- Acceptance criteria:
  1. Клик по хотспоту (или `Enter`/`Space`) открывает отдел: он занимает ~90% основной области
     (`DepartmentExperience`), остальные 4 отдела показаны в `DepartmentNavigationRail` (~10%);
     полной перезагрузки/навигации документа не происходит.
  2. Клик по любому из 4 элементов rail, пока активен другой отдел, переключает отдел напрямую:
     10/90-оболочка сохраняется, содержимое/URL меняются, `overview` не показывается в
     промежутке, нет полной перезагрузки (`docs/05` `department-switching`, честно описанный
     после Step 5).
  3. Активный отдел/элемент rail обозначен не только цветом (`docs/14`).
  4. Содержимое активного отдела (`DepartmentCopy`/`OutcomePanel`/`DepartmentCTA`) присутствует в
     DOM и интерактивно сразу по диспетчу `SELECT_DEPARTMENT`/`SWITCH_DEPARTMENT`, независимо от
     завершения визуального перехода (Motion rules CLAUDE.md).
  5. Tab-порядок при активном отделе: сначала содержимое 90%-области (заголовок →
     symptoms/outcomes → CTA → кнопка «Закрыть»), затем 4 элемента rail.
  6. `Escape`/явная кнопка «Закрыть» (уже реализованные в Step 5) продолжают работать идентично
     при новой раскладке — focus программно возвращается на исходную кнопку-хотспот.
  7. Low-height fallback (`docs/08`, `@media (max-height: 700px)`, 1280×500) работает для новой
     10/90-раскладки: заголовок/CTA не обрезаны, документ не скроллится целиком, внутренний
     скролл — только у соответствующей панели при нехватке места.
  8. Нет вертикального скролла документа на desktop ≥1280×800 в состояниях `hero`, `overview` и
     `department-active` с реальной 10/90-раскладкой (полная регрессия, не только базовая
     проверка Step 5).
  9. `prefers-reduced-motion: reduce` — переходы по-прежнему функциональны в контексте новой
     раскладки; все функциональные критерии (focus, URL, доступность контента) идентичны.
  10. Ни один client-компонент не импортирует `src/content/*` напрямую (grep-проверка, тот же
      инвариант, что в Steps 3/4/5).
  11. Существующие регрессионные тесты Step 3/4/5 (URL-sync, boot-открытие по ссылке, Escape,
      honesty `docs/05`) продолжают проходить без ослабления ожиданий — с учётом честных, явно
      перечисленных изменений (переключение теперь через rail, а не через видимые хотспоты).
  12. Headless-проверка консоли браузера против `npm run dev` (не только против production) не
      показывает console/page errors на всём потоке (открыть/переключить через rail/закрыть/
      Escape/прямой URL) — та же обязательная проверка, что в Step 5, повторно применённая к
      новой раскладке.
  13. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  14. `git diff --stat` относительно коммита закрытия Step 5 ограничен списком Expected files.
  15. `DECISIONS.md` не требует новых записей для уже решённых OQ-A/B/C/D (сделано 2026-07-15) —
      новые записи нужны только если при исполнении возникнут новые, не предвиденные развилки.
- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  ```
  Плюс отдельная, обязательная, реально выполняемая проверка dev-режима (тот же процессный
  прецедент, что в Step 5/Step 4 — `npm run test:e2e` проверяет только продовую сборку):
  ```bash
  npm run dev
  # headless Playwright (одноразовый скрипт либо постоянный отдельный test:e2e:dev — конкретный
  # механизм решается при исполнении, по прецеденту Step 5) против http://localhost:3100: пройти
  # полный поток с новой 10/90-раскладкой (открыть отдел, переключить через rail, закрыть, Escape,
  # прямой ?department=<id>) и зафиксировать console/pageerror — ожидается [].
  # Остановить dev-сервер после проверки.
  ```
  Фактический вывод обеих проверок (dev и prod) обязателен в `WORKLOG.md` (`docs/17` "Skeptic
  gate").
- Manual checks:
  - Открыть `http://localhost:3100`, кликнуть по каждому из 5 хотспотов по очереди — подтвердить
    90/10-геометрию (`boundingClientRect` в DevTools console), содержимое отдела видно.
  - Кликнуть по каждому из 4 элементов rail — подтвердить переключение без overview, без
    перезагрузки (Network tab), URL меняется на `?department=<новый id>`.
  - Клавиатура: подтвердить Tab-порядок 90%-область → rail; `Escape`/кнопка «Закрыть» работают,
    как в Step 5.
  - Viewport 1280×500 (low-height) с активным отделом — заголовок/CTA не обрезаны, документ не
    скроллится целиком.
  - `prefers-reduced-motion: reduce` в DevTools.
  - Обе обязательные console-проверки (dev и production).
  - `git diff --stat` относительно коммита закрытия Step 5 — подтвердить рамки Expected files.
- Risks:
  - **Взаимодействие low-height fallback с принципиально новой геометрией** — media query,
    работавшая для временного стека Step 5, может не переноситься без изменений на реальный 10/90
    grid; требует отдельной перепроверки, не переиспользования без изменений (тот же класс риска,
    что уже был явно поднят в нераздельном черновике Step 5, до Amendment 3).
  - **Убирание временного механизма Step 5** (все 5 хотспотов видимы одновременно с активным
    отделом) может задеть e2e-тесты Step 5, написанные под старую презентацию — требует честного,
    не молчаливого обновления (см. Expected files/In scope), не тихого ослабления ожиданий.
  - **Content gap (`docs/12` vs `data/departments.json`)** — по-прежнему актуален; `DepartmentCopy`/
    `OutcomePanel` полагаются только на неструктурированный `problem`/`symptoms`/`outcomes[]`, не
    на `beforeSteps`/`automationSteps`.
  - **Tab-порядок между двумя top-level-сиблингами** (`OfficeExperience`/`DepartmentExperience`)
    зависит от порядка в DOM, а не только от визуального CSS-порядка (`order`/grid placement) —
    нужно явно проверить, что DOM-порядок соответствует решённому Tab-порядку (acceptance
    criterion 5), а не полагаться на визуальный CSS-reorder, который может разойтись с порядком
    Tab.
  - Scope creep: соблазн переделать логику state machine "заодно" — явно отклоняется, эта логика
    уже реализована и принята в Step 5.
- Rollback: `git revert` диапазона коммитов Step 6 (аддитивно относительно Step 5: новые
  компоненты, CSS-раскладка меняется, но редьюсер/URL-sync логика Step 5 не переписывается).
  Деструктивный `git reset --hard` — только с явного разрешения пользователя, как в предыдущих
  шагах.
- Skeptic verdict (review плана, Phase A): **round 1** (review плана после разбиения, Amendment 3) —
  `FAIL`, вместе со Step 5 (общая находка на весь разбитый план — устаревшие/ложные перекрёстные
  ссылки на номера шагов в уже `COMPLETED` секциях Step 3/Step 4, см. Step 5 → Skeptic verdict выше
  и `DECISIONS.md` 2026-07-15 "Коррекция: устаревшие перекрёстные ссылки..."). **round 2** — `FAIL`,
  тоже вместе со Step 5 (та же коррекция не была применена к `WORKLOG.md` Entry 3/4, исправлено).
  **round 3** — `FAIL`, тоже вместе со Step 5 (тот же класс находки — на этот раз в `DECISIONS.md`,
  третьем source-of-truth документе; исправлено). **round 4** — `FAIL`, тоже вместе со Step 5
  (риск-записи Step 1 в `WORKPLAN.md`/`WORKLOG.md`, "2–8" вместо "2–9"; исправлено). **round 5** —
  `FAIL`, тоже вместе со Step 5 (bare-упоминание "панель... переносятся в Step 5" в Objective
  Step 4; исправлено). **round 6** — `FAIL`, тоже вместе со Step 5 (bare "сверх текущих 8" в
  `DECISIONS.md` "Scope Step 1"; исправлено). **round 7** (финальный, построчное чтение всех
  процессных файлов целиком) — `PASS`: новых буквально ложных утверждений не найдено; цикл коррекции
  завершён (6 раундов, коммиты `e42e90a`/`8884f31`/`4bc8ec7`/`04a228e`/`d875bf3`/`d341225`). Этот шаг
  выделен из бывшего единого черновика "Step 5 — Desktop 10/90 shell" по Amendment 3 (см.
  `DECISIONS.md` 2026-07-15 "OQ-D").
- Skeptic findings (Phase A): см. Step 5 → Skeptic findings (общие находки round 1–7 на оба новых
  шага, так как оба — части одного и того же разбитого документа); специфичных для именно Step 6
  находок ни один из раундов не выявил.
- Skeptic verdict (review исполнения, Phase B): 5 раундов, все `FAIL`/`BLOCKED`; ни один из пяти не
  нашёл дефекта в функциональной реализации, тестах, архитектуре, accessibility или
  производительности — все пять были дефектами bookkeeping-полей самого review-процесса
  (`WORKPLAN.md`/`WORKLOG.md`), каждый раз находимыми и исправляемыми в следующем раунде, кроме
  находки round 5. **round 1** — `FAIL`: git-индекс рассинхронизирован (`WORKPLAN.md`/`WORKLOG.md`
  застейджены до финальных правок), из-за чего `WORKLOG.md` Entry 6 не попал бы в коммит. **round
  2** — `FAIL`: у `WORKPLAN.md` Step 6 отсутствовали поля `Skeptic verdict (Phase B)`/`Skeptic
  findings (Phase B)`, `Completion evidence` противоречил `Status` ("шаг не начат" при уже
  выполненной реализации). **round 3** — `FAIL`: `WORKLOG.md` "Correction iteration 2" содержала
  буквально ложную формулировку про вывод `git diff HEAD --stat -- src`. **round 4** — `FAIL`:
  `WORKLOG.md` "Correction iteration 3" ложно утверждала, что сама обновила `Completion evidence`
  упоминанием себя; `Completion evidence` также говорил "подтверждено дважды" при уже 4 раундах.
  **round 5** — `BLOCKED`: правка, закрывавшая round 4 (заявленная как "полная переработка, не
  точечный патч"), оставила рядом старую и новую версии поля `Skeptic findings (Phase B)` — два
  дублирующих, частично расходящихся бюллета с одинаковым заголовком в одной секции. Skeptic
  идентифицировал это как тот же класс дефекта, что round 2–4 (текст расходится с реальным
  состоянием документа), в наиболее механической форме (буквальный дубль), и прямо порекомендовал
  не открывать round 6 в прежнем виде без решения пользователя — либо принять текущее
  функциональное состояние Step 6 закрытым с этим известным, не блокирующим bookkeeping-дефектом,
  либо перейти на более простой формат Phase B bookkeeping. Решение пользователя — см. `DECISIONS.md`
  2026-07-16 "Step 6: остановка Phase B correction loop после round 5 BLOCKED".
- Skeptic findings (Phase B): round 1 — 1 Major (git-индекс), устранён Correction iteration 1;
  round 2 — 1 Major (отсутствующие/противоречивые bookkeeping-поля), устранён Correction iteration
  2; round 3 — 1 Major (ложная формулировка про `git diff`) + 1 Minor, устранены Correction
  iteration 3; round 4 — 1 Major (самоссылочное ложное утверждение + устаревший счётчик раундов),
  устранён Correction iteration 4; round 5 — 1 Major (дублирующий бюллет `Skeptic findings (Phase
  B)`, оставленный предыдущей правкой) — устранён этой правкой (это поле переписано один раз,
  дублей больше нет — проверено `grep -c` на уникальность заголовка внутри секции Step 6, см.
  `WORKLOG.md` "Correction iteration 5"). Остальные Minor round 1/3 (docs/03 "возврат", формулировка
  dev-mode Escape, недостающая ссылка на "Correction iteration 2") — не блокировали ни один раунд,
  устранены попутно.
- Completion evidence: `WORKLOG.md`, Entry 6, подразделы "Skeptic review (round 1)"–"Correction
  iteration 5". Функциональная реализация (15 acceptance criteria, 6 verification commands — 90/90
  unit, успешный build, 34/34 e2e, затем `--repeat-each=3` → 90/90, dev-mode console-проверка — 0
  подозрительных сообщений) независимо подтверждена ещё в round 1 и не менялась ни разу за все 5
  раундов (`git diff HEAD --stat -- src` — идентичен во всех раундах: 20 файлов, 652
  insertions/140 deletions). `git diff --cached --name-status -M0 HEAD` — 24 файла (4 процессных, 20
  код/тесты). Phase B review остановлен пользователем на round 5 `BLOCKED` (без формального `PASS`)
  — пользователь явно решил принять текущее, пятикратно независимо подтверждённое функциональное
  состояние как основание для закрытия шага, см. `DECISIONS.md` 2026-07-16 "Step 6: остановка Phase B
  correction loop после round 5 BLOCKED".

## Step 7 — Mobile touch flow

- Status: `COMPLETED` (пользователь явно подтвердил закрытие, 2026-07-16: «Step 7 подтверждаю.
  Переходи к следующему шагу.» — недвусмысленное согласие после сверки визуала прототипа с планом).
- Status history: `PASSED` (2026-07-16, Phase B — skeptic Phase B round 2 `PASS`, без находок).
- Skeptic verdict (review исполнения, Phase B): round 1 — `FAIL` (1 Critical + 3 Major + 1 Minor,
  "no plan amendment required"), устранено в "Correction iteration 1" (`WORKLOG.md` Entry 8); round 2
  — `PASS` (без находок, "no plan amendment required") — независимо перепроверены все 5 фиксов round 1
  плюс полный набор verification commands (`test:e2e` 50/50, остальные 5 команд чисто).
- Skeptic findings (Phase B): round 1 — (1) Critical: ложное "проверено вручную" про 320px в Entry 8,
  прямо противоречившее собственному разделу "Manual checks" той же записи; (2) Major: AC 7 не
  проверялся ни на одной второй характерной высоте; (3) Major: DevTools Manual checks пропущены
  целиком без явной пометки как опциональные; (4) Major: AC 13 не проверен для мобильного
  `department-active` Tab-порядка; (5) Minor: `.card` без явного `min-width: 44px`. Все 5 устранены —
  подробности и код-diff см. `WORKLOG.md` Entry 8 "Correction iteration 1". round 2 — находок нет.
- Status (history): `IN_PROGRESS` (2026-07-16, начало Phase B execution) → `APPROVED` — **исходный
  черновик прошёл skeptic Phase A rounds 1–3 (2026-07-16) в
  варианте, построенном на default-предположении OQ-M3 = (a) (вертикальный список + полноэкранная
  карточка без прямого переключения). Пользователь ответил на все четыре открытых вопроса
  (`DECISIONS.md`, 2026-07-16 "Step 7: ответы на OQ-M1–OQ-M4"): OQ-M3 = (b) (горизонтальная
  карусель/пейджинг) и OQ-M1 = (c) (сейчас же добавить отдельный Tablet-шаг) РАСХОДЯТСЯ с default
  черновика и потребовали существенной переработки этой секции — по прецеденту Amendment 3 ("Step 5
  → Step 5/Step 6"), тот исходный skeptic verdict (rounds 1–3) относится к другой, замещённой форме
  плана и утратил силу.** Переработанная (карусельная) версия ниже прошла собственный цикл skeptic
  Phase A review (round 1 `BLOCKED` → round 2 `FAIL` → round 3 `PASS`, 2026-07-16 — полная история
  ниже) и получила ответы пользователя на все дополнительно найденные при review пункты (**OQ-M5** —
  конфликт с `docs/03`, решён 2026-07-16 = (a); схема нумерации "Step 7.5" подтверждена — см.
  `Amendment 4`). OQ-M2 = (b) и OQ-M4 = (a) совпали с default черновика — их текст ниже не менялся
  по существу. Реализация не начата — `Status: APPROVED` разрешает старт, но не является отчётом о
  выполнении.
- Objective: Адаптировать уже работающую офис-цепочку `hero → overview → выбор отдела` (state
  machine, URL-sync, focus management — `src/features/office-machine/reducer.ts`,
  `OfficeMachine.tsx`, `url-sync.ts`, реализованы и приняты в Step 5/Step 6, `COMPLETED`, последний
  коммит `5756d8d` "feat: Step 6 - Desktop 10/90 shell") под ширину viewport ≤767px
  (`docs/08-responsive-behavior.md` "Mobile ≤767") для touch-ввода, по Core concept CLAUDE.md
  ("Mobile is not a scaled-down desktop office") и `docs/08` ("Не использовать буквальный 10/90";
  путь: логотип → hero → обзор офиса → **список/карусель отделов** → активная карточка → до/после →
  CTA, с явной кнопкой назад). По решению пользователя (**OQ-M3 = (b)**, `DECISIONS.md` 2026-07-16)
  реализуется вариант **"карусель"** из этого пути `docs/08`, а не "список": на ≤767px overview
  показывает ровно ОДНУ карточку отдела с кнопками "предыдущий"/"следующий" (пейджинг), а не
  вертикальный прокручиваемый список всех пяти сразу; переключение между уже открытыми отделами
  происходит напрямую (`SWITCH_DEPARTMENT`), без промежуточного возврата к списку/обзору.

  **Этот шаг по-прежнему не добавляет и не изменяет ни одного состояния/действия редьюсера
  `office-machine`** — используются те же 6 состояний и 8 действий, что и в Step 5/6, включая уже
  существующий "умный" диспетчер `handleSelectDepartment` в `OfficeMachine.tsx` (сам решает
  `SELECT_DEPARTMENT` vs `SWITCH_DEPARTMENT` по текущему `activeDepartmentId`) — редьюсер/действия не
  меняются. Новое, что вводит этот шаг, — это ЛОКАЛЬНОЕ, не-редьюсерное React-состояние (`useState`
  "индекс просматриваемой карточки") внутри нового компонента карусели, полностью отделённое от
  `OfficeMachineState`: браузер карточек ДО выбора отдела (пока пользователь ещё не тапнул "открыть")
  не диспетчерит ничего в редьюсер, не меняет URL и не переводит состояние машины из `overview` — это
  сознательное архитектурное решение (не открытый вопрос), объяснённое ниже.

  **`OfficeMachine.tsx` ВСЁ ЖЕ входит в Expected files этого шага — не как исключение, а как
  необходимая точечная правка (найдено при skeptic Phase A review переработанного плана):** её
  существующая логика возврата фокуса после закрытия отдела (`useEffect`, ветка "Focus возвращается
  на кнопку-хотспот") делает буквально `document.getElementById(\`hotspot-${returnId}\`)?.focus(...)`.
  На ≤767px `DepartmentHotspot`/`OfficeSemanticMap` остаются в DOM, но скрыты через `display: none`
  (см. решение 4 ниже) — `.focus()` на элементе с `display: none` является no-op, поэтому после
  закрытия отдела на мобильном фокус молча не переходил бы никуда (эффективно терялся, `document.
  activeElement` откатывался бы к `<body>`), что нарушило бы уже принятый и протестированный
  инвариант "focus возвращается после закрытия" (`docs/11`, Step 5/6 AC).

  **Решение (round 2 итерация — round 1 версия этого решения сама содержала баг, найденный
  skeptic'ом: `carousel-card-${returnId}` предполагал существование карточки закрытого отдела в
  DOM, но карусель сбрасывается на индекс 0 при каждом новом входе в `overview` — AC 17 — поэтому
  после закрытия НЕ первого по порядку отдела `carousel-card-${returnId}` не существовал бы вовсе,
  fallback ловил бы `null` и фокус снова терялся бы для 4 из 5 отделов).** Правильное решение не
  привязывает id карусельной карточки к конкретному отделу вообще — карусель всегда показывает ровно
  одну карточку с фиксированным, не зависящим от отдела id `mobile-department-carousel-card`.
  Fallback-логика в `useEffect` `OfficeMachine.tsx` пробует по очереди: (1) `hotspot-<returnId>` —
  сработает на desktop/tablet, где карта видима; (2) стабильный
  `mobile-department-carousel-card` — сработает на mobile, где карусель после сброса показывает
  первый отдел (то же поведение, что уже зафиксировано AC 17 как ожидаемое — фокус на "первой
  карточке, которую пользователь реально видит" семантически корректен, а не костыль под баг):
  ```ts
  const candidateIds = [`hotspot-${returnId}`, "mobile-department-carousel-card"];
  const target = candidateIds
    .map((id) => document.getElementById(id))
    .find((el): el is HTMLElement => el !== null && el.offsetParent !== null);
  target?.focus({ preventScroll: true });
  ```
  Логика по-прежнему CSS-only с точки зрения breakpoint (сам `OfficeMachine.tsx` не проверяет ширину
  viewport и не использует `matchMedia` — просто пробует оба id и берёт видимый). `offsetParent !==
  null` — дешёвая, широко используемая проверка видимости, не требующая `getComputedStyle`.
  `MobileDepartmentCarousel` присваивает `id="mobile-department-carousel-card"` кнопке текущей
  карточки (не зависит от `department.id`) — не конфликтует с `hotspot-<id>` и не создаёт
  дублирующихся id в DOM (в любой момент рендерится только одна карточка карусели, id один и тот же
  независимо от того, какой именно отдел сейчас показан).

  **Технические решения, принятые этим шагом (не открытые вопросы — сформулированы и обоснованы
  здесь, по прямой инструкции пользователя "реши сам, технически обоснованно"):**
  1. **"Открытие" отдела ≠ "просмотр" в карусели.** Overview на ≤767px рендерит карусель, которая
     сама по себе — чисто локальный browse-режим (текст видим, ничего не выбрано); только явный тап
     по текущей карточке (или Enter/Space, когда она в фокусе) диспетчерит реальный
     `SELECT_DEPARTMENT` и переводит машину в `department-opening`. Альтернатива "тап по
     Next/Prev = сразу открывать" отклонена: она означала бы, что URL/аналитика меняются при
     простом пролистывании, прежде чем пользователь на самом деле выбрал отдел — семантически
     неверно (`overview` перестал бы означать "ничего не выбрано").
  2. **Новый общий компонент навигации, не переиспользование `DepartmentNavigationRail`.**
     `DepartmentNavigationRail` — список ИЗ ЧЕТЫРЁХ кнопок остальных отделов (Step 6, `docs/03`
     "пять миниатюр"/"4 доступных кнопки") — не подходит для постраничной навигации "вперёд/назад
     по кругу". Вводится новый, маленький презентационный компонент `CarouselNavControls` (пара
     кнопок "предыдущий"/"следующий"), переиспользуемый в ДВУХ местах: (a) внутри нового
     `MobileDepartmentCarousel` (`overview`, локальное переключение индекса просмотра, без
     диспетча); (b) внутри уже существующего `DepartmentExperience` (`department-active`,
     диспетчерит настоящий `SWITCH_DEPARTMENT` через уже существующий `onSelectDepartment`).
     Единственный компонент, единственный CSS-класс, единый визуальный язык в обоих местах — вместо
     дублирования разметки. Кнопки навигации по кругу (wrap-around: от последнего отдела "следующий"
     ведёт к первому, и наоборот) — не заблокированы на границах списка; полагается на уже
     установленный zod-инвариант "ровно 5 отделов" (Step 2), тот же, на который уже неявно
     полагается `DepartmentNavigationRail` ("4 доступных кнопки").
  3. **`DepartmentHotspot.tsx`/`.module.css` НЕ изменяются этим шагом** (существенное отличие от
     прежнего (a)-черновика, который требовал CSS-var-рефакторинга inline-позиционирования). Так как
     карусель — новый компонент, не переиспользующий абсолютно-позиционированный хотспот, вся
     причина рефакторинга (специфичность inline-стилей мешает `@media`-переопределению) отпадает.
     `OfficeSemanticMap`/`DepartmentHotspot` остаются полностью нетронутыми Step 3-кода; единственное
     изменение — одна CSS-строка, скрывающая всю карту целиком на ≤767px (см. In scope).
  4. **Обе структуры (карта-для-Desktop/Tablet и карусель-для-Mobile) присутствуют в одном DOM-дереве
     одновременно**, видимость переключает только CSS (`display: none`/`display: flex` по
     `max-width`/`min-width`) — тот же паттерн, что уже используется в проекте
     (`:global(.js) .hiddenUntilRevealed`, `OfficeExperience.module.css`). Это сохраняет уже принятый
     инвариант "без JS-детекции ширины/`matchMedia`" (тот же риск гидратации, что уже один раз
     привёл к реальному багу в Step 4). `MobileDepartmentCarousel`/`CarouselNavControls` не требуют
     собственной директивы `'use client'` — они рендерятся исключительно внутри уже существующего
     клиентского поддерева `OfficeMachine.tsx` (тот же принцип, что уже действует для
     `OfficeExperience`/`DepartmentHotspot`, ни один из которых тоже не несёт эту директиву).

- In scope:
  - **Механизм breakpoint — CSS-only**, без JS/`matchMedia` (без изменений относительно прежнего
    черновика) — `max-width: 767px` в `*.module.css`.
  - **Новый `src/components/office/MobileDepartmentCarousel.tsx` (+ `.module.css`)** — рендерится
    `OfficeExperience.tsx` в ветке `overview` РЯДОМ с уже существующим `OfficeSemanticMap` (оба в
    DOM, видимость по CSS). Проп-контракт: `departments: Department[]` (тот же отсортированный
    массив, что уже вычисляется в `OfficeExperience.tsx` для rail — переиспользуется, не
    дублируется), `onSelectDepartment: (id) => void`. Внутреннее состояние: `useState<number>(0)` —
    индекс просматриваемой карточки, сбрасывается к 0 при каждом новом входе в `overview`
    (естественное следствие того, что вся `overview`-ветка размонтируется/монтируется заново при
    переходе в/из `department-active` — уже существующее поведение `OfficeExperience.tsx`, не новый
    код). Рендерит: карточку текущего отдела как `<button type="button">` с
    `overviewLabel`/`overviewProblem` (оба ВСЕГДА видимы в разметке — touch не имеет hover, тот же
    принцип, что уже был в предыдущем варианте плана, `docs/14` "touch не зависит от hover"), затем
    `CarouselNavControls`, меняющий `previewIndex` локально (без диспетча в редьюсер, без изменения
    URL).
  - **Новый `src/components/office/CarouselNavControls.tsx` (+ `.module.css`)** — презентационный,
    без своей бизнес-логики: `previousLabel`/`nextLabel: string` (для `aria-label`, включают имя
    целевого отдела, например "Предыдущий отдел: Отдел продаж"), `onPrevious`/`onNext: () => void`.
    Видимый текст кнопок короткий ("← Назад"/"Далее →" или аналог), полная семантика — в
    `aria-label`. CSS: `display: none` по умолчанию, `display: flex` только при `max-width: 767px`
    (единое правило работает одинаково в обоих местах использования — внутри
    `MobileDepartmentCarousel`, где хватило бы избыточно, так как родитель и так скрыт на ≥768px, и
    внутри `DepartmentExperience`, где это правило единственный механизм скрытия на Desktop/Tablet).
  - **`OfficeSemanticMap.module.css` — одна новая строка**: `@media (max-width: 767px) { .map {
    display: none; } }` — скрывает всю пространственную карту целиком на мобильном (заменяется
    каруселью). Никаких других изменений в `OfficeSemanticMap.tsx`/`DepartmentHotspot.tsx`/
    `.module.css` (отличие от предыдущего черновика — см. Objective, решение 3).
  - **`OfficeExperience.tsx` (+ `.module.css`)**:
    - overview-ветка: рендерит `MobileDepartmentCarousel` рядом с `interactionHint`/
      `OfficeSemanticMap` (использует уже вычисленный `sortedDepartments`).
    - department-active-ветка: `.shell10x90` при `≤767px` — `grid-template-columns: 1fr`,
      `grid-template-areas: "main"`, и явное `.railArea { display: none; }` (та же техника,
      найденная и исправленная skeptic Phase A round 1 предыдущего черновика — CSS Grid без явного
      `display:none` не убирает элемент из `grid-template-areas`-несовпадающей области, он
      возвращается к auto-placement).
    - Прокидывает вниз в `DepartmentExperience` два новых пропа: `departments` (тот же
      `sortedDepartments`) и уже существующий `onSelectDepartment` (переиспользуется, не создаётся
      заново) — единственная причина изменения `DepartmentExperienceProps`.
  - **`DepartmentExperience.tsx` (+ `.module.css`)** — новые пропы `departments: Department[]`,
    `onSelectDepartment: (id) => void`; вычисляет `prevId`/`nextId` из отсортированного массива
    относительно `department.id` (wrap-around по модулю длины массива); рендерит
    `CarouselNavControls` новым блоком после `.actions` (после CTA/«Закрыть» — тот же порядок
    "контент → навигация", что уже установлен для rail в Step 6 AC5) — видим только на ≤767px.
    `onClose`/кнопка «Закрыть» — без изменений, по-прежнему единственная кнопка "назад"
    (`docs/08` "Есть явная кнопка назад"), ведёт в `overview` (`CLOSE_DEPARTMENT`), не отличается от
    Desktop.
  - **`DepartmentCopy`/`OutcomePanel`/`DepartmentCTA` — `.module.css`-проходка на ≤767px**
    (typography/spacing, тот же паттерн, что уже есть для `max-height: 700px`), без изменения
    контракта — без изменений относительно прежнего черновика.
  - **Hero/Header на ≤767px** — без изменений относительно прежнего черновика (`.ctaRow` в колонку,
    типографика, проверка перекрытия лого/бренда на 320–375px).
  - **Проверка `<meta name="viewport">`** — без изменений относительно прежнего черновика.
  - **Тап-таргеты ≥44×44 CSS px** — теперь применяется к: карточке карусели, обеим кнопкам
    `CarouselNavControls` (в обоих местах использования), `DepartmentCTA`, кнопке «Закрыть», hero
    CTA.
  - **Клавиатура**: Tab в overview на ≤767px обходит [карточка-кнопка] → [Prev] → [Next] (контент
    сначала, навигация после — тот же принцип, что и в active-виде); Enter/Space на карточке
    открывает отдел; Enter/Space на Prev/Next — та же логика, что клик. В `department-active`: Tab —
    заголовок → symptoms/outcomes → CTA → «Закрыть» → Prev/Next (регрессия Step 6 AC5, расширенная
    новым хвостом вместо rail). **ArrowLeft/ArrowRight как ярлык переключения — намеренно НЕ
    добавляется** (см. Out of scope) — нативная `Tab`+`Enter/Space`-семантика кнопок уже
    удовлетворяет требованию клавиатурной доступности, дополнительный `keydown`-обработчик не нужен
    и увеличивал бы риск конфликта с уже существующим глобальным `Escape`-listener.
  - **`prefers-reduced-motion`** — без изменений относительно прежнего черновика; `CarouselNavControls`
    не вводит собственной анимации/keyframes.
  - **Инвариант "без скролла документа"** — без изменений относительно прежнего черновика.
  - **[OQ-M2 = (b), без изменений] Свайп не реализуется** — вся навигация каруселью только тап/
    клавиатура через `CarouselNavControls`; никакой `touchstart`/`touchmove`/`touchend`-обработки не
    вводится.
  - **[OQ-M4 = (a), без изменений] `interactionHint` не рендерится на ≤767px.**
  - **Server/client граница** — без изменений по существу (см. Objective, решение 4); явно
    зафиксировано, что новое ЛОКАЛЬНОЕ `useState`-состояние `MobileDepartmentCarousel` — не часть
    `OfficeMachineState`, не диспетчерит редьюсер, не синхронизируется с URL, пока пользователь не
    совершит явный тап "открыть".
  - **Обновлённые/новые unit-тесты**: новый `mobile-department-carousel.test.tsx`, новый
    `carousel-nav-controls.test.tsx`; `office-experience.test.tsx` (условный рендер карусели/карты/
    rail); `department-experience.test.tsx` (новые пропы `departments`/`onSelectDepartment`,
    wrap-around вычисление prev/next id).
  - **Новые e2e-тесты** `src/tests/e2e/mobile-touch-flow.spec.ts` (возможно, второй файл для
    клавиатуры — решается при исполнении, по прецеденту Step 3): `test.use({viewport:{width:375,
    height:812}, hasTouch:true, isMobile:true})`; полный поток: hero → `ACTIVATE_CTA` тапом →
    карусель показывает первую карточку → Next дважды (индекс меняется, URL/машина НЕ меняются,
    проверено явно) → тап по текущей карточке → открывается СООТВЕТСТВУЮЩИЙ (третьей по счёту, не
    первой) отдел → `SWITCH_DEPARTMENT` через Prev/Next в active-виде (URL меняется, без полной
    перезагрузки) → «Закрыть» возвращает в overview (карусель снова с индекса 0); wrap-around на
    обеих границах (от последнего "Next" → первый, от первого "Prev" → последний), проверено и для
    browse-режима, и для `SWITCH_DEPARTMENT`; прямой `?department=<id>` на мобильном viewport;
    тап-таргеты ≥44×44; отсутствие горизонтального/постраничного скролла;
    `prefers-reduced-motion`; клавиатурная регрессия; консоль-проверка dev/prod; полная регрессия
    существующих desktop (≥1280px) e2e-сьютов.

- Out of scope:
  - **Tablet 768–1279px** — по решению пользователя (**OQ-M1 = (c)**, `DECISIONS.md` 2026-07-16) БОЛЬШЕ
    НЕ безвладельческий gap: реализуется отдельным новым шагом **"Step 7.5 — Tablet touch flow"**
    (Amendment 4, см. ниже), физически следующим сразу за этим шагом. Этот шаг (Step 7) по-прежнему
    не реализует ничего для 768–1279px — граница не изменилась, изменился только факт наличия
    owner'а у соседнего диапазона.
  - `hover`/`pointer` capability-based адаптация — без изменений (breakpoint только по ширине).
  - Новые npm-зависимости — без изменений (не вводятся).
  - GSAP/WebGL/Canvas — без изменений.
  - Правка `data/*.json` — без изменений (OQ-M4 = (a), правка не требуется).
  - Новые состояния/действия редьюсера `office-machine` — без изменений (по-прежнему не вводятся;
    `previewIndex` — не редьюсер-состояние, см. Objective).
  - **ArrowLeft/ArrowRight как клавиатурный ярлык каруселей** — явный новый пункт (не существовал в
    (a)-варианте, так как там не было пейджинга) — намеренно не добавляется, см. In scope.
  - **Сохранение позиции карусели (`previewIndex`) между заходами в `overview`** — явный новый
    пункт: при каждом возврате из `department-active` в `overview` карусель показывает первый отдел
    списка, а не последний просмотренный/открытый — минимальный, раскрытый (не скрытый) UX-компромисс,
    см. Risks.
  - Живая индикация позиции "N из 5" (aria-live регион) — рассматривалась и намеренно отклонена как
    избыточная сложность для low-fidelity milestone: `aria-label` на кнопках Prev/Next уже несёт
    достаточный контекст ("Предыдущий отдел: <имя>"); при необходимости — дешёвое добавление позже,
    не требующее архитектурных изменений.
  - Диагностика, `contact-open`, `OfficeVisualLayer`, WebGL/Canvas, `FallbackExperience`,
    автоматизированное axe-сканирование, `/solutions/*`-навигация, `popstate`, дозаполнение
    `data/departments.json`, `MANIFEST.json`, CI pipeline — без изменений (все уже установленные для
    Steps 3–6 исключения остаются в силе).
  - `BeforeAfterSequence` — без изменений (по-прежнему не создаётся, OQ-C Step 6).
  - Реальная device-лаборатория — без изменений.
  - Landscape как отдельный формальный acceptance criterion — без изменений.

- Dependencies: Step 6 (`COMPLETED`, коммит `5756d8d`) — реальный коммит уже существует, прежняя
  находка skeptic Phase A round 1 ("Step 6 только застейджен") больше не актуальна, зависимость
  закрыта без остатка. Ответы пользователя на OQ-M1–OQ-M4 получены и зафиксированы 2026-07-16
  (`DECISIONS.md`) — открытых вопросов для ЭТОГО шага (в отличие от нового Step 7.5, см. ниже)
  больше нет.

- Expected files:
  - Новый `src/components/office/MobileDepartmentCarousel.tsx` + `.module.css`.
  - Новый `src/components/office/CarouselNavControls.tsx` + `.module.css`.
  - `src/features/office-machine/OfficeMachine.tsx` — точечная правка focus-restoration `useEffect`
    (найдено при skeptic Phase A review: fallback между `hotspot-<id>` и стабильным
    `mobile-department-carousel-card`, см. Objective выше) — единственная правка этого файла в этом
    шаге, редьюсер/действия не меняются.
  - `src/components/office/OfficeExperience.tsx` (+ `.module.css`) — рендер карусели, скрытие rail
    на ≤767px, проброс `departments`/`onSelectDepartment` в `DepartmentExperience`.
  - `src/components/office/OfficeSemanticMap.module.css` — одна новая CSS-строка (скрытие карты).
  - `src/components/departments/DepartmentExperience.tsx` (+ `.module.css`) — новые пропы, рендер
    `CarouselNavControls`.
  - `src/components/departments/DepartmentCopy.module.css`, `OutcomePanel.module.css`,
    `DepartmentCTA.module.css` — `≤767px`-проходка.
  - `src/components/homepage/HeroCopy.tsx` (+ `.module.css`), `Header.module.css` — без изменений
    относительно прежнего черновика.
  - `src/app/layout.tsx`, `playwright.config.ts` — условно, как в прежнем черновике.
  - Новый `src/tests/unit/components/office/mobile-department-carousel.test.tsx`.
  - Новый `src/tests/unit/components/office/carousel-nav-controls.test.tsx`.
  - Обновлённые `src/tests/unit/components/office/office-experience.test.tsx`,
    `src/tests/unit/components/departments/department-experience.test.tsx`.
  - Новый `src/tests/e2e/mobile-touch-flow.spec.ts` (возможно, второй файл).
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md` (процессные).
  - **Явно НЕ входят** (отличие от прежнего черновика): `src/components/office/DepartmentHotspot.tsx`
    и `.module.css` — не изменяются этим шагом.

- Acceptance criteria:
  1. На ≤767px `overview` рендерит РОВНО ОДНУ карточку отдела за раз (не пространственную карту, не
     список всех пяти одновременно) с видимыми `overviewLabel`/`overviewProblem` без наведения/фокуса.
  2. Кнопки Prev/Next в overview меняют показанную карточку (проверено для всех 5 позиций и обоих
     направлений, включая переход через границу списка по кругу), но НЕ диспетчируют
     `SELECT_DEPARTMENT`, НЕ меняют `?department=` в URL и НЕ переводят `office-machine` из состояния
     `overview` — проверено явно (URL/машина неизменны при пролистывании).
  3. Тап (`page.tap()`) или Enter/Space по текущей карточке открывает ИМЕННО показанный на тот момент
     отдел (`SELECT_DEPARTMENT`) — проверено после нескольких Next/Prev, не только для первого отдела
     по умолчанию.
  4. В `department-active` на ≤767px видимы `CarouselNavControls` (Prev/Next), а `DepartmentNavigationRail`
     не рендерится (`display:none`, вне Tab-последовательности); Prev/Next диспетчируют реальный
     `SWITCH_DEPARTMENT` (URL меняется, без полной перезагрузки), с wrap-around на обеих границах.
  5. Явная, всегда видимая кнопка «Закрыть» присутствует и тапается, пока отдел активен; активация
     возвращает в `overview` (карусель показывает первый отдел — см. AC 17), эффект идентичен `Escape`.
  6. **(найдено при skeptic Phase A review переработанного плана)** После закрытия отдела
     (`CLOSE_DEPARTMENT`/`Escape`), открытого через карусель на ≤767px, фокус реально переходит на
     видимый, focusable элемент (текущую кнопку-карточку карусели, стабильный id
     `mobile-department-carousel-card`) — не теряется молча на скрытом `display:none` хотспоте карты
     (регрессия исправленной находки: старая логика `OfficeMachine.tsx` целилась только в
     `hotspot-<id>`, который на мобильном скрыт). Проверено `document.activeElement` после закрытия
     — не `<body>` — для закрытия ЛЮБОГО из 5 отделов, не только первого по порядку (round 1 версия
     этого фикса ошибочно привязывала fallback-id к отделу, `carousel-card-<returnId>`, что ломалось
     бы для 4 из 5 отделов из-за сброса карусели на первый отдел при возврате в overview, AC 17;
     round 2 версия использует стабильный, не привязанный к отделу id).
  7. `DepartmentCTA` реально достижима, не обрезана; измерено минимум на двух характерных высотах.
  8. Все интерактивные тап-таргеты (карточка карусели, обе кнопки Prev/Next в обоих местах
     использования, CTA отдела, «Закрыть», hero CTA) — ≥44×44 CSS px.
  9. Нет горизонтального скролла ни на одной проверенной ширине ≤767px.
  10. Документ по-прежнему не скроллится целиком на ≤767px (`.shell` инвариант).
  11. Прямой URL `?department=<id>` на ≤767px открывает нужный отдел сразу — идентично Desktop.
  12. `prefers-reduced-motion: reduce` на ≤767px — все функциональные критерии выше идентичны.
  13. Клавиатура: Tab-порядок [карточка → Prev → Next] в overview и [заголовок → symptoms/outcomes →
      CTA → «Закрыть» → Prev/Next] в active-виде; Enter/Space на каждой из этих кнопок эквивалентен
      клику/тапу; ArrowLeft/ArrowRight не имеют специального обработчика (регрессия — нативное
      поведение браузера, если есть, не блокируется, но не тестируется как функция продукта).
  14. Ни один компонент, введённый/изменённый этим шагом, не импортирует `src/content/*` напрямую
      (grep-регрессия).
  15. Desktop-поведение (≥1280px) из Steps 3–6 не регрессирует; полный прогон существующих desktop
      e2e-сьютов без ослабления ожиданий — включая регрессию исправленной focus-restoration логики
      `OfficeMachine.tsx` на ≥1280px (fallback не должен ничего изменить на desktop: `hotspot-<id>`
      там реально видим и остаётся первым найденным кандидатом).
  16. `<meta name="viewport">` присутствует в отрендеренном HTML.
  17. **(специфичный для карусели)** После закрытия отдела (`CLOSE_DEPARTMENT`/`Escape`) и
      возврата в `overview` карусель детерминированно показывает первый (по тому же порядку
      сортировки, что rail/map) отдел — не последний просмотренный/открытый; поведение зафиксировано
      как ожидаемое (см. Out of scope), не проверяется как "сохранение позиции".
  18. Нет console/page errors на всём мобильном потоке (раскрытие → browse каруселью → открытие →
      переключение Prev/Next в active → закрытие → прямой URL) — отдельно в `npm run dev`, отдельно
      в production-сборке.
  19. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  20. `git diff --stat 5756d8d` (реальный коммит закрытия Step 6, не placeholder) ограничен списком
      Expected files.
  21. `DECISIONS.md` уже содержит записи по OQ-M1–OQ-M4 с реальным согласованием пользователя
      (получено 2026-07-16, до начала реализации) — новых записей для ЭТОГО шага не требуется, если
      при исполнении не возникнут новые, не предвиденные развилки (например, точный визуальный вид
      Prev/Next-кнопок — низкий риск, решается при исполнении, не требует нового OQ).
  22. Ни одна новая npm-зависимость не добавлена в `package.json`/`package-lock.json`.

- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  ```
  Плюс обязательная dev-mode console-проверка (тот же процессный прецедент, что Steps 5/6/прежний
  черновик Step 7):
  ```bash
  npm run dev
  # headless Playwright против http://localhost:3100 на 375×812 (hasTouch, isMobile): полный поток
  # (раскрыть → browse каруселью → открыть → переключить Prev/Next в active → закрыть → прямой
  # ?department=<id>) — зафиксировать console/pageerror, ожидается [].
  # Остановить dev-сервер после проверки.
  ```

- Manual checks:
  - Chrome DevTools device toolbar: iPhone SE (375×667), типичный Android (393×851), 320px крайний
    случай — карусель, Prev/Next, тап-таргеты, отсутствие горизонтального скролла.
  - Touch-симуляция — полный поток тапами, не кликами.
  - `prefers-reduced-motion: reduce` на мобильном viewport.
  - Быстрый регрессионный проход на Desktop ≥1280px.
  - `git diff --stat 5756d8d`.
  - Реальное устройство — опционально, не блокирует (как в прежнем черновике).

- Risks:
  - **Двойной рендер overview-дерева** (карта + карусель одновременно в DOM, CSS переключает
    видимость) — увеличивает поверхность e2e-тестирования Tab-порядка на обеих границах брейкпоинта;
    требует явной проверки, что скрытая ветка реально `display:none` (не просто визуально скрыта) на
    ОБЕИХ сторонах границы 767/768px.
  - **Сброс позиции карусели при каждом возврате в overview** (см. Out of scope/AC 17) — минимальный
    UX-компромисс: пользователь, открывший 4-й по счёту отдел, при закрытии снова видит 1-й — явно
    раскрыто, не скрытая деградация; легко улучшаемо позже передачей `initialIndex`.
  - **`CarouselNavControls` в двух разных родителях с разной семантикой действия** (локальный browse
    vs реальный `SWITCH_DEPARTMENT`) — риск путаницы при будущем рефакторинге, если кто-то забудет,
    что один и тот же компонент имеет два разных смысла в зависимости от места использования;
    смягчается явным комментарием-инвариантом в коде.
  - **Полагание на "ровно 5 отделов" для wrap-around без явной проверки границ** — тот же инвариант,
    на который уже полагается `DepartmentNavigationRail` ("4 доступных кнопки"); при изменении числа
    отделов в данных оба места потребуют пересмотра одновременно.
  - **Правка `OfficeMachine.tsx`, единственного файла state machine, затронутого этим шагом** (найдено
    при skeptic Phase A review, round 1/round 2) — focus-restoration fallback (`hotspot-<id>` →
    стабильный `mobile-department-carousel-card`) логически прост и не меняет ни редьюсер, ни
    действия, но это первая правка этого файла со Step 5; требует точной regression-проверки на
    Desktop/Tablet (AC 15), где `hotspot-<id>` по-прежнему должен оставаться первым найденным
    видимым кандидатом без поведенческих изменений. round 1 версия этой правки сама содержала баг
    (id, привязанный к `returnId`, а не стабильный) — round 2 исправлено, см. Objective/AC 6.
  - **Конфликт с `docs/03-office-map.md` "Mobile"** (найдено при skeptic Phase A review, Critical):
    буквальный текст документа — "Не уменьшенная карта, а отдельный touch-путь: обзор, **список
    отделов**, полноэкранная карточка отдела, явная кнопка назад и CTA" — описывает список, не
    карусель/пейджинг, и не упоминает прямое переключение между уже открытыми отделами.
    `docs/08-responsive-behavior.md` (единственный документ, процитированный в OQ-M3) формулирует
    расплывчато ("список/карусель отделов"), но `docs/03` формулирует однозначно и без вариантов —
    OQ-M3 не процитировал `docs/03` при формулировке вариантов, поэтому пользователь отвечал на
    OQ-M3=(b), не видя этого прямого текстового расхождения. Это неразрешённый на момент review
    конфликт с уже утверждённым документом (CLAUDE.md: "Never silently contradict approved
    documents. Report conflicts before implementation") — не решается исполнителем самостоятельно,
    вынесен пользователю отдельным вопросом (см. основную сессию/`DECISIONS.md`) до перевода этого
    плана в `APPROVED`.
  - **`100dvh`/`overflow:hidden` на реальных мобильных браузерах** — без изменений (существующий
    остаточный риск).
  - **Playwright touch-эмуляция — только Chromium** — без изменений (существующее ограничение).
  - **Content gap `docs/12` vs `data/departments.json`** — без изменений.
  - Scope creep: соблазн добавить свайп/ArrowLeft-ярлыки/сохранение позиции "заодно" — явно
    отклоняется ссылкой на явные решения выше.
- Rollback: `git revert` диапазона коммитов Step 7 (аддитивно относительно Step 6 — редьюсер/
  URL-sync не меняются, только новые компоненты + точечные правки существующих + CSS). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя.
- Профильный ревьюер (Phase D, милстоун-ревью после закрытия шага): `frontend-architect` и
  `qa-reviewer` — обязательны по CLAUDE.md; `ux-strategist` — обязателен (user-facing изменение
  навигационной парадигмы overview); `motion-engineer` — обязателен (новый переиспользуемый
  navigation-контрол в двух разных motion-контекстах, хотя сам не вводит новых CSS-анимаций).
- Skeptic verdict (review плана, Phase A, переработанная версия): _(rounds 1–3, 2026-07-16,
  относились к варианту (a) черновика и утратили силу после переработки под OQ-M3=(b)/OQ-M1=(c) —
  полный текст сохранён в git history для трассируемости, не повторяется здесь.)_ **round 1** (новый
  цикл, после переработки) — `BLOCKED`: (1) Critical — undisclosed конфликт с `docs/03-office-map.md`
  "Mobile" (буквально "список отделов", не карусель/пейджинг; OQ-M3 процитировал только `docs/08`,
  пользователь отвечал на OQ-M3 не видя этого расхождения) — не решается исполнителем самостоятельно,
  требует отдельного вопроса пользователю; (2) Critical — реальный, найденный по коду баг: focus-
  restoration `useEffect` в `OfficeMachine.tsx` целится в `hotspot-<id>`, который на ≤767px скрыт
  (`display:none`) — `.focus()` на скрытом элементе no-op, фокус после закрытия отдела молча
  терялся бы на мобильном; (3) Major — `Step 8` `Dependencies` не упоминает `Step 7.5`, хотя
  Amendment 4 делает Step 7.5 обязательным предшественником; (4) Major — запись `DECISIONS.md`
  "Step 7: ответы на OQ-M1–OQ-M4" описывает вариант (c) OQ-M1 как "аккуратную перенумеровку", но
  Amendment 4 в итоге выбрал нелинейную метку без перенумеровки — расхождение между записью решения
  и фактическим Amendment; (5) Minor — `Amendment 4` `Status: APPROVED` не различает утверждённое
  структурное решение и ещё не подтверждённую схему нумерации. Устранено: (1) конфликт с `docs/03`
  явно раскрыт в Risks выше и вынесен пользователю отдельным вопросом до `APPROVED` (см. основную
  сессию/`DECISIONS.md`); (2) `OfficeMachine.tsx` включён в Expected files с описанным fallback
  (`hotspot-<id>` → `carousel-card-<id>`, первый видимый кандидат), добавлен acceptance criterion 6
  + регрессионное дополнение к AC 15; (3)/(4)/(5) — см. соответствующие правки `WORKPLAN.md` Step 8
  `Dependencies`, `DECISIONS.md` (новая корректирующая запись) и `Amendment 4` `Status` ниже.
  **round 2** — `FAIL` (Critical×1, Major×1): (1) Critical — round 1 версия исправления (2) сама
  содержала баг: `carousel-card-${returnId}` предполагал существование карточки ЗАКРЫТОГО отдела в
  DOM, но карусель сбрасывается на первый отдел при каждом входе в `overview` (AC 17) — после
  закрытия любого НЕ первого по порядку отдела (4 из 5) `carousel-card-${returnId}` не существовал
  бы, fallback ловил бы `null`, фокус снова терялся бы; (2) Major — заголовок "## Open questions
  (Step 7) — RESOLVED 2026-07-16" стал вводящим в заблуждение после того, как round 1 нашёл новый
  открытый пункт (конфликт с `docs/03`) — заголовок и текст под ним по-прежнему буквально утверждали
  "все четыре вопроса решены... дальнейших действий не требуется", хотя `Completion evidence`
  того же документа уже ждал ответа на этот пятый, неформализованный пункт. Устранено: (1)
  fallback-id заменён со привязанного к отделу (`carousel-card-<returnId>`) на стабильный, не
  зависящий от конкретного отдела (`mobile-department-carousel-card` — карусель всегда рендерит
  ровно одну карточку с этим id, независимо от того, какой отдел она сейчас показывает); все
  упоминания в Objective/Expected files/AC 6/Risks синхронизированы с этим исправлением; (2)
  конфликт с `docs/03` формализован как **OQ-M5** в разделе "Open questions (Step 7)" ниже (заголовок
  раздела переименован, чтобы не утверждать "всё решено"), с явными вариантами ответа. **round 3**
  (финальный) — `PASS`: fallback-код независимо переизведён skeptic'ом из реального кода редьюсера/
  `OfficeExperience.tsx` (не с чужих слов) — подтверждено отсутствие race-условия (`CLOSE_COMPLETE`
  атомарно переводит `view`/`activeDepartmentId` в одном commit, focus-`useEffect` срабатывает уже
  после того, как `MobileDepartmentCarousel` смонтирована и показывает индекс 0 — `mobile-
  department-carousel-card` гарантированно существует и видим к моменту вызова `.focus()`); OQ-M5
  сформулирован непредвзято (оба документа процитированы дословно); заголовок "RESOLVED" больше не
  дублируется/не противоречит; `WORKLOG.md` Entry 7 — без дублей подразделов; git-индекс
  синхронизирован; `src/**` не менялся за все 3 раунда. Цикл коррекции плана завершён.
- Skeptic findings (Phase A): round 1 (переработанная версия) — 2 Critical + 2 Major + 1 Minor,
  устранены в round 2; round 2 — 1 Critical (баг в собственном round-1 исправлении) + 1 Major
  (вводящий в заблуждение заголовок "RESOLVED"), устранены в round 3; round 3 — Blocker/Critical/
  Major/Minor нет, план готов к показу пользователю.
- Completion evidence: план прошёл skeptic Phase A round 3 `PASS` (после round 1 `BLOCKED` → round 2
  `FAIL` → round 3 `PASS`, полная история — три раунда, все находки устранены и независимо
  переподтверждены). Все ранее гейтившие пункты закрыты 2026-07-16: (a) OQ-M5 (конфликт с `docs/03`)
  = (a) "подтвердить карусель, поправить docs/03" — `docs/03-office-map.md` "Mobile" честно
  переписан; (b) OQ-T1 (Step 7.5) = (b) "показывать как есть" (**тем же днём переопределён
  `Amendment 5`** — см. `DECISIONS.md` "OQ-T1 переопределён"); (c) схема нумерации "Step 7.5"
  подтверждена (`Amendment 4`). `Status` переведён в `APPROVED` этой же правкой — см.
  `DECISIONS.md` 2026-07-16 "Step 7/Step 7.5: OQ-M5, схема нумерации..." для полного согласования.
  **Phase B (реализация, 2026-07-16):** выполнена полностью по плану выше, без изменения scope —
  доказательства (список изменённых файлов, реальный вывод всех 6 verification commands, отдельная
  dev-mode console-проверка, known limitations) см. `WORKLOG.md` Entry 8. Skeptic Phase B round 1 —
  `FAIL` (1 Critical + 3 Major + 1 Minor, устранены в "Correction iteration 1", без amendment); round
  2 — `PASS`, без находок (`WORKLOG.md` Entry 8 "Skeptic review (Phase B, round 2)"). `Status`
  переведён в `PASSED` этой же правкой — ждёт явного подтверждения пользователем для перехода в
  `COMPLETED` (README.md "Правила статусов").

## Open questions (Step 7) — OQ-M1–OQ-M5 RESOLVED 2026-07-16

**История заголовка (для трассируемости):** изначально этот раздел назывался "— RESOLVED" после
того, как пользователь ответил на OQ-M1–OQ-M4. Skeptic Phase A review (round 2, Major finding)
отметил, что это стало ложным утверждением, как только round 1 того же review нашёл новый, ещё не
решённый пункт (конфликт с `docs/03-office-map.md`, формализован ниже как **OQ-M5**) — заголовок
был переименован в "OQ-M1–OQ-M4 RESOLVED, OQ-M5 OPEN". Пользователь ответил на OQ-M5 2026-07-16
(см. ниже) — все пять вопросов теперь решены, заголовок обновлён финально.

Первые четыре вопроса (OQ-M1–OQ-M4) заданы пользователю напрямую через `AskUserQuestion` 2026-07-16.
Ответы: **OQ-M1 = (c)** — сейчас же добавить отдельный Tablet-шаг (Amendment 4, см. "Step 7.5 —
Tablet touch flow" ниже); **OQ-M2 = (b)** — свайп не реализуется (совпало с default черновика);
**OQ-M3 = (b)** — горизонтальная карусель/пейджинг (разошлось с default черновика (a), потребовало
переработки секции Step 7 выше); **OQ-M4 = (a)** — `interactionHint` не рендерится на ≤767px
(совпало с default черновика). Полный текст исходных вариантов сохранён ниже для истории/
трассируемости — решения уже зафиксированы в основной секции Step 7 выше и в `DECISIONS.md`.

**OQ-M5. Конфликт формулировки OQ-M3 с `docs/03-office-map.md` "Mobile" (найдено при skeptic
Phase A review, round 1, после того как пользователь уже ответил на OQ-M3). Ответ пользователя
(2026-07-16, `AskUserQuestion`): вариант (a).**
`docs/08-responsive-behavior.md` (единственный документ, процитированный при формулировке OQ-M3)
описывает mobile-путь расплывчато — "список/карусель отделов", оставляя выбор между ними открытым.
Но `docs/03-office-map.md` "Mobile" формулировал это же однозначно: *"Не уменьшенная карта, а
отдельный touch-путь: обзор, **список отделов**, полноэкранная карточка отдела, явная кнопка назад
и CTA"* — буквально "список", без упоминания карусели/пейджинга или прямого переключения между уже
открытыми отделами. OQ-M3 не процитировал этот текст `docs/03`, поэтому пользователь, выбирая
OQ-M3 = (b) (горизонтальная карусель), не видел этого прямого текстового расхождения с уже
утверждённым документом (CLAUDE.md: "Never silently contradict approved documents. Report conflicts
before implementation"). Полный текст исходных вариантов сохранён ниже для истории/трассируемости.
- (a) **[Выбрано]** Подтвердить OQ-M3 = (b) (карусель) как осознанный, теперь явно раскрытый выбор,
  переопределяющий буквальный текст `docs/03` — `docs/03` "Mobile" честно исправлен под фактическое
  поведение (тот же прецедент, что уже применялся к `docs/05` дважды — Step 3/Step 5, "honesty-правка
  после skeptic FAIL"). Реализовано этой же правкой — см. `docs/03-office-map.md`.
- (b) Пересмотреть OQ-M3 в пользу буквального текста `docs/03` — вернуться к варианту (a)
  исходного OQ-M3 (вертикальный список + полноэкранная карточка без прямого переключения между
  отделами), откатив архитектуру Step 7 к её первому черновику (уже существовал, прошёл 3 раунда
  review, сохранён в git history).
- (c) Гибридный вариант — например, список для overview (буквально по `docs/03`), но с прямым
  переключением между отделами внутри уже открытой карточки (частично сохраняет технические решения
  этого черновика) — потребует отдельной проработки `planner`'ом, если выбран.

**OQ-M1. Диапазон Tablet 768–1279px.**
`docs/08` описывает три разных breakpoint-раздела (Desktop ≥1280 — реализован; Tablet 768–1279 —
не реализован; Mobile ≤767 — предмет этого шага). Название и наследованный из 9-шагового скелета
scope Step 7 — буквально "Mobile touch flow", не "Tablet". Если Step 7 реализует только ≤767px,
диапазон 768–1279px продолжит показывать буквальную desktop 10/90-раскладку/пространственную карту
(уже собранную в Steps 3–6) — с hover-only раскрытием `overviewProblem` и мелкими тап-таргетами,
непроверенными для планшета, что напрямую противоречит `docs/08` Tablet ("hover не обязателен;
выбор кликом/касанием; крупные touch targets") и Responsive rules CLAUDE.md ("Tablet supports
pointer and touch").
- (a) Step 7 — строго ≤767px; Tablet 768–1279 — явный, названный gap, остаётся без owner-шага до
  отдельного будущего решения.
- (b) Порог этого шага расширяется до `<1280px` целиком (Tablet получает то же touch-first
  списочное/карточное решение, что и Mobile, без отдельной "более широкой панели", которую `docs/08`
  формально приписывает именно Tablet).
- (c) Step 7 остаётся ≤767px как в (a), но уже сейчас в план добавляется отдельный, новый шаг для
  Tablet 768–1279 — требует формального Amendment к утверждённому 9-шаговому скелету (тот же класс
  процедуры, что Amendment 3).

**OQ-M2. Глубина реализации свайпа.**
`docs/08`: "Свайп только как дополнительный способ" — необязателен. Полноценная реализация требует
самописной обработки touch-событий (без новой библиотеки, по существующему архитектурному
ограничению) — нетривиальный, автономно тестируемый класс кода.
- (a) Реализовать минимальный самописный свайп сейчас — строго дополнительный, не единственный,
  способ переключения/возврата.
- (b) Не реализовывать свайп в этом шаге — только тап/клавиатура (уже полностью удовлетворяет
  `docs/08`, так как свайп необязателен); отложить как отдельную будущую задачу.
- (c) Ввести стороннюю gesture/carousel-библиотеку — первая новая UI-зависимость со времён `zod`
  (Step 2), требует отдельного согласования и записи в `DECISIONS.md`, аналогично `zod`.

**OQ-M3. Представление списка отделов и переключение между уже открытыми отделами.**
`docs/08`-путь называет шаг "список/карусель отделов", не выбирая между ними; это также определяет,
есть ли на мобильном экране активного отдела какой-либо прямой способ перейти к другому отделу
(аналог desktop `SWITCH_DEPARTMENT`/rail) или единственный путь — «назад» → список → выбрать снова
(редьюсер это всё равно поддерживает, вопрос только в том, что диспетчерит мобильный UI).
- (a) Вертикальный прокручиваемый список для overview; открытый отдел — только полноэкранная
  карточка + кнопка «назад»; без rail, без прямого переключения между отделами — возврат к другому
  отделу всегда через список.
- (b) Горизонтальная карусель/пейджинг — одна "карточка" отдела видна с самого начала (включая
  overview), переключение через кнопки и/или свайп (см. OQ-M2); прямое переключение между соседними
  отделами без промежуточного экрана списка (использует `SWITCH_DEPARTMENT`, аналогично
  rail-переключению на desktop, но постранично).
- (c) Вертикальный список для overview, как в (a), но при активном отделе рядом с кнопкой «назад»
  появляется пара кнопок "следующий/предыдущий отдел" (не rail, не карта) — промежуточный вариант
  между (a) и (b).

**OQ-M4. Копия `interactionHint` ("Наведите курсор на отдел") на мобильном.**
Единственная существующая строка в `data/homepage-copy.json`, буквально предписывающая hover —
показ как есть на touch противоречит Motion rules CLAUDE.md.
- (a) Не рендерить `interactionHint` на ≤767px вовсе (список самообъясним визуально); правка
  контента не требуется.
- (b) Показывать текст как есть на ≤767px — принять как известный, невысокой критичности
  content-mismatch (по аналогии с уже принятыми content gaps, например `beforeSteps`/
  `automationSteps` из Step 2), не блокирующий этот шаг.
- (c) Признать это реальным content gap, требующим новой строки копии в `data/homepage-copy.json` —
  правка `data/*.json`, которая до сих пор явно оставалась вне scope каждого предыдущего шага;
  потребует отдельного согласования на расширение scope.

## Step 7.2 — Overview full-screen (hide hero)

- Status: `COMPLETED` (пользователь явно подтвердил закрытие, 2026-07-17: «Закрывай Step 7.2 и
  Step 7.4. Как закроешь, остановись и сообщи.»).
- Status history (closure): `PASSED` (2026-07-16, skeptic Phase B round 2 `PASS`, без находок) →
  `COMPLETED` (2026-07-17).
- Status history: `APPROVED` → `IN_PROGRESS` (Phase B начата) → `AWAITING_SKEPTIC` → skeptic Phase B
  round 1 `FAIL` (3 blocking: AC2/AC5 не проверялись для `secondaryCta`; AC9 no-JS не проверяла `h1`
  для `?department=<id>`; AC7 Manual checks не покрывали 1280×500/Tablet) → исправлено (2 новых
  e2e-теста secondaryCta, 1 доп. проверка no-JS, Manual checks выполнены и записаны) →
  `AWAITING_SKEPTIC` → skeptic Phase B round 2 `PASS` (без находок, все 5 конкретных пунктов
  проверены независимо, включая реальный повторный прогон всех 6 verification commands) →
  `PASSED`.
- Status history: `PROPOSED` → planner Phase A (2026-07-16, полностью детализирован) → `BLOCKED`
  (skeptic Phase A round 1 — противоречие с `APPROVED` Step 7.5 OQ-T1=(b)) → пользователь разрешил
  противоречие через `AskUserQuestion` (`DECISIONS.md` "OQ-T1 переопределён"), `Amendment 5`
  формально обновил Step 7.5 → `PROPOSED` → `FAIL` (skeptic Phase A round 2 — AC12 Step 7.5 не
  привязан ни к одному verification-пункту) → исправлено inline (без нового согласования
  пользователя — правка не меняла решение, только дополняла verification-план) → `PROPOSED` →
  `APPROVED` (skeptic Phase A round 3 `PASS`, 2026-07-16).
- Objective: В состоянии `overview` (`docs/05-homepage-state-machine.md`, правка 2026-07-16) и во
  всех `department-*`-состояниях скрыть весь hero-блок (заголовок, подзаголовок, короткие
  обещания, обе CTA) и подсказку `interactionHint` ("Наведите курсор на отдел") — офис (карта
  отделов на Desktop/Tablet, карусель на Mobile) занимает весь экран под `Header`. Hero остаётся
  видимым только в состоянии `hero` (до `ACTIVATE_CTA`) — не меняется (`docs/05` "## hero").
  Решение принято пользователем и не пересматривается этим планом (`DECISIONS.md` 2026-07-16
  "Overview: офис на весь экран, hero скрывается") — эта секция только детализирует реализацию.

  **Почему это один шаг, а не несколько.** Скрытие hero и `interactionHint` — одно решение
  пользователя (одна запись `DECISIONS.md`), но технически неотделимо от трёх прямых следствий,
  найденных при этом Phase A review (не открытые вопросы — обоснованные технические решения,
  описанные ниже): (1) `HeroCopy` — единственный focusable-блок, содержащий сам элемент, по
  которому пользователь только что кликнул (`primaryCta`/`secondaryCta`) — его скрытие без
  дополнительной меры означает потерю фокуса на `<body>`, что напрямую нарушает уже принятое
  `docs/11-accessibility.md` ("Focus" — "отсутствие потери focus при transition"); (2) `.office`
  ранее не имел собственного верхнего отступа, потому что визуальный отступ от `Header`
  обеспечивал `padding` самого `HeroCopy` — без него карта/карусель окажутся вплотную к `Header`;
  (3) `interactionHint` рендерится в той же ветке `OfficeExperience.tsx`, что уже частично скрыта
  ограниченным CSS-правилом (Step 7, только ≤767px) — расширение этого правила на все ширины
  логически то же самое действие, что и решение про hero, и правится тем же коммитом. Разносить
  эти три следствия по отдельным шагам означало бы либо оставить очевидную регрессию доступности
  между шагами (недопустимо), либо создать искусственно несамостоятельные шаги, которые нельзя
  верифицировать по отдельности — оба варианта хуже одного связного шага.

  **Технические решения этого шага (Phase A, не открытые вопросы):**
  1. **Механизм скрытия HeroCopy — тот же паттерн, что уже используется для `OfficeExperience`
     (`isRevealed`/`hiddenUntilRevealed`), не новый; проп называется иначе, чем на
     `OfficeExperience`, во избежание одноимённого пропа с противоположным смыслом** (skeptic
     Phase A round 1, non-blocking: `isRevealed=true` значит "показан" на `OfficeExperience", но
     значило бы "скрыт" на `HeroCopy` — то же значение, обратный смысл имени). `OfficeMachine.tsx`
     уже вычисляет `const isRevealed = state.view !== "hero"` и передаёт его в `OfficeExperience`.
     Тот же булев (то же значение, не инверсия) передаётся новым проп **`isHiddenAfterReveal`** в
     `HeroCopy` (не `isRevealed` — другое имя для того же значения, чтобы имя пропа совпадало с
     его эффектом на каждом конкретном компоненте); `HeroCopy` применяет новый CSS-класс
     (например, `styles.hiddenAfterReveal`) при `isHiddenAfterReveal === true`.
     `HeroCopy.module.css` получает правило `:global(.js) .hiddenAfterReveal { display: none; }`
     — **обязательно `:global(.js)`-gated, как у `hiddenUntilRevealed`, а НЕ безусловное
     `display:none`** (в отличие от решения 3 ниже про `interactionHint`) — это единственный
     способ сохранить уже принятое и протестированное no-JS поведение (`docs/05` "## hero":
     "Без JavaScript... hero и overview рендерятся одновременно" — этот абзац прямо не меняется
     данным шагом). Ошибочное безусловное скрытие сломало бы уже пройденный e2e-тест
     `office-overview-keyboard.spec.ts` "works with JavaScript disabled...".
  2. **Focus-management после `ACTIVATE_CTA` — новая ветка в уже существующем `useEffect`
     `OfficeMachine.tsx`** (том же, что уже обрабатывает focus при открытии/закрытии отдела, не
     новый эффект). Условие `state.view === "overview" && previousView === "hero"` (тот же принцип,
     что уже используется для `previousView === "department-closing"`); при срабатывании — focus
     программно переводится на первый доступный интерактивный элемент внутри только что
     раскрытой панели офиса: первую кнопку внутри `[aria-label="Отделы компании"]` (Desktop/
     Tablet) либо, если она не видима (`offsetParent === null`), первую кнопку внутри
     `[aria-label="Карусель отделов"]` (Mobile) — тот же принцип "перебрать кандидатов, взять
     первый видимый", что уже применён для close-fallback (Step 7, AC 6). Специально НЕ
     привязывается к конкретному `departmentId`/сортировке зон в `OfficeMachine.tsx` — это
     избегает дублирования сортировки `officeZones` по (y,x), уже инкапсулированной в
     `OfficeSemanticMap.tsx`/`OfficeExperience.tsx`: DOM-порядок кнопок внутри `nav[aria-label=
     "Отделы компании"]` уже совпадает с этой сортировкой (проверено по коду
     `OfficeSemanticMap.tsx`), поэтому "первая кнопка в DOM" эквивалентна "первому отделу по
     принятому порядку" без явного пересчёта.
     **Обоснование отсутствия race condition** (тот же класс анализа, что независимо
     переизведён skeptic'ом для close-fallback в Step 7 round 3): переход `hero → overview` по
     `ACTIVATE_CTA` — синхронный, без промежуточного таймера/`*-opening`-состояния (в отличие от
     открытия отдела); `isRevealed`/новый hero-класс обновляются в одном React-commit; `useEffect`
     выполняется после коммита DOM, когда `.hiddenUntilRevealed` уже снят и хотспоты/карусель уже
     имеют `offsetParent !== null` — безопасно вызывать `.focus()` сразу.
     **На boot (`initialRevealed=true` через `?department=...`, включая невалидный id) эта ветка
     не срабатывает** — `previousViewRef` инициализируется текущим `state.view` при монтировании
     (`useRef(state.view)`, а не `null`), поэтому на первом рендере `previousView === state.view`
     и переход не детектируется — тот же, уже существующий инвариант, что и у close-fallback
     (не переиспользуется явно, но следует из уже существующего кода без изменений в этой части).
  3. **`interactionHint` — расширение уже существующего CSS-правила Step 7, не новый
     механизм.** `OfficeExperience.module.css`: `@media (max-width: 767px) { .hint { display:
     none; } }` заменяется на безусловное `.hint { display: none; }` (без media-обёртки,
     без `:global(.js)`-обёртки — умышленно ДРУГОЙ механизм, чем у hero, п.1). Разница обоснована:
     формулировка решения пользователя ("подсказка... полностью скрывается на ВСЕХ
     breakpoint'ах") не делает исключения для no-JS, а `:hover`/`:focus`-раскрытие
     `overviewProblem` у `DepartmentHotspot` — чистый CSS-псевдокласс, продолжающий работать без
     JS независимо от исчезновения текстовой подсказки; сохранение `HeroCopy` рендерящимся в
     no-JS (п.1) не требует того же для `interactionHint`, так как это два отдельных, явно
     разведённых в тексте решения пользователя случая. Разметка (`<p>{interactionHint}</p>`) и
     проп `interactionHint`/`copy.interactionHint` (схема `HomepageCopy`) НЕ удаляются — тот же
     принцип минимального diff, что уже применён к Step 7 (CSS-сокрытие, не удаление кода/схемы).
  4. **Верхний отступ `.office`.** `OfficeExperience.module.css` `.office { padding: 0
     var(--space-6) var(--space-6); }` → `padding: var(--space-6);` (единообразный отступ по
     всем сторонам, восстанавливает визуальный зазор от `Header`, ранее обеспечивавшийся
     собственным `padding` исчезающего `HeroCopy`). Безусловное изменение (не gated ни по
     breakpoint, ни по `.js`) — в состоянии `hero` `.office` целиком скрыт через
     `hiddenUntilRevealed`, поэтому изменение отступа там невидимо и безопасно. Точное значение
     (переиспользование токена `var(--space-6)`, того же, что был у `HeroCopy`) — рекомендация,
     не жёсткое требование; финальная величина — техническая настройка исполнителя при визуальной
     проверке (тот же прецедент, что desktop-значение 14% rail в Step 6).
  5. **Без анимации/перехода.** Исчезновение hero — мгновенный CSS-класс-тоггл, без fade/transition
     (тот же паттерн, что уже используется для `hiddenUntilRevealed`); полировка motion — вне
     scope текущего low-fidelity milestone (см. Out of scope).

- In scope:
  - `HeroCopy.tsx`/`HeroCopy.module.css` — новый проп `isHiddenAfterReveal`, новый CSS-класс/
    правило скрытия (решение 1).
  - `OfficeMachine.tsx` — проброс `isHiddenAfterReveal` в `HeroCopy`; новая ветка в существующем
    focus-management `useEffect` (решение 2). Редьюсер/действия/состояния **не меняются**
    (те же 6 состояний/8 действий, что и в Steps 5–7).
  - `OfficeExperience.module.css` — безусловное скрытие `.hint` (решение 3); верхний отступ
    `.office` (решение 4).
  - Обновление существующих unit/e2e тестов Steps 3–7, чьи допущения устарели из-за этого шага
    (полный список — см. Expected files/Risks ниже, а не общая формулировка).
  - Новые unit/e2e тесты, специфично проверяющие: исчезновение hero/подсказки на всех
    breakpoint'ах и во всех `department-*`-состояниях; сохранение фокуса после `ACTIVATE_CTA`;
    сохранение no-JS поведения hero; регрессия отступа/отсутствия наложения с `Header`.
  - `README.md` — исправление уже устаревшей строки статуса "7" (`Не приступили` →
    `Выполнено`, отражая явное подтверждение пользователя) и добавление строки "7.2".
- Out of scope:
  - `Step 7.3` (Department view redesign, боль/выгода 20/80, фото в панели) — не реализуется
    этим шагом; `DepartmentExperience`/`DepartmentCopy`/`OutcomePanel` внутреннее содержимое не
    трогается, только внешний контейнер `.office` (отступ) и соседний `HeroCopy` (видимость).
  - `Step 7.5` (Tablet-специфичные CSS-адаптации: ширина rail, hover-gating, тап-таргеты) — не
    реализуется этим шагом; Tablet автоматически наследует эффект этого шага (общий код), но
    формальное автоматизированное e2e-покрытие Tablet-диапазона остаётся ответственностью Step
    7.5 (её Dependencies уже ссылаются на этот шаг) — этот шаг ограничивается ручной DevTools-
    проверкой на Tablet-ширинах (см. Manual checks), не новым `*.spec.ts`-файлом для Tablet.
  - Mobile-карусель — внутренняя логика `MobileDepartmentCarousel`/`CarouselNavControls` (Step 7,
    только что подтверждён) не меняется; этот шаг только влияет на видимость соседнего `HeroCopy`
    и на общий CSS `.hint`.
  - Fade/transition-анимация исчезновения hero — намеренно не вводится (решение 5).
  - Правка `data/*.json`/`content/schema.ts`/`content/types.ts` — не требуется; поле
    `interactionHint` остаётся в модели данных, просто не рендерится видимо.
  - Правка `docs/05-homepage-state-machine.md`/`docs/03-office-map.md` — не требуется этим шагом:
    оба уже honesty-поправлены 2026-07-16, ДО этого Phase A прохода (см. `DECISIONS.md`); если
    при реализации обнаружится новое расхождение текста с фактическим поведением — обязательна
    честная правка тем же коммитом (не молчаливое игнорирование), но заранее это не планируется.
  - `Header.tsx`/`Header.module.css` — не меняются; визуальный отступ решается со стороны
    `.office` (решение 4), не со стороны `Header`, чтобы не расширять blast radius на компонент,
    прямо не упомянутый в решении пользователя.
  - Новые npm-зависимости — не вводятся.
  - Реальная device-лаборатория, автоматизированное axe-сканирование, диагностика,
    `contact-open`, `OfficeVisualLayer`/WebGL, `/solutions/*`-навигация, `popstate`, дозаполнение
    `data/departments.json`, `MANIFEST.json`, CI pipeline — все уже установленные для Steps 3–7
    исключения остаются в силе без изменений.
- Dependencies: **Step 7 (`COMPLETED`, подтверждено пользователем 2026-07-16)** — прямая,
  функциональная зависимость: этот шаг правит тот же `OfficeExperience.module.css` и тот же
  `OfficeMachine.tsx`, что и Step 7, и его Expected files описаны как diff поверх результата
  Step 7 (включая `MobileDepartmentCarousel`/фокус-fallback на `mobile-department-carousel-card`).
  **Важный факт, найденный при подготовке этого Phase A (не блокер, но должен быть учтён
  исполнителем до начала работы):** по состоянию git на момент этого review код-изменения Step 7
  (`MobileDepartmentCarousel.tsx`, правки `OfficeExperience.tsx`/`OfficeMachine.tsx` и т.д.) **ещё
  не закоммичены** — существуют как unstaged/untracked изменения рабочего дерева (`git status`).
  Рекомендация: закоммитить результат Step 7 отдельным коммитом ДО начала реализации Step 7.2 —
  иначе `git diff --stat`-проверка (Acceptance criteria) и чистый rollback этого шага не будут
  однозначно отделимы от несохранённых изменений Step 7. Это решение процесса, не архитектуры —
  не требует Amendment, только последовательности действий исполнителя (коммит — с явного согласия
  пользователя, `CLAUDE.md` "Safety").
- Expected files:
  - `src/components/homepage/HeroCopy.tsx` — новый проп `isHiddenAfterReveal: boolean`, условный
    CSS-класс.
  - `src/components/homepage/HeroCopy.module.css` — новое `:global(.js)`-gated правило скрытия
    (решение 1).
  - `src/features/office-machine/OfficeMachine.tsx` — проброс `isHiddenAfterReveal` в `HeroCopy`; новая
    ветка в существующем focus-management `useEffect` (решение 2). Единственная логическая
    правка помимо проброса пропа.
  - `src/components/office/OfficeExperience.module.css` — безусловное `.hint { display: none; }`
    (решение 3, замена media-scoped правила Step 7); отступ `.office` (решение 4).
  - `src/tests/unit/components/homepage/hero-copy.test.tsx` — все 5 существующих `render(<HeroCopy
    copy={copy} onActivate={...} />)` дополняются `isHiddenAfterReveal={false}` (сохраняет
    буквальное текущее поведение тестов без изменения их смысла); новый 6-й тест:
    `isHiddenAfterReveal={true}` → скрывающий класс присутствует (структурная проверка, как для
    `OfficeExperience` — реальное CSS-сокрытие остаётся верифицируемым только в e2e, тот же
    задокументированный лимит jsdom).
  - `src/tests/unit/home-page.test.tsx` — новый тест: после клика по `primaryCta`
    `document.activeElement` — не `<body>`, а элемент внутри `nav[aria-label="Отделы компании"]`
    (структурная проверка нового focus-management, решение 2); 6 существующих тестов — без
    изменений содержания (проверено выше построчно: ни один не зависит от видимости hero после
    `ACTIVATE_CTA`).
  - `src/tests/e2e/office-overview.spec.ts`:
    - Rewrite теста "low-height desktop... heading/CTA never clipped..." (текущие строки ~169–208):
      проверки `boundingBox` для `h1`/`primaryCta` переносятся ДО `activateCta(page)` (состояние
      `hero`, где эти элементы по-прежнему обязаны быть видимы и не обрезаны — регрессия
      неизменна); проверки минимального размера хотспотов остаются ПОСЛЕ `activateCta(page)`
      (состояние `overview`) без изменений.
    - Новый тест: после `activateCta(page)` — `h1`/`primaryCta`/`secondaryCta`/текст
      `interactionHint` отсутствуют в дереве доступности (`toHaveCount(0)`/`not.toBeVisible()`);
      после клика по хотспоту (переход в `department-active`) — та же проверка повторяется
      (регрессия сохранения скрытости во всех `department-*`-состояниях, п. Objective/AC 3).
    - Новый тест (или расширение предыдущего): сразу после `activateCta(page)`, без каких-либо
      `Tab`, `document.activeElement` — первая кнопка `nav[aria-label="Отделы компании"]`
      (проверка решения 2 на Desktop).
  - `src/tests/e2e/office-overview-keyboard.spec.ts` — Rewrite теста "hidden hotspots are not
    reachable by Tab before ACTIVATE_CTA..." (текущие строки ~19–54): убрать цикл "Tab до 20 раз,
    пока не достигнут первый хотспот" (основан на устаревшем допущении "primaryCta/secondaryCta
    предшествуют карте в Tab-порядке"); заменить на прямую проверку — сразу после
    `activateCta(page)` фокус уже на первом хотспоте (`expectedOrder[0]`, без Tab), затем
    `Tab` по оставшимся 4 (тот же итог — полный проход по 5 хотспотам с видимым focus-ring,
    просто с исправленной начальной точкой).
  - `src/tests/e2e/mobile-touch-flow.spec.ts` — новый тест: после `activateCta(page)` на
    мобильном viewport — `h1`/`primaryCta`/`secondaryCta`/`interactionHint`-текст отсутствуют;
    `document.activeElement.id === "mobile-department-carousel-card"` (решение 2 на Mobile, ранее
    Step 7 явно НЕ реализовывал скрытие hero — см. Risks).
  - `README.md` — строка "7" исправлена на `Выполнено`; новая строка "7.2" (`Не приступили` до
    старта реализации).
  - `WORKPLAN.md` (эта секция — переходы статуса по ходу исполнения), `WORKLOG.md` (новая запись
    при исполнении).
  - **Явно НЕ входят:** `docs/05-homepage-state-machine.md`, `docs/03-office-map.md` (уже честно
    поправлены до этого Phase A, см. Out of scope); `content/schema.ts`, `content/types.ts`,
    `data/*.json` (модель данных не меняется); `Header.tsx`/`.module.css`; редьюсер
    `src/features/office-machine/reducer.ts` (те же состояния/действия); `DepartmentExperience`/
    `DepartmentCopy`/`OutcomePanel`/`DepartmentCTA`/`MobileDepartmentCarousel`/
    `CarouselNavControls`/`OfficeSemanticMap`/`DepartmentHotspot` — их внутреннее содержимое не
    меняется этим шагом (только внешний `.office`-контейнер и `HeroCopy`).

- Acceptance criteria:
  1. В состоянии `hero` (до `ACTIVATE_CTA`) `HeroCopy` (заголовок/подзаголовок/обещания/обе CTA)
     видим без изменений относительно Step 3/4 — регрессия.
  2. Сразу после `ACTIVATE_CTA` (любой из двух CTA) весь `HeroCopy`-блок отсутствует в дереве
     доступности (не просто визуально скрыт) — проверено для primary и secondary CTA отдельно.
  3. `HeroCopy` остаётся скрытым во ВСЕХ состояниях `overview`/`department-opening`/
     `department-active`/`department-switching`/`department-closing`, включая после открытия
     конкретного отдела — не только сразу после раскрытия overview.
  4. `interactionHint` ("Наведите курсор на отдел") не присутствует в дереве доступности ни на
     одной ширине — Desktop (≥1280px), Tablet (768–1279px, ручная проверка), Mobile (≤767px) —
     расширение уже принятого для Mobile правила Step 7 на все ширины.
  5. Сразу после `ACTIVATE_CTA`, без единого нажатия `Tab`, `document.activeElement` — реальный,
     видимый, focusable элемент внутри только что раскрытой панели офиса (первый хотспот на
     Desktop/Tablet; `mobile-department-carousel-card` на Mobile), не `<body>` — проверено для
     обеих CTA (primary/secondary) и отдельно для Desktop/Mobile viewport.
  6. Существующее focus-management поведение (программный focus на заголовок при открытии
     отдела; возврат focus на хотспот/карточку карусели при закрытии) не регрессирует — те же
     проверки Steps 5–7 проходят без изменений их логики/ожиданий.
  7. `.office`-панель визуально не соприкасается с `Header` (измеримый зазор, соответствующий
     ранее использовавшемуся отступу `HeroCopy`) ни на одном из ранее проверенных viewport'ов
     (1280×720/800, 1440×900, 1920×1080, 1280×500 "низкий desktop", 375×812/667/851, 320px).
  8. Инвариант "документ не скроллится целиком" (Steps 3–7) не регрессирует ни на одном из ранее
     проверенных viewport'ов после добавления верхнего отступа `.office`.
  9. Без JavaScript (`javaScriptEnabled:false`) hero и полностью раскрытый офис (или напрямую
     открытый по `?department=<id>` отдел) по-прежнему рендерятся одновременно в одном статичном
     HTML — регрессия, поведение `docs/05` "## hero" не меняется этим шагом.
  10. `office-overview.spec.ts` "low-height desktop" тест по-прежнему подтверждает "заголовок/
      навигация/CTA не обрезаются" (`docs/08` "Низкий desktop") — с проверками `h1`/`primaryCta`
      корректно перенесёнными в состояние `hero`, проверками хотспотов — в состоянии `overview`.
  11. `office-overview-keyboard.spec.ts` подтверждает полный Tab-обход всех 5 хотспотов с видимым
      focus-ring, начиная от корректной новой стартовой точки (первый хотспот сразу после
      `ACTIVATE_CTA`, без предварительных Tab).
  12. `hero-copy.test.tsx` — все 6 тестов (5 существующих + 1 новый) проходят; `isHiddenAfterReveal`
      обязательный проп, задействован во всех вызовах.
  13. `home-page.test.tsx` — все 7 тестов (6 существующих без изменения содержания + 1 новый)
      проходят.
  14. `mobile-touch-flow.spec.ts` — новый тест подтверждает скрытие hero/подсказки и корректный
      focus-target на мобильном после `ACTIVATE_CTA` (Step 7 этого не проверял и не реализовывал
      — честное закрытие пробела, а не тихая регрессия).
  15. Полная регрессия существующих e2e-сьютов (`office-overview`, `office-overview-keyboard`,
      `desktop-10x90-shell`, `department-selection`, `mobile-touch-flow`) — без ослабления каких-
      либо других, не связанных с hero, ожиданий.
  16. `data-revealed`-атрибут/механизм `OfficeExperience` (существующий, Step 4+) не изменён и не
      переиспользован для `HeroCopy` — у `HeroCopy` вводится независимый, параллельный механизм
      (тот же принцип, другая пара проп/класс).
  17. Ни один компонент, изменённый этим шагом, не импортирует `src/content/*` напрямую
      (grep-регрессия).
  18. Нет console/page errors на всём потоке (`hero → ACTIVATE_CTA → overview → открытие отдела →
      переключение → закрытие`) — отдельно `npm run dev`, отдельно production-сборка.
  19. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  20. `git diff --stat` относительно коммита закрытия Step 7 (см. Dependencies — рекомендуется
      закоммитить Step 7 первым отдельным коммитом) ограничен списком Expected files.
  21. Ни одна новая npm-зависимость не добавлена.
  22. `README.md` отражает актуальный статус: "7" → `Выполнено`, "7.2" — добавлена строка.

- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  ```
  Плюс обязательная dev-mode console-проверка (тот же процессный прецедент, что Steps 5/6/7):
  ```bash
  npm run dev
  # headless Playwright против http://localhost:3100: полный поток hero → ACTIVATE_CTA →
  # overview → открытие отдела → переключение → закрытие, отдельно на Desktop (1280x800) и Mobile
  # (375x812, hasTouch/isMobile) viewport — зафиксировать console/pageerror, ожидается [].
  # Остановить dev-сервер после проверки.
  ```

- Manual checks:
  - Chrome DevTools: Desktop (1280×800, 1920×1080), низкий Desktop (1280×500), Tablet-спот-чек
    (768×1024, 1024×768 — только визуальная проверка отсутствия наложения/скроллбага, без
    формального Tablet e2e-сьюта, см. Out of scope), Mobile (375×812, 320px крайний случай) —
    подтвердить: hero мгновенно исчезает по клику любой CTA; заметный, но не чрезмерный зазор
    между `Header` и панелью офиса; подсказка нигде не появляется.
  - Клавиатура: Tab от загрузки страницы → CTA → Enter/клик → фокус сразу на первом хотспоте/
    карточке карусели → Tab по остальным → Enter открывает отдел → Escape закрывает, фокус
    возвращается.
  - `prefers-reduced-motion: reduce` — быстрый регрессионный проход (новых анимаций не вводится).
  - No-JS проверка вручную (`/` и `/?department=<id>`) — hero и офис/открытый отдел видны
    одновременно, как раньше.
  - `git diff --stat` относительно коммита закрытия Step 7.

- Risks:
  - **Focus-management — новая функциональная логика, не просто CSS** (решение 2) — самый
    высокий риск этого шага; требует независимой skeptic-проверки анализа "нет race condition"
    (см. Objective), а не принятия на слово. Ошибка здесь — реальная accessibility-регрессия
    (`docs/11`), а не bookkeeping-находка.
  - **Два существующих e2e-теста требуют переписывания, а не только повторного прогона**
    (`office-overview.spec.ts` "low-height desktop"; `office-overview-keyboard.spec.ts` "hidden
    hotspots...") — риск случайного ослабления исходной гарантии при переносе проверок; смягчается
    явными AC 10/AC 11, требующими сохранения ТОЙ ЖЕ гарантии, только в правильном состоянии.
  - **Два разных, намеренно НЕ унифицированных механизма скрытия** (`HeroCopy` — `:global(.js)`-
    gated; `interactionHint` — безусловный) — риск, что при реализации кто-то "исправит"
    несогласованность и случайно сломает no-JS fallback hero; явно задокументировано как
    намеренное решение (Objective, решения 1/3), не оплошность.
  - **Отступ `.office` — визуальная величина, требующая ручной проверки, не только автоматической**
    — риск недостаточного/избыточного зазора на разных viewport'ов; смягчается Manual checks на
    полном наборе уже проверявшихся ранее размеров, включая самый тесный (1280×500).
  - **Известный, явно принятый UX-компромисс:** после этого шага `interactionHint` — единственная
    существовавшая текстовая подсказка о hover-взаимодействии с хотспотами — исчезает на Desktop
    (и, по `Amendment 5`, на Tablet тоже) полностью; `overviewProblem` по-прежнему раскрывается по
    `:hover`/`:focus`, но без текстовой подсказки пользователь должен обнаружить это сам. Это
    прямое, осознанное следствие решения пользователя (`DECISIONS.md` 2026-07-16, обе записи —
    исходная и "OQ-T1 переопределён"), не дефект этого шага — зафиксировано здесь для прозрачности,
    не как блокирующая находка.
  - **Non-blocking (skeptic Phase A round 1) — дополнено:** безусловный (не `:global(.js)`-gated)
    механизм скрытия `interactionHint` (решение 3) убирает подсказку и из no-JS fallback на
    Desktop/Tablet, где раньше она была видна без JavaScript — тот же компромисс, что описан выше,
    просто действует независимо от наличия JS. Ни один существующий тест не проверял no-JS-
    видимость `interactionHint` специально, поэтому это не скрытая регрессия покрытия, только
    ранее неявная грань уже принятого решения.
  - **Незакоммиченный Step 7** (см. Dependencies) — риск нечистого `git diff --stat`/rollback,
    если исполнение начнётся до коммита результата Step 7.
  - Scope creep: соблазн "заодно" начать Step 7.3 (боль/выгода панель) или Tablet-специфичные
    правки (Step 7.5) под предлогом "раз уже трогаем `.office`" — явно отклоняется, оба шага
    остаются отдельными, со своим Phase A.
- Rollback: `git revert` коммит(ов) этого шага — аддитивно/CSS-класс-based поверх уже
  `COMPLETED`/`PASSED` Steps 3–7 (редьюсер, URL-sync, схема данных не меняются). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя.
- Milestone review: не применимо к этому отдельному шагу (`CLAUDE.md` "Milestone review... не на
  каждом шаге") — отложено до завершения текущего milestone (Steps 7/7.2/7.3/7.5/8/9).
- Skeptic verdict (Phase A): round 1 — `BLOCKED` (2026-07-16) — все технические утверждения плана о
  текущем коде проверены и подтверждены точными (нет придуманных фактов); анализ отсутствия race
  condition для нового focus-fallback независимо переизведён и признан верным. Блокировала не сама
  реализация Step 7.2, а необнаруженное planner'ом прямое противоречие с уже `APPROVED` Step 7.5 —
  устранено пользователем (`DECISIONS.md` "OQ-T1 переопределён") и `Amendment 5`. Round 2 — `FAIL` —
  новый AC12 Step 7.5 (введён `Amendment 5`) не был привязан ни к одному конкретному
  verification-пункту (ни e2e-перечисление `tablet-touch-flow.spec.ts`, ни `Manual checks` не
  проверяли `interactionHint` на Tablet) — исправлено добавлением явных проверок, без нового
  согласования пользователя (правка не меняла решение). Round 3 — `PASS` (2026-07-16) — AC12 теперь
  прослеживается до конкретных e2e/Manual-check пунктов на том же уровне, что остальные AC плана;
  полный grep по `WORKPLAN.md` на "OQ-T1"/"показывать как есть" не нашёл блокирующих несоответствий
  (один опциональный non-blocking пункт — см. ниже); текст `Amendment 5` подтверждён согласованным
  с фактически внесёнными правками. План готов к `APPROVED`.
- Skeptic findings (Phase A, round 1):
  - **Blocking — RESOLVED via `Amendment 5`.** Objective/AC4 этого шага требуют, чтобы `interactionHint` "не присутствовал в
    дереве доступности ни на одной ширине", явно включая Tablet (768–1279px). Но уже `APPROVED`
    Step 7.5 содержит прямо противоположное, отдельно утверждённое пользователем решение
    **OQ-T1 = (b) "Показывать как есть"** со своим Acceptance criterion 12: `interactionHint`
    виден на 768–1279px без изменений относительно Desktop. Это решение зафиксировано в
    `DECISIONS.md` ("Step 7/Step 7.5: OQ-M5, схема нумерации..., OQ-T1 — финальные ответы")
    непосредственно ПЕРЕД записью "Overview: офис на весь экран, hero скрывается", на которой
    построен Step 7.2. `docs/05` honesty-правка тоже не делает исключения для Tablet. Ни в одном
    поле Step 7.2 (Objective/In scope/Out of scope/Risks) это прямое противоречие не упомянуто и
    не разрешено — план либо тихо отменяет уже утверждённый AC12 Step 7.5 без Amendment
    (запрещено `CLAUDE.md` "Never change the plan after approval without recording and approving
    the amendment"), либо сам содержит невыполнимое AC4. Требуется явное решение пользователя:
    имел ли он в виду отменить OQ-T1 для Tablet, когда сказал "подсказка... полностью
    скрывается" (сформулировано при сверке Desktop/Mobile-скриншотов, без явного упоминания
    Tablet) — до тех пор Step 7.2 не может перейти в `APPROVED`.
  - Non-blocking: Risks не называет отдельно, что безусловный (не `:global(.js)`-gated) механизм
    скрытия `interactionHint` (решение 3) также убирает подсказку из no-JS fallback на Desktop/
    Tablet, где раньше она была видна — стоит явно упомянуть в Risks при следующей правке, не
    блокирует.
  - Non-blocking — FIXED: имя пропа `isRevealed` у `HeroCopy` имело инвертированную семантику
    относительно того же пропа у `OfficeExperience` (то же значение, противоположный визуальный
    эффект). Исправлено: проп у `HeroCopy` переименован в `isHiddenAfterReveal` (то же значение,
    имя совпадает с эффектом на этом конкретном компоненте) — см. Objective, решение 1.
  - Non-blocking: заголовок теста `office-overview-keyboard.spec.ts` "hidden hotspots are not
    reachable by Tab before ACTIVATE_CTA..." станет чуть неточным после описанного rewrite (фокус
    ставится напрямую, не только через Tab) — косметика.
- Skeptic findings (Phase A, round 2):
  - **Blocking — FIXED.** Новый AC12 Step 7.5 (введённый `Amendment 5`, «`interactionHint` НЕ
    виден на 768–1279px») не был привязан ни к одному конкретному verification-пункту — ни
    e2e-перечисление `tablet-touch-flow.spec.ts`, ни `Manual checks` Step 7.5 не проверяли
    `interactionHint` на Tablet, при том что Step 7.2 → Out of scope прямо передаёт эту
    ответственность Step 7.5. Исправлено: добавлены явные проверки в In scope (e2e bullet) и
    Manual checks Step 7.5, обе со ссылкой на AC12.
  - Non-blocking — FIXED: Step 7.5 `Status` и `Completion evidence` bullets содержали
    неаннотированный устаревший текст "OQ-T1 = (b) показывать как есть" — оба дополнены ссылкой на
    `Amendment 5`.
  - Non-blocking — FIXED: top-level "## Approval" не упоминал `Amendment 5` — добавлен абзац.
- Skeptic findings (Phase A, round 3): блокирующих находок нет. Non-blocking (не исправлено,
  явно принято как есть): Step 7 (не Step 7.5) → `Completion evidence` тоже содержит
  неаннотированный текст "OQ-T1 (Step 7.5) = (b) «показывать как есть»" — исторический факт о том,
  что гейтило approval Step 7 в момент его закрытия, не текущее утверждение о поведении Tablet;
  канонический источник (Step 7.5 → Status/Completion evidence/"Open questions") уже корректно
  аннотирован. Отложено до следующей правки этой строки, не блокирует.
- Completion evidence: план прошёл skeptic Phase A round 3 `PASS` (после round 1 `BLOCKED` → round
  2 `FAIL` → round 3 `PASS`); все блокеры устранены, открытых вопросов нет.
  **Phase B (реализация, 2026-07-16):** выполнена по плану, без изменения scope.
  - `HeroCopy.tsx`/`HeroCopy.module.css`: новый проп `isHiddenAfterReveal`, класс
    `hiddenAfterReveal`, `:global(.js)`-gated правило скрытия (решение 1).
  - `OfficeMachine.tsx`: `isHiddenAfterReveal={state.view !== "hero"}` передан в `HeroCopy`; новая
    ветка `state.view === "overview" && previousView === "hero"` в существующем focus-management
    `useEffect` — кандидаты `[aria-label="Отделы компании"] button` / `#mobile-department-carousel-
    card`, берётся первый с `offsetParent !== null` (решение 2).
  - `OfficeExperience.module.css`: `.hint { display: none; }` безусловно (решение 3); `.office`
    padding → `var(--space-6)` со всех сторон (решение 4).
  - `README.md`: строка "7" → `Выполнено`; добавлена строка "7.2" → `В работе` (переведена в
    `Выполнено` при закрытии шага).
  - Тесты обновлены/добавлены точно по Expected files: `hero-copy.test.tsx` (5 существующих +
    `isHiddenAfterReveal={false}`, +1 новый тест на класс), `home-page.test.tsx` (+1 новый тест —
    focus после `ACTIVATE_CTA`; jsdom не реализует layout, поэтому `offsetParent` в тесте временно
    застаблен, чтобы реально пройти по коду candidate-fallback, а не обойти его — восстановлен в
    `finally`), `office-overview.spec.ts` (low-height "hero" rewrite — проверки `h1`/`primaryCta`
    перенесены в состояние `hero`, до `activateCta`; +2 новых теста — скрытие hero/hint, focus без
    Tab; no-JS тест дополнен проверкой видимого `h1`), `office-overview-keyboard.spec.ts` (Tab-order
    тест переписан — focus уже на первом хотспоте сразу после `ACTIVATE_CTA`, без предварительных
    Tab; CTA активируется клавиатурой `focus()+Enter`, а не кликом мышью, — иначе Chromium
    `:focus-visible` не показывает ring для программного `.focus()` после мышиного клика, что не
    баг кода, а браузерная эвристика модальности ввода), `mobile-touch-flow.spec.ts` (+1 новый тест
    — то же на Mobile, focus на `mobile-department-carousel-card`).
  - **Находка при исполнении (не в исходном плане, устранена тем же коммитом):** `interactionHint`
    остаётся в DOM (markup не удаляется, решение 3), поэтому проверка `toHaveCount(0)` (которая в
    остальных случаях работает благодаря исключению `display:none`-элементов из query по role) не
    подходит для проверки через `getByText` — `getByText` матчит по тексту независимо от
    видимости. Использован `toBeHidden()` вместо `toHaveCount(0)` в 2 местах (`office-overview.
    spec.ts`, `mobile-touch-flow.spec.ts`) — тест проверяет ровно то же самое (реальное визуальное
    сокрытие), просто корректным для этого случая матчером.
  - Verification commands — все реально прогнаны: `format:check` ✓, `lint` ✓, `typecheck` ✓,
    `test` ✓ (103/103, включая 2 новых теста), `build` ✓, `test:e2e` ✓ (53/53, включая 4 новых/
    переписанных теста). Отдельная dev-mode ручная проверка (Playwright против `npm run dev`,
    Desktop 1280×800 и Mobile 375×812 с `hasTouch`/`isMobile`) — полный поток hero → ACTIVATE_CTA →
    overview → открытие отдела → закрытие, `console`/`pageerror` — `[]` на обоих viewport.
  - Manual checks: визуальный скриншот overview на Desktop и Mobile подтверждает — hero отсутствует
    полностью, office занимает экран под `Header` с видимым равномерным отступом, подсказка нигде
    не видна (см. скриншоты сессии). Полный DevTools-проход по всем размерам Manual checks (Tablet-
    спот-чек, `prefers-reduced-motion`, no-JS, `git diff --stat`) — не проводился отдельно от
    e2e/unit-покрытия, которое уже проверяет эти же инварианты программно (no-JS — `office-overview.
    spec.ts`/`office-overview-keyboard.spec.ts`; `prefers-reduced-motion` — `office-overview-
    keyboard.spec.ts`; `git diff --stat` — см. ниже).
  - `git diff --stat` ограничен Expected files: `README.md`, `WORKPLAN.md`,
    `src/components/homepage/HeroCopy.tsx`/`.module.css`,
    `src/components/office/OfficeExperience.module.css`,
    `src/features/office-machine/OfficeMachine.tsx`, и 5 тестовых файлов — соответствует плану.
  **Skeptic Phase B round 1 — `FAIL`** (2026-07-16): 3 blocking находки, устранены:
  - AC2/AC5 не проверялись для `secondaryCta` отдельно (только `primaryCta` во всех новых/
    переписанных тестах) — добавлены 2 новых e2e-теста (`office-overview.spec.ts` Desktop,
    `mobile-touch-flow.spec.ts` Mobile), каждый проверяет и скрытие hero, и focus-fallback именно
    через `secondaryCta`.
  - AC9 (no-JS) не проверяла видимость `h1` для ветки `?department=sales`, только для `/` —
    добавлена проверка `getByRole("heading", {level:1})).toBeVisible()` после
    `goto("/?department=sales")` в `office-overview.spec.ts`.
  - AC7 Manual checks не покрывали заявленный в Risks самый тесный viewport (1280×500) и Tablet
    spot-check — выполнено вручную (Playwright-скрипт против `npm run dev`, не e2e-сьют):
    1280×500, 768×1024, 1024×768 — на всех трёх `scrollHeight <= innerHeight`,
    `scrollWidth <= innerWidth`, зазор `Header`↔office 24px без наложения; визуально подтверждено
    скриншотами (без клиппинга, без наложения панелей).
  Round 2 verification: `format:check`/`lint`/`typecheck`/`test` (103/103)/`build`/`test:e2e`
  (55/55, +2 новых теста) — все прогнаны заново после фиксов.
  **Skeptic Phase B round 2 — `PASS`** (2026-07-16): независимо перепроверил все 3 фикса (реально
  прочитал новые тесты целиком, не по описанию; подтвердил `secondaryCta`-тесты бьют по тому же
  `<a>`-элементу и той же силы проверка, что `primaryCta`; подтвердил проверка `h1` в no-JS тесте
  стоит именно после второго `goto`; подтвердил 24px зазор совпадает с `--space-6` в реальном CSS,
  не произвольное число) плюс самостоятельно перезапустил все 6 verification commands
  (`format:check`/`lint`/`typecheck`/`test` 103/103/`build`/`test:e2e` 55/55) — совпало с
  самоотчётом. Находок нет.

## Step 7.3 — Department view redesign (pain/gain panel)

- Status: `COMPLETED` — `APPROVED` пользователем 2026-07-17 ("Переводи шаг APPROVED и приступай к
  реализации"), реализация выполнена в этой же сессии. Skeptic Phase B review (round 1) вернул `FAIL`
  (3 Blocking: реально нестабильный `test:e2e`, недостаточный drift-check тест, падающий
  `format:check`) — настоящая причина нестабильности найдена и устранена (см. "Correction" ниже);
  сфокусированный skeptic Phase B re-check вернул `PASS` (2026-07-17) — независимо перепроверил все
  3 находки как реально устранённые (в т.ч. воспроизвёл падение drift-check теста подменой местами и
  зелёный `test:e2e` включая `--workers=1`), полный набор проверок прогнал сам. Закрыт по явному
  подтверждению пользователя (2026-07-17: "Закрывай Step 7.3"). Phase A round 1 (`planner`, 2026-07-17) прошёл skeptic Phase A review
  (`PASS`, 1 non-blocking correction, применён inline). Пользователь ответил на все 6 открытых
  вопросов (`DECISIONS.md` 2026-07-17 "Step 7.3: ответы на OQ-P1–OQ-P6") — полный текст исходных
  вариантов сохранён ниже в "Open questions (Step 7.3) — RESOLVED" для истории/трассируемости. План
  переписан с учётом ответов; skeptic Phase A round 2 вернул `FAIL` (3 Blocking: ложная ссылка на
  прецедент `Header.tsx`; нерешённая судьба `Department.reference`; пропущенный
  `department-hotspot.test.tsx` в Expected files) — все три исправлены inline. Сфокусированный
  re-check вернул ещё один `FAIL` (Expected files фактически не отражал заявленный drift-check тест;
  формулировка severity в Objective противоречила Status) — оба пункта тоже исправлены inline (см.
  "Skeptic verdict"/"Correction"/"Skeptic re-check" ниже).
- Objective: Перестроить состояние `department-active` (`docs/03-office-map.md` "Режим 10/90",
  правка 2026-07-16) под структуру, описанную пользователем:
  1. Левая панель (`DepartmentNavigationRail`, сейчас 10–14% — см. Risks про ширину) — у каждого из
     5 отделов название **и собственное фото** (не только текст, как сейчас); позади панели — общее
     фото офиса, которое темнеет/бледнеет, когда отдел открыт (не исчезает полностью).
  2. Основная область — **не одна колонка, а две**, примерно 20/80: левая (20%) — ровно **5**
     кликабельных/фокусируемых пунктов "боли" отдела; правая (80%) — при выборе конкретного пункта
     показывает именно его "выгоду" (что получит бизнес, решив ИМЕННО эту проблему — не общий список
     результатов отдела).

  **Технический факт (не открытый вопрос):** текущая модель данных не подходит для связки "боль →
  выгода" один-к-одному. Сейчас `Department.symptoms: string[]` (максимум 3 в UI,
  `docs/12-content-data-model.md` "Правила") и `Department.outcomes: string[]` (5 штук, независимый
  список) — раздельные, несвязанные массивы. Новая структура требует типа вида `painPoints: { pain:
  string; gain: string }[]` длиной ровно 5 (тот же `.length(5)`-паттерн, что уже используется для
  `departmentsSchema`/`officeZonesDataSchema` в `src/content/schema.ts` — независимо подтверждено
  skeptic Phase A review), заменяющего оба текущих поля — правка `content/types.ts`,
  `src/content/schema.ts` (zod), `docs/12-content-data-model.md` и реального содержимого
  `data/departments.json` для всех 5 отделов.

  **Найдено при подготовке черновика:** `docs/05-homepage-state-machine.md` "## department-active"
  всё ещё описывает временный блок Step 5 как "до 3 `symptoms`/`outcomes`" — устарело относительно
  уже honesty-исправленных 2026-07-16 `docs/03`/`docs/12` (независимо подтверждено skeptic Phase A
  review чтением документа: Step 6 `COMPLETED` сознательно сохранил именно эту "временную"
  структуру, не заменил её `DepartmentScene`, поэтому расхождение реально, не мнимое). Честная правка
  этого раздела `docs/05` — часть In scope этого шага.

  **Решения по итогам ответов пользователя на OQ-P1–OQ-P6 (`DECISIONS.md` 2026-07-17):**
  - **OQ-P1 = (a), с уточнением пользователя.** Реальные `references/**/*.png` используются и как
    общее фото офиса (полноразмерно, позади `department-active`), и как источник миниатюр в
    `DepartmentNavigationRail` (уменьшенные версии тех же изображений, не отдельные файлы). Техническая
    реализация — статический импорт (`import photo from "../../../references/.../xxx.png"`) через
    `next/image`. **Уточнение (найдено при skeptic Phase A round 2 review, Blocking, исправлено
    inline): это НЕ повторение существующего прецедента.** `Header.tsx` использует
    `next/image` со строковым `public/`-путём к SVG-логотипу (`<Image src="/logo.svg" ... width={90}
    height={64} />`) — не статический ES-импорт растрового файла из-за пределов `src/`. Это первое в
    проекте использование именно такой техники. Сама возможность технически подтверждена независимо
    (глобальный `declare module '*.png'` в типах Next.js применяется к любому пути в проекте, не
    только `src/`; `next.config.ts` не отключает Image Optimization; `sharp` уже установлен), но
    Expected files/реализация должны учитывать, что это новый, не обкатанный в проекте механизм, а не
    рутинное повторение. Встроенный Next.js Image Optimization должен генерировать
    уменьшенные/оптимизированные версии на лету под каждый размер использования (миниатюра rail vs
    полноразмерный фон); отдельный ручной ресайз/сжатие исходников и копирование в `public/` не
    требуются — точные атрибуты (`sizes`, `priority`/`loading="lazy"`) настраиваются исполнителем при
    реализации, не отдельный OQ. Фоновое фото рендерится только внутри ветки `department-active` (не
    в `overview`), поэтому оно и так лениво подгружается только когда реально нужно — соответствует
    Performance rules CLAUDE.md ("Lazy-load department assets") без дополнительного кода.
    **Уточнение (найдено при skeptic Phase B review исполнения, Blocking, исправлено): статический
    импорт оригиналов `references/**/*.png` напрямую был технически рабочим (сборка проходила), но
    реально нестабильным под нагрузкой — независимо воспроизведено: полный `npm run test:e2e`
    периодически ловил `page.goto` timeout >30с (до 4 из 5 прогонов), включая при `--workers=1`
    (то есть не проблема параллелизма). Расследование (`netstat`, прямой вызов `sharp` в изоляции,
    сравнение с/без `Accept: image/webp,avif`) показало настоящую причину: не время кодирования
    (оно было быстрым и в изоляции, и после фикса), а объём отдельных HTTP-запросов к
    `/_next/image`-эндпойнту (по одному на каждый размер/формат для каждой из 5 миниатюр + фона на
    каждый рендер отдела) — за один прогон e2e это порождало тысячи short-lived TCP-соединений,
    вплоть до исчерпания эфемерных портов Windows в рамках одного прогона (`netstat` показывал
    TIME_WAIT-сокеты вплоть до верхней границы диапазона). Исправлено в два шага: (1) исходники
    (3.1–3.6 МБ, 1536×1024, плохо сжатый PNG для этого типа контента) один раз предварительно
    пересжаты в WebP через `sharp` (миниатюры — 160×160 под рендер 32×32 CSS px, фон — тот же
    1536×1024 с лучшим сжатием), сохранены как `src/assets/office-photos/*.webp` (5–7 КБ на
    миниатюру, 285 КБ фон — было 3.1–3.6 МБ); (2) `<Image unoptimized>` в
    `DepartmentNavigationRail.tsx`/`OfficeExperience.tsx` — раз производные уже нужного размера и
    формата, повторная обработка через `/next/image` не нужна и только добавляет round-trip; теперь
    файл отдаётся напрямую как обычный статический ассет. После фикса: 5 подряд чистых прогонов
    `npm run test:e2e` (включая `--workers=1`, тот же сценарий, где раньше падало) — 63/63 каждый раз,
    ~20с вместо ~50с. `Department.reference` в `data/departments.json` по-прежнему указывает на
    оригинал в `references/` — описание исходного дизайн-референса, не буквальный путь импорта.
  - **Найдено при skeptic Phase A round 2 review (Blocking, применено inline): судьба поля
    `Department.reference`.** Схема/типы уже содержат провалидированное поле `reference: string`
    (например, `"references/executive/04-executive-department.png"`), которое не использовалось нигде
    в рендере (round 1 skeptic finding). `next/image` требует статических ES-импортов с литеральными
    путями, известными на этапе сборки — runtime-строку вида `department.reference` нельзя
    использовать как спецификатор `import`. Поэтому компоненты используют захардкоженную карту с 5
    явными `import` (после Phase B фикса — из предварительно сгенерированных производных
    `src/assets/office-photos/${id}-thumbnail.webp`, не из оригиналов напрямую, см. уточнение выше):
    `const photoByDepartmentId: Record<DepartmentId, StaticImageData> = { executive: executiveThumbnail,
    sales: salesThumbnail, ... }`. Чтобы это не создавало второй, расходящийся источник истины,
    **поле `Department.reference` остаётся в модели данных** (не удаляется, описывает исходный
    дизайн-референс), и добавлен unit-тест (`src/tests/unit/content/departments.test.ts`), который
    проверяет для каждого `id`: (1) существует import из `${id}-thumbnail.webp`; (2) объект-литерал
    `photoByDepartmentId` присваивает ключу `id` именно эту импортированную переменную, а не
    какую-то другую — расхождение/перепутанное присваивание ловится тестом (падает `npm run test`).
    **Проверено эмпирически (не только теоретически) при Phase B review**: временная подмена двух
    присвоений местами (`sales: supportThumbnail`) заставила тест реально упасть; после возврата
    исходного кода — тест снова зелёный.
  - **OQ-P2 = (a), с уточнением пользователя.** При открытии отдела и при любом переключении между
    отделами панель выгоды сразу показывает пункт боли №1 — не пустое состояние, не приглашение
    кликнуть. Согласовано с OQ-P3 (сброс на переключении, не "липкая" память последнего выбора).
  - **OQ-P3 = (a).** Состояние "какой пункт боли выбран" — локальный `useState` в новом компоненте
    боль/выгода, принудительно сбрасываемый к пункту №1 при переключении между отделами (через
    `key={department.id}` на этом поддереве или через `useEffect`, привязанный к `department.id`, —
    точный механизм решается при реализации, эквивалентен по результату). Редьюсер `office-machine`
    не меняется.
  - **OQ-P4 = (a).** 5 пунктов боли — обычные `<button type="button">` в обычном последовательном
    Tab-порядке, нативная активация Enter/Space — без ARIA tablist/listbox/roving-tabindex; тот же
    паттерн, что уже используют `DepartmentNavigationRail`/`CarouselNavControls`. Применяется
    единообразно на всех breakpoint'ах, включая mobile-аккордеон (OQ-P6).
  - **OQ-P5 = (a).** Черновая (явно не финальная, "будет правиться") копия боль/выгода пишется для
    всех 4 оставшихся отделов (Продажи/Поддержка/HR/Логистика — 20 пар) в рамках реализации этого
    шага, тем же тоном/форматом, что уже есть у "Дирекция" — все 5 отделов получают реальный
    (черновой) контент за один проход, ни один zod-заглушечный текст не остаётся в `data/departments.json`.
  - **OQ-P6 = (b).** Mobile (≤767px) получает собственный, специально спроектированный вариант
    раскладки — список из 5 пунктов боли на всю ширину; тап/Enter/Space по пункту раскрывает или
    заменяет его выгодой (accordion-подобное поведение, не боковая 20/80-колонка). Desktop/Tablet
    (≥768px) используют боковую 20/80-раскладку. Оба варианта — CSS/условный рендер внутри одного и
    того же логического компонента-дерева (тот же принцип "оба варианта в DOM, видимость по CSS",
    что уже применялся в Step 7 для карты/карусели), либо два явно разных под-компонента,
    переключаемых по breakpoint, — точная граница решается при реализации.
  - Точный CSS-механизм "темнеет/бледнеет" для фонового фото (например, `filter: grayscale()
    brightness()` vs полупрозрачный тёмный оверлей `::before`) — техническая настройка на этапе
    реализации, низкий риск, тот же класс решения, что ширина rail 14% в Step 6.
  - Переключение боль→выгода внутри уже открытого отдела — это уровень "selection"
    (`docs/07-motion-system.md`, 180–320мс), отдельный от уже существующих `Transition`-переходов
    `opening/switching/closing` (450–1000мс); лёгкое opacity-затухание в этом диапазоне (или без
    анимации вовсе) — решение исполнителя, подчиняется `prefers-reduced-motion`, как и всё
    остальное в проекте.
  - Название отдела в левой панели — существующее поле `overviewLabel` (то же, что уже используют
    `DepartmentNavigationRail`/`MobileDepartmentCarousel`/`aria-label` в `DepartmentExperience`), НЕ
    неиспользуемое нигде в рендере поле `Department.name` — явно зафиксировано здесь (по замечанию
    skeptic Phase A review), чтобы не решаться молча при реализации.

  **Статус советов ассистента из `DECISIONS.md` 2026-07-16 (не решены пользователем — не спутаны с
  решённым и не отброшены молча):**
  - "Не обещать конкретных цифр экономии без реальных данных" — это не опциональный совет, а прямое
    требование CLAUDE.md Copy rules ("Do not make unsupported promises about revenue, savings...");
    применяется ко всей копии "боль/выгода" в этом шаге вне зависимости от отдельного согласования.
  - "CTA может отражать выбранную боль" — не подтверждено, не отклонено — Out of scope этого
    черновика.
  - "Лёгкая подсветка соседних отделов" в панели — не подтверждено, не отклонено — Out of scope
    этого черновика.

- In scope:
  - `src/content/types.ts` / `src/content/schema.ts` — `painPoints: { pain: string; gain: string }[]`
    (ровно 5), заменяет `symptoms`/`outcomes` в `Department`.
  - `data/departments.json` — реальный (черновой, OQ-P5) контент боль/выгода для всех 5 отделов;
    черновик "Дирекция" из 5 пар выше переиспользуется как есть, по-прежнему не финальная копия;
    новые 20 пар для Продажи/Поддержка/HR/Логистика пишутся в рамках этого шага, тем же тоном.
  - `docs/12-content-data-model.md`, `docs/03-office-map.md` — уже honesty-исправлены 2026-07-16;
    подтвердить/доформулировать после того, как схема реально ляжет в код.
  - `docs/05-homepage-state-machine.md` "## department-active" — честная правка устаревшего описания
    "3 symptoms/outcomes" (см. Objective, "Найдено при подготовке черновика").
  - `src/components/office/DepartmentNavigationRail.tsx`/`.module.css` — фото-миниатюра (из
    `references/**/*.png`, статический импорт через `next/image`) на каждый пункт, рядом с уже
    существующим `overviewLabel`-текстом.
  - `src/components/office/OfficeExperience.tsx`/`.module.css` — слой фонового фото офиса (тот же
    источник `references/`, полноразмерный вариант) позади `.shell10x90` (`department-active`),
    тёмный/десатурированный, когда отдел открыт; CSS-only переключение видимости/затемнения.
  - `src/components/departments/DepartmentExperience.tsx`/`.module.css` — замена одноколоночной
    композиции `DepartmentCopy` + `OutcomePanel` на: (a) Desktop/Tablet (≥768px) — боковую
    20/80-раскладку боль/выгода; (b) Mobile (≤767px, OQ-P6) — отдельный вариант в столбик/аккордеон
    (список боли на всю ширину, тап/Enter/Space раскрывает/заменяет выгодой). `DepartmentCopy`
    по-прежнему рендерит `headline`/`problem` без изменений, но перестаёт рендерить список
    `symptoms`. Новый(е) презентационный(е) компонент(ы) для боли/выгоды и для mobile-аккордеона —
    точные имена/границы (например `PainGainPanel.tsx` для Desktop/Tablet,
    `MobilePainGainAccordion.tsx` для Mobile) — решение исполнителя, не требует отдельного OQ.
  - `OutcomePanel.tsx` — удаляется или репрофилируется (сейчас рендерит плоский `outcomes: string[]`,
    которого больше не будет на `Department`); его роль берёт новый компонент(ы).
  - Состояние "какой пункт боли выбран" (OQ-P2/OQ-P3) — новый локальный `useState`, дефолт — пункт
    №1, принудительный сброс на пункт №1 при переключении отдела (`key={department.id}` или
    эквивалентный `useEffect`) — не предполагается идентичным `previewIndex` Step 7 буквально, так
    как — в отличие от карусели — `DepartmentExperience` НЕ размонтируется при `SWITCH_DEPARTMENT`
    (независимо подтверждено skeptic Phase A review: `OfficeExperience.tsx` рендерит
    `<DepartmentExperience department={activeDepartment} ... />` без `key`, привязанного к
    `department.id`) — этот шаг вводит собственный сброс-механизм, а не переиспользует чужой.
  - `CarouselNavControls` внутри `DepartmentExperience` (Step 7, Mobile ≤767px Prev/Next между
    отделами) — сохраняется без изменения поведения/пропов; может измениться только его позиция в
    переверстанной разметке (по-прежнему после содержимого боль/выгода/аккордеона, по-прежнему
    видим только ≤767px через собственный CSS).
  - Обновлённые unit-тесты: `src/tests/unit/content/departments.test.ts`,
    `.../invalid-fixtures.test.ts` (новые фикстуры `painPoints`, удаление фикстур
    `symptoms`/`outcomes`), `.../components/departments/department-experience.test.tsx`
    (переписан вокруг `painPoints`, клик по пункту боли → появляется текст выгоды, дефолт на пункт
    №1, сброс на переключении, сохранено wrap-around поведение `CarouselNavControls`),
    `.../components/office/department-navigation-rail.test.tsx` (фото-элемент на каждый пункт),
    новый unit-тест для mobile-аккордеона (OQ-P6).
  - Новое/обновлённое e2e-покрытие: выбор пункта боли меняет видимый текст выгоды; дефолт на пункт
    №1 при открытии/переключении (OQ-P2); клавиатурная достижимость всех 5 пунктов боли обычным
    Tab-порядком (OQ-P4); фото в панели + фон присутствуют; регрессия затемнения фона (структурная/
    атрибутная проверка, не пиксельное сравнение); отдельный mobile-аккордеон поток на ≤767px
    (OQ-P6); полная регрессия существующих проверок `department-selection.spec.ts`, перенесённых с
    `outcomes`/`symptoms` на `painPoints`.
  - `README.md`/`WORKPLAN.md`/`WORKLOG.md` — статус-учёт.

- Out of scope:
  - Реагирующий на выбранную боль CTA (совет ассистента, не подтверждён пользователем) —
    `DepartmentCTA` продолжает рендерить `ctaLabel` уровня отдела, без изменений.
  - Подсветка соседних отделов в панели (совет ассистента, не подтверждён) — визуальное поведение
    панели, кроме добавления фото, не меняется.
  - `DepartmentScene`/`BeforeAfterSequence` — по-прежнему не вводятся (прецедент OQ-C, Step 6).
  - Любая новая npm-зависимость (библиотеки оптимизации изображений, carousel/tabs и т.п.) — не
    вводится без отдельного решения; `next/image` (уже используется `Header.tsx`) — единственный
    доступный механизм рендера изображений без новой зависимости.
  - Любые изменения `src/features/office-machine/reducer.ts` (6 состояний/9 действий) — не вводятся
    (OQ-P3 решён в пользу локального состояния, не редьюсера).
  - ARIA `tablist`/`listbox`-паттерн, roving tabindex, обработка стрелок для пунктов боли — не
    вводится (OQ-P4 решён в пользу обычного Tab-порядка/нативных кнопок).
  - Заглушечная копия боль/выгода для Продажи/Поддержка/HR/Логистика — не вводится (OQ-P5 решён в
    пользу реальной черновой копии для всех 5 отделов сейчас).
  - CSS-заглушка/плейсхолдер вместо реальных фото — не вводится (OQ-P1 решён в пользу реальных
    `references/**/*.png`).
  - Специфичная для Step 7.5 (Tablet) CSS-адаптация новой панели — остаётся задачей Step 7.5, как уже
    зафиксировано в его собственной секции Dependencies (Step 7.5 зависит от структуры этого шага, не
    наоборот).
  - Реальная device-лаборатория, автоматизированное axe-сканирование, диагностика/`contact-open`,
    `OfficeVisualLayer`/WebGL, `/solutions/*`-навигация, `popstate`, `MANIFEST.json`, CI pipeline —
    все ранее установленные исключения остаются в силе без изменений.
  - Разрешение открытых вопросов ниже planner'ом/исполнителем — каждый OQ требует явного ответа
    пользователя до закрытия Phase A.

- Dependencies: **Step 7.2 (`COMPLETED`)** — зависимость закрыта; этот шаг строится поверх уже
  выпущенного поведения `.office`-padding/hero-hiding, блокеров нет. **Step 7.4 (`COMPLETED`)** —
  делит файл `OfficeExperience.tsx`/`.module.css` (кнопка «Выйти из офиса» — в ветке `overview`, не
  затрагивается этим шагом) — функционального конфликта нет, отмечено из-за общего файла.
  **Step 7 (`COMPLETED`)** — `DepartmentExperience.tsx` уже содержит `CarouselNavControls` (Mobile
  Prev/Next); переверстка этим шагом не должна его регрессировать (см. In scope/Risks). Обратной
  зависимости от Step 7.5 (`APPROVED`, не начат) нет — Step 7.5 зависит от этого шага, не наоборот.

- Expected files:
  - `src/content/types.ts`, `src/content/schema.ts`
  - `data/departments.json`
  - `docs/12-content-data-model.md`, `docs/03-office-map.md`, `docs/05-homepage-state-machine.md`
  - `src/components/office/DepartmentNavigationRail.tsx`/`.module.css`
  - `src/components/office/OfficeExperience.tsx`/`.module.css`
  - `src/components/departments/DepartmentExperience.tsx`/`.module.css`
  - `src/components/departments/OutcomePanel.tsx`/`.module.css` (удаляется или заменяется)
  - `src/components/departments/DepartmentCopy.tsx`/`.module.css` (перестаёт рендерить `symptoms`)
  - Новый компонент(ы) для Desktop/Tablet 20/80 боль/выгода (например `PainGainPanel.tsx`, имя — на
    этапе реализации).
  - Новый компонент для Mobile-аккордеона (OQ-P6, например `MobilePainGainAccordion.tsx`, имя — на
    этапе реализации) + `.module.css`.
  - Новый `src/components/office/departmentPhotos.ts` — карта `photoByDepartmentId` + фон
    `officeBackgroundPhoto`, статический импорт WebP-производных из `src/assets/office-photos/`.
  - `src/tests/unit/content/departments.test.ts` (плюс новый unit-тест на привязку захардкоженной
    карты `photoByDepartmentId` к правильному файлу-производному для каждого `id` — AC16, финальная
    форма после Phase B review проверяет и наличие импорта `${id}-thumbnail.webp`, и то, что именно
    он присвоен ключу `id`, не другой — эмпирически проверено подменой местами при реализации),
    `.../invalid-fixtures.test.ts`, `.../components/departments/department-experience.test.tsx`,
    `.../components/office/department-navigation-rail.test.tsx`, новый unit-тест
    mobile-аккордеона.
  - `src/tests/unit/components/office/department-hotspot.test.tsx` — **найдено при skeptic Phase A
    round 2 review (Blocking, применено inline):** этот файл строит типизированный литерал
    `Department` с полями `symptoms`/`outcomes` для тестовой фикстуры — сломает `npm run typecheck`
    после удаления этих полей из типа, если не обновить фикстуру на `painPoints`; пропущен в
    исходном перечислении.
  - `src/tests/e2e/department-selection.spec.ts` (переписанные ассерты `outcomes`/`symptoms`)
  - Новый `src/tests/e2e/department-pain-gain.spec.ts` (Desktop/Tablet) и/или расширение
    `mobile-touch-flow.spec.ts` (mobile-аккордеон) — точное разбиение файлов уточняется при
    реализации, по прецеденту Step 3 (`office-overview.spec.ts`/`office-overview-keyboard.spec.ts`).
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`.
  - Новые `src/assets/office-photos/{sales,support,executive,hr,logistics}-thumbnail.webp` и
    `office-background.webp` — предварительно сгенерированные один раз (`sharp`, вне рантайма)
    WebP-производные оригиналов `references/**/*.png` (найдено при skeptic Phase B review: прямой
    статический импорт оригиналов был технически рабочим, но нестабильным под нагрузкой e2e — см.
    уточнение в Objective). Изображения — статический импорт этих производных внутри новых
    компонентов (`DepartmentNavigationRail`, фон `OfficeExperience`) с `<Image unoptimized>`; новых
    файлов под `public/` не требуется — `references/**/*.png` остаются единственным исходником
    дизайна, `src/assets/office-photos/` — код-facing производные для рендера.

- Acceptance criteria:
  1. У `Department` нет полей `symptoms`/`outcomes`; есть `painPoints: {pain, gain}[]` ровно длины 5,
     проверено zod для каждого из 5 отделов; все 5 отделов заполнены реальным (черновым) контентом —
     ни одного заглушечного текста вида "Боль-заглушка N".
  2. `DepartmentNavigationRail` рендерит `overviewLabel` (без изменений) плюс фото-миниатюру
     (`next/image`, источник — `references/**/*.png`) для каждого из 5 пунктов.
  3. Общее фото офиса (тот же источник `references/`) присутствует позади раскладки
     `department-active` и визуально темнее/десатурированнее, чем в `overview` (по-прежнему
     присутствует в DOM, не `display:none`).
  4. На Desktop/Tablet (≥768px) рендерятся ровно 5 пунктов боли в боковой 20/80-раскладке, каждый
     независимо кликабелен и фокусируем обычным Tab-порядком/Enter/Space (без ARIA tablist/listbox).
  5. На Mobile (≤767px) рендерится отдельный столбик/аккордеон-вариант: список из 5 пунктов боли на
     всю ширину, тап/Enter/Space по пункту раскрывает или заменяет его выгодой; та же клавиатурная
     модель (обычный Tab-порядок), что на Desktop/Tablet.
  6. При открытии отдела и при любом `SWITCH_DEPARTMENT` панель/аккордеон выгоды по умолчанию
     показывает пункт боли №1 — детерминированно, без "залипания" на последнем выбранном пункте
     предыдущего отдела.
  7. Выбор пункта боли (клик/Enter/Space) показывает именно его `gain`-текст — и никакой другой; для
     всех 5 позиций, на Desktop/Tablet и на Mobile-аккордеоне.
  8. `CarouselNavControls` (Mobile ≤767px, Prev/Next между отделами) по-прежнему рендерится (после
     контента боль/выгода/аккордеона) и по-прежнему диспетчирует `SWITCH_DEPARTMENT` без изменений —
     регрессия, не новое поведение.
  9. Поведение `DepartmentCTA`/«Закрыть» (видимость, работоспособность, `onClose`) не изменилось.
  10. Полная регрессия существующих проверок `department-selection.spec.ts` (opening/switching/
      closing, URL sync, focus management, `prefers-reduced-motion`, консоль/hydration) — перенесена
      на `painPoints`, не ослаблена.
  11. `docs/12-content-data-model.md`, `docs/03-office-map.md`, `docs/05-homepage-state-machine.md`
      не содержат устаревших упоминаний `symptoms`/`outcomes` для department-active.
  12. Граница breakpoint 767/768px для боль/выгода-раскладки проверена явно (аккордеон на 767px,
      боковая 20/80 на 768px) — не предполагается по непрерывности.
  13. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  14. Ни одна новая npm-зависимость не добавлена; никаких новых файлов не появилось под `public/`.
  15. `git diff --stat` ограничен списком Expected files.
  16. **(найдено при skeptic Phase A round 2, ужесточено при Phase B review)** Захардкоженная карта
      фото-импортов (`photoByDepartmentId`) проверена unit-тестом на то, что каждый ключ `id`
      привязан именно к импорту `${id}-thumbnail.webp`, а не к перепутанному — тест эмпирически
      проверен (временная подмена местами реально ломает его, не только теоретически).
  17. Реальные фото (миниатюры и фон) отдаются напрямую как статический ассет (`unoptimized`), без
      прохода через `/next/image` на каждый запрос — сетевой ответ миниатюры заметно меньше
      исходного `references/**/*.png`.

- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  ```
  Плюс обязательная dev-mode console-проверка (тот же прецедент, что Steps 5/6/7/7.2): `npm run dev`,
  headless Playwright по полному потоку `hero → overview → открыть отдел → выбрать пункт боли →
  переключить отдел → закрыть`, ожидается `[]` console/pageerror.

- Manual checks:
  - Chrome DevTools: Desktop (1280×800, 1920×1080), низкий desktop (1280×500), Tablet
    (768×1024, 1024×768) — фото в панели + затемнённый фон + 20/80-раскладка рендерятся без обрезки/
    наложения; реальные `references/**/*.png` визуально узнаваемы, не битые/не placeholder.
  - Mobile (320–767px) — аккордеон-вариант: список боли на всю ширину, тап раскрывает выгоду, нет
    горизонтального скролла, нет наложения с `CarouselNavControls`.
  - Клавиатура: полный Tab-проход на Desktop/Tablet и на Mobile-аккордеоне (обычный Tab-порядок,
    Enter/Space).
  - `prefers-reduced-motion: reduce` — переключение боль→выгода без анимации либо мгновенный аналог.
  - Сетевая вкладка DevTools — подтвердить, что фоновое фото не загружается, пока отдел не открыт
    (ленивая загрузка, Performance rules CLAUDE.md); **дополнено при skeptic Phase A round 2 review,
    уточнено после Phase B фикса (`unoptimized` + предварительно сгенерированные WebP):** отдельно
    подтвердить, что размер сетевого ответа миниатюры rail (не полноразмерного фона) заметно меньше
    исходного файла `references/**/*.png` (3.1–3.6 МБ) — фактически подтверждено: миниатюры 5–7 КБ,
    фон 285 КБ, отдаются напрямую как статический ассет (без `/next/image` round-trip, `unoptimized`).
  - `git diff --stat` относительно списка Expected files.

- Risks:
  - **Реальные фото-ассеты (OQ-P1) — первый в проекте случай использования фото такого объёма.**
    Изначальный подход (статический импорт оригиналов `references/**/*.png` напрямую через
    `next/image`, полагаясь на встроенную Image Optimization) технически работал, но независимо
    подтверждённо приводил к нестабильности e2e под нагрузкой (см. Objective, найдено при skeptic
    Phase B review) — исчерпание эфемерных портов Windows из-за большого числа отдельных запросов к
    `/next/image`-эндпойнту. **Устранено**: предварительно сгенерированные WebP-производные
    (`src/assets/office-photos/`) + `<Image unoptimized>` — подтверждено 5 подряд чистыми прогонами
    `npm run test:e2e` (включая `--workers=1`). Фон по-прежнему грузится лениво только при открытии
    отдела (монтируется вместе с веткой `department-active`, не превентивно на `overview`).
  - **Место хранения состояния выбора (OQ-P3) содержит реальную, ранее не замеченную тонкость**:
    `DepartmentExperience` не размонтируется при `SWITCH_DEPARTMENT` (в отличие от
    `MobileDepartmentCarousel`, который размонтируется, потому что размонтируется вся ветка
    `overview`) — независимо подтверждено skeptic Phase A review чтением `OfficeExperience.tsx` и
    кода `reducer.ts`. Наивное копирование паттерна `previewIndex` молча перенесло бы устаревший
    индекс боли через переключение отдела — этот шаг вводит собственный сброс-механизм (см. Objective).
  - **Отдельный Mobile-аккордеон (OQ-P6) — новый компонент, а не CSS-адаптация существующего** —
    больше поверхности для review/тестирования, чем изначально предполагал минимальный (a)-вариант;
    требует собственного unit+e2e покрытия, не только регрессии.
  - Объём копирайтинга: 20 пар боль/выгода (4 отдела × 5) пишутся впервые в рамках этого шага —
    качество/тон копии для не-"Дирекция" отделов не проходил отдельного review до реализации.
  - Step 7.5 (Tablet, `APPROVED`, не начат) прямо зависит от результата этого шага — любая задержка/
    переработка здесь откладывает старт Step 7.5.
  - Риск расползания scope: соблазн попутно реализовать реагирующий CTA или подсветку соседних
    отделов "раз уже трогаем этот файл" — явно отклонено (Out of scope).

- Rollback: `git revert` коммита(ов) этого шага — аддитивное изменение схемы/компонентов
  относительно Steps 3–7.2/7.4 (URL-sync, состояния/действия редьюсера не меняются). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя.

- Профильный ревьюер (Phase D, milestone review после этого шага и Step 7.5): `frontend-architect` и
  `qa-reviewer` (обязательно, `CLAUDE.md`); `ux-strategist` (обязательно — пользовательский паттерн
  боль/выгода, клавиатурная модель, первый реальный фото-ассет в прототипе); `motion-engineer`
  (впервые используется категория "selection" из `docs/07`).

- Skeptic verdict: `PASS` (Phase A, план-ревью, 2026-07-17). Независимо перепроверил все ключевые
  фактические утверждения черновика напрямую по репозиторию (не на веру): (1) подтверждено — ни один
  компонент не рендерит `Department.reference`/фото нигде сейчас (`grep` по `src`); (2) подтверждено
  — реальные размеры `references/**/*.png` 3.32–3.73 МБ; (3) подтверждено, самая нагруженная находка
  — `DepartmentExperience` рендерится без `key`, привязанного к `department.id`, `SWITCH_DEPARTMENT`
  не вызывает размонтирование, в отличие от `MobileDepartmentCarousel`; (4) подтверждено — `docs/05`
  "department-active" реально устарел относительно `docs/03`/`docs/12`; (5) подтверждено —
  `CarouselNavControls` реально живёт внутри `DepartmentExperience.tsx`; (6) подтверждено —
  `.length(5)`-паттерн реально уже используется в `departmentsSchema`/`officeZonesDataSchema`; (7)
  один non-blocking пробел — поле `Department.name` не используется нигде в рендере, черновик не
  указывал явно, что панель использует именно `overviewLabel` (см. ниже, применено); (8) подтверждено
  — в `docs/11-accessibility.md` нет tablist/roving-tabindex конвенции, весь проект сегодня использует
  только обычный Tab-порядок `<button>`; (9) других фактических ошибок не найдено, включая честно
  отмеченное расхождение поля Dependencies (было "Step 7.2 (`PROPOSED`)", теперь `COMPLETED`).
- Skeptic findings (round 1): Non-blocking (1): панель использует `overviewLabel`, а не
  неиспользуемое поле `Department.name`, — не было явно зафиксировано в черновике как технический
  факт. **Применено inline** (см. Objective, "Технические решения, принятые здесь" выше). Blocking:
  нет.

- Skeptic verdict (round 2, после ответов пользователя на OQ-P1–OQ-P6): `FAIL` (2026-07-17).
  Независимо перепроверил переработанный план по репозиторию: (1) **Blocking** — заявление "тот же
  прецедент, что уже использует `Header.tsx`" было фактически неверным (`Header.tsx` использует
  строковый `public/`-путь к SVG, не статический ES-импорт растрового файла извне `src/`) — сама
  техника подтверждена как технически рабочая (глобальный `declare module '*.png'`, `sharp` уже
  установлен, `next.config.ts` не отключает Image Optimization), но ложная ссылка на прецедент
  введена в заблуждение; (2) **Blocking** — судьба поля `Department.reference` не была решена: так
  как `next/image`-статический импорт требует литеральных путей, а `department.reference` — runtime-
  строка, реализация неизбежно вводит захардкоженную карту фото-импортов как второй источник истины,
  который может разойтись с JSON без единого теста, ловящего расхождение; (3) **Blocking** —
  `src/tests/unit/components/office/department-hotspot.test.tsx` строит типизированный литерал
  `Department` с полями `symptoms`/`outcomes` и не был включён в Expected files/тестовый
  перечень — без правки этого файла `npm run typecheck` реально сломается после удаления полей.
  Non-blocking: Manual checks не проверяли явно, что миниатюра rail в сети действительно уменьшена
  Image Optimization, а не отдаёт исходный файл целиком. Остальные пункты (Mobile-аккордеон как
  реальный новый компонент, отсутствие новых файлов под `public/`, консистентность AC 4/5 для
  Desktop/Tablet и Mobile, отсутствие устаревших "по итогу OQ" формулировок, отсутствие регрессии
  `DepartmentCTA`/`CarouselNavControls`/`DepartmentCopy`/`OutcomePanel`) — независимо подтверждены
  как корректные, без замечаний.
- Correction (после round 2 `FAIL`): все три Blocking-находки исправлены inline (не требуют нового
  решения пользователя, по заключению skeptic) — (1) ложная ссылка на прецедент `Header.tsx` заменена
  честной формулировкой "первое использование такой техники в проекте" (см. Objective выше); (2)
  добавлено явное решение — `Department.reference` остаётся в модели данных, вводится новый unit-тест
  на совпадение путей захардкоженной карты с этим полем (см. Objective, Expected files, Acceptance
  criterion 16); (3) `department-hotspot.test.tsx` добавлен в Expected files с пояснением; non-blocking
  правка про Network-проверку миниатюры добавлена в Manual checks.
- Skeptic re-check (сфокусированный, не полный round 3, по прямому указанию round 2 verdict) —
  `FAIL`: (1) Blocking — Expected files фактически НЕ содержал упоминания нового drift-check теста
  (`photoByDepartmentId` ↔ `Department.reference`), хотя Correction-запись утверждала обратное —
  исправлено: явное упоминание добавлено в bullet `departments.test.ts` в Expected files; (2)
  Non-blocking — правка про ложный `Header.tsx`-прецедент была в Objective ошибочно помечена как
  "non-blocking correction", что противоречило Status/round 2 verdict (везде классифицировано как
  Blocking) — исправлено: метка убрана. Оба пункта исправлены inline без нового решения пользователя.
- Skeptic findings (round 2 + focused re-check): см. verdict-записи выше — 3 Blocking round 2 + 1
  Blocking и 1 non-blocking re-check, все исправлены inline.
- Skeptic Phase B review (round 1, после первичной реализации) — `FAIL`. 3 Blocking: (1)
  `npm run test:e2e` был реально нестабилен (не разовый флейк, как изначально честно, но неточно,
  предполагалось) — независимо воспроизведено skeptic'ом в 4 из 5 полных прогонов, включая
  `--workers=1`; два процессных документа (`WORKLOG.md`/`WORKPLAN.md`) на тот момент давали два
  разных, взаимоисключающих объяснения одного и того же инцидента — сигнал, что причина не была
  по-настоящему установлена; (2) drift-check тест (AC16 на тот момент) проверял только "путь
  reference встречается где-то в тексте файла", но не то, что конкретный ключ `photoByDepartmentId`
  привязан именно к правильной переменной — подмена местами (`sales: supportPhoto`) осталась бы
  незамеченной; (3) `npm run format:check` реально падал на первом независимом прогоне skeptic'а
  (рассинхронизация README.md таблицы после ручной правки) — противоречило заявленным "все exit 0".
- Correction (после Phase B round 1 `FAIL`): (1) **настоящая причина найдена** (не концовка на
  "холодный кэш/разовый флейк", а честное расследование) — прямой статический импорт оригиналов
  `references/**/*.png` порождал по HTTP-запросу на каждый размер/формат для каждой из 5 миниатюр +
  фона на каждый рендер отдела; за один e2e-прогон это давало тысячи short-lived TCP-соединений к
  `/_next/image`, вплоть до исчерпания эфемерных портов Windows в рамках одного прогона (`netstat`
  подтвердил TIME_WAIT-сокеты вплоть до верхней границы диапазона) — воспроизводилось независимо от
  `--workers`. Исправлено: (a) исходники предварительно пересжаты в WebP через `sharp`
  (`src/assets/office-photos/*.webp` — миниатюры 160×160/5–7 КБ, фон 1536×1024/285 КБ, было
  3.1–3.6 МБ каждый); (b) `<Image unoptimized>` — производные уже нужного размера/формата, повторная
  обработка через `/next/image` не нужна, файл отдаётся как обычный статический ассет без лишнего
  round-trip. (2) drift-check тест переписан: проверяет для каждого `id` — существует import из
  `${id}-thumbnail.webp`, и именно эта переменная присвоена ключу `id` в object-литерале (не другая) —
  эмпирически проверено (временная подмена местами → тест падает; возврат кода → тест снова зелёный).
  (3) `format:check` починен (`npm run format`). Objective/Expected files/Risks/Manual checks в
  WORKPLAN.md переписаны без исторических неточностей (не two conflicting explanations, а один
  честный, проверенный текст).
- Skeptic Phase B re-check (сфокусированный, после Correction) — `PASS` (2026-07-17). Независимо
  перепроверил все 3 Blocking-находки round 1: (1) `test:e2e` реально стабилен — сам прогнал
  параллельно (63/63, ~20с) и `--workers=1` (63/63, ~45с, та же конфигурация, где round 1 ловил
  таймаут); подтвердил механизм фикса (`unoptimized` на всех трёх `<Image>`, импорт WebP-производных
  5–7 КБ/285 КБ вместо 3.1–3.6 МБ оригиналов); подтвердил, что `WORKPLAN.md`/`WORKLOG.md` больше не
  содержат двух противоречащих объяснений — старые гипотезы (осиротевшие процессы, холодный кэш,
  разовый флейк) присутствуют только как явно отозванные. (2) drift-check тест — сам воспроизвёл:
  подмена `sales`↔`support` местами реально уронила тест с точным сообщением, возврат кода — снова
  зелёный (файл byte-identical по хешу). (3) `format:check` — exit 0. Полный набор проверок прогнал
  сам: format/lint/typecheck/test (122/122)/build/test:e2e (parallel + `--workers=1`) — все exit 0.
  Non-blocking: строка `departmentPhotos.ts` изначально отсутствовала отдельным пунктом в Expected
  files (задокументирован в других строках) — добавлена после re-check. Blocking: нет.
- Completion evidence (после Phase B round 1 correction, 2026-07-17): все Expected files изменены
  (`content/types.ts`/`schema.ts`, `data/departments.json`, `docs/03`/`docs/05`/`docs/12`), новые
  компоненты `PainGainPanel`/`MobilePainGainAccordion`/`departmentPhotos.ts` + `src/assets/
  office-photos/*.webp` созданы, `OutcomePanel.tsx`/`.module.css` удалены, `DepartmentCopy`/
  `DepartmentExperience`/`DepartmentNavigationRail`/`OfficeExperience` обновлены. Реальные фото
  используются (OQ-P1) через предварительно оптимизированные WebP-производные +
  `<Image unoptimized>` — независимо подтверждено чистой сборкой и чистыми прогонами `npm run
  test:e2e` (63/63 каждый, включая `--workers=1`, ~20с вместо ~50с до фикса), в т.ч. независимо
  перепрогнано skeptic'ом при re-check. `npm run format:check`/`lint`/`typecheck`/`test` (122/122,
  включая drift-check с эмпирической проверкой) — все exit 0. Ручная проверка (одноразовый
  Playwright-скрипт против `npm run dev`, не сохранён в репозитории): консоль чистая на Desktop
  (`?department=executive`) и Mobile (`?department=sales`, 375×812); граница breakpoint 767/768px
  подтверждена; клавиатура — после программного фокуса на заголовке первый Tab уходит на первый пункт
  боли; клик/тап по пункту боли меняет текст выгоды и не оставляет старый виден (скриншоты Desktop
  pain#3, Mobile pain#2).
- Закрытие: `PASSED` → `COMPLETED` по явному подтверждению пользователя 2026-07-17 ("Закрывай Step
  7.3"), тот же прецедент, что закрытие Step 5/7/7.2/7.4. Код и `src/assets/office-photos/*.webp`
  остаются незакоммиченными в рабочем дереве (коммит не запрашивался). Следующий по плану — Step 7.5
  (Tablet, `APPROVED`), зависел от готовой структуры этого шага.

## Open questions (Step 7.3) — OQ-P1–OQ-P6 RESOLVED 2026-07-17

Все шесть вопросов заданы пользователю напрямую через `AskUserQuestion` 2026-07-17 (двумя раундами,
4+2 вопроса). Ответы: **OQ-P1 = (a)** с уточнением — реальные `references/**/*.png` используются и
как общий фон, и как источник миниатюр (разошлось с рекомендацией исполнителя — CSS-заглушка);
**OQ-P2 = (a)** с уточнением — дефолт на пункт №1, всегда сбрасывается при переключении/возврате
(совпало с рекомендацией); **OQ-P3 = (a)** — локальное состояние, сбрасывается при переключении
(совпало с рекомендацией); **OQ-P4 = (a)** — обычный Tab + нативные кнопки (совпало с
рекомендацией); **OQ-P5 = (a)** — черновая копия для всех 5 отделов сейчас (совпало с
рекомендацией); **OQ-P6 = (b)** — отдельный mobile-аккордеон (совпало с рекомендацией). Полный текст
решений и обоснование — `DECISIONS.md` 2026-07-17 "Step 7.3: ответы на OQ-P1–OQ-P6". Решения уже
внесены в основную секцию Step 7.3 выше. Полный текст исходных вариантов сохранён ниже для истории/
трассируемости.

**OQ-P1. Источник фото для миниатюр в панели и общего затемняемого фона.** Сегодня в живом прототипе
нет ни одной фотографии отдела и ни одного фонового фото офиса (`OfficeExperience` рендерит только
карточки/хотспоты на токен-цветных фонах). Единственный кандидат — `Department.reference`
(`references/*.png`) — (a) нигде не используется в рендере сегодня, (b) в `references/README.md`
описан как референс для дизайнера ("мастер-референс", метафоры, "лого... при необходимости
перерисовать" — то есть не готов к продакшену как есть), (c) весит 3.3–3.7 МБ на файл — прямо
затрагивает Performance rules CLAUDE.md ("Lazy-load department assets", "Do not preload all detailed
scenes") и решение 2026-07-14 держать low-fidelity и art-direction раздельными последовательными
этапами.
- (a) Использовать `references/*.png` как есть, скопировав/оптимизировав в `public/`, как реальные
  фото панели и реальный фон — вносит art-direction-уровня ассет в low-fidelity milestone уже сейчас;
  требует ресайза/сжатия, не входящего иначе в scope.
- (b) Новые, намеренно low-fidelity плейсхолдер-изображения (простые плоские иллюстрации/иконки на
  отдел, по несколько КБ) — сохраняет визуальную low-fidelity прототипа, откладывает реальную
  фотографию до будущего art-direction milestone; структурное требование ("у каждого отдела есть
  фото-элемент") всё равно выполнено.
- (c) Единый обобщённый плейсхолдер (или CSS-only заглушка: цветной блок + `alt`-текст, без бинарного
  ассета вообще) для всех 5 отделов и фона — выполняет "фото-элемент существует, семантически описан"
  при нулевом весе новых ассетов; отдельная картинка на отдел — будущая задача.
- (d) Не вводить фото-ассет в этом шаге вообще; выпустить структурную 20/80-раскладку боль/выгода
  сейчас, а "фото в панели + затемняемый фон" — отдельным будущим шагом, когда появится реальный/
  согласованный визуал — сужает scope этого шага, но расходится с уже данной пользователем структурой
  для `department-active`; потребует отдельного согласования на разделение.

**OQ-P2. Начальное состояние области выгоды (80%) до клика по любому пункту боли** — при первом
открытии отдела и при переключении на другой отдел. Не уточнено ни решением пользователя, ни
отредактированным текстом `docs/03`.
- (a) По умолчанию выбран пункт боли №1 (его выгода видна сразу при открытии/переключении) — нет
  пустого состояния, но подразумевает "выбранное" визуальное/ARIA-состояние без действия пользователя.
- (b) Явный плейсхолдер/приглашение ("Выберите проблему слева, чтобы увидеть выгоду") до клика — нет
  дефолтного выбора, чище начальная семантика, но добавляет один лишний клик перед тем, как увидеть
  текст выгоды при каждом визите в отдел.
- (c) Пункт №1 по умолчанию при первом открытии, но последний выбранный пункт сохраняется для отдела
  при повторных `SWITCH_DEPARTMENT`/открытиях в рамках сессии — самый "цепкий"/stateful вариант, выше
  сложность реализации (напрямую завязан на OQ-P3).

**OQ-P3. Где живёт состояние "выбранный пункт боли" и сбрасывается ли оно.** В отличие от
`previewIndex` в Step 7 (сбрасывается бесплатно, так как родительская ветка размонтируется/
монтируется заново), `DepartmentExperience` НЕ размонтируется при переключении между двумя уже
открытыми отделами (`SWITCH_DEPARTMENT` использует ту же JSX-ветку). Наивный локальный `useState` тихо
перенёс бы устаревший индекс через переключение.
- (a) Локальный `useState` в новом компоненте боль/выгода, принудительно сбрасываемый через
  `key={department.id}` на этом поддереве — самое простое решение, без правок редьюсера/URL, тот же
  дух, что и `previewIndex` (локальное, не machine-состояние), с поправкой на найденное отличие в
  размонтировании.
- (b) Локальный `useState` плюс явный `useEffect`, привязанный к `department.id`, сбрасывающий индекс
  без размонтирования всего поддерева — тот же результат, что (a), чуть меньше DOM-churn, чуть больше
  кода.
- (c) Поднять "индекс выбранной боли" в редьюсер `office-machine` как новое состояние — больший
  blast radius (новое поле/действие редьюсера, противоречит паттерну "новое состояние редьюсера не
  вводится", которому следовали все предыдущие шаги 7.x), оправдано только если выбор должен быть
  доступен через URL или читаться в другом месте дерева.
- (d) Не сбрасывать вовсе — индекс сохраняется численно через переключения — не рекомендуется
  (неожиданный UX: отдел B может открыться с уже "выбранным" пунктом №4 просто потому, что это было
  последним кликом на отделе A), приведено для полноты.

**OQ-P4. Клавиатурная модель для 5 пунктов боли.** `docs/11-accessibility.md` говорит только "Tab по
отделам; Enter/Space открывает" в общих чертах — не специфицирует listbox/tablist-паттерн со стрелками
для группы взаимоисключающих выбираемых пунктов. Единственный существующий в проекте прецедент
"несколько кнопок на выбор" (`DepartmentNavigationRail`, `CarouselNavControls`) использует обычный
последовательный Tab + нативные Enter/Space на `<button>`, не roving-tabindex/стрелки.
- (a) Обычный последовательный Tab-порядок — 5 отдельных `<button type="button">`, каждая в обычном
  Tab-порядке, нативная активация Enter/Space — точно повторяет уже существующий прецедент rail/
  карусели, не вводит новый паттерн взаимодействия.
- (b) ARIA `tablist`/`tab`/`tabpanel` (пункты боли — табы, область выгоды — tabpanel) — более точное
  семантическое соответствие "выбор одного из 5 взаимоисключающих видов", но требует roving tabindex +
  обработку стрелок по WAI-ARIA APG — паттерн, нигде больше не используемый в проекте, требует
  собственного тестового покрытия.
- (c) ARIA `listbox`/`option` — та же сложность roving tabindex/стрелок, что (b), более слабое
  семантическое соответствие, чем tablist, для этого конкретного взаимодействия "кликнул — увидел
  деталь".

**OQ-P5. Писать ли оставшиеся 20 пар боль/выгода (4 отдела × 5) в рамках реализации этого шага, или
отдельной content-задачей?** Только "Дирекция" имеет (не финальный) черновик; zod-инвариант
`.length(5)` потребует хоть какого-то валидного контента для всех 5 отделов в момент правки схемы —
поэтому "заблокировать до появления реальной копии" не отдельный третий путь: реальный выбор — между
реальной (пусть не финальной) деловой копией для всех 5 сейчас или заглушечной копией для 4 отделов с
последующей content-задачей.
- (a) Написать черновую (явно не финальную, "будет правиться") копию боль/выгода для всех 4
  оставшихся отделов в рамках этого же шага, в том же тоне/формате, что уже есть у "Дирекция" —
  выпускает полностью демонстрируемый, с реальным контентом опыт для всех 5 отделов за один проход.
- (b) Выпустить структурную/схемную правку сейчас с явной заглушкой для 4 не-"Дирекция" отделов
  (например, "Боль-заглушка 1" / "Выгода-заглушка 1"), отдельным будущим шагом WORKPLAN заменить их на
  реальную черновую копию — меньше диффа в этом шаге, но 4 из 5 отделов визуально незакончены до
  этого будущего шага.

**OQ-P6. Применяется ли 20/80-раскладка боль/выгода единообразно и на Mobile (≤767px), или Mobile
нужен собственный явно спроектированный вариант в рамках этого шага?** `DepartmentExperience` — один
общий компонент на Desktop/Tablet/Mobile сегодня (только padding/font-size отличаются по breakpoint,
нет breakpoint-зависимой замены контента). Step 7 (Mobile, `COMPLETED`) уже рендерит этот компонент,
включая `CarouselNavControls`. Так как `symptoms`/`outcomes` удаляются из модели данных полностью,
Mobile в любом случае не сможет рендерить старую форму — опциональна только *визуальная раскладка*
(буквально бок о бок 20/80 vs раскладка в столбик/аккордеон).
- (a) Выпустить ту же раскладку 20/80 бок о бок как единственный вариант пока что, с базовой
  регрессионной проверкой, что она визуально не ломается на Mobile-ширинах (риск: колонка шириной 80%
  на 320–375px, вероятно, слишком узкая для использования, может понадобиться аварийный
  столбик-фолбэк всё равно).
- (b) Спроектировать и выпустить явный Mobile-специфичный вариант в столбик/аккордеон (список боли на
  всю ширину; тап по пункту раскрывает/заменяет его выгодой) в рамках этого же шага, чтобы Mobile не
  остался в стихийном состоянии — больший scope, но сохраняет уже `COMPLETED`/подтверждённый
  пользователем Mobile-поток аккуратно законченным, а не случайно деградировавшим.

## Step 7.4 — Global return-to-hero navigation + header tagline

- Status: `COMPLETED` (пользователь явно подтвердил закрытие, 2026-07-17: «Закрывай Step 7.2 и
  Step 7.4. Как закроешь, остановись и сообщи.»).
- Status history: `AWAITING_SKEPTIC` → skeptic Phase B round 1 `PASS` (кнопка в `Header`) →
  `PASSED` → **пользователь скорректировал размещение кнопки до подтверждения `COMPLETED`** (см.
  `DECISIONS.md` "Возврат кнопки из Header в панель офиса") → `AWAITING_SKEPTIC` (round 2) →
  skeptic Phase B round 2 `PASS` (без блокирующих находок; 1 non-blocking — противоречие между
  формулировками Manual checks в `WORKPLAN.md` и `WORKLOG.md` — устранено inline) → `PASSED` →
  **пользователь переименовал кнопку «Вернуться в офис» → «Выйти из офиса» до подтверждения
  `COMPLETED`** (чисто контентная правка, отдельный лёгкий skeptic review `PASS`, см.
  `DECISIONS.md` "Переименование кнопки...") → `PASSED` → `COMPLETED` (2026-07-17).
- Objective: Добавить два элемента (устраняют реальный пробел, найденный пользователем при
  визуальной проверке Step 7.2: после скрытия hero не было способа вернуться к исходному экрану,
  кроме перезагрузки страницы): (1) кнопку «Выйти из офиса» (`copy.returnToOfficeLabel`) —
  **над сеткой отделов, внутри панели офиса** (`OfficeExperience`), видима только в `overview`
  (когда отдел не выбран) — по клику мгновенно возвращает в `hero`, очищая
  `activeDepartmentId`/URL-параметр `?department=` и перенося focus на заголовок hero;
  (2) текстовый тэглайн (`copy.tagline`) по центру `Header`, видимый во всех состояниях без
  исключений (не затронуто правкой — осталось как было реализовано изначально).
  **Правка 2026-07-16 (после первичной реализации, до подтверждения `COMPLETED`):** первая версия
  этого шага размещала и кнопку, и тэглайн в `Header`, с кнопкой видимой во ВСЕХ не-`hero`
  состояниях (включая `department-active`). Пользователь скорректировал: кнопка переезжает в
  панель офиса, над сеткой карточек отделов, и видима **только в `overview`** — из
  `department-active` пути назад в hero теперь два шага (существующая кнопка «Закрыть» →
  `overview` → «Выйти из офиса» → `hero`), не один прямой клик. Тэглайн остаётся в `Header` без
  изменений.
- **Архитектурная правка (первая версия, теперь частично отменена):** `Header` был статичным
  server-компонентом СНАРУЖИ `OfficeMachine`. Для кнопки в `Header` потребовался перенос `Header`
  внутрь `OfficeMachine.tsx`, чтобы получить `view`/`dispatch`. **После правки размещения кнопки
  этот перенос всё ещё нужен** — `Header` остаётся внутри `OfficeMachine` (для тэглайна доступ к
  состоянию не требовался бы, но откатывать перенос ради этого не имеет смысла — `.main`-стиль уже
  живёт в `OfficeMachine.module.css`, откат создал бы лишний diff без функциональной причины);
  `Header.tsx` при этом упрощён обратно до `{ tagline: string }` — пропы `showReturnButton`/
  `onReturnHome` удалены, кнопка теперь — проп `OfficeExperience` (`returnToOfficeLabel`/
  `onReturnHome`), рендерится в overview-ветке `OfficeExperience.tsx`, перед `OfficeSemanticMap`.
- In scope:
  - `src/features/office-machine/reducer.ts` — действие `RETURN_TO_HERO`
    (`{view: "hero", activeDepartmentId: null}` из любого состояния, кроме `hero` — no-op там; не
    изменено правкой — сам редьюсер по-прежнему принимает действие из любого состояния, изменилось
    только то, из какого UI-элемента и в каких состояниях он реально диспетчерится).
  - `src/features/office-machine/OfficeMachine.tsx` — `Header` рендерится здесь (`tagline` —
    единственный проп); `OfficeExperience` получает новые пропы `returnToOfficeLabel`/
    `onReturnHome`; focus-management ветка (`state.view === "hero" && previousView !== "hero"` →
    focus на `#hero-heading`) не изменена.
  - `src/components/homepage/Header.tsx`/`.module.css` — **правка**: пропы `showReturnButton`/
    `onReturnHome` удалены, остался один `tagline`; раскладка упрощена обратно (лого+бренд слева,
    тэглайн по центру, без колонки для кнопки).
  - `src/components/office/OfficeExperience.tsx`/`.module.css` — **правка**: новые пропы
    `returnToOfficeLabel: string`/`onReturnHome: () => void`; кнопка рендерится первым элементом в
    overview-ветке (перед `<p className={styles.hint}>`), только когда `activeDepartment`
    отсутствует — структурно недоступна, когда открыт отдел, вместе с остальной overview-веткой
    (`OfficeSemanticMap`/`MobileDepartmentCarousel`).
  - `src/components/homepage/HeroCopy.tsx` — `id="hero-heading" tabIndex={-1}` на `<h1>` (не
    затронуто правкой).
  - `src/components/homepage/HomepageShell.tsx`/`.module.css`,
    `src/features/office-machine/OfficeMachine.module.css` — не затронуты этой правкой.
  - `src/content/types.ts`, `src/content/schema.ts`, `data/homepage-copy.json` — поля
    `HomepageCopy.tagline`/`HomepageCopy.returnToOfficeLabel` не затронуты правкой.
  - `docs/05-homepage-state-machine.md` — раздел "## Возврат в hero" переписан под новое
    поведение: кнопка только в `overview`, из `department-active` — два шага («Закрыть» →
    «Выйти из офиса»).
  - Тесты: `src/tests/unit/components/homepage/header.test.tsx` (переписан под упрощённый
    `Header`), `src/tests/unit/components/office/office-experience.test.tsx` (+2 новых теста —
    кнопка видна и работает в overview, отсутствует в department-active), `home-page.test.tsx` (без
    изменений в этой правке — их проверки не завязаны на местоположение кнопки в DOM, только на
    `getByRole("button", {name: ...})`, что работает независимо от контейнера),
    `office-overview.spec.ts` (последний тест переписан: раньше проверял прямой клик из
    department-active, теперь проверяет двухшаговый путь — «Закрыть» → overview → «Выйти из
    офиса»), `mobile-touch-flow.spec.ts` (не изменено — уже тестировал только из overview/carousel).
- Out of scope:
  - Анимация/motion при возврате в hero — мгновенный переход, без transition (тот же принцип, что
    Step 7.2 решение 5 — намеренно, не оплошность).
  - Прямой возврат в `hero` из `department-active` одним кликом — отклонён этой правкой: кнопка
    видна только в `overview`, из `department-active` — два шага («Закрыть» → «Выйти из
    офиса»). Само действие редьюсера `RETURN_TO_HERO` по-прежнему технически работает из любого
    состояния (не переписано), но не диспетчерится ни одним UI-элементом, кроме как из `overview`.
  - Копирайт-ревью тэглайна на соответствие Copy rules `CLAUDE.md` — конфликт зафиксирован в
    `DECISIONS.md`, не решён этим шагом (не отказ реализовать и не молчаливая правка текста
    пользователя).
  - Step 7.3 (боль/выгода панель), Step 7.5 (Tablet-специфичные CSS) — не затронуты по существу;
    Header/`RETURN_TO_HERO` — общий код для всех breakpoint'ов, наследуется автоматически.
- Dependencies: Step 7.2 (`PASSED`) — этот шаг реализован поверх его результата в том же
  незакоммиченном рабочем дереве. `git diff --stat` этого шага пересекается с файлами, реально
  принадлежащими scope Step 7.2 (`HeroCopy.module.css`, `OfficeExperience.module.css`,
  `office-overview-keyboard.spec.ts`, `hero-copy.test.tsx`, `README.md` — уже покрыты собственным
  independent skeptic PASS Step 7.2, round 2, без находок), а не только `OfficeMachine.tsx`/
  `HeroCopy.tsx`, названными выше.
- Expected files: см. In scope — полный список.
- Acceptance criteria:
  1. Кнопка «Выйти из офиса» отсутствует в дереве доступности в состоянии `hero`.
  2. Кнопка видима сразу после `ACTIVATE_CTA` (состояние `overview`), расположена над сеткой
     карточек отделов (первый элемент overview-ветки в DOM).
  3. Кнопка **отсутствует** в дереве доступности во всех `department-*`-состояниях (структурно —
     overview-ветка, которую она возглавляет, вообще не рендерится, когда отдел активен).
  4. Клик по кнопке из `overview` возвращает в `hero`: `h1`/`primaryCta` снова видимы, хотспоты
     снова отсутствуют в дереве доступности, кнопка «Выйти из офиса» снова отсутствует.
  5. Из `department-active` (включая напрямую открытый по URL) возврат в `hero` — два шага:
     «Закрыть» → `overview` (кнопка появляется) → «Выйти из офиса» → `hero`; URL-параметр
     `?department=` очищается на первом шаге.
  6. Сразу после возврата в hero (шаг 4 или второй клик шага 5), без единого нажатия Tab,
     `document.activeElement` — `#hero-heading` (заголовок hero), не `<body>`.
  7. Тэглайн виден в дереве доступности во всех состояниях без исключений (`hero`, `overview`,
     `department-*`), на Desktop и Mobile viewport — не затронуто правкой, остаётся в `Header`.
  8. Тап-таргет кнопки «Выйти из офиса» ≥44×44 CSS px на Mobile.
  9. Существующие focus-management инварианты (открытие отдела → focus на заголовок; закрытие →
     focus на хотспот/карточку; `ACTIVATE_CTA` → focus на первый хотспот/карточку) не регрессируют.
  10. Существующий инвариант "документ не скроллится целиком" не регрессирует ни на одном из ранее
      проверенных viewport (десктоп/мобильный наборы Step 7.2/Step 7.5).
  11. Нет hydration-mismatch — размещение кнопки внутри `OfficeExperience` не меняет условия
      рендера остальной overview-ветки.
  12. `npm run format:check`/`lint`/`typecheck`/`test`/`build`/`test:e2e` — все exit 0.
  13. Ни одна новая npm-зависимость не добавлена.
- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test -- --run
  npm run build
  npm run test:e2e
  ```
  **Round 1** (кнопка в Header, до правки размещения): `format:check` ✓, `lint` ✓, `typecheck` ✓,
  `test` ✓ (115/115), `build` ✓, `test:e2e` ✓ (59/59). **Round 2** (кнопка перенесена в
  `OfficeExperience`, только `overview`) — реально прогнано заново: `format:check` ✓ (1 файл
  автоформатирован — `office-experience.test.tsx`), `lint` ✓, `typecheck` ✓, `test` ✓ 115/115
  (после исправления 2 реальных падений — см. ниже), `build` ✓, `test:e2e` ✓ 59/59.
  **Находка при прогоне round 2 (не самоотчёт, реальный `test` fail):** 2 теста в
  `home-page.test.tsx` ожидали, что кнопка структурно отсутствует в hero (`.not.toBeInTheDocument()`)
  — неверно: кнопка теперь живёт в overview-ветке `OfficeExperience`, которая (как и
  `interactionHint`/карта/карусель до неё) в hero — только CSS-скрыта (`hiddenUntilRevealed`), не
  удалена из DOM; jsdom не применяет это CSS-правило, поэтому элемент реально найден. Тесты
  исправлены под уже установленный в проекте паттерн (проверка `data-revealed`, не
  `.not.toBeInTheDocument()` для CSS-скрытых, а не структурно отсутствующих элементов) — реальный
  баг в тесте, не в коде компонента (сам компонент/CSS корректны, подтверждено e2e round 1/2).
- Manual checks: визуальная проверка на dev-сервере проведена (одноразовый Playwright-скрипт
  против уже запущенного `npm run dev`, не сохранён в репозитории — см. `WORKLOG.md` Entry 21):
  скриншоты **на тот момент (2026-07-16, до переименования 2026-07-17)** подтвердили — кнопка
  «Вернуться в офис» над сеткой карточек отделов (выше «Дирекция»), `Header` — лого+бренд+тэглайн
  без кнопки, при открытом отделе кнопки нет вовсе (только «Закрыть»); повторная визуальная
  проверка после переименования — `WORKLOG.md` Entry 23. Основная верификация тем не менее —
  e2e-покрытие AC (программная проверка тех же инвариантов в реальном браузере/Chromium).
- Risks:
  - **Архитектурная правка (`Header` внутри `OfficeMachine`) — сохраняется и после round 2**, хотя
    `Header` больше не нуждается в `view`/`dispatch` (у него остался только `tagline`) — откат
    переноса ради этого не сделан (см. Objective, "Архитектурная правка"); смягчается тем, что
    итоговая DOM-структура идентична прежней, подтверждено отсутствием hydration-mismatch в e2e.
  - **Copy rules конфликт (тэглайн)** — зафиксирован в `DECISIONS.md`, не устранён этим шагом,
    остаётся открытым для решения пользователя.
  - **Пропущенный planner Phase A** — компенсируется полным Phase B review (skeptic) на каждом
    раунде (включая этот, round 2), тем же уровнем строгости verification commands, что и у шагов
    с полным циклом.
  - **UX-риск двухшагового возврата** — из `department-active` теперь два клика («Закрыть», затем
    «Выйти из офиса»), не один прямой — сознательное следствие правки пользователя (кнопка живёт
    только над сеткой overview), не оплошность; зафиксировано для прозрачности, не для решения этим
    шагом.
- Rollback: `git revert` коммит(ов) этого шага — аддитивно/пропс-based поверх Step 7.2, не меняет
  редьюсер/URL-sync существующих действий (только добавляет новое).
- Skeptic verdict: **round 1** — `PASS` (2026-07-16, Phase B, кнопка в Header) — без блокирующих
  находок; 2 non-blocking устранены inline. **round 2** — `PASS` (2026-07-16, Phase B, кнопка в
  `OfficeExperience`) — независимо перезапустил `typecheck`/`test` (115/115)/`test:e2e` (59/59) плюс
  `lint`/`format:check`/`build`; подтвердил буквальное соответствие корректирующей инструкции
  пользователя, честность признания архитектурного нюанса (Header внутри OfficeMachine остаётся не
  строго необходимым, но откат не сделан — явно объяснено, не blocking), корректность
  overview-only видимости (тот же механизм, что уже скрывает interactionHint/карту), реальность
  найденного и исправленного бага в тестах (jsdom не применяет CSS, не подгонка под неверное
  поведение), корректность двухшагового e2e-пути, отсутствие регрессии round-1 покрытия, чистоту
  `git diff --stat`. 1 non-blocking (противоречие Manual checks между `WORKPLAN.md`/`WORKLOG.md`) —
  устранено inline.
- Skeptic findings: round 1 — см. выше. Round 2 — 1 non-blocking (устранено), 0 blocking.
- Completion evidence: реализация round 1 выполнена по прямому поручению пользователя 2026-07-16;
  пользователь скорректировал размещение кнопки до подтверждения `COMPLETED` — round 2 реализован
  тем же днём (см. `DECISIONS.md` "Возврат кнопки из Header в панель офиса"), прошёл skeptic
  Phase B round 2 `PASS`. Verification commands финально: `format:check` ✓, `lint` ✓,
  `typecheck` ✓, `test` ✓ 115/115, `build` ✓, `test:e2e` ✓ 59/59. Ждёт явного подтверждения
  пользователем перехода в `COMPLETED`.

## Step 7.5 — Tablet touch flow

- Status: `COMPLETED` (закрыт 2026-07-17 по явному подтверждению пользователя — «Закрыть оба +
  закоммитить 7.6», `AskUserQuestion`. Реализация выполнена, все verification commands прогнаны с
  exit 0; skeptic Phase B round 1 → `PASS`, blocking-находок нет, 4 non-blocking исправлены inline;
  см. `WORKLOG.md` Entry 35/36/40 и `Skeptic verdict (review реализации, Phase B)` ниже.
  Предусловия Dependencies были выполнены: Step 7 `COMPLETED`,
  Step 7.2 `COMPLETED`, Step 7.3 `COMPLETED`. Новый шаг, добавлен Amendment 4 — см. "## Plan
  amendments" ниже; skeptic Phase A прошёл вместе со Step 7, round 3 `PASS` (2026-07-16); исходный
  ответ пользователя на OQ-T1 получен 2026-07-16 — «(b) Показывать как есть» — **тем же днём
  переопределён `Amendment 5`** (см. "## Plan amendments" ниже и `DECISIONS.md` "OQ-T1
  переопределён"): `interactionHint` теперь скрывается на Tablet тоже.)
- Objective: Адаптировать уже реализованный и принятый Desktop 10/90 shell (Step 6, `COMPLETED`,
  коммит `5756d8d`) для pointer-опционального touch-использования на ширинах viewport 768–1279px
  (`docs/08-responsive-behavior.md` "Tablet 768–1279": "hover не обязателен; выбор кликом/касанием;
  панель может быть шире; меньше ambient motion; крупные touch targets"), по Responsive rules
  CLAUDE.md ("Tablet supports pointer and touch"). В отличие от Step 7 (Mobile ≤767px), который
  заменяет пространственную карту офиса каруселью, этот шаг ЯВНО СОХРАНЯЕТ ту же пространственную,
  абсолютно-позиционированную карту офиса и ту же 10/90-подобную раскладку с
  `DepartmentNavigationRail`, что уже используется на Desktop: раздел `docs/08` "Tablet 768–1279", в
  отличие от раздела "Mobile ≤767" ("Не использовать буквальный 10/90"; отдельный линейный путь
  логотип→hero→обзор→список/карусель→карточка), не описывает отказ от карты или панели — только
  требует, чтобы панель "могла быть шире", touch-таргеты были крупнее, hover не был обязателен, и
  ambient motion было меньше. Поэтому этот шаг целиком переиспользует уже реализованное и принятое в
  Steps 3–6 компонентное дерево (`OfficeSemanticMap`, `DepartmentHotspot`, `DepartmentNavigationRail`,
  `DepartmentExperience`, `DepartmentCopy`/`OutcomePanel`/`DepartmentCTA`) **без единого нового
  React-компонента** — весь шаг сводится к CSS-адаптации внутри нового
  `@media (min-width: 768px) and (max-width: 1279px)` плюс одному функциональному изменению (снятие
  hover-раскрытия `overviewProblem`, так как touch не гарантирует hover) — решение, обобщающее уже
  принятый в Step 7 подход для той же самой причины (см. In scope, пункт 2, и "Не вынесено как
  открытый вопрос" в "## Open questions (Step 7.5)" ниже).

  **Ни `MobileDepartmentCarousel`, ни `CarouselNavControls` (Step 7) здесь не используются** —
  `docs/08` не описывает пейджинг/карусель для Tablet, только для Mobile; вводить их сюда означало бы
  молча копировать mobile-парадигму на диапазон, для которого approved-документ явно описывает
  другое поведение. Этот шаг также не трогает `src/features/office-machine/` (ни редьюсер, ни
  `OfficeMachine.tsx`) — используются те же 6 состояний и 8 действий без изменений, тот же принцип,
  что уже дважды подтверждён в Step 7.

  **Обоснование последовательности исполнения именно после Step 7.** Прямой код-зависимости между
  этим шагом и Step 7 нет — Tablet не переиспользует ни один mobile-специфичный компонент/CSS-класс.
  Тем не менее этот шаг должен исполняться СТРОГО ПОСЛЕ завершения Step 7 (не параллельно), по двум
  причинам: (a) прямое указание пользователя (OQ-M1 = (c), "сейчас же добавить... сразу после");
  (b) оба шага правят один и тот же файл `OfficeExperience.module.css` (Step 7 — скрытие rail и
  рендер карусели на ≤767px; этот шаг — расширение колонки rail на 768–1279px) — последовательное
  исполнение исключает конфликт слияния и сохраняет инвариант CLAUDE.md "не более одного шага
  `IN_PROGRESS` одновременно". См. также Dependencies.

- In scope:
  - **Механизм breakpoint — CSS-only**, без JS/`matchMedia` — `@media (min-width: 768px) and
    (max-width: 1279px)` в существующих `*.module.css`-файлах, тот же принцип, что в Steps 3–7.
  - **Снятие hover-gating с `overviewProblem` (`DepartmentHotspot.module.css`).** Существующее
    правило `.hotspot:hover .problem, .hotspot:focus .problem { opacity: 1; ... }` (Step 3) дополняется
    безусловным показом при `max-width: 1279px` (не отдельным диапазоном 768–1279 — единая широкая
    граница проще и надёжнее двух синхронизируемых вручную правил; на ≤767px это безвредно, так как
    родительский `.map` там уже полностью скрыт правилом Step 7). **Это решение, а не открытый
    вопрос** — оно напрямую продолжает уже принятый в Step 7 (`MobileDepartmentCarousel`) вывод
    "touch не гарантирует hover → текст должен быть виден всегда", тот же принцип, применённый к уже
    существующему, не новому компоненту. Контракт `DepartmentHotspot` (пропы, `aria-describedby`,
    позиционирование) не меняется — реальный desktop-рендер (≥1280px) остаётся пиксель-в-пиксель
    идентичным.
  - **Более широкая панель (`OfficeExperience.module.css`).** `docs/08` "панель может быть шире" —
    новый `@media (min-width: 768px) and (max-width: 1279px)` блок увеличивает колонку rail в
    `.shell10x90` (`grid-template-columns`) относительно desktop-значения `minmax(140px, 14%)`, до
    большего значения (например, `minmax(180px, 20%)`) — точное число — техническая настройка
    исполнителя (прецедент: desktop-значение 14% само было таким же исполнительским решением в
    Step 6), не требует отдельного согласования. Обе колонки (`rail`/`main`) СОХРАНЯЮТСЯ — Tablet не
    переходит на одну колонку, как Mobile.
  - **[OQ-T1 = (b), получено 2026-07-16, ПЕРЕОПРЕДЕЛЁН 2026-07-16 — см. `Amendment 5`]
    `interactionHint`.** Исходный ответ пользователя был «Показывать как есть» — подсказка должна
    была остаться видимой на 768–1279px без изменений. Этот ответ **отменён тем же днём** при
    подготовке Step 7.2 ("Overview full-screen (hide hero)"): skeptic Phase A обнаружил
    противоречие между этим OQ-T1=(b) и требованием Step 7.2 скрыть `interactionHint` на всех
    ширинах; пользователь явно выбрал скрыть подсказку и на Tablet тоже (`DECISIONS.md` 2026-07-16
    "OQ-T1 переопределён"). Механизм: безусловное CSS-правило `.hint { display: none; }`
    (`OfficeExperience.module.css`, вводится Step 7.2, без media-обёртки) уже покрывает Tablet —
    этот шаг **не добавляет собственного CSS** для `interactionHint`, только подтверждает
    регрессию (подсказка отсутствует) на Tablet-ширинах. Старый текст этого пункта (варианты (a)/
    (b)/(c) и мотивировка "показывать как есть") сохранён ниже в "Open questions (Step 7.5)" для
    истории/трассируемости, не удалён.
  - **Тап-таргеты ≥44×44 CSS px** — измерение (не изменение по умолчанию) для: хотспотов карты
    (`DepartmentHotspot`), кнопок `DepartmentNavigationRail`, `DepartmentCTA`, кнопки «Закрыть» — на
    характерных Tablet-размерах (портрет 768×1024, альбом 1024×768, крайняя узкая 768px). Если
    измерение покажет значение <44px — точечная CSS-правка внутри того же media query (условный
    Expected file, решается по факту измерения, не предполагается заранее).
  - **"Меньше ambient motion" — явно раскрытая неприменимость.** В текущем low-fidelity прототипе НЕ
    реализовано никакого decorative/continuous ambient motion (нет `OfficeVisualLayer`, нет
    WebGL/cursor-parallax — Step 3 Risks явно зафиксировал их отсутствие); единственная существующая
    моторика — функциональные CSS-переходы `opening`/`switching`/`closing` состояний (Step 5),
    которые не являются "ambient" в смысле `docs/08` (они не непрерывные/декоративные, а
    привязаны к конкретному переходу состояния) и не сокращаются этим шагом по этой причине. Это
    зафиксировано здесь явно, чтобы не выглядеть как молчаливо пропущенный пункт `docs/08` при
    будущем review.
  - **`prefers-reduced-motion` на Tablet** — регрессионная проверка уже существующего глобального
    правила и CSS-классов `opening`/`switching`/`closing`, без нового механизма.
  - **Регрессия инварианта "без скролла документа"** на новых комбинациях ширины/высоты, ранее не
    протестированных (768×1024 портрет, 1024×768 альбом, 1024×600 — узко-низкая комбинация).
  - **Регрессия клавиатуры/фокус-менеджмента** — тот же DOM/компоненты, что Desktop; Tab-порядок
    (контент 90%-области → 4 элемента rail, Step 6 AC5), Escape, явная кнопка «Закрыть» — без
    изменений кода, только подтверждение на Tablet-ширинах.
  - **Проверка корректности границ трёх смежных breakpoint'ов.** Впервые в проекте появляются ТРИ
    смежных CSS-диапазона (`≤767`/`768–1279`/`≥1280`) — явная проверка на граничных значениях 767px,
    768px, 1279px, 1280px: нет ни зазора (ширина, не покрытая ни одним правилом), ни наложения (два
    противоречащих правила активны одновременно).
  - **Header/HeroCopy на Tablet** — точечная регрессионная проверка (не предполагаемая правка) на
    768px и 1279px — лого/бренд не перекрываются, hero CTA не обрезаны; правка файлов — условная,
    только при фактически найденной проблеме (тот же паттерн, что уже применён для Header в Step 7).
  - **Обновлённые unit-тесты:** `department-hotspot.test.tsx` — если снятие hover-gating меняет
    проверяемые CSS-классы/атрибуты.
  - **Новые e2e-тесты** `src/tests/e2e/tablet-touch-flow.spec.ts` (возможно, второй файл для
    клавиатуры, по прецеденту `office-overview.spec.ts`/`office-overview-keyboard.spec.ts`):
    `test.use({viewport: {width: 1024, height: 768}, hasTouch: true})` плюс отдельный прогон на
    768×1024 (портрет) — полный поток (тап по хотспоту открывает отдел; `overviewProblem` виден без
    hover/focus; тап по элементу rail переключает без промежуточного overview; «Закрыть»/Escape;
    прямой `?department=<id>`); измерение ширины rail-колонки (`boundingClientRect`, шире, чем
    desktop-эталон); тап-таргеты ≥44×44; граничные ширины 767/768/1279/1280px; регрессия клавиатуры;
    `prefers-reduced-motion`; отсутствие console/hydration-mismatch ошибок — отдельно в `npm run dev`
    и отдельно в production-сборке; полная регрессия существующих Desktop (≥1280px) И Mobile
    (≤767px) e2e-сьютов без ослабления ожиданий. **Дополнено `Amendment 5`:** отдельная проверка —
    `interactionHint` отсутствует в дереве доступности на 768×1024 и 1024×768 (регрессия AC12,
    безусловное правило Step 7.2 покрывает и Tablet — см. Dependencies на Step 7.2).

- Out of scope:
  - `MobileDepartmentCarousel`/`CarouselNavControls` (Step 7) — не используются на Tablet;
    `docs/08` не описывает пейджинг/карусель для этого диапазона.
  - Любые новые React-компоненты — не вводятся; весь шаг — CSS плюс одна точечная функциональная
    правка (hover-gating).
  - Свайп — неприменимо (на Tablet нет карусельной поверхности для свайпа; вопрос не возникает).
  - Landscape/portrait-ориентация как отдельный, специфицированный acceptance criterion — не
    вводится (тот же прецедент, что уже установлен в Step 7 Out of scope); проверяется в Manual
    checks/Risks, не как формальный численный критерий.
  - Новые npm-зависимости, GSAP, WebGL/Canvas — не вводятся.
  - Правка `data/*.json` — не требуется ни для одного варианта ответа на OQ-T1 (варианты (a)/(b) не
    требуют изменения копии; вариант (c), если выбран, потребует отдельного согласования — см.
    Open questions).
  - Новые состояния/действия редьюсера `office-machine`, изменения `OfficeMachine.tsx` — не
    вводятся.
  - Реальная device-лаборатория, автоматизированное axe-сканирование, диагностика/`contact-open`,
    `OfficeVisualLayer`/WebGL, `FallbackExperience`, `/solutions/*`-навигация, `popstate`,
    дозаполнение `data/departments.json`, `MANIFEST.json`, CI pipeline — все уже установленные
    исключения Steps 3–7 остаются в силе без изменений.
  - Сокращение длительности функциональных CSS-переходов `opening`/`switching`/`closing` "раз меньше
    ambient motion" — явно отклонено (см. In scope: ambient motion неприменимо к текущей реализации;
    функциональные переходы регулируются `prefers-reduced-motion`, не breakpoint'ом).
  - Защитный `min-width`-floor для абсолютно-позиционированных хотспотов (аналог существующего
    `min-height: 340px`) — не вводится заранее; вводится только если измерение (In scope, тап-таргеты)
    реально найдёт зону <44×44 на узком портретном Tablet — по прецеденту, как аналогичный
    `min-height`-floor был добавлен в Step 3 только после того, как реальное измерение показало
    проблему (24.7px), а не превентивно.

- Dependencies: Step 6 (`COMPLETED`, коммит `5756d8d`) — жёсткая, функциональная зависимость (этот
  шаг строит CSS-адаптацию поверх уже реализованного 10/90-дерева). Step 7 (`Mobile touch flow`) —
  **зависимость по последовательности исполнения, не по коду** (см. Objective) — этот шаг не
  начинается, пока Step 7 не получит `APPROVED` и не будет фактически реализован/закрыт (во
  избежание параллельных правок одного и того же `OfficeExperience.module.css` и по прямому указанию
  пользователя, OQ-M1 = (c)). Ответ пользователя на OQ-T1 получен 2026-07-16, зафиксирован в
  `DECISIONS.md` — см. "Open questions (Step 7.5)" ниже. **Дополнено 2026-07-16 (пользователь сверил
  визуал overview с планом):** этот шаг также зависит от нового **Step 7.2 (`Overview full-screen
  (hide hero)`, `PROPOSED`)**, вставленного между Step 7 и этим шагом — Tablet должен строиться на
  уже исправленном поведении `overview` (hero скрыт, офис на весь экран), а не наследовать
  устаревшее (`docs/05` "overview", правка 2026-07-16). **Дополнено 2026-07-16 (сверка визуала
  department-active):** также зависит от нового **Step 7.3 (`Department view redesign (pain/gain
  panel)`, `PROPOSED`)** — Tablet использует тот же `DepartmentExperience`/`DepartmentNavigationRail`,
  что и Desktop, поэтому должен строиться на уже исправленной 20/80-раскладке "боль/выгода" и фото в
  панели, а не наследовать устаревшую одноколоночную структуру.

- Expected files:
  - `src/components/office/DepartmentHotspot.module.css` — обобщение hover-gating правила
    `.problem` до `max-width: 1279px`.
  - `src/components/office/OfficeExperience.module.css` — новый
    `@media (min-width: 768px) and (max-width: 1279px)` блок: более широкая колонка rail;
    `interactionHint` скрыт безусловным правилом Step 7.2 (`.hint { display: none; }`) — регрессия
    на Tablet-ширинах, не новая правка этим шагом (`Amendment 5`, переопределяет прежний OQ-T1=(b)).
  - `src/components/office/DepartmentNavigationRail.module.css` — условно, только если измерение
    найдёт тап-таргет <44×44.
  - `src/components/departments/DepartmentCTA.module.css`, `DepartmentExperience.module.css` —
    условно, та же причина (кнопка «Закрыть»/CTA).
  - `src/components/homepage/HeroCopy.module.css`, `Header.module.css` — условно, только при
    найденной проблеме на граничных ширинах 768/1279px.
  - Обновлённый `src/tests/unit/components/office/department-hotspot.test.tsx` — если меняются
    проверяемые классы/атрибуты.
  - Новый `src/tests/e2e/tablet-touch-flow.spec.ts` (возможно, второй файл).
  - `README.md` (новая строка "7.5" в таблице статусов), `WORKPLAN.md`, `WORKLOG.md`,
    `DECISIONS.md` (включая запись по OQ-T1).

- Acceptance criteria:
  1. На 768–1279px `overview` по-прежнему рендерит пространственную, абсолютно-позиционированную
     карту офиса (`OfficeSemanticMap`/`DepartmentHotspot`) — не карусель, не вертикальный список;
     `MobileDepartmentCarousel` остаётся `display: none` на всём этом диапазоне.
  2. `overviewProblem` виден в разметке для каждого хотспота на 768–1279px без наведения/фокуса
     (регрессия невозможна физически, так как правило CSS общее для диапазона — проверяется
     геометрически/структурно).
  3. Тап/клик по хотспоту открывает отдел: 10/90-подобная раскладка сохраняется (`main`+`rail`, не
     одна колонка, в отличие от Mobile).
  4. Колонка `DepartmentNavigationRail` измеримо шире desktop-эталона (`boundingClientRect`) на
     768–1279px.
  5. Тап/клик по любому из 4 элементов rail переключает отдел напрямую (`SWITCH_DEPARTMENT`), без
     промежуточного `overview`, без полной перезагрузки.
  6. Явная кнопка «Закрыть» присутствует и работает; `Escape` — идентичный эффект (регрессия Step 5).
  7. Все интерактивные тап-таргеты (хотспоты, кнопки rail, `DepartmentCTA`, «Закрыть»), измеренные на
     768/1024/1279px, — ≥44×44 CSS px (либо измерены и уже соответствуют без изменений, либо
     доведены до соответствия точечной CSS-правкой).
  8. Нет вертикального скролла документа на 768–1279px при разумной высоте (регрессия по прецеденту
     Steps 3–6); отдельная проверка узко-низкой комбинации (например, 1024×600) — внутренний скролл
     соответствующей панели, не документа.
  9. Клавиатура: Tab-порядок и `Escape`/фокус-менеджмент идентичны Desktop-поведению (Step 5/6 AC),
     подтверждено измерением именно на Tablet-ширинах, не только унаследовано по предположению.
  10. `prefers-reduced-motion: reduce` на 768–1279px — переходы функциональны идентично Desktop.
  11. Граничные ширины: на 767px активна Mobile-раскладка (карусель, не карта); на 768px — Tablet
      (карта+широкий rail); на 1279px — Tablet; на 1280px — Desktop-раскладка Step 6 без изменений
      (rail — узкая desktop-ширина, не Tablet-широкая) — все четыре значения проверены явно, не
      предполагаются по непрерывности.
  12. `interactionHint` НЕ виден на 768–1279px (безусловное CSS-правило Step 7.2, `Amendment 5`,
      переопределяет прежний OQ-T1=(b)) — регрессия отсутствия наложения/остатков подсказки на
      Tablet-ширинах, та же проверка, что на Desktop/Mobile.
  13. Полная регрессия существующих Desktop (≥1280px) e2e-сьютов (Steps 3–6) — без ослабления
      ожиданий.
  14. Полная регрессия существующих Mobile (≤767px) e2e-сьютов (Step 7) — без ослабления ожиданий;
      подтверждено, что Tablet-правки (`max-width: 1279px` для hover-gating,
      `min-width:768px and max-width:1279px` для rail) не протекают на ≤767px раскладку.
  15. Ни один компонент, изменённый этим шагом, не импортирует `src/content/*` напрямую
      (grep-регрессия) — тривиально верно, так как новых client-компонентов не вводится.
  16. Нет console/page errors на всём потоке на Tablet viewport — отдельно `npm run dev`, отдельно
      production-сборка.
  17. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run test:e2e` — все exit 0.
  18. `git diff --stat` относительно коммита закрытия Step 7 ограничен списком Expected files.
      **Известное ограничение метода, зафиксировано 2026-07-17 (skeptic Phase B, non-blocking 1):**
      буквальная форма невыполнима — Steps 7.2/7.3/7.4 остались незакоммиченными (`WORKLOG.md`
      Entry 34; коммит по CLAUDE.md требует запроса пользователя), поэтому diff против `42d80d2`
      включает и их. Суть критерия (изоляция шага) проверена эквивалентным методом: перечислением
      файлов, реально изменённых этим шагом, и сверкой их с Expected files. Skeptic подтвердил
      изоляцию независимо, тремя несходящимися сигналами (mtime, маркеры "7.5" в `src/`, счётчики
      тестов 63+18=81). Это замена метода верификации, не scope — Amendment не требуется (вердикт
      skeptic Phase B).
  19. `DECISIONS.md` содержит запись по OQ-T1 с реальным согласованием пользователя, полученным до
      начала реализации, а не проставленную исполнителем.
  20. Ни одна новая npm-зависимость не добавлена в `package.json`/`package-lock.json`.

- Verification commands:
  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:e2e
  ```
  Плюс обязательная dev-mode console-проверка (тот же процессный прецедент, что Steps 5/6/7):
  ```bash
  npm run dev
  # headless Playwright против http://localhost:3100 на 1024×768 (hasTouch) и отдельно на 768×1024
  # (портрет): пройти полный поток (открыть хотспот, переключить через rail, закрыть, Escape, прямой
  # ?department=<id>) и зафиксировать console/pageerror — ожидается [].
  # Остановить dev-сервер после проверки.
  ```

- Manual checks:
  - Chrome DevTools device toolbar: iPad портрет (768×1024), iPad альбом (1024×768), типичный
    Android-планшет (например, 800×1280) — подтвердить карту+широкий rail (не карусель, не одна
    колонка), отсутствие обрезки, читаемые тап-таргеты; `interactionHint` нигде не появляется
    (`Amendment 5`, AC12).
  - Граничные ширины 767/768/1279/1280px — визуально подтвердить переключение между тремя
    раскладками без промежуточных «сломанных» состояний.
  - Touch-симуляция — полный поток тапами.
  - `prefers-reduced-motion: reduce` на Tablet viewport.
  - Быстрый регрессионный проход на Desktop ≥1280px и Mobile ≤767px.
  - `git diff --stat` относительно коммита закрытия Step 7.

- Risks:
  - **Новый класс риска — корректность границ трёх смежных breakpoint'ов** (впервые в проекте) —
    возможность зазора/наложения между `≤767`/`768–1279`/`≥1280`, особенно если правки этого шага и
    Step 7 в одном и том же файле (`OfficeExperience.module.css`) окажутся не полностью
    непротиворечивы при последовательном мёрдже — смягчается явными AC11/12 и Manual checks.
  - **Малые зоны карты (`office-zones.json`: HR width 26/height 32, executive width 35/height 24) на
    узком портретном Tablet (768px)** — по расчётной оценке (26% от ~720px эффективной ширины
    контейнера ≈ 187px) тап-таргеты должны оставаться далеко выше 44px без дополнительных мер, но это
    ОЦЕНКА, не измерение — подлежит обязательной эмпирической проверке (AC7), не принимается на веру;
    при обнаружении проблемы — точечный `min-width`-floor по прецеденту `min-height` (Step 3), не
    требует нового OQ.
  - **`DepartmentNavigationRail`/`DepartmentHotspot` — единственные, не Tablet-специфичные компоненты,
    получающие правки в этом шаге** — любая правка их CSS рискует случайно задеть Desktop-геометрию
    (≥1280px), уже закреплённую e2e-измерениями Step 3/6 — смягчается явной регрессионной проверкой
    (AC13) и тем, что оба новых правила scoped строго `max-width: 1279px`/
    `min-width:768px and max-width:1279px` (не затрагивают ≥1280px по построению).
  - **Путаница между Step 7 (Mobile touch adaptation) и Step 7.5 (Tablet touch adaptation)** при
    поверхностном чтении названий — оба "touch", но архитектурно принципиально разные (карусель vs
    карта+широкий rail) — смягчается явным disambiguation-абзацем в Objective обоих шагов.
  - **"Ambient motion" неприменимо к текущей реализации** — риск того, что при art-direction milestone
    (когда появится реальный `OfficeVisualLayer`/decorative motion) этот пункт `docs/08` потребует
    отдельного, ещё не назначенного владельца-шага для Tablet-специфичного сокращения — уже
    зафиксировано как известный будущий gap, не решается здесь.
  - Content gap `docs/12` vs `data/departments.json` — без изменений, унаследован.
  - Scope creep: соблазн переделать `OfficeSemanticMap`/`DepartmentHotspot` архитектурно "заодно" —
    явно отклоняется; этот шаг — только CSS-адаптация уже принятого дерева.

- Rollback: `git revert` диапазона коммитов Step 7.5 (аддитивно/CSS-первично относительно Step 6/
  Step 7 — редьюсер, URL-sync, mobile-компоненты не меняются, только CSS + одна точечная правка
  hover-gating). Деструктивный `git reset --hard` — только с явного разрешения пользователя.

- Профильный ревьюер (Phase D, милстоун-ревью после закрытия шага): `frontend-architect` и
  `qa-reviewer` — обязательны по CLAUDE.md; `ux-strategist` — обязателен (user-facing изменение
  раскрытия `overviewProblem` и ширины панели); `motion-engineer` — включён по общему правилу Phase D
  ("motion-related changes"), но с низким ожидаемым объёмом находок, так как этот шаг сознательно не
  вводит нового motion-механизма (см. In scope "ambient motion — неприменимо").

- Skeptic verdict (review плана, Phase A): пройден вместе со "Step 7 — Mobile touch flow" (три
  раунда одного review, 2026-07-16 — **round 1** `BLOCKED`, **round 2** `FAIL`, **round 3** `PASS`,
  см. Step 7 → `Skeptic verdict` выше для полного текста) — все находки всех трёх раундов относились
  к тексту Step 7/Amendment 4/перекрёстным ссылкам (focus-restoration `OfficeMachine.tsx`, конфликт
  с `docs/03`, `Step 8` `Dependencies`, `DECISIONS.md`/`Amendment 4` bookkeeping); специфичных для
  именно содержания Step 7.5 находок ни один из трёх раундов не выявил.
- Skeptic verdict (review реализации, Phase B): **`PASS`** (2026-07-17, round 1). Blocking-находок
  нет. Skeptic перепрогнал весь набор проверок независимо (format/lint/typecheck exit 0; unit 122
  passed/16 files — совпадает с базой Entry 33, значит ни один тест не удалён; build exit 0; e2e 81
  passed = база 63 + 18 новых, значит существующие сьюты не ослаблены и не удалены), подтвердил
  изоляцию шага по существу (mtime + маркеры + счётчики), проверил scoping CSS статически и
  эмпирически (opacity 0 на 1280 vs 1 на 1279; `DepartmentHotspot` импортируется только из
  `OfficeSemanticMap`, скрытой на ≤767px) и признал законными правку `expect.poll` (артефакт
  transition 0.15s, ожидания не ослаблены) и `min-height: 44px` до 1279px (условие Expected files
  сработало по измерению 33px). Также выдвинул и **опроверг собственную гипотезу дефекта**: обрезка
  безусловно раскрытого `.problem` (`max-height: 4rem` + `overflow: hidden`) на узком 768px — probe
  показал `scrollHeight` максимум 28px против лимита 64px, `clipped=false` на всех 5 хотспотах и
  всех трёх Tablet-ширинах.
- Skeptic findings (Phase B): blocking — нет. Non-blocking (1) AC18 формально заменён по методу —
  **FIXED**: зафиксировано прямо в тексте AC18 выше как известное ограничение. (3) `docs/03`
  "Левая панель 10–14%" не квалифицирован по breakpoint'ам — **FIXED**: в `docs/03` "Режим 10/90"
  добавлено уточнение про Tablet со ссылкой на `docs/08`. (4) AC2 проверялся по opacity только на
  1024px — **FIXED**: e2e AC2 параметризован по обоим краям диапазона (768/1279) и дополнен явной
  проверкой отсутствия обрезки текста (`scrollHeight > clientHeight`), закрывающей ровно ту
  гипотезу, которую skeptic проверял вручную. (5) LCP-warning без владельца — **FIXED**:
  зарегистрирован в "## Известные дефекты без владельца" ниже. (2) Незакоммиченные Steps 7–7.5 и
  вытекающая недоступность документированного rollback — **не в компетенции исполнителя**, вынесено
  пользователю (см. "Next"). (6) Текстовый фильтр `/error|hydrat/i` в AC16 — унаследованный
  прецедент Steps 5/6/7, не дефект этого шага, оставлен как есть.
- Skeptic findings (Phase A): см. Step 7 → `Skeptic findings` выше — общие находки, разделённые по
  раундам; ни одна не относится конкретно к Step 7.5.
- Completion evidence: план прошёл skeptic Phase A round 3 `PASS` (вместе со Step 7); все открытые
  вопросы получили ответ пользователя 2026-07-16 (**исходный** OQ-T1 = (b) "показывать как есть",
  **тем же днём переопределён `Amendment 5`** — см. `DECISIONS.md` "OQ-T1 переопределён"; OQ-M5 = (a)
  "подтвердить карусель, честно поправить `docs/03`" — см. Step 7 → "Open questions (Step 7)";
  схема нумерации "Step 7.5" подтверждена — см. `Amendment 4`).
  **Реализация (2026-07-17, `WORKLOG.md` Entry 35):** только CSS (4 файла) + новый
  `src/tests/e2e/tablet-touch-flow.spec.ts`; ни одного `.tsx` — обещание Objective "без единого
  нового React-компонента" выполнено буквально. Все verification commands прогнаны с exit 0
  (`format:check`/`lint`/`typecheck`/`test` 122 passed/`build`/`test:e2e` **81 passed**, включая
  регрессию Desktop ≥1280px (AC13) и Mobile ≤767px (AC14) без ослабления ожиданий) плюс обязательная
  dev-mode console-проверка на 1024×768 и 768×1024 — по критерию проекта `[]`. Все результаты
  независимо перепрогнаны skeptic Phase B → `PASS`. AC7 подтверждён измерением, а не допущением:
  `DepartmentCTA`/«Закрыть» дали 33px и доведены до 44px точечной правкой (условие Expected files);
  риск плана "малые зоны карты на 768px" не подтвердился — все 5 хотспотов ≥44×44 без floor'а.
- Next (решение пользователя, не исполнителя): Steps 7–7.5 остаются незакоммиченными пятый шаг
  подряд, из-за чего документированный rollback этого шага (`git revert` диапазона коммитов) не
  существует физически, а изоляция каждого следующего шага проверяется всё более косвенно (skeptic
  Phase B, non-blocking 2). Рекомендуется решить вопрос о коммите до старта Step 8.

## Известные дефекты без владельца

Зарегистрировано 2026-07-17 по находке skeptic Phase B (Step 7.5, non-blocking 5) — чтобы известный
дефект не потерялся к milestone-review, как это произошло бы, останься он только в `WORKLOG.md`.

- **Dev-only `console.warning` next/image про LCP на `office-background.webp`.** Введён Step 7.3
  (`OfficeExperience.tsx` — `<Image src={officeBackgroundPhoto} fill unoptimized>` без `priority`).
  Не Tablet-специфичен: воспроизводится идентично на Desktop 1280×800 (контрольный прогон Step 7.5).
  В production-сборке отсутствует — e2e AC16 чист. Не подпадает под критерий `/error|hydrat/i`
  Steps 5/6/7. Владелец не назначен; кандидат — Step 8 (`Reduced motion and fallback`) или
  performance-часть milestone-review. Не блокирует Step 7.5.

## Open questions (Step 7.5) — RESOLVED 2026-07-16

**OQ-T1. Копия `interactionHint` ("Наведите курсор на отдел") на Tablet (768–1279px).** —
`RESOLVED (2026-07-16) → ПЕРЕОПРЕДЕЛЁН (2026-07-16)`, см. `Amendment 5`.
Прямой аналог уже решённого для Mobile OQ-M4, применённый к новому диапазону. Единственная
существующая строка в `data/homepage-copy.json` буквально предписывает hover, который `docs/08`
Tablet прямо называет необязательным ("hover не обязателен"). **Исходный ответ пользователя
(2026-07-16, `AskUserQuestion`): вариант (b)** — «Показывать как есть». **Тем же днём, при
подготовке Step 7.2, этот ответ переопределён** — skeptic Phase A обнаружил, что он противоречит
требованию Step 7.2 скрыть `interactionHint` на всех ширинах; пользователь, получив прямой вопрос
об этом противоречии (`AskUserQuestion`), выбрал скрыть подсказку и на Tablet тоже (`DECISIONS.md`
2026-07-16 "OQ-T1 переопределён"). Итоговое поведение: `interactionHint` скрыт на Tablet тем же
безусловным CSS-правилом, что Step 7.2 вводит для всех ширин — Step 7.5 не добавляет отдельного
CSS. Полный текст исходных вариантов сохранён ниже для истории/трассируемости, старое решение (b)
не удалено, только помечено переопределённым.
- (a) Не рендерить `interactionHint` на 768–1279px тоже (тем же CSS-скрытием, что уже принято для
  Mobile, обобщённым до `max-width: 1279px`) — правка контента не требуется. Default черновика, не
  выбран.
- (b) **[Выбрано]** Показывать текст как есть на Tablet — принять как известный, невысокой
  критичности content-mismatch (тот же класс решения, что был доступен, но не выбран, для Mobile —
  OQ-M4 вариант (b)).
- (c) Признать реальным content gap, требующим новой строки копии в `data/homepage-copy.json`,
  учитывающей и Tablet, и Mobile раздельно (например, разный текст для "touch без hover" и "hover
  недоступен, но возможен указатель") — расширение scope на правку `data/*.json`, требует отдельного
  согласования (тот же класс, что OQ-M4 вариант (c)).

**Кандидаты, рассмотренные planner'ом и НЕ вынесенные как открытые вопросы — с обоснованием:**

- **"Показывать desktop 10/90 rail как есть, адаптированную версию, или mobile-подобную карусель на
  планшете?"** — рассмотрено как потенциальный кандидат на открытый вопрос. **Не вынесено как
  открытый вопрос** — решено через прямое чтение `docs/08`: раздел "Tablet 768–1279" явно
  перечисляет "панель может быть шире" (подразумевает, что панель/rail СУЩЕСТВУЕТ и просто
  расширяется), тогда как раздел "Mobile ≤767" явно и однозначно говорит "Не использовать
  буквальный 10/90" и описывает отдельный линейный путь (список/карусель) — эта формулировка есть
  ТОЛЬКО в Mobile-разделе, не в Tablet-разделе. Документ уже дифференцирует эти два диапазона именно
  по этому признаку. Если пользователь не согласен с этим прочтением `docs/08`, это стоит указать
  явно — тогда это станет не открытым вопросом плана, а конфликтом с уже утверждённым документом
  (CLAUDE.md "Report conflicts before implementation"), другой процессный трек.
- **Снятие hover-gating у `overviewProblem` на Tablet ("всегда видим" vs "hover с fallback на
  tap").** Рассмотрено — по природе похоже на реальный, ранее уже эскалированный вопрос (Step 3,
  2026-07-14, "показ overviewProblem"). **Не вынесено как открытый вопрос для Tablet** — отличие от
  прецедента Step 3 в том, что тогда решался вопрос "показывать ли вообще, и если да, то как" при
  трёх реально жизнеспособных альтернативах; для Tablet реальной альтернативы для механизма
  экспонирования уже показываемого (Step 3) текста, по сути, нет: "оставить только hover" при "hover
  не обязателен" (`docs/08`) оставило бы часть пользователей без доступа к обязательному контенту
  вовсе — то же рассуждение, уже применённое к Mobile в Step 7 и прошедшее Phase A review трижды без
  замечаний по этому пункту.
- **Точное числовое значение "шире" для колонки rail** — признано технической настройкой низкого
  риска (прямой прецедент: desktop-значение 14% для той же колонки было аналогичным исполнительским
  решением в Step 6) — не вынесено.
- **Landscape/portrait как формальный acceptance criterion для Tablet** — решено унаследовать уже
  принятый в Step 7 прецедент (проверяется в Risks/Manual checks, не как отдельный численный
  критерий) — не вынесено как новый вопрос именно для Tablet.

## Step 7.6 — Header: clickable logo + tagline scale/centering

- Status: `COMPLETED` (закрыт 2026-07-17 по явному подтверждению пользователя — «Закрыть оба +
  закоммитить 7.6», `AskUserQuestion`; тем же ответом пользователь принял двухрядную шапку на
  Tablet как есть (N4) и подтвердил сохранение left-align tagline на ≤767px — см. "Открытые
  вопросы шапки" ниже. Skeptic Phase B: round 1 `FAIL` (две blocking-находки — обе в тестах, не в
  продукте: нечитаемый маркер перезагрузки и вакуумный guard AC8), исправлено, round 2 → **`PASS`**.
  Все verification commands прогнаны с exit 0: unit 125 passed, e2e **87 passed**. См. `WORKLOG.md`
  Entry 37/38/39/40 и `Skeptic verdict` ниже. Введён `Amendment 6`; scope получен дословно от пользователя при визуальной проверке шапки, см.
  Amendment. Не является частью Step 7.5: тот прошёл skeptic Phase B `PASS` в границах "Tablet touch
  flow" и закоммичен (`cbdabcf`); дописывать в него правки шапки означало бы молча расширить уже
  проверенный scope — прямой запрет CLAUDE.md.)
- Skeptic verdict (Phase B): **round 1 `FAIL`** → **round 2 `PASS`** (2026-07-17). Blocking round 1:
  (B1) `__noReloadMarker` ставился и никогда не читался — AC1 «нет перезагрузки» не верифицировался,
  мёртвая переменная маскировала дыру под видом покрытия; (B2) guard AC8 вакуумен на 768–1279px —
  мерил `boundingBox()` параграфа во всю ширину, из-за чего центр совпадал с центром экрана
  тождественно и регресс `text-align: left` остался бы зелёным. Обе — дефекты проверок, не продукта
  (поведение skeptic подтвердил независимо в обоих раундах). Round 2: skeptic сам воспроизвёл
  mutation test и доказал невакуумность нового guard'а на всех трёх ширинах диапазона (768/1024/1279
  → 109/237/365px), а для B1 изолировал второй блок теста и показал, что маркер — единственный
  ассерт, ловящий реальную перезагрузку (`h1`/`h2`/URL при ней проходят). Non-blocking: N1
  («Previous scope» Amendment 6 противоречил заголовку Step 7.4) — FIXED; N2 (буллет Amendment 6 в
  `## Approval`) — FIXED; N3 (AC7 без автотеста) — принят, skeptic подтвердил computed 22.5/25.5px
  против 15/17px = ровно ×1.5; N4 (шапка на Tablet стала двухрядной, 96 → 133px) и вопрос о центре
  tagline на ≤767px — вынесены пользователю, не решены молча.
- Objective: Две точечные правки шапки, обе названы пользователем буквально: (1) логотип кликабелен
  и возвращает на начальную страницу (`hero`); (2) tagline на 50% крупнее и отцентрован по экрану,
  а не по остатку после логотипа.
- In scope:
  - **Кликабельный логотип.** Оборачивание логотипа+бренда в `<button type="button">`,
    диспатчащий уже существующий `RETURN_TO_HERO` (`reducer.ts`) через уже существующий
    `handleReturnToHero` (`OfficeMachine.tsx`) — ни нового состояния, ни нового действия редьюсера.
    Прецедент: кнопка «Выйти из офиса» (Step 7.4) делает ровно это. `<Link href="/">` **отклонён**:
    `/` и `/?department=hr` — один и тот же route, soft-навигация не размонтирует `OfficeMachine`,
    поэтому `useReducer`-состояние пережило бы переход и логотип визуально «не сработал» бы.
  - **Доступное имя.** `alt` логотипа → `""` (декоративный): текст бренда рядом уже даёт кнопке имя
    «QBit-Studio-Ai»; без этого имя удвоилось бы. Тап-таргет кнопки ≥44px (CLAUDE.md a11y).
  - **Tagline +50%** — `calc(1.0625rem * 1.5)` (desktop/tablet) и `calc(0.9375rem * 1.5)` (≤767px).
    `calc(... * 1.5)` вместо посчитанного числа — множитель «50%» остаётся читаемым в коде.
  - **Центрирование по экрану** — `.header` переводится с `flex` на `grid`. Причина текущего
    смещения — `.tagline { flex: 1; text-align: center }` центрирует текст в остатке ПОСЛЕ
    `brandRow`, что пользователь и увидел.
    **Уточнено по факту измерения (2026-07-17, probe — см. `WORKLOG.md` Entry 37; исходный черновик
    предполагал один универсальный `grid-template-columns: 1fr auto 1fr` на все ширины, и это
    оказалось неверно — сработал риск, записанный ниже):** tagline занимает 501px, `brandRow` —
    222px, поэтому раскладка «логотип слева + идеально центрованный tagline в один ряд» требует
    `48 + 222*2 + 32 + 501 ≈ 1025px`. На 768px она не помещается: боковые колонки перестают быть
    равными (tagline уезжает вправо на измеренные 66px), а `brandRow` сжимается до 160px, перенося
    название бренда на вторую строку. Поэтому раскладок две, и обе дают центр по экрану:
    (a) базовая, одна колонка — tagline отдельной строкой во всю ширину, центр строки = центр
    экрана; (b) `@media (min-width: 1280px)` — три колонки `1fr auto 1fr`. Порог взят
    **существующий** (граница Desktop, Step 7.5) — четвёртый breakpoint не вводится, три смежных
    диапазона Step 7.5 (`≤767`/`768–1279`/`≥1280`) не затрагиваются. `brandRow` получает
    `min-width: max-content`, чтобы колонка не сжимала бренд.
  - Переписывание `@media (max-width: 767px)` блока под grid (`flex-wrap`/`flex-basis` в grid не
    работают). Выравнивание tagline по левому краю на ≤767px — сознательное решение Step 7.4 —
    **сохраняется, не отменяется**: запрос «центрировать» относился к широкому экрану (пользователь
    сверял именно его), и молча ревертить чужое утверждённое решение под общую формулировку нельзя.
    Поэтому AC8 проверяет центрирование на ≥768px.
  - Unit-тесты `header.test.tsx` (кнопка, доступное имя, `onReturnHome`), e2e-регрессия возврата.
- Out of scope: новые состояния/действия редьюсера; изменение `data/homepage-copy.json`; смена
  самого файла логотипа; правка кнопки «Выйти из офиса» (Step 7.4) — обе точки возврата
  сосуществуют сознательно.
- Dependencies: Step 7.4 (`COMPLETED`) — переиспользует введённый им `RETURN_TO_HERO`/focus-эффект.
  Step 7.5 (`PASSED`, `cbdabcf`) — этот шаг правит `.header`, который Step 7.5 не трогал; конфликта
  нет.
- Expected files: `src/components/homepage/Header.tsx`, `src/components/homepage/Header.module.css`,
  `src/features/office-machine/OfficeMachine.tsx` (проброс `onReturnHome`),
  `src/tests/unit/components/homepage/header.test.tsx`, e2e (регрессия), `WORKPLAN.md`,
  `WORKLOG.md`, `README.md`.
- Acceptance criteria:
  1. Клик по логотипу из `overview` и из `department-active` возвращает в `hero`; `?department=<id>`
     исчезает из URL; полной перезагрузки нет.
  2. Клик по логотипу в `hero` — безопасный no-op (`RETURN_TO_HERO` при `view === "hero"` возвращает
     то же состояние).
  3. Логотип — настоящая `<button>`: достижим с клавиатуры, срабатывает по Enter/Space, focus виден.
  4. Доступное имя кнопки — ровно «QBit-Studio-Ai» (не удвоено).
  5. Тап-таргет кнопки логотипа ≥44×44 CSS px на mobile/tablet.
  6. Focus после возврата — на `hero-heading` (существующий эффект `OfficeMachine.tsx`), не на
     `<body>`.
  7. Tagline ровно в 1.5× от прежнего размера на своих breakpoint'ах.
  8. Центр tagline совпадает с центром viewport (допуск на субпиксель), а не смещён вправо, — на
     ≥768px (на ≤767px сохраняется left-align Step 7.4, см. In scope). Проверено на
     768/1024/1279/1280/1920 — по обе стороны от порога раскладки 1280px.
     **Измерение — строго `Range.getBoundingClientRect()` реального inline-box текста, не
     `boundingBox()` параграфа** (уточнено 2026-07-17 по находке skeptic Phase B round 1 B2:
     прежняя формулировка «измерение `boundingClientRect`» позволила вакуумному guard'у выглядеть
     соответствующим — на ≤1279px `<p>` занимает всю ширину контента, поэтому его собственный центр
     совпадает с центром экрана тождественно, при любом `text-align`). Guard обязан быть доказуемо
     невакуумным: mutation test (`text-align: center` → `left`) роняет его на 768/1024/1279
     (смещения 109/237/365px — воспроизведено skeptic независимо).
  9. Нет горизонтального скролла/наложения лого и tagline на 320/768/1279/1280px и шире.
  10. Регрессия: существующие сьюты Desktop/Tablet/Mobile — без ослабления ожиданий.
  11. `format:check`, `lint`, `typecheck`, `test`, `build`, `test:e2e` — exit 0.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Risks:
  - На узких Tablet-ширинах увеличенный tagline + `1fr auto 1fr` может не поместиться в одну строку.
    Ожидаемая деградация — перенос текста на вторую строку (min-content колонки = длинное слово),
    не переполнение; подлежит проверке (AC9), а не допущению.
  - Смена `flex` → `grid` затрагивает `.header`, общий для всех breakpoint'ов — риск регрессии на
    320px, где раньше работал `flex-wrap`; смягчается переписыванием mobile-блока и AC9/AC10.
- Rollback: `git revert` коммита Step 7.6 (изолирован от Steps 7.2–7.5, `cbdabcf`).

### Открытые вопросы шапки — RESOLVED 2026-07-17

Оба вынесены пользователю по находкам skeptic Phase B (N4 и п.4), а не решены исполнителем молча.
Ответы получены 2026-07-17 через `AskUserQuestion`, до закрытия шага.

- **OQ-H1. Двухрядная шапка на Tablet 768–1279px.** Центр tagline по экрану на этом диапазоне
  недостижим в один ряд: логотип 222px + tagline 501px + отступы требуют ≈1025px (измерено), на
  768px tagline уезжал вправо на 66px. Цена одноколоночной раскладки — высота шапки 96 → 133px,
  офисная зона теряет 37px (вертикального скролла не возникает, tablet AC8 зелёный).
  **Ответ пользователя: (a) «Оставить как есть»** — двухрядная шапка на Tablet принята; приоритет у
  центрирования, ради которого шаг и заводился. Вариант (b) «одноколоночная, центр только с 1280px»
  предлагался и не выбран.
- **OQ-H2. Выравнивание tagline на ≤767px.** Формулировка пользователя «выровни по центру экрана»
  буквально задевала left-align, введённый `COMPLETED` Step 7.4, но сверялся широкий экран.
  **Ответ пользователя: (a) «Оставить left-align»** — решение Step 7.4 сохраняется, AC8 остаётся
  ограниченным ≥768px. Вариант (b) «центрировать и на мобильном» предлагался и не выбран.

## Step 8 — Reduced motion and fallback

- Status: `COMPLETED`
- Approval provenance: пользователь прямой инструкцией 2026-07-17 («Приступай к Step 8. Сразу
  выполняй без дополнительного планирования») санкционировал старт без Phase A (planner-черновик +
  skeptic review плана), в отличие от Steps 5–7.6. Поля ниже, ранее помеченные «детализируется
  перед стартом шага», заполнены исполнителем при старте — это раскрытие уже утверждённых
  Objective/Acceptance criteria, не Amendment (Objective и оба AC не менялись). Phase B (skeptic
  review исполнения) **не отменяется** — остаётся обязательной.
- **Разрешение отложенного вопроса «что является visual layer»** (owner по Step 3 Risks/Step 5/Step 6
  Out of scope — «перед стартом Step 8»): visual layer этого milestone — **фотослой `next/image`**
  (`officeBackgroundPhoto` позади 10/90-раскладки + 5 миниатюр отделов в `DepartmentNavigationRail`,
  Step 7.3, OQ-P1). `OfficeVisualLayer`/WebGL/Canvas **не вводятся** — это не новое решение, а
  подтверждение уже зафиксированного в Steps 3/5/6 Out of scope и в CLAUDE.md «First milestone»
  («No final 3D art»). Следствие: «ошибка визуального слоя» = ошибка загрузки фото, а не падение
  WebGL-контекста. См. `DECISIONS.md` 2026-07-17.
- Objective: Реализовать reduced-motion и visual fallback.
- Dependencies: Step 7 (`COMPLETED`), Step 7.5 (`COMPLETED`) — **дополнено при skeptic Phase A
  review Step 7/Step 7.5 (Amendment 4, 2026-07-16):** Step 7.5 физически вставлена между Step 7 и
  этим шагом и должна завершиться первой (см. "Step 7.5 — Tablet touch flow" → Dependencies); текст
  этого шага (кроме этой строки) сознательно не переписывается по Amendment 4 (нумерация Step
  8/Step 9 не сдвигается). **Дополнено 2026-07-16:** между Step 7 и Step 7.5 также вставлены новые
  Step 7.2 (`Overview full-screen (hide hero)`, `PROPOSED`) и Step 7.3 (`Department view redesign
  (pain/gain panel)`, `PROPOSED`) — тот же принцип (нелинейная метка, не сдвиг нумерации).
- In scope:
  - **(A) Reduced motion — реальный разрыв, а не косметика.** Сегодня `globals.css` обнуляет CSS
    `animation`/`transition` под `prefers-reduced-motion: reduce`, но JS-таймеры машины состояний
    (`OfficeMachine.tsx`: `OPEN_DURATION_MS` 800, `SWITCH_DURATION_MS` 600, `CLOSE_DURATION_MS` 700)
    работают независимо от медиа-запроса. Под reduced motion это даёт: пустая 90%-область в течение
    700 мс на закрытии (fade-out уже отработал мгновенно, а `CLOSE_COMPLETE` ещё не пришёл) и на
    столько же отложенный возврат focus на хотспот. Нарушает `docs/05` инвариант «reduced motion
    сохраняет функции», `docs/07` «оставить все функции», CLAUDE.md Motion rules («Critical content
    must not depend on animation completion») и `docs/07` запрет «критические кнопки после длинной
    анимации». Исправление: новый хук `usePrefersReducedMotion` (`matchMedia`, подписка на
    изменение — это и есть `MOTION_PREFERENCE_CHANGE` из `docs/05`, без отдельного действия
    редьюсера) → под reduce все три длительности схлопываются в 0.
  - **(B) Visual fallback.** Обёртка `OfficePhoto` над `next/image` с `onError` → детерминированный
    нейтральный CSS-плейсхолдер вместо битой картинки. Применяется в обеих точках рендера фотослоя
    (`OfficeExperience` фон, `DepartmentNavigationRail` миниатюры).
  - Тесты: unit (хук, `OfficePhoto`, fallback в rail) + e2e (reduced-motion закрытие без 700 мс
    задержки и с возвратом focus; `route.abort()` по `**/*.webp` → контент и 5 кнопок живы).
  - Честная правка `docs/05` «## error-fallback» — привести документ в соответствие с реальностью
    (прецедент: honesty-правка `docs/05` после skeptic FAIL в Step 3).
- Out of scope:
  - `OfficeVisualLayer`, WebGL/Canvas — не вводятся (см. «Разрешение отложенного вопроса» выше).
  - **`SCENE_ERROR` в редьюсере и отдельное машинное состояние `error-fallback`** — сознательно не
    добавляются. При DOM/фото-слое (не WebGL) ошибка локальна для одного `<img>` и не имеет
    оснований поднимать глобальное состояние: `docs/05` требует от `error-fallback` «статичный
    overview с пятью HTML-кнопками», а `OfficeSemanticMap`/`MobileDepartmentCarousel` **уже** ровно
    это и есть — HTML-кнопки, не зависящие от фото (все фото декоративны, `alt=""`). Поднимать
    состояние машины ради декоративной картинки — расширение blast radius без выигрыша. Явно
    поднятое, не молчаливое ограничение; фиксируется правкой `docs/05`.
  - Параллакс, ambient-анимации, «камерный перелёт» (`docs/07`) — не существуют в коде (GSAP
    исключён, OQ-A = (b)); убирать под reduced motion нечего.
  - `VISIBILITY_CHANGE`/пауза анимаций при скрытой вкладке (`docs/07` «Пауза») — нет бесконечных
    циклов, которые нужно останавливать; owner не назначается.
  - Автоматизированное axe-сканирование, `popstate` — по-прежнему owner Step 9.
  - Правка `data/*.json`, `MANIFEST.json`, CI pipeline.
- Expected files:
  - `src/hooks/usePrefersReducedMotion.ts` (новый).
  - `src/components/office/OfficePhoto.tsx` + `.module.css` (новые).
  - `src/features/office-machine/OfficeMachine.tsx` (длительности схлопываются под reduce).
  - `src/components/office/OfficeExperience.tsx`, `src/components/office/DepartmentNavigationRail.tsx`
    (переход на `OfficePhoto`).
  - `src/tests/unit/hooks/use-prefers-reduced-motion.test.ts`,
    `src/tests/unit/components/office/office-photo.test.tsx` (новые).
  - `src/tests/e2e/reduced-motion-and-fallback.spec.ts` (новый).
  - `src/tests/unit/setup.ts` (заглушка `window.matchMedia` — jsdom не реализует её вовсе; без неё
    новый хук роняет весь набор). **Уточнено по факту исполнения (skeptic Phase B, N2):** при старте
    шага здесь ошибочно значился
    `src/tests/unit/components/office/department-navigation-rail.test.tsx` («дополняется»), а
    `setup.ts` не значился вовсе. Реально вышло наоборот: rail-покрытие fallback'а живёт в
    `office-photo.test.tsx` (второй `describe`), а `department-navigation-rail.test.tsx` не тронут.
    Строка приведена в соответствие с диффом, а не наоборот.
  - `docs/05-homepage-state-machine.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Функции сохраняются.
  2. Visual layer error не блокирует контент.
  - Раскрытие AC 1 (проверяемо): под `prefers-reduced-motion: reduce` открытие/переключение/закрытие
    отдела и возврат focus происходят без ожидания motion-длительностей; весь остальной flow
    (Escape, rail, URL-sync, mobile) остаётся рабочим — прежние reduced-motion e2e-тесты не падают.
  - Раскрытие AC 2 (проверяемо): при полном блоке загрузки `*.webp` overview показывает 5 рабочих
    HTML-кнопок, отдел открывается/закрывается, вместо каждого фото — нейтральный плейсхолдер, а не
    битая картинка; в консоли нет необработанных ошибок.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks: Desktop ≥1280px на `http://localhost:3100` с включённым reduced motion (DevTools →
  Rendering → Emulate CSS `prefers-reduced-motion: reduce`): открыть отдел, переключить через rail,
  закрыть — переходы мгновенные, focus возвращается на хотспот, скролла страницы нет. Отдельно —
  DevTools Network блок `*.webp`: overview и открытый отдел остаются читаемыми и кликабельными.
- Risks:
  - `useSyncExternalStore` + `matchMedia` на SSR: сервер не знает предпочтение пользователя →
    серверный снапшот обязан быть `false` (motion разрешён), иначе hydration mismatch. Смягчается
    явным `getServerSnapshot`, юнит-тестом и `npm run build`.
  - Схлопывание длительностей в 0 меняет тайминг, на который опираются существующие e2e-тесты
    reduced motion (5 спеков). Смягчается полным прогоном `npm run test:e2e` — это регрессионная
    проверка, а не новая.
  - `onError` у `next/image` не срабатывает в jsdom так же, как в браузере (нет реальной сети) —
    unit-тест диспатчит `error` вручную; настоящее поведение проверяется e2e через `route.abort()`.
    Оба уровня заявлены сознательно, ни один не выдаётся за другой.
  - `OfficePhoto` становится client-компонентом (`useState`). Реального роста клиентского бандла
    нет: обе точки рендера уже в клиентском графе `OfficeMachine.tsx` (`"use client"`).
- Rollback: `git revert` коммита(ов) Step 8 — шаг аддитивен (2 новых компонента/хук + новые тесты +
  точечные правки 3 существующих файлов); `data/*.json` не меняются. Деструктивный `git reset --hard`
  — только с явного разрешения пользователя.
- Skeptic verdict: **round 1 `PASS`** (Phase B, review исполнения). Blocking findings — нет. Skeptic
  независимо перезапустил все 6 команд (не принял отчёт на веру) и отдельно эмпирически перепроверил
  спорное утверждение про jsdom.
- Skeptic findings:
  - Blocking: нет.
  - N1 (non-blocking, **исправлено inline**): комментарий в
    `use-prefers-reduced-motion.test.ts` ложно утверждал, что jsdom реализует `matchMedia` с
    `matches: false` — на деле (jsdom@29.1.1, проверено запуском) функции нет вовсе, а `false` даёт
    заглушка самого проекта в `setup.ts`. Комментарий противоречил `setup.ts` в том же диффе.
  - N2 (non-blocking, **исправлено inline**): `Expected files` разошлись с реальным диффом — см.
    уточнение в самой секции выше.
  - N3/N4/N7 (non-blocking, приняты без правки): `getSnapshot` создаёт `MediaQueryList` на рендер
    (возвращает `boolean` → `Object.is` стабилен, петли ре-рендера нет; `OfficeMachine` рендерится
    только на переходах); `hasFailed` сбрасывается при remount элемента rail на переключении отдела
    (самоизлечивается за один `setState`, ценой одного повторного неудачного запроса на сломанной
    сети); два reduce-теста не слушают `pageerror` (предпочтение не влияет ни на какую разметку —
    ловить нечего).
  - N5 (для пользователя): ручная браузерная проверка исполнителем не выполнялась — оба Manual
    checks остаются за пользователем; шаг не считать визуально принятым до них.
  - N6 (для пользователя): рекомендация явно ратифицировать запись `DECISIONS.md` 2026-07-17
    (решение о visual layer принято исполнителем, отдельным вопросом пользователю не задавалось).
- Completion evidence:
  - Команды (перепроверены skeptic'ом независимо): `format:check`, `lint`, `typecheck`, `build` —
    exit 0; `npm run test` — **133 passed** (18 файлов); `npm run test:e2e` — **93 passed** (было 87,
    +6 новых; ни один прежний тест не изменён/не ослаблен — подтверждено `git status`).
  - AC 1 — `reduced-motion-and-fallback.spec.ts:20` и `:42`, с контрольным `:68` (без предпочтения
    закрытие по-прежнему ≥650 мс). Пара мутационно доказывает, что схлопывание привязано к
    предпочтению, а не «motion сломан вообще»: на коде до Step 8 тест `:20` намерил бы ~700 мс и упал.
  - AC 2 — `:96` и `:130`, с контрольным `:145` (здоровая сеть → 6 реальных фото, 0 плейсхолдеров).
  - Skeptic отдельно подтвердил полноту AC 1 исчерпывающим grep'ом motion-поверхности: 3 CSS-анимации
    + 1 transition + 3 JS-таймера; ни `rAF`, ни `setInterval`, ни `scrollIntoView`/`smooth` в проекте
    нет — JS-таймеры действительно были единственной непокрытой поверхностью.
  - Раскладка при отказе фото цела by construction: `.thumbnailWrap` имеет явные 32×32, `.shell10x90`
    — `flex:1` grid; absolute-плейсхолдер не участвует в раскладке и схлопнуть их не может. Наборы
    свойств `.fallback` и `.backgroundPhoto` не пересекаются — порядок классов не важен.

## Step 9 — Browser acceptance tests

- Status: `COMPLETED` (skeptic Phase B round 1 `PASS`, blocking findings нет; пользователь явно
  подтвердил закрытие 2026-07-17: «Закрой Step 9. Больше ничего не делай. Я открою новую сессию на
  Step 10» — тот же формат ратификации, что закрытие Steps 5–8).
- Approval provenance: пользователь прямой инструкцией 2026-07-17 («Продолжай работу. Делай сразу с
  кода без дополнительного мини-планирования») санкционировал старт без Phase A (planner-черновик +
  skeptic review плана), тот же прецедент, что Step 8. Поля ниже, ранее помеченные «детализируется
  перед стартом шага», заполнены исполнителем при старте — это раскрытие уже утверждённых
  Objective/Acceptance criteria, не Amendment (Objective и оба AC не менялись). Phase B (skeptic
  review исполнения) **не отменяется** — остаётся обязательной.
- **Ключевой факт состояния при старте:** пять именованных потоков AC1 (desktop, keyboard, mobile,
  URL, reduced-motion) и «нет ошибок в консоли» (AC2) **уже покрыты 93 e2e-тестами, добавленными по
  ходу Steps 3–8** (каждый шаг вносил свои потоки + свой `no console errors`-тест). Базовые AC1/AC2
  таким образом выполнены прошлыми шагами. Реальный остаточный scope Step 9 — два отложенных пункта,
  которые план **четырежды** явно маршрутизировал в Step 9 как owner: **(A) автоматизированный
  axe-скан** (Step 3 Risks «владелец назначен», Step 4 Out of scope «owner Step 9», Step 8 Out of
  scope «owner Step 9») и **(B) фиксация поведения кнопок «назад»/«вперёд» браузера / `popstate`**
  (Step 5/6 Out of scope «явно вне scope … сознательно поднятое», Step 8 Out of scope «owner Step
  9»). Пользователь выбрал этот scope напрямую через `AskUserQuestion` 2026-07-17 (вариант «Axe-скан
  + фиксация back/forward»), см. `DECISIONS.md`.
- Objective: Зафиксировать основные потоки Playwright.
- Dependencies: Step 8 (`COMPLETED`).
- In scope:
  - **(A) Автоматизированный axe-скан** (`@axe-core/playwright`, новая devDependency) — заменяет
    ручной прогон axe DevTools, о котором Step 3/Step 4 Manual checks писали «зафиксировать
    отсутствие серьёзных нарушений». Проверяются три ключевых состояния state machine (hero /
    overview / department-active) на desktop (1280px) и mobile (375px) — на обеих сторонах порога
    767/768px рендерится разный overview (карта офиса vs карусель). Порог приёмки — `impact` serious
    и выше (ровно «серьёзные нарушения»); moderate/minor (напр. best-practice `page-has-heading-one`
    в overview, где hero-h1 намеренно скрыт по Step 7.2) сознательно не заваливают приёмку.
  - **(A-fix) Правка реального нарушения контраста, найденного axe.** Токен `--color-accent-warm`
    (`#b5793a`) на CTA-кнопках (`HeroCopy.primaryCta`, `DepartmentCTA.cta`, белый текст) давал
    контраст 3.64:1 — ниже WCAG AA 4.5:1, axe помечал serious. Затемнён до `#a0642b` (4.82:1) —
    единственная точечная правка чинит оба нарушителя (общий токен). Все прочие применения токена
    (рамка `.painButtonSelected`/`.current`, текст `.currentMark` на светлом, focus-outline) от
    затемнения только выигрывают — ни одна пара «тёмный текст на акценте»/«акцент как светлый фон» не
    существует, регресса контраста нигде нет. Токен помечен «предварительным» ещё в Step 1 и явно
    ждёт art direction — правка не преждирует финальную палитру, только вводит нижнюю границу
    контраста. Пользователь заранее санкционировал починку найденных нарушений (выбор scope выше).
  - **(B) Фиксация поведения истории браузера** — acceptance-тест текущего детерминированного
    поведения, **без реализации** SPA-истории отделов. `url-sync.ts` сознательно использует
    `replaceState` (не `pushState`) по решению OQ-B (`DECISIONS.md` 2026-07-15): открытие/
    переключение/закрытие отдела заменяют текущую запись истории, а не добавляют новую → длина стека
    не растёт, браузерный «назад» не шагает по фантомным состояниям отделов. Тест фиксирует именно
    это (инвариант `history.length`), чтобы будущая реализация `popstate` (если появится) стала явным
    изменением, а не тихим. Второй тест фиксирует, что реальные навигации к прямым ссылкам
    `?department=<id>` по-прежнему поддерживают штатный back/forward (replaceState подавляет только
    внутренние SPA-записи, не реальные переходы).
- Out of scope:
  - **Реализация `popstate`/SPA-истории отделов** — не добавляется: это противоречило бы решению
    OQ-B (`replaceState`) и потребовало бы отдельного Amendment. Step 9 фиксирует текущее поведение,
    не меняет его.
  - **Устранение non-serious axe-находок** (moderate/minor) — вне порога приёмки (см. In scope A).
  - Реальная device-лаборатория, `contact-open`, `OfficeVisualLayer`/WebGL, `/solutions/*`, CI
    pipeline, правка `data/*.json`/`MANIFEST.json` — как и в предыдущих шагах.
- Expected files:
  - `src/tests/e2e/accessibility-scan.spec.ts` (новый — axe, 6 тестов: 3 состояния × 2 ширины).
  - `src/tests/e2e/browser-history.spec.ts` (новый — 2 теста поведения истории).
  - `src/styles/tokens.css` (`--color-accent-warm` затемнён — A-fix).
  - `package.json`, `package-lock.json` (новая devDependency `@axe-core/playwright`).
  - `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Desktop, keyboard, mobile, URL и reduced-motion flows проходят.
  2. Console не содержит критических ошибок.
  - Раскрытие (disclosure, не новые AC): AC1/AC2 подтверждаются полным зелёным прогоном всего e2e
    (101 passed — 93 прежних + 8 новых, ни один прежний не изменён/не ослаблен). Дополнительно
    Step 9 вносит axe-приёмку (0 serious/critical нарушений в 3 состояниях × 2 ширины) и
    acceptance-фиксацию поведения истории браузера — пункты, маршрутизированные планом в этот шаг.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks: axe-скан автоматизирован — ручной прогон axe DevTools более не требуется как
  gate (заменён `accessibility-scan.spec.ts`). Опционально пользователь может лично убедиться в
  desktop-браузере, что затемнённые CTA-кнопки читаемы и визуально приемлемы (изменение цвета —
  единственное user-visible следствие шага).
- Risks:
  - Новая devDependency `@axe-core/playwright` тянет `axe-core` — увеличивает только dev/test-граф,
    в клиентский бандл не входит (`build` exit 0 без изменения размера страницы). Смягчается тем, что
    зависимость исключительно тестовая.
  - Затемнение общего токена могло бы задеть контраст в другом применении — снято прямым аудитом всех
    8 использований (см. In scope A-fix): регресса нет by construction, подтверждено повторным
    зелёным axe-прогоном всех 6 состояний.
  - `history.length`-инвариант зависит от того, что никакой другой код не вызывает `pushState`.
    Смягчается grep'ом (`pushState`/`goBack`/`goForward` в `src` — 0 вхождений до этого шага) и самим
    тестом.
- Rollback: `git revert` коммита(ов) Step 9 — шаг аддитивен (2 новых спека + 1-строчная правка
  токена + devDependency); `data/*.json` не меняются. Деструктивный `git reset --hard` — только с
  явного разрешения пользователя.
- Skeptic verdict: **round 1 `PASS`** (Phase B, review исполнения). Blocking findings — нет. Skeptic
  независимо перезапустил все 6 команд (не принял отчёт на веру), независимо перевычислил контраст по
  WCAG (белый на `#b5793a` = 3.64:1 fail; на `#a0642b` = 4.82:1 pass), аудировал все 8 применений
  токена (регресса контраста нет), подтвердил `pushState`/`goBack`/`goForward` = 0 вхождений в
  production-коде (инвариант `history.length` осмыслен), и `git status`, что ни один прежний тест не
  изменён.
- Skeptic findings:
  - Blocking: нет.
  - N1 (non-blocking, для пользователя): формулировка выбранного в `AskUserQuestion` варианта не
    произносила буквально «и почини найденные нарушения контраста»; A-fix опирается на описание
    варианта («реально найденные нарушения чиню в рамках шага») и запись `DECISIONS.md`. Правка
    легитимна (чинит настоящий WCAG AA дефект, токен помечен «предварительным», отменяема `git
    revert`), но факт передан пользователю на осознание.
  - N2 (non-blocking, принято): порог приёмки axe — serious+; moderate/minor (напр. large-text 3:1,
    часть landmark/ARIA) сознательно не заваливают приёмку. Приемлемо для low-fidelity milestone,
    зафиксировано в In scope (A).
  - N3 (non-blocking): мутационное доказательство «4/6 падали до правки» skeptic перепроверил
    косвенно (контраст-математика + анализ состояний), а не деструктивным перезапуском — он read-only.
    Живой 6/6 pass + нетривиальный `.toEqual([])` + подтверждённый контраст делают его достоверным.
- Completion evidence:
  - Команды (реальные прогоны): `format:check`, `lint`, `typecheck`, `build` — exit 0;
    `npm run test` — **133 passed** (18 файлов, без изменений); `npm run test:e2e` — **101 passed**
    (93 прежних + 8 новых; ни один прежний тест не изменён/не ослаблен).
  - AC1 — весь прежний e2e-набор (desktop/keyboard/mobile/URL/reduced-motion) зелёный на новом коде.
  - AC2 — прежние `no console errors`-тесты в каждом suite зелёные; новые спеки не вводят ошибок.
  - (A) — `accessibility-scan.spec.ts`: 6/6 passed после A-fix; до правки токена 4/6 падали именно на
    `color-contrast` serious (мутационное доказательство, что порог реально ловит нарушения).
  - (B) — `browser-history.spec.ts`: 2/2 passed; инвариант `history.length` неизменен за
    open/switch/close, реальный back/forward между прямыми ссылками работает.

## Plan amendments

### Amendment 1

- Status: `APPROVED`
- Reason: В ходе исполнения Step 1 (после того, как план уже был утверждён) обнаружено, что порт
  3000 на машине разработки постоянно занят посторонним, не относящимся к репозиторию Next.js-
  процессом другого проекта ("Qbit-Studio-AI"). Playwright по умолчанию переиспользует уже
  слушающий сервер (`reuseExistingServer: !CI`), из-за чего первый прогон `npm run test:e2e`
  проверил чужой сайт вместо нашего вместо честного FAIL/старта собственного сервера. Это —
  изменение зафиксированного в утверждённом плане поведения (`dev`/`start`/e2e должны были
  использовать порт по умолчанию 3000), поэтому требует amendment, а не тихой правки внутри уже
  одобренного раздела Step 1.
- Previous scope: `npm run dev`/`npm run start` на порту по умолчанию (3000); `playwright.config.ts`
  `baseURL`/`webServer.url` — `http://127.0.0.1:3000`.
- New scope: `npm run dev`/`npm run start` жёстко зафиксированы на порту 3100 (`next dev -p 3100`,
  `next start -p 3100`); `playwright.config.ts` `baseURL`/`webServer.url` — `http://localhost:3100`
  (не `127.0.0.1` — см. ниже); `README.md` и `WORKPLAN.md` (manual checks) обновлены на порт 3100.
- Impact: не меняет архитектуру или scope Step 1, только номер порта разработки/тестирования.
  Остаточный риск: если порт 3100 в будущем тоже окажется занят посторонним процессом на этой же
  машине, `reuseExistingServer` снова может тихо переиспользовать чужой сервер — этот риск явно
  зафиксирован без владельца в Step 1 Risks; при повторном возникновении потребуется либо
  preflight-проверка занятости порта перед запуском, либо переход на динамически выделяемый
  свободный порт вместо хардкода — это не решается сейчас, чтобы не расширять scope Step 1.
- Skeptic verdict: `FAIL` (review исполнения шага, режим 2) — потребовал (среди прочего) явной
  amendment-записи вместо тихой правки внутри уже одобренного раздела Step 1, а также вскрыл
  связанную проблему: `baseURL: 127.0.0.1:3100` (первоначальный выбор при amendment) провоцирует
  реальную console-ошибку в dev-режиме (Next.js 16 `allowedDevOrigins` блокирует HMR-websocket
  для числового IP-хоста), которой не было при `localhost`. Исправлено переходом на `localhost`
  везде (`playwright.config.ts`, `README.md`, `WORKPLAN.md` manual checks) — см. также запись в
  `DECISIONS.md`.
- User approval: **получено.** 2026-07-14, через явный вопрос пользователю после того, как
  skeptic вернул `BLOCKED` (исполнитель не вправе сам одобрить собственное отклонение от
  утверждённого плана). Пользователь подтвердил: "Да, утверждаю порт 3100 / localhost". Отдельно
  пользователь решил: остаточный риск "порт 3100 тоже может быть занят в будущем" остаётся known
  issue без owner-шага — намеренно не назначается отдельным шагом плана, будет решаться по факту,
  если повторится (см. также `WORKPLAN.md` Step 1, Risks, и `DECISIONS.md`).

### Amendment 2

- Status: `APPROVED`
- Reason: Step 1 явно зафиксировал (`src/styles/tokens.css`, комментарий-заголовок; `WORKLOG.md`
  Entry 1): design tokens "не импортируется в globals.css до финального арт-дирекшна". При
  планировании Step 3 planner предложил тихо пересмотреть это (импортировать токены уже сейчас),
  включив решение в раздел "решений без вопроса" черновика плана. Skeptic (review плана Step 3,
  режим 1, BLOCKED) указал, что это — изменение ранее зафиксированного и утверждённого инварианта
  предыдущего шага, требующее формального `Plan amendments` и реального согласования пользователя
  (CLAUDE.md: "Never change the plan after approval without recording and approving the
  amendment"), а не решения исполнителя задним числом — тот же класс нарушения, что уже приводил
  к BLOCKED в Amendment 1 (Step 1).
- Previous scope: `src/styles/tokens.css` создан в Step 1, не импортирован в `globals.css`,
  комментарий-заголовок: "не импортируется в globals.css до финального арт-дирекшна".
- New scope: `src/app/globals.css` получает `@import "../styles/tokens.css";` уже в Step 3;
  комментарий-заголовок `tokens.css` обновляется (более не "ждёт арт-дирекшна").
- Impact: чисто CSS-изменение, не влияет на архитектуру/компонентную структуру. Design tokens
  становятся реально используемыми в разметке Step 3 (позиционирование/типографика/spacing
  hero и hotspot'ов) вместо inline-значений без токенов.
- Skeptic verdict: `BLOCKED` (review плана Step 3) → потребовал явной amendment-записи с реальным
  согласованием пользователя ДО начала реализации Step 3 (в отличие от Amendment 1, где
  согласование было получено уже постфактум, после того как исполнитель уже начал считать вопрос
  решённым).
- User approval: **получено** 2026-07-14, через явный вопрос пользователю ДО начала реализации
  Step 3: "Да, импортировать сейчас".

### Amendment 3

- Status: `APPROVED` (пользователем — сама структурная развилка OQ-D, "разбить план на два шага
  vs один шаг с под-фазами"; **план обоих новых шагов в разбитой форме ниже отдельно ожидает
  review skeptic**, см. Step 5/Step 6 → Skeptic verdict).
- Reason: при планировании "Step 5 — Desktop 10/90 shell" единый черновик объединял то, что
  `docs/17-execution-protocol.md` в своём собственном примере "хороших шагов" перечисляет как два
  разных пункта ("4. Реализовать выбор отдела." и "5. Реализовать 10/90 shell."). Skeptic (review
  плана Step 5, round 1) отметил это как крупнейший blast radius в проекте на сегодня (state
  machine с нуля + 10/90-раскладка + URL-sync одновременно) — planner явно поднял это как открытый
  вопрос (OQ-D) вместо того, чтобы молча унаследовать увеличенный объём одного шага, по прямому
  правилу CLAUDE.md "не объединяй несколько шагов в один проход реализации".
- Previous scope: единый "Step 5 — Desktop 10/90 shell" (state machine выбора отдела с нуля +
  10/90-раскладка + URL-sync — всё одним WORKPLAN-шагом); далее "Step 6 — Mobile touch flow",
  "Step 7 — Reduced motion and fallback", "Step 8 — Browser acceptance tests".
- New scope: "Step 5 — Department selection state machine" (state machine с нуля, инверсия no-op
  хотспотов, Escape/явная кнопка «Закрыть», focus management, honesty-правка `docs/05`, реальное
  автооткрытие отдела по прямому URL и URL-sync при выборе/переключении/закрытии — без
  10/90-раскладки, содержимое отдела — намеренно минимальный/неоформленный блок) и "Step 6 —
  Desktop 10/90 shell" (10/90-раскладка, `DepartmentNavigationRail`, реальное содержимое отдела по
  OQ-C, поверх уже работающей state machine Step 5). Бывшие "Step 6 — Mobile touch flow"/"Step 7 —
  Reduced motion and fallback"/"Step 8 — Browser acceptance tests" сдвинуты на "Step 7"/"Step 8"/
  "Step 9" соответственно — без изменения содержательного scope, только номер и внутренние
  перекрёстные ссылки. `README.md` обновлён до девятистрочной таблицы статусов.
- Impact: не меняет архитектуру или суммарный содержательный объём работы — тот же набор
  функциональности (state machine + 10/90-раскладка + URL-sync), ранее объединённый в одном шаге,
  теперь разделён на два меньших, отдельно верифицируемых шага с собственным skeptic review
  исполнения у каждого. Общее число шагов утверждённого скелета — 9 вместо 8 (`Approval` →
  `Approved scope` выше сохранён как есть, историческая запись на момент первоначального
  утверждения 2026-07-14; это Amendment документирует последующее изменение).
- Skeptic verdict: review плана Step 5 в его прежней, единой форме вернул `PASS` (round 1, до
  этого Amendment) — этот verdict **утратил силу** после формального разбиения, так как форма
  плана изменилась (см. `WORKPLAN.md` → Step 5/Step 6 → Skeptic verdict ниже: оба — "план ещё не
  проверен skeptic'ом"). Review именно этого структурного разбиения запрошен вместе с
  представлением обновлённого `WORKPLAN.md` пользователю.
- User approval: получено 2026-07-15 напрямую через `AskUserQuestion` — выбран вариант "Разбить на
  два шага (рекомендую)" (OQ-D = (b), см. `DECISIONS.md`, 2026-07-15 "Step 5: разбиение на два
  отдельных шага WORKPLAN (OQ-D, Amendment 3)").

### Amendment 4

- Status: `APPROVED` — оба ранее раздельных статуса теперь утверждены: **структурное решение**
  (сама развилка OQ-M1, "добавить сейчас отдельный шаг для Tablet vs оставить безвладельческим
  gap") получено 2026-07-16 через `AskUserQuestion`; **схема нумерации "Step 7.5"** (рекомендация
  planner'а — нелинейная метка вместо буквального сдвига Step 8→9/Step 9→10, обоснование ниже)
  отдельно подтверждена пользователем 2026-07-16 через тот же `AskUserQuestion` ("Да, «Step 7.5»
  (рекомендация)"). Разделение на два статуса (вместо единого бланкетного `APPROVED`) было признано
  необходимым при skeptic Phase A review (round 1, 2026-07-16) — само разделение сохранено здесь как
  честная запись процесса, не как признак незавершённости: оба пункта теперь закрыты. **План нового
  шага "Step 7.5 — Tablet touch flow" и переработанный "Step 7 — Mobile touch flow" (под OQ-M3)
  прошли собственный review skeptic** (3 раунда — `BLOCKED` → `FAIL` → `PASS`, см. Step 7 →
  `Skeptic verdict` выше) — тот же паттерн, что Amendment 3, где структурное решение и план
  получившихся шагов утверждались раздельно.
- Reason: при планировании "Step 7 — Mobile touch flow" обнаружилось, что `docs/08` описывает три
  разных breakpoint-раздела (Desktop ≥1280 — реализован Steps 3–6; **Tablet 768–1279 — не реализован
  ни одним шагом утверждённого 9-шагового скелета**; Mobile ≤767 — предмет Step 7). Planner вынес
  это как открытый вопрос (OQ-M1) вместо того, чтобы молча оставить Tablet безвладельческим gap
  только потому, что название Step 7 буквально "Mobile", не "Tablet" — по тому же принципу, что уже
  привёл к Amendment 3 (не унаследовать увеличенный объём/пробел молча). Пользователь выбрал
  OQ-M1 = (c): "сейчас же добавить отдельный шаг для Tablet" (`DECISIONS.md`, 2026-07-16
  "Step 7: ответы на OQ-M1–OQ-M4") — прямое изменение утверждённого 9-шагового скелета, требующее
  формального amendment, по тому же non-negotiable правилу CLAUDE.md, что уже применялось к
  Amendment 3 ("Never change the plan after approval without recording and approving the
  amendment").
- Previous scope: утверждённый (Amendment 3) 9-шаговый скелет — ...Step 6 (Desktop 10/90 shell,
  `COMPLETED`) → Step 7 (Mobile touch flow, `PROPOSED`) → Step 8 (Reduced motion and fallback,
  `PROPOSED`, ещё не детализирован) → Step 9 (Browser acceptance tests, `PROPOSED`, ещё не
  детализирован). Диапазон Tablet 768–1279px явно не назначен ни одному шагу.
- New scope: между Step 7 и Step 8 (физически — сразу после секции "## Step 7 — Mobile touch flow"
  и связанного с ней "## Open questions (Step 7)" в `WORKPLAN.md`, перед "## Step 8 — Reduced motion
  and fallback") вставлен новый шаг **"Step 7.5 — Tablet touch flow"**, реализующий диапазон
  768–1279px поверх уже принятой в Step 6 10/90-раскладки, без mobile-специфичных компонентов
  Step 7. Одновременно "Step 7 — Mobile touch flow" переработан под OQ-M3 = (b) (горизонтальная
  карусель/пейджинг вместо default-варианта (a), вертикальный список). **Step 8 и Step 9 сохраняют
  свои текущие номера, названия и весь существующий текст без изменений** — нумерация не
  сдвигается (см. обоснование выбора нумерации ниже). `README.md` получает одну новую строку
  "7.5 | Tablet touch flow | Не приступили", вставленную между строками "7" и "8"; строки "8"/"9" не
  меняются.
- Impact: утверждённая последовательность становится "9 канонически пронумерованных шагов (1–9) +
  один шаг, добавленный этим amendment под нелинейной меткой '7.5'" — итого 10 шагов в порядке
  фактического исполнения, но только Steps 1–9 сохраняют исходную сквозную нумерацию.

  **Обоснование выбора нелинейной метки "7.5" вместо буквального сдвига номеров (Step 8→9,
  Step 9→10).** Рассмотрены два варианта, по прямой аналогии с тем, как в Amendment 3 сравнивались
  "один шаг с под-фазами" vs "формальное разбиение на два шага":
  - (a) **Буквальный сдвиг**: новый Tablet-шаг становится "Step 8"; нынешний Step 8 ("Reduced motion
    and fallback") → "Step 9"; нынешний Step 9 ("Browser acceptance tests") → "Step 10". Плюс:
    чистая, полностью последовательная нумерация. Минус: требует найти и проверить/поправить каждое
    существующее упоминание "Step 8"/"Step 9" по всему проекту — измерено прямым `grep` по трём
    процессным файлам: **21 вхождение в `WORKPLAN.md`, 7 в `WORKLOG.md`, 7 в `DECISIONS.md` — 35
    вхождений суммарно.** Это тот же класс работы, что уже потребовал **6 отдельных раундов skeptic
    `FAIL`** при Amendment 3 (сдвиг Step 6/7/8 → 7/8/9, сопоставимый по масштабу перекрёстных ссылок)
    — прямой, измеренный, задокументированный прецедент высокой стоимости именно этого класса правки
    в этом самом проекте.
  - (b) **Нелинейная метка ("Step 7.5")**: новый шаг вставляется с дробным номером; "Step 7",
    "Step 8", "Step 9" не переименовываются вовсе. Плюс: все 35 существующих вхождений остаются
    буквально верными без единой правки; ноль риска повторения 6-раундового цикла коррекции. Минус:
    дробный номер шага — первый прецедент в проекте; формулировку "9-шаговый скелет" необходимо
    явно аннотировать как "9 канонически пронумерованных + Step 7.5 амендментом" впредь.
  - **Рекомендация planner'а: (b).** Измеренная стоимость (a) — 35 вхождений, сопоставимых или
    превышающих по масштабу прецедент, который уже стоил 6 раундов skeptic `FAIL` в этом же проекте
    — явно перевешивает единственный минус (b). **Эта рекомендация отдельно передана пользователю на
    подтверждение** (не была прямо запрошена вместе с самим OQ-M1 = (c)) — см. `DECISIONS.md`.
- Skeptic review: не запрошен отдельно для текста самого Amendment — review плана обоих затронутых
  шагов (переработанный Step 7 + новый Step 7.5) запрошен и получен вместе (round 1 — `BLOCKED`,
  2 Critical + 2 Major + 1 Minor, включая находки Major (3)/(4)/Minor (5) непосредственно про текст
  этого Amendment — см. Step 7 → Skeptic verdict (Phase A) выше; устранены этой же правкой), по
  прецеденту Amendment 3.
- User approval: структурная развилка (добавить сейчас отдельный Tablet-шаг) получена 2026-07-16
  напрямую через `AskUserQuestion` (OQ-M1 = (c), см. `DECISIONS.md`). Схема нумерации ("Step 7.5"
  вместо буквального сдвига) отдельно подтверждена пользователем 2026-07-16, тоже через
  `AskUserQuestion` — оба согласования получены, см. `DECISIONS.md`.

### Amendment 5

- Status: `APPROVED` (пользователь подтвердил 2026-07-16 через `AskUserQuestion`, вариант «Прятать и
  на Tablet (Recommended)»).
- Reason: skeptic Phase A review (round 1) плана Step 7.2 ("Overview full-screen (hide hero)")
  обнаружил, что Objective/AC4 этого шага (скрыть `interactionHint` на ВСЕХ ширинах, включая Tablet)
  прямо противоречит уже `APPROVED` Step 7.5 — там пользователь ранее ответил на **OQ-T1 = (b)**
  «Показывать как есть»: `interactionHint` на Tablet (768–1279px) должен был остаться видимым без
  изменений, со своим Acceptance criterion 12. Ни planner (Step 7.2 Phase A), ни исходная запись
  `DECISIONS.md` "Overview: офис на весь экран, hero скрывается" не заметили и не обсуждали Tablet
  явно — решение принималось при сверке только Desktop/Mobile-скриншотов. Skeptic вернул `BLOCKED`
  (не `FAIL`) именно потому, что это прямое противоречие между двумя решениями пользователя,
  требующее его явного выбора, а не находка, устранимая правкой одного шага в одну сторону
  односторонне (`WORKPLAN.md` Step 7.2 → Skeptic findings round 1; `DECISIONS.md` 2026-07-16
  "OQ-T1 переопределён").
- Previous scope: Step 7.5 (`APPROVED`) — Objective/In scope содержит пункт «[OQ-T1 = (b), получено
  2026-07-16] `interactionHint`... остаётся видимым на 768–1279px без изменений»; Expected files —
  «`interactionHint` не затрагивается (OQ-T1 = (b))»; Acceptance criterion 12 — «`interactionHint`
  виден на 768–1279px без изменений относительно Desktop (OQ-T1 = (b))»; "Open questions (Step 7.5)"
  фиксирует OQ-T1 как `RESOLVED` = (b).
- New scope: Step 7.5 — пункт про `interactionHint` в Objective/In scope переписан: подсказка
  скрывается на Tablet тем же безусловным CSS-правилом, что вводит Step 7.2 (`.hint { display:
  none; }` без media-обёртки) — Step 7.5 сам не добавляет нового CSS для этого (правило уже
  безусловно на все ширины после Step 7.2), только подтверждает регрессию на Tablet-ширинах.
  Expected files — строка «`interactionHint` не затрагивается» заменена на «`interactionHint`
  скрыт безусловным правилом Step 7.2 — регрессия на Tablet, не новая правка». Acceptance criterion
  12 заменён: «`interactionHint` НЕ виден на 768–1279px (безусловное правило Step 7.2) — регрессия
  отсутствия наложения/остатков подсказки на Tablet-ширинах». "Open questions (Step 7.5)" OQ-T1
  помечен `RESOLVED (2026-07-16) → ПЕРЕОПРЕДЕЛЁН 2026-07-16` со ссылкой на эту запись и
  `DECISIONS.md`, старый ответ (b) сохранён для истории/трассируемости, не удалён.
  Step 7.2 (см. секцию выше) — Status возвращён из `BLOCKED` в `PROPOSED` (готов к skeptic Phase A
  round 2, противоречие устранено); текст Objective/AC4/Risks Step 7.2 не меняется — они уже
  требовали скрытия на Tablet, именно это оказалось правильным после решения пользователя.
  **Дополнено при skeptic Phase A round 2 (`FAIL`, non-blocking-класса дыра в верификации):** новый
  AC12 не был привязан ни к одному конкретному verification-пункту — исправлено добавлением
  явной проверки `interactionHint` в `In scope`/e2e-перечисление `tablet-touch-flow.spec.ts` и в
  `Manual checks` Step 7.5 (та же правка, без нового согласования пользователя — она не меняет
  ничьего решения, только дополняет план проверки уже принятого AC12). Заодно аннотированы два
  оставшихся места с устаревшим необновлённым текстом OQ-T1=(b) (`Status`, `Completion evidence`
  Step 7.5) и добавлена строка про этот Amendment в top-level "## Approval".
- Impact: единственное затронутое architecture-решение — механизм скрытия `interactionHint` остаётся
  ровно тем, что уже описан в Step 7.2 (решение 3, безусловный CSS, без `:global(.js)`-gate); Step
  7.5 теряет единственную Tablet-специфичную особенность видимости hint, приобретённую в OQ-T1 = (b),
  но не теряет ничего из остальных 19 своих acceptance criteria (rail-ширина, hover-gating, тап-
  таргеты, клавиатура, breakpoint-границы и т.д. — не затронуты). Оба шага (7.2 и 7.5) теперь
  взаимно непротиворечивы.
- Skeptic review: находка, приведшая к этому Amendment, — результат Step 7.2 Phase A round 1
  (`BLOCKED`). Сам текст Amendment 5 и обновлённые секции Step 7.2/Step 7.5 подлежат отдельному
  skeptic Phase A review (round 2) перед переводом Step 7.2 в `APPROVED` — по тому же прецеденту,
  что Amendment 3/4 (текст amendment проверяется вместе с планом затронутых шагов, не отдельно).
- User approval: получено 2026-07-16 напрямую через `AskUserQuestion` — вариант «Прятать и на Tablet
  (Recommended)», см. `DECISIONS.md` "OQ-T1 переопределён: `interactionHint` скрывается и на
  Tablet".

### Amendment 6

- Status: `APPROVED` (scope продиктован пользователем дословно 2026-07-17 при визуальной проверке
  шапки: «1) Сделай так, чтобы логотип был кликабельным и переводил на начальную страницу. 2) текст
  "Помогаем экономить ДЕНЬГИ и ВРЕМЯ" сделай на 50% больше. Так же выровни его по центру экрана
  (сейчас у него центровка видимо стоит от логотипа, а надо с начала экрана.)». Согласование —
  сам запрос; отдельный `AskUserQuestion` не требуется, вариантов на выбор нет.)
- Reason: пользователь сверил визуал шапки и нашёл два дефекта, не покрытых ни одним шагом плана.
  Хронологически запрос пришёл, когда Step 7.5 был `PASSED` и ожидал перевода в `COMPLETED`
  («Прежде чем переводить шаг 7.5 в COMPLETED, обрати внимание на шапку»). Дописать эти правки в
  Step 7.5 было нельзя: он прошёл skeptic Phase B `PASS` в границах "Tablet touch flow" и уже
  закоммичен (`cbdabcf`) — это было бы молчаливым расширением утверждённого и проверенного scope
  (запрет CLAUDE.md "Never change the plan after approval without recording and approving the
  amendment" / "Never combine multiple approved steps into one implementation pass").
- Previous scope: шапка принадлежала **Step 7.4** («Global return-to-hero navigation + header
  tagline», `COMPLETED`) — именно он ввёл `.tagline { flex: 1; text-align: center }`, центрирующий
  текст в остатке после `brandRow`, а не по экрану, и его же left-align на ≤767px. Логотип
  некликабелен со Step 1 и владельца не имел. (Формулировка исправлена 2026-07-17 по находке
  skeptic Phase B N1: исходно здесь стояло «шапка вне scope всех существующих шагов», что прямо
  противоречило и заголовку Step 7.4, и соседней строке этого же Amendment.)
  Step 7.4 при этом **не переоткрывается**: он `COMPLETED` по явному подтверждению пользователя, а
  переоткрытие закрытого пользователем шага хуже, чем отдельный новый шаг — этот шаг пересматривает
  его решение открыто, через Amendment, а не правит его задним числом.
- New scope: между Step 7.5 и Step 8 вставлен новый шаг **"Step 7.6 — Header: clickable logo +
  tagline scale/centering"** (см. секцию выше). Схема нумерации — та же дробная, что уже
  подтверждена пользователем для Step 7.5 (`Amendment 4`) и применена к Steps 7.2/7.3/7.4:
  канонические номера 1–9 не сдвигаются, Step 8/Step 9 не перенумеровываются.
- Impact: architecture-решения не меняются — переиспользуются существующие `RETURN_TO_HERO` и
  focus-эффект `hero-heading` (Step 7.4); новых состояний/действий редьюсера, новых зависимостей,
  правок `data/*.json` нет. Step 7.5 не затронут: его acceptance criteria и его диапазон
  (768–1279px) этот шаг не пересматривает; `.header` Step 7.5 не трогал. Step 8/Step 9 — без
  изменений. Единственный принятый ранее выбор, который этот шаг пересматривает, — визуальная
  типографика/раскладка шапки, то есть ровно то, что пользователь и попросил пересмотреть.
- Skeptic review: сам текст Amendment 6 и Step 7.6 проверяется вместе с реализацией шага
  (skeptic Phase B) — тот же прецедент, что Amendment 3/4/5 (текст amendment проверяется вместе с
  планом/реализацией затронутых шагов, не отдельным раундом).

---

## Milestone: Этап 2 — Art direction

- Plan status: `APPROVED` (skeptic-review плана (Phase A) пройден `PASS` 2026-07-18 — blocking находок
  нет, non-blocking findings 1–5 внесены; **все Open questions OQ-A2-1…8 + нумерация закрыты
  2026-07-18** (`AskUserQuestion` + принятые дефолты, см. блок «RESOLVED» и `DECISIONS.md`), поправка
  на черновой арт внесена. **Пользователь явно подтвердил старт реализации Step 10 (2026-07-18, новая
  сессия: «Начинай работать со Step 10. Переходи сразу к исполнению»)** — план переведён в `APPROVED` и
  с этого момента неизменяем, кроме как через записанную Amendment (по прецеденту Amendment 3/4).
- Task: перевести закрытый low-fidelity прототип (Этап 1, Steps 1–9 + 7.2–7.6 — `COMPLETED`, milestone
  review gate `PASS`) в состояние art direction по `docs/02-art-direction.md`, `docs/03-office-map.md`,
  `docs/08`, `docs/10`, `docs/11`, `docs/07` и `docs/13` («Этап 2 — art direction»), не начиная
  Этап 3 (sales pilot: сцена «до/после», калькулятор — вне scope).
- Goal: (1) overview как настоящая сцена офиса поверх мастер-фото; (2) собственная сцена у каждого из
  5 отделов; (3) финальная дизайн-система, выведенная из ассетов; (4) функциональная графическая
  система логотипа; (5) пайплайн адаптивных оптимизированных производных в рамках performance-budget;
  (6) адаптивное кадрирование сцен; (7) контролируемое приближение overview↔отдел. Всё — визуальный
  слой поверх неизменной state machine/контент-модели Этапа 1; skeptic-review обязателен на каждом
  шаге.

### Схема нумерации milestone

Новые шаги продолжают **сквозную каноническую нумерацию** проекта как `Step 10 … Step 16`. Обоснование
(по прямой аналогии с разбором в Amendment 4 «(a) сдвиг vs (b) нелинейная метка»): это добавление
шагов **в конец** последовательности, не вставка между существующими — коллизии номеров и
перекрёстных ссылок, которые сделали дробные метки (`7.2`–`7.6`) оправданными внутри Этапа 1, здесь
нет. Плоская сквозная нумерация — исходная конвенция проекта (Steps 1–9 покрыли Этапы 0–1); дробные
метки применялись только к вставкам в середину. Поэтому `Step 10+` — самый дешёвый и согласованный с
прецедентом выбор. Схема нумерации отдельно выносится пользователю на подтверждение (как в
Amendment 4).

### Что вне scope всего milestone

- Сцена `DepartmentScene`, последовательность «до/после» `BeforeAfterSequence`, калькулятор экономии —
  Этап 3 (`docs/13` «Этап 3 — sales pilot»; `docs/03` прямо оставляет их «не в текущем milestone»).
- Диагностика, lead capture/consent, аналитика — Этапы 3/8.
- Подключение CTA к реальному лид-приёму (Major B из milestone review Этапа 1) — отдельное
  продуктовое решение, не этот визуальный milestone.
- Внутренние страницы `/solutions/*`, `/audit`, cases, blog, contacts — Этап 9; backend/CRM.
- WebGL/Canvas — не вводится: visual layer остаётся фото (`next/image`) + DOM/SVG, подтверждено Step 8
  и `CLAUDE.md` «Do not place the whole interface in Canvas or WebGL». Пересмотр этого требовал бы
  отдельного Amendment.
- Финальные 3D-персонажи, анимация каждого сотрудника (`docs/02` «Избегать»).
- Изменение контент-модели pain/gain, копирайта, schema — визуальный milestone, `data/departments.json`
  контентно не переписывается (кроме координат `data/office-zones.json` в Step 12, это позиционные
  данные арт-дирекшна, не копирайт).
- Возврат оптимизации тяжёлых оригиналов `references/**/*.png` (3+ МБ) на лету через `/next/image` —
  запрещён (исчерпание эфемерных портов под e2e, см. `departmentPhotos.ts`); браузер никогда не
  запрашивает оригиналы.
- Реальная device-лаборатория, cross-browser сверх chromium.

### Глобальные риски milestone

- **Тяжёлые бинарные ассеты в git.** Производные (мастер + 5 сцен × несколько ширин × 1–2 формата)
  добавляют мегабайты в историю. Смягчение: держать производные оптимизированными (в рамках
  performance-budget); каждый шаг фиксирует суммарный вес добавленных файлов в `WORKLOG.md`; оригиналы
  `references/**` не дублируются.
- **Регресс контраста текста поверх фото.** Подписи/панели на фотофоне рискуют упасть ниже WCAG AA.
  Смягчение: обязательный скрим/оверлей с измеренным контрастом; axe-скан (`accessibility-scan.spec.ts`)
  на каждом визуальном шаге, порог serious+ как в Step 9.
- **Перф-регресс от больших изображений.** Смягчение: адаптивные производные, ленивая загрузка деталей
  (`docs/10` «detail assets — только при намерении/выборе»), hero доступен до загрузки любой сцены,
  проверка через DevTools Network + Lighthouse на визуальных шагах.
- **Регресс существующего покрытия.** 133 unit + 101 e2e должны оставаться зелёными; axe 0 serious/
  critical; ни один существующий тест не ослабляется — проверяется `git status` skeptic'ом на каждом
  шаге.
- **Хрупкость финального арта.** Если 6 PNG в `references/**` окажутся плейсхолдерами, калибровка
  координат (Step 12) и вывод палитры (Step 11) частично обесценятся. Смягчение: OQ-A2-7 закрывается
  ДО Step 11/12 (потенциальный blocker).
- **SSR/hydration `next/image`.** Расширение фотослоя не должно вносить hydration mismatch; смягчение —
  `npm run build` на каждом шаге.

### Глобальный rollback milestone

Каждый шаг аддитивен и откатывается независимым `git revert` своего коммита(ов) без затрагивания
предыдущих. Ассеты и токены разнесены по разным шагам, поэтому откат визуального шага не ломает
пайплайн/токены под ним. `data/office-zones.json` (Step 12) — единственное изменение данных; его
откат возвращает предварительные координаты. Деструктивный `git reset --hard` — только с явного
разрешения пользователя. Полный откат milestone = откат Steps 16→10 в обратном порядке; состояние
возвращается к закрытому Этапу 1.

---

## Step 10 — Adaptive image asset pipeline

- Status: `COMPLETED`
- Objective: Ввести воспроизводимый пайплайн адаптивных оптимизированных производных (мастер-сцена
  overview + 5 сцен отделов) в нескольких размерах и современном формате, укладывающийся в
  `docs/10-performance-budget.md`, взамен нынешних одноразово сгенерированных `office-background.webp`
  и миниатюр.
- Dependencies: Этап 1 закрыт (Step 9 `COMPLETED`). OQ-A2-4 (инструментарий/форматы/размеры) и OQ-A2-7
  (финальность арта) закрыты пользователем ДО старта.
- In scope:
  - Скрипт воспроизводимой генерации (напр. `scripts/generate-office-images.mjs`), детерминированно
    порождающий из `references/office-overview/01-company-overview.png` и `references/{sales,support,
    executive,hr,logistics}/0X-*.png` набор производных: мастер-сцена и 5 сцен отделов, каждая в
    нескольких ширинах (напр. 768/1280/1536, при апруве — +1920/2x) в WebP (при OQ-A2-4 = «+AVIF» —
    ещё и AVIF). Миниатюры рельса (~5–8 КБ) сохраняются/перегенерируются тем же скриптом — устраняет
    нынешний «чёрный ящик» (`departmentPhotos.ts`: «сгенерированы один раз»).
  - npm-скрипт запуска генерации (напр. `assets:images`); README-фрагмент/док с точной командой и
    параметрами, чтобы производные восстанавливались из оригиналов.
  - Расширение `departmentPhotos.ts`: экспорт источников мастер-сцены и 5 сцен отделов + метаданных
    для адаптивной отдачи (набор ширин/`sizes`). Механизм отдачи responsive srcset при текущем
    `<Image unoptimized>` определяется по OQ-A2-4 (либо ручной `<picture>`/srcset из предгенерированных
    ширин, либо снятие `unoptimized` только с лёгких производных — оригиналы на лету НЕ оптимизируются).
  - Unit-тест соответствия `department.id ↔ файл-сцена` по схеме именования (как существующий
    `departments.test.ts` для миниатюр) — перепутанное присваивание не остаётся незамеченным.
- Out of scope:
  - Подключение новых сцен к рендеру overview/отделов — Steps 12/13 (этот шаг только готовит ассеты и
    их экспорт; UI не меняется, визуально сайт идентичен).
  - Финальная палитра/токены — Step 11.
  - Оптимизация оригиналов `references/**` на лету — запрещена (см. global scope).
- Expected files:
  - `scripts/generate-office-images.mjs` (новый).
  - `package.json`, `package-lock.json` (новый npm-скрипт; devDependency инструмента генерации по
    OQ-A2-4, напр. `sharp`).
  - `src/assets/office-photos/**` (новые производные мастер-сцены и 5 сцен отделов ×N ширин ×формат;
    миниатюры сохраняются).
  - `src/components/office/departmentPhotos.ts` (экспорт сцен + адаптивные метаданные).
  - `src/tests/unit/content/departments.test.ts` или новый спек (проверка сопоставления сцен).
  - `references/README.md` / `docs/10-performance-budget.md` (документирование процесса генерации).
  - `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. `npm run assets:images` детерминированно порождает все производные из оригиналов `references/**`
     без ручных шагов; повторный запуск даёт **те же производные (имена/размеры/формат)** из тех же
     оригиналов (байт-идентичность кодеков WebP/AVIF между версиями/платформами не гарантируется и не
     требуется — критерий воспроизводимости о наборе файлов, не о байтах; уточнено по skeptic-review
     плана, finding 4).
  2. Каждая производная сцена при своём served-размере укладывается в согласованный вес (напр.
     ≤ ~250 КБ AVIF / ~350 КБ WebP на 1536px — точные пороги фиксируются по OQ-A2-4); ни одна
     производная не превышает бюджет.
  3. Никакой `references/**/*.png` (3+ МБ) не импортируется в клиентский граф и не запрашивается
     браузером (проверяется grep импорта + build-выводом).
  4. Экспорт `departmentPhotos.ts` покрыт unit-тестом соответствия id↔сцена; типизация проходит.
  5. Существующие 133 unit + 101 e2e зелёные без изменений; сайт визуально идентичен (UI не подключает
     сцены на этом шаге).
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`; отдельно `npm run assets:images` (генерация).
- Manual checks: запустить генерацию из чистого состояния (удалив производные) и убедиться, что они
  восстановлены; в DevTools/файловом менеджере сверить итоговые веса с бюджетом. Браузерная проверка
  overview/отдела — идентичность прежнему виду (UI не меняется).
- Risks:
  - Native-зависимость (`sharp`) добавляет бинарь в devDependencies — только dev/build-граф, в
    клиентский бандл не входит. Смягчение: `build` exit 0, размер бандла неизменен; альтернатива —
    документированные CLI (`cwebp`/`avifenc`) без npm-зависимости (OQ-A2-4).
  - Рост размера репозитория от новых бинарников. Смягчение: веса фиксируются в `WORKLOG.md`, держатся
    в бюджете.
  - `<Image unoptimized>` не строит srcset автоматически — responsive-отдача требует явного решения
    (OQ-A2-4); риск, что без него «адаптивность» окажется номинальной. Смягчение: AC2 требует
    нескольких реальных ширин, подключаемых в Steps 12/13.
- Rollback: `git revert` коммита(ов) Step 10 — аддитивно (скрипт + ассеты + экспорт + тест +
  devDependency); UI не затронут.
- Профильный ревьюер (milestone review): frontend-architect (пайплайн/бандл), qa-reviewer (перф-бюджет).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения).
- Skeptic verdict (Phase B, review исполнения): `PASS` (2026-07-18; независимо перепрогнан весь quality
  gate — 141 unit + 101 e2e + build exit 0, детерминизм побайтово, 0 PNG в `.next`, бюджет соблюдён,
  тест ловит перепутанное присваивание; blocking находок нет). Non-blocking: (a) `docs/06` —
  предсессионная правка вне scope, вынесена в отдельный коммит до Step 10; (b) косметика единиц КБ/KiB
  в `docs/10` — исправлена inline (пороги заданы в байтах); (c) source-text тест — обоснованный выбор.

---

## Step 11 — Art-direction design tokens

- Status: `COMPLETED`
- Objective: Заменить предварительные нейтральные токены (`src/styles/tokens.css`, помечены «ждут
  финального арт-дирекшна») финальной дизайн-системой, выведенной из фотографий: палитра
  (графит/тёплый дуб/янтарь/шалфей/крем), типографическая шкала, поверхности, тени/elevation и
  скрим-токены — с сохранением контрастных полов WCAG AA.
- Dependencies: OQ-A2-3 (апрув конкретных hex) закрыт пользователем ДО старта. Формально независим от
  Step 10, но по порядку идёт после него (оба — фундамент до визуальных шагов).
- In scope:
  - Финальные значения токенов цвета/типографики/spacing + новые токены для elevation/теней и для
    скрим/оверлей-слоёв (используются Steps 12/13 для читаемости текста поверх фото).
  - Сохранение нижних границ контраста, введённых Step 9 (`--color-accent-warm` ≥ 4.5:1 на белом для
    CTA); финальная тёплая палитра обязана удовлетворять тому же полу.
  - Документирование палитры/токенов (обновление `docs/02-art-direction.md` или новый
    `docs/design-tokens.md`) — источник истины значений.
- Out of scope:
  - Переверстка/изменение разметки компонентов — только значения токенов; существующие компоненты
    наследуют новые значения без структурных правок.
  - Подключение фото-сцен (Steps 12/13) и логотипной графики (Step 14).
- Expected files:
  - `src/styles/tokens.css` (финальные значения + новые токены elevation/scrim).
  - `src/app/globals.css` (при необходимости — ссылки на новые токены; минимально).
  - `docs/02-art-direction.md` / `docs/design-tokens.md` (фиксация палитры).
  - `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Все токены имеют **предварительные арт-дирекшн-значения**, выведенные из текущих (черновых) сцен
     (OQ-A2-7 = черновой арт); комментарий «ждёт финального арт-дирекшна» **заменяется** на
     «предварительный арт-дирекшн по черновым сценам, ревизия при финальном арте» (не снимается совсем).
  2. axe-скан (`accessibility-scan.spec.ts`) — 0 serious/critical в 3 состояниях × 2 ширины; ни одна
     контрастная пара текст/фон не падает ниже WCAG AA (перепроверяется независимо; контрастные полы
     держатся независимо от конкретных hex и переживают замену арта).
  3. 141 unit + 101 e2e зелёные без изменений (смена значений токенов не ломает поведение).
     («133» в исходной редакции — устаревшая цифра: baseline вырос до 141 ещё в Step 10, который
     добавил 8 тестов сцен. Исправлено при исполнении Step 11, skeptic finding 4.)
  4. Diff ограничен `tokens.css` (+ минимальный `globals.css`) + документация — компонентная логика
     не тронута.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks: Desktop/Tablet/Mobile на `http://localhost:3100` — hero, overview, department-active,
  rail, CTA читаемы и визуально согласованы с новой палитрой; focus-ring (`--color-accent-warm`)
  различим. ~~проверить оба варианта `prefers-color-scheme`~~ — **переопределено Amendment 7**:
  тёмная схема удалена, проверять нечего; вместо этого подтверждается, что под системной тёмной темой
  отдаётся тот же светлый интерфейс.
- **Amendment 7 (2026-07-18, при исполнении Step 11).** Причина: manual-проверка
  `prefers-color-scheme` обнаружила унаследованный дефект — компоненты берут цвет из
  `--color-graphite-*`, а не из `--foreground`, поэтому блок `@media (prefers-color-scheme: dark)`
  переключал только фон документа и давал тёмный текст на тёмном фоне (заголовки 1.16:1, замерено на
  состоянии ДО шага; axe не ловил, так как прогоняется в светлой схеме). Старый scope: globals.css
  правится «минимально, ссылки на новые токены», тёмная схема сохраняется и проверяется. Новый scope:
  из `globals.css` удалены `@media (prefers-color-scheme: dark)` и `html { color-scheme: dark }`.
  Влияние: диф globals.css сокращается; у пользователей с системной тёмной темой интерфейс становится
  читаемым; полноценная тёмная палитра (свой набор токенов + axe-прогон в тёмной схеме) выносится в
  отдельный будущий шаг вне Steps 10–16. Утверждение пользователя: **да** (2026-07-18,
  `AskUserQuestion` — «Убрать блок dark из globals.css»; см. `DECISIONS.md`). Внесено по skeptic
  finding 3, чтобы утверждённый план и код не расходились.
- Risks:
  - Смена общих токенов может задеть контраст в неожиданном применении. Смягчение: аудит всех применений
    акцента (как в Step 9 A-fix) + повторный axe-прогон 6 состояний.
  - Палитра «из фото» субъективна — риск расхождения с ожиданием пользователя. Смягчение: OQ-A2-3
    (апрув hex) закрыт до старта; браузерная проверка обязательна.
- Rollback: `git revert` коммита(ов) Step 11 — возвращает предварительные токены; аддитивно.
- Профильный ревьюер: ux-strategist (палитра/иерархия), qa-reviewer (контраст/a11y).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения).
- Skeptic verdict (Phase B, review исполнения): `PASS` (2026-07-18). Независимо перепрогнан весь
  quality gate (141 unit + 101 e2e + build exit 0); все 22 заявленных значения контраста пересчитаны
  собственной реализацией WCAG и совпали до последней цифры, включая скримы (6.801/4.787/12.819) и
  унаследованные значения (`#a6aab0` 2.33/1.92; `#a0642b` 4.82; тёмная схема 1.16 — дефект
  подтверждён реальным); вывод палитры перепроверен собственным измерением 6 сцен (тёплые тона
  71–88% площади против 1–8% холодных) — не выдуман. AC1–AC4 выполнены; сверка всех `var(--…)`,
  потребляемых в `src/**/*.module.css`, с объявленными токенами — ни один не потерян, единственное
  удаление `--font-size-scale-ratio` нигде не используется. Blocking находок — нет.
  Non-blocking findings 1–7 внесены inline без второго раунда: (1) `--font-size-base` переведён
  16px→1rem, чтобы `body` не переопределял пользовательскую настройку размера шрифта;
  (2) уточнена формулировка «3.89 vs 3.97» (старый акцент считался против нового `graphite-100`);
  (3) удаление тёмной схемы оформлено как **Amendment 7** выше; (4) «133 unit» в AC3 → 141;
  (5) «отдельный шаг типографики» переформулирован как будущий шаг вне Steps 10–16;
  (6) `--font-size-md` удалён как дубликат `--font-size-base`; (7) уточнена формулировка про запас
  `--scrim-soft`. Гейт перепрогнан после правок — зелёный.
  Forward-looking (Steps 12–15): axe структурно не проверяет контраст текста поверх изображения и не
  ловит акцент-на-светлом — ручной расчёт остаётся единственной защитой; `--scrim-soft` (запас 0.29)
  не класть под основные подписи.

---

## Step 12 — Overview как настоящая сцена офиса

- Status: `COMPLETED` (skeptic Phase B `PASS`; AC4 подтверждён пользователем в живом браузере
  2026-07-19: «Зоны попадают куда надо». Закрытие шага — по прямому указанию пользователя
  2026-07-19: «Закрой Step 12 самостоятельно»)
- Objective: Превратить overview (`OfficeSemanticMap` внутри ветки overview `OfficeExperience`) из
  карточек-хотспотов на токен-цветном фоне в настоящую сцену офиса: мастер-фото фоном, 5 хотспотов,
  откалиброванных под сцену, скрим для читаемости подписей, сохранённые hover/focus/selected,
  клавиатура, axe и fallback.
- Dependencies: Step 10 (`COMPLETED`, мастер-сцена как производная), Step 11 (`COMPLETED`, скрим/токены).
  OQ-A2-1 (заменять фон целиком vs фото-подложка под карточками) и OQ-A2-2 (координаты) закрыты
  пользователем ДО старта.
- In scope:
  - Рендер мастер-сцены как адаптивного фона overview через `OfficePhoto` (тот же fallback-паттерн
    Step 8: `onError` → нейтральный плейсхолдер; overview остаётся 5 рабочих HTML-кнопок при отказе фото).
  - Скрим/оверлей-слой (токены Step 11) под подписями/описаниями хотспотов — измеренный контраст ≥ WCAG AA.
  - Реализация решения OQ-A2-1: либо хотспоты становятся прозрачными зонами со скримом поверх фото,
    либо карточки сохраняются как подложка-независимый fallback поверх фото.
  - Калибровка координат `data/office-zones.json` под **текущую** мастер-сцену (OQ-A2-2); координаты
    остаются data-driven и помечаются в `note` как «откалибровано под черновую сцену, перекалибровка
    при замене арта» (OQ-A2-7 = черновой арт — не золотить пиксель-перфект под черновик; перекалибровка
    позже = правка данных, без кода).
  - Обновление hover/focus/selected-состояний хотспотов под фотофон (`DepartmentHotspot.module.css`).
  - Честная правка `docs/03-office-map.md` (уточнение OQ-P1: «overview фото не рендерит» — теперь
    неверно; overview рендерит мастер-сцену) — прецедент honesty-правок `docs/03/05`.
  - e2e: overview показывает фото; при блоке `*.webp` (`route.abort`) — 5 рабочих кнопок и нет
    ошибок консоли; axe 0 serious.
- Out of scope:
  - Сцены отделов в `department-active` — Step 13 (этот шаг трогает только overview-ветку).
  - Motion-переход overview→отдел — Step 16.
  - Адаптивное кадрирование сцены под планшет/телефон — Step 15 (здесь достаточно, чтобы mobile-путь
    `MobileDepartmentCarousel` и tablet-карта не регрессировали; финальный кроп — Step 15).
  - Логотипная графика — Step 14.
- Expected files:
  - `src/components/office/OfficeSemanticMap.tsx` + `.module.css` (фото-фон + скрим).
  - `src/components/office/OfficeExperience.tsx` (передача/рендер мастер-сцены в overview-ветке).
  - `src/components/office/DepartmentHotspot.tsx` + `.module.css` (состояния поверх фото).
  - `src/components/office/departmentPhotos.ts` (экспорт мастер-сцены для overview).
  - `data/office-zones.json` (откалиброванные координаты + note).
  - `src/tests/e2e/overview-scene.spec.ts` (новый); обновления unit
    (`office-semantic-map.test.tsx`, `department-hotspot.test.tsx`).
  - `docs/03-office-map.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Overview рендерит мастер-сцену как адаптивный фон; при отказе загрузки фото overview остаётся 5
     рабочих HTML-кнопок без битой картинки и без ошибок консоли (fallback Step 8 сохранён).
  2. Все подписи/описания хотспотов над фото имеют контраст ≥ WCAG AA, **измеренный против
     эффективной сплошной подложки скрима в наихудшем случае** (не выведенный из axe — axe помечает
     text-over-image как *incomplete*, не *serious*; уточнено по skeptic-review плана, finding 1).
     axe-скан — дополнительный gate: 0 serious/critical в overview на desktop и mobile.
  3. hover/focus/selected хотспотов работают; фокус видим; Tab по отделам, Enter/Space открывает,
     Escape закрывает; клавиатурные e2e не регрессируют.
  4. Координаты хотспотов визуально соответствуют зонам мастер-сцены (подтверждено пользователем,
     OQ-A2-2).
  5. Браузер не запрашивает оригинал `01-company-overview.png` (3.7 МБ); мастер-сцена отдаётся как
     производная в рамках бюджета; hero доступен до её загрузки.
  6. 141 unit + 101 e2e (+ новые) зелёные; ни один прежний тест не ослаблен. («133» в исходной
     редакции — устаревшая цифра: baseline вырос до 141 ещё в Step 10. Исправлено при исполнении
     Step 12, skeptic finding 2.)
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks (обязательно): Desktop ≥1280px `http://localhost:3100` — overview показывает сцену,
  подписи читаемы, хотспоты точно над зонами, hover/focus/выбор корректны; DevTools → Rendering →
  reduced-motion — overview цел; DevTools Network блок `*.webp` — 5 кнопок живы; DevTools Network —
  оригинал PNG не запрашивается; axe DevTools/Lighthouse — контраст ок.
- Risks:
  - Неточная калибровка координат ломает соответствие «зона↔реквизит отдела». Смягчение: OQ-A2-2 +
    обязательная браузерная сверка пользователем.
  - Текст поверх фото падает по контрасту. Смягчение: скрим-токены + axe как gate.
  - Замена абстрактного фона может ослабить no-JS/fallback-путь. Смягчение: fallback-паттерн Step 8
    сохранён и покрыт e2e.
- Rollback: `git revert` коммита(ов) Step 12 — возвращает абстрактный overview и предварительные
  координаты; аддитивно поверх Steps 10/11.
- Профильный ревьюер: ux-strategist + frontend-architect (сцена/зоны), qa-reviewer (a11y/контраст).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения).
- Skeptic verdict (Phase B, review исполнения): `PASS` (2026-07-18). Независимо перепрогнан весь
  quality gate (147 unit + 106 e2e + build exit 0) и добавлены собственные Playwright-замеры на пяти
  вьюпортах (1920×1080, 1440×900, 1280×620, 900×1000, 1280×400) плюс собственное наложение зон на
  мастер-сцену через `sharp`. Подтверждено независимо: контраст скрима пересчитан вручную —
  композит `(93.3, 90.5, 87.7)`, 6.799 ≈ 6.80:1 (AC2); `:focus-visible` реальным Tab даёт
  `outline rgb(143,87,34) 3px` + `box-shadow rgb(255,255,255) 0 0 0 3px` (AC3); пропорция кадра
  измерена ровно `1.5000` на всех пяти вьюпортах, зона sales стоит на 44.0%/2.0% кадра везде —
  утверждение о стабильности процентов верно и математически, и эмпирически (AC4); выбраны
  `overview-1536.avif` (135 099 Б) и `overview-1280.avif` (102 526 Б), 0 запросов `.png` (AC5);
  оба unit-дифа только ДОБАВЛЯЮТ тесты, ни одно существующее утверждение не ослаблено (AC6);
  документ не скроллится ни на одном размере, панель `.office` тоже. Старый тест
  `reduced-motion-and-fallback.spec.ts` не ослаб: он работает на `/?department=sales`, где ветка
  overview не рендерится. Мёртвого CSS не осталось. Blocking находок — нет.
  Non-blocking findings 2–4 внесены inline: (2) «133 unit» в AC6 → 141; (3) пороги веса в e2e
  приведены к таблице `docs/10` по ширине И формату (единый потолок «по 1536px» был слабее
  документа); (4) уточнён заголовок и добавлено пояснение к webp-only блокировке в
  `reduced-motion-and-fallback.spec.ts`. Findings 1 и 5 (mobile грузит невидимую сцену; пол 44px на
  очень низких вьюпортах) перенесены в **Step 15 → «Входные данные из Step 12»** вместе с риском
  «проценты зон держатся на пропорции 3:2». Findings 6–7 (недотронутые Expected files; пустые поля
  по бокам кадра) действий не требуют — первое есть следствие smallest-coherent-change, второе
  закреплено за Step 15.
- **Amendment 9 (2026-07-18, во время открытого Step 12).** Три правки по прямому запросу
  пользователя после визуальной проверки overview. Формально они выходят за scope Step 12 (он про
  сцену overview), но затрагивают ровно те же файлы и состояние, поэтому внесены здесь, а не
  отложены; Step 12 остаётся открытым до подтверждения пользователем.
  1. **Основная CTA ведёт в Telegram, а не в офис.** Старое поведение: `primaryCta` — `<button>`,
     порождающая `ACTIVATE_CTA` (Step 4). Новое: `<a href>` на внешний контакт
     (`primaryCtaHref` в `data/homepage-copy.json`, `target="_blank"`, `rel="noopener noreferrer"`),
     офис раскрывает только вторичная CTA «Исследовать офис». Затронуты: `HeroCopy.tsx`/`.module.css`,
     `data/homepage-copy.json`, `schema.ts` (валидация URL), `types.ts`, 10 e2e-спеков + 2 unit-файла
     (переведены на вторичную CTA), `docs/04`, `docs/05` (честная правка: `ACTIVATE_CTA` теперь имеет
     ровно один инициатор). Это досрочно закрывает Major B милестоун-ревью Этапа 1 («CTA не
     подключена к лид-приёму») — но не через форму, а через прямой контакт.
  2. **Исправлен дефект самопроизвольно раскрывающегося описания отдела.** Пользователь заметил, что
     у «Поддержки» подпись появляется без курсора. Причина: после `ACTIVATE_CTA` фокус переносится на
     первый хотспот программно (Step 7.2), браузер ставит `:focus`, но не `:focus-visible`, а
     описание раскрывалось по `:focus` — текст появлялся без видимой рамки, то есть без причины.
     Замерено: `:focus` = true, `:focus-visible` = false, `outline-style` = none. Исправлено переводом
     селектора на `:focus-visible`. Попутно найдено и исправлено второе: свёрнутое описание сохраняло
     ~8px высоты и тёмную плашку, потому что `padding` не сжимается вместе с `max-height`.
  3. **Забронированы места под будущий текст слева и справа от сцены.** Пустые слоты
     (`[data-overview-slot]`) в сетке `1fr auto 1fr`; занимают поля, которые и так пустовали (кадр
     ограничен по высоте, а не по ширине), поэтому сцену не сжимают — замерено 401×700px каждый при
     неизменном кадре. Ничего не рисуют, пока нет контента. На <1280px схлопываются.
  Влияние на приёмку: unit 147 (состав не менялся, три теста переписаны под новое поведение,
  один добавлен), e2e 106 → 107 (+1 регресс на дефект 2). Пользователь подтвердил, что зоны
  overview попадают верно, но просил Step 12 пока не закрывать.

- **Amendment 10 (2026-07-18/19, во время открытого Step 12).** По прямому ответу пользователя на
  открытый вопрос Amendment 9: **все CTA внутри отделов** («Разобрать работу поддержки», «Получить
  разбор управленческих процессов» и остальные три) ведут в тот же Telegram-контакт, что и основной
  CTA в hero. `DepartmentCTA` перестал быть функциональной заглушкой (`<button>` без обработчика,
  как было с Step 5) и стал внешней ссылкой с теми же правилами, что в Amendment 9: `<a>`,
  `target="_blank"`, `rel="noopener noreferrer"`.
  Поле `primaryCtaHref` переименовано в **`contactHref`**: потребителей стало шесть, и имя,
  привязанное к одной конкретной кнопке, вводило бы в заблуждение. Значение одно на весь сайт —
  дублировать адрес по кнопке нельзя, иначе при смене контакта его забудут в половине мест.
  Адрес прокидывается пропом по цепочке `OfficeMachine → OfficeExperience → DepartmentExperience →
  DepartmentCTA`: импортировать контент-модуль прямо в клиентский компонент нельзя — он тянет zod в
  клиентский бандл (запрет зафиксирован в `src/content/*.ts`).
  Затронуто: `DepartmentCTA.tsx`/`.module.css`, `DepartmentExperience.tsx`, `OfficeExperience.tsx`,
  `OfficeMachine.tsx`, `data/homepage-copy.json`, `schema.ts`, `types.ts`, `docs/04`, `docs/05`,
  5 e2e-спеков + 3 unit-файла (роль `button` → `link` у CTA отдела).
  Проверка: 147 unit + 107 e2e зелёные; в браузере все пять отделов отдают
  `https://t.me/Promt_Pavel`, ошибок страницы нет.

- **Процессный гейт (закрыт 2026-07-19):** AC4 прямо требует «подтверждено пользователем,
  OQ-A2-2», а Manual checks шага — браузерную проверку на ≥1280px. Skeptic проверил соответствие зон
  независимо (наложение + позиционный e2e + скриншоты); пользователь подтвердил их в браузере
  («Зоны попадают куда надо») и затем прямо распорядился закрыть шаг. Все AC1–AC6 выполнены,
  blocking-находок нет → `COMPLETED`.
- **Что осталось за пределами шага (не дефекты, перенесено осознанно):** mobile грузит сцену,
  которую не показывает (~47 КБ), и пол 44px на очень низких вьюпортах — оба вынесены в Step 15
  («Входные данные из Step 12»). Пустые поля по бокам кадра заняты бронями под будущий текст
  (Amendment 9).

---

## Step 12.7 — Раздел «Ваша задача»: форма и отправка в Telegram

- Status: `AWAITING_SKEPTIC` — **закрытие сознательно отложено на конец проекта** (решение
  пользователя 2026-07-19: «то, что касается ботов, отправки — это сделаем в самую последнюю
  очередь, когда сайт будет готов и будем править текст»).
  Что уже сделано: раздел, форма, серверный роут, тесты (159 unit + 114 e2e зелёные), README с
  настройкой бота. Что НЕ сделано и ждёт конца проекта: (1) `skeptic` Phase B по этому шагу;
  (2) manual-проверка реальной доставки в Telegram — нужен токен бота, который заводит пользователь.
  До обоих пунктов шаг не может стать `COMPLETED`.
  Пока токен не задан, раздел деградирует честно: форма показывает ошибку и не изображает отправку,
  поэтому незакрытый шаг не создаёт ложных обещаний посетителю.
- **Amendment 11 (2026-07-19).** Новый шаг, которого не было в milestone «Этап 2 — Art direction».
  Причина: прямой запрос пользователя. Нумерация дробная (12.7) по прецеденту Steps 7.2–7.6 — это
  вставка между существующими шагами, а не добавление в конец, поэтому Step 13+ не переименовываются.
  Шаг выходит за рамки визуального milestone (вводит backend), поэтому вынесен отдельно, а не
  подмешан в Step 12/13. Решения пользователя: (а) отправка — **настоящая, через Telegram-бота**
  (отклонены «копировать текст + открыть чат» и «пока не отправлять»); (б) точка входа — **и в
  рельсе, и на обзорном экране** (отклонены «только рельс» и «плюс hero»).
- Objective: Добавить шестой раздел офиса «Ваша задача» — форму свободного описания задачи, которая
  реально доставляет сообщение в Telegram через серверный роут, не раскрывая токен клиенту.
- Dependencies: Step 12 (`PASSED`, паттерн 10/90 и рельс), Amendment 9/10 (единый `contactHref`).
  **Блокирующая внешняя зависимость:** бот создаётся пользователем (@BotFather), `TELEGRAM_BOT_TOKEN`
  и `TELEGRAM_CHAT_ID` заводятся им же в `.env.local`. Я к секретам не прикасаюсь (CLAUDE.md Safety:
  «Never read .env, .env.local, or secret files»), поэтому сквозная проверка реальной доставки —
  за пользователем.
- In scope:
  - Контент раздела в `data/homepage-copy.json` (`taskSection`): подпись в рельсе «Ваша задача»,
    заголовок «Решить Вашу задачу», вводный текст, подпись поля, подпись кнопки, тексты состояний
    (успех/ошибка/валидация). Схема + типы.
  - State machine: `activeDepartmentId` расширяется до `activeSectionId: DepartmentId | "task" | null`.
    Виды (`opening/active/switching/closing`) переиспользуются — раскладка 10/90 та же, отличается
    только содержимое 90%-области. URL: `?section=task` (для отделов `?department=<id>` не меняется;
    при обоих параметрах приоритет у отдела).
  - Точки входа: пункт в `DepartmentNavigationRail` под пятью отделами + отдельная кнопка на
    обзорном экране под сценой офиса (решение (б) — иначе форма недостижима из overview).
  - `TaskForm` (клиентский): textarea, счётчик/лимит, кнопка отправки, состояния
    «отправка/успех/ошибка» через `aria-live`, блокировка повторной отправки, honeypot-поле.
  - Серверный роут `POST /api/task`: валидация (zod), honeypot, лимиты длины, простой rate-limit,
    отправка в Telegram Bot API из серверного кода. Токен читается ТОЛЬКО из `process.env` и никогда
    не попадает в клиентский бандл. Отсутствие настроенного токена — явная 503 с внятным текстом, а
    не молчаливый «успех».
  - `.env.example` (без значений) + раздел в `README.md`: как завести бота и переменные.
  - Тесты: unit на валидацию и на роут (fetch замокан — реальная сеть в тестах не дёргается);
    e2e на форму с перехватом `/api/task` (успех, ошибка сервера, пустой ввод); axe на новом разделе.
- Out of scope:
  - Хранение заявок, CRM, аналитика, e-mail-дубли — Этапы 3/8.
  - Капча. Защита этого шага — honeypot + лимиты + rate-limit; полноценная антиспам-система при
    появлении реального трафика.
  - Проверка реальной доставки в Telegram — за пользователем (нет токена).
- Acceptance criteria:
  1. «Ваша задача» доступна из рельса И с обзорного экрана; открывается по прямому URL
     `?section=task`; Escape и «Закрыть» возвращают в overview, как у отдела.
  2. Форма отправляет текст на `/api/task`; при успехе показывает подтверждение, при ошибке — текст
     ошибки; повторная отправка заблокирована во время запроса. Все состояния объявляются
     скринридеру (`aria-live`), а не только цветом.
  3. Токен Telegram не присутствует в клиентском бандле — проверяется поиском по `.next/static`.
  4. Пустой/слишком короткий ввод не отправляется; заполненный honeypot молча отбрасывается сервером.
  5. Незаданные переменные окружения → 503 с внятным сообщением, а не ложный успех.
  6. axe 0 serious/critical на новом разделе (desktop + mobile); 147 unit + 107 e2e (+ новые) зелёные.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks: пользователь заводит бота и переменные → отправляет тестовое сообщение из формы →
  подтверждает, что оно пришло в Telegram. До этого шаг не может быть `COMPLETED`.
- Risks:
  - **Секрет в клиенте.** Смягчение: токен только в route handler, AC3 проверяет бандл.
  - **Спам через открытый эндпойнт.** Смягчение: honeypot + лимиты длины + rate-limit; отмечено, что
    это не полноценная защита.
  - **Ложное чувство доставки.** Смягчение: AC5 — без токена честная 503.
  - **Разрастание state machine.** Смягчение: виды переиспользуются, добавляется только тип секции.
- Rollback: `git revert` коммита(ов) шага — убирает раздел, роут и точки входа; аддитивно.
- Профильный ревьюер: frontend-architect (state machine/роут), qa-reviewer (a11y формы, безопасность).

---

## Step 13 — Сцены отделов (пять фонов вместо одного общего)

- Status: `COMPLETED` (skeptic Phase B `PASS` по объёму Amendment 12; Manual checks выполнены
  пользователем 2026-07-19 — раскладка принята, найденный им дефект рамки фокуса у заголовка
  устранён и покрыт регресс-тестом)
- Objective: Заменить единый общий `office-background.webp` позади `department-active` на пять
  различимых сцен отделов (по реквизиту), затемнённых как контекст, с читаемой поверх фото панелью
  боль→выгода; загружается только сцена активного отдела.
- Dependencies: Step 10 (`COMPLETED`, 5 сцен как производные), Step 11 (`COMPLETED`, скрим/токены),
  Step 12 (`COMPLETED`, паттерн фото-фона overview). **OQ-A2-8 (per-department фон vs общий
  continuity-фон) закрыт пользователем ДО старта** (добавлено по skeptic-review плана, finding 2).
- **Решение docs/03, которое этот шаг пересматривает (не «тихая honesty-правка»):** `docs/03`
  (правка Step 7.3, «Режим 10/90») сознательно сделал фон позади `department-active` **общим** фото
  офиса «то же, что фон overview» ради непрерывности («офис остаётся контекстом»). Замена его на
  per-department сцены — реальный пересмотр этого решения, поэтому вынесен отдельным открытым
  вопросом OQ-A2-8 (симметрично OQ-A2-1 для overview), а не решается внутри шага. `docs/03`
  правится только после того, как OQ-A2-8 закрыт пользователем в пользу per-department сцен.
- **Amendment 8 (2026-07-18, до старта Step 13).** Причина: пользователь, увидев экран отдела в
  браузере после Step 12, указал, что при нынешней раскладке замена общего фона на per-department
  сцену почти бессмысленна — белая панель `DepartmentExperience` закрывает ~85% площади, и от сцены
  остаётся полоска ~300×450px под рельсом. Возражение подтверждается скриншотом: правая панель
  «выгоды» при этом почти пуста (одна строка текста на ~1250×600), то есть место расходуется
  вхолостую одновременно с тем, что фото не видно. Требование пользователя дословно: «надо разместить
  фотографии, чтобы было реальное ощущение перехода между отделами».
  Старый scope: сцена ставится ФОНОМ под существующую раскладку, компоновка `department-active` не
  меняется («Изменение pain/gain-контента и state machine» — вне scope, про раскладку молчание, но
  подразумевалась неизменность).
  Новый scope: сцена отдела занимает всю 90%-область (full-bleed), белая панель-подложка убирается, а
  боли/выгода/заголовок/CTA ложатся поверх фото компактными карточками на скрим-токенах Step 11.
  Решение пользователя: `AskUserQuestion` 2026-07-18 — вариант «Фото на весь экран, текст поверх»
  (отклонены: сплит 50/50 и полоса сверху).
  Влияние: шаг перестаёт быть «заменой фона» и становится перекомпоновкой экрана отдела; растёт
  объём (затрагиваются `DepartmentExperience.module.css`, `PainGainPanel.module.css`,
  `DepartmentCopy.module.css`, `DepartmentCTA.module.css`), выше риск по контрасту — но он
  подготовлен заранее: скрим-токены Step 11 рассчитаны именно на текст поверх фотографии и дают
  6.80:1 в худшем случае фотофона. Согласованность с overview: там пользователь уже выбрал
  immersive-вариант (OQ-A2-1 = (a), зоны поверх фото) — экран отдела теперь следует тому же принципу,
  а не противоречит ему. AC2 (измерение контраста против скрима, не через axe) уже сформулирован под
  этот случай и не меняется.
- In scope:
  - `departmentPhotos.ts`: карта `departmentId → сцена отдела` (адаптивная производная), рядом с уже
    существующей картой миниатюр. Отдача — через `OfficeScenePhoto` (`<picture>` AVIF→WebP, Step 12),
    а не через одноисточниковый `OfficePhoto`.
  - `OfficeExperience.tsx` (ветка `department-active`): рендер сцены активного отдела вместо общего
    `officeBackgroundPhoto`; сцена монтируется лениво (только активный отдел — соответствует
    `docs/10` «detail assets — при выборе»).
  - **Перекомпоновка `department-active` под full-bleed сцену (Amendment 8):** сцена на всю
    90%-область; белая сплошная подложка `DepartmentExperience` убирается; заголовок, список болей,
    блок выгоды и CTA — карточки на `--scrim-strong`/`--scrim-panel` поверх фото; пустое поле правой
    панели устраняется как следствие. Рельс отделов сохраняет свою колонку и остаётся читаемым.
  - Настройка затемнения/десатурации сцены (`.backgroundPhoto`, токены Step 11) и читаемости
    `PainGainPanel`/`DepartmentExperience` поверх фото — измеренный контраст ≥ WCAG AA.
  - Честная правка `docs/03-office-map.md` («общее фото офиса … позади панели» → per-department сцены).
  - e2e: каждый отдел показывает свою сцену; при блоке `*.webp` — контент и кнопки живы; только сцена
    активного отдела запрашивается (не все 5).
- Out of scope:
  - Overview-сцена — Step 12; motion-переход и crossfade между сценами — Step 16; кадрирование под
    планшет/телефон — Step 15.
  - Изменение pain/gain-**контента** (тексты) и state machine. Перекомпоновка раскладки — В scope
    начиная с Amendment 8; меняется подача, не содержание и не набор элементов.
- Expected files:
  - `src/components/office/departmentPhotos.ts` (карта сцен отделов).
  - `src/components/office/OfficeExperience.tsx`, `OfficeExperience.module.css` (per-department фон,
    скрим).
  - `src/components/departments/DepartmentExperience.module.css`, `PainGainPanel.module.css`,
    `DepartmentCopy.module.css`, `DepartmentCTA.module.css` (карточки на скриме поверх фото вместо
    сплошной белой подложки — Amendment 8).
  - `src/tests/e2e/department-selection.spec.ts` (дополнение) или новый `department-scene.spec.ts`.
  - `docs/03-office-map.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Открытие каждого из 5 отделов показывает собственную сцену; переключение через rail меняет сцену
     без перезагрузки страницы.
  2. Панель боль→выгода, заголовок и CTA поверх фото имеют контраст ≥ WCAG AA, **измеренный против
     эффективной сплошной подложки скрима в наихудшем случае (самый светлый участок фото под текстом
     на светлую сторону, самый тёмный — на тёмную)**, а не выведенный из axe (axe помечает
     text-over-image как *incomplete*, не *serious*, и сам по себе читаемость не доказывает — уточнено
     по skeptic-review плана, finding 1). axe-скан остаётся дополнительным gate: 0 serious/critical
     в department-active на desktop и mobile.
  3. Загружается только сцена активного отдела (остальные 4 не запрашиваются до выбора); браузер не
     запрашивает оригиналы PNG; веса в бюджете.
  4. При отказе загрузки сцены — нейтральный плейсхолдер, контент/кнопки/CTA работают (fallback Step 8).
  5. 147 unit + 106 e2e (+ новые) зелёные; прежние не ослаблены. («133 unit + 101 e2e» в исходной
     редакции — устаревший baseline: 141/101 после Step 10, 147/106 после Step 12.)
  6. **(Amendment 8, порог пересмотрен Amendment 12)** Сцена отдела занимает всю 90%-область, а не
     полоску под рельсом; сплошной белой подложки во всю площадь больше нет. Проверяется измеримо:
     видимая площадь сцены (не перекрытая непрозрачными панелями) — **не менее 25%** 90%-области на
     Desktop ≥1280px. Прежний порог «не менее половины» держался до Amendment 12; он пересмотрен не
     потому, что оказался недостижим, а потому что пользователь сознательно обменял площадь сцены на
     вторую колонку с пояснением (см. Amendment 12).
  7. **(Amendment 8)** Переключение между отделами меняет видимую сцену: при переходе
     отдел → отдел загружается и отображается другая производная (проверяется по фактически
     выбранному браузером файлу, а не по DOM-атрибуту).
  8. **(Amendment 12)** Пояснение к выбранной боли показывается в отдельном окне СПРАВА от списка
     болей, равном ему по высоте; блока под списком больше нет. Геометрия окна не зависит от длины
     текста: при переключении между болями его размеры не меняются, соседние элементы не смещаются
     (проверяется замером бокса до и после смены пункта, а не на глаз).
  9. **(Amendment 12)** Текст пояснения появляется анимацией печати; при быстром переключении болей
     текущая печать прерывается и начинается новая. При `prefers-reduced-motion: reduce` текст
     появляется сразу. Полный текст присутствует в DOM с самого начала и доступен скринридеру
     независимо от стадии анимации — критический контент не ждёт её завершения (`CLAUDE.md` Motion
     rules).
- **Amendment 12 (2026-07-19, после `PASSED` Step 13 — пользователь посмотрел готовый экран в
  браузере).** Причина: пользователь принял результат («Мне нравится!») и указал на одно место —
  пояснение к выбранной боли стоит ПОД списком болей, где читается шестым пунктом списка, а справа
  при этом пустует сцена. Требование дословно: «Надо создать такое же окошко справа, по высоте равное
  тому, что слева, где указаны боли. Окошко сделать статичным, то есть, чтобы оно не менялось от
  длины текста… нижнее окошко удалить. Я бы хотел для таких комментариев сделать анимацию в виде
  печатающегося текста. Такое оформление надо сделать во всех отделах.»
  Старый scope (Amendment 8): боли и выгода — одна колонка, выгода под списком; анимации текста нет.
  Новый scope: две колонки поверх сцены — слева боли, справа пояснение равной высоты с фиксированной
  геометрией; блок под списком удаляется; текст пояснения печатается посимвольно.
  Решения пользователя (`AskUserQuestion` 2026-07-19): (1) порог видимой площади сцены **пересмотреть
  до ~25%** (отклонены «ужать обе колонки под 50%» и «промежуточно ~35%») — то есть площадь сцены
  сознательно обменяна на читаемость пояснения; (2) при быстром переключении болей печать
  **прерывается и начинается новая** (отклонены «дать допечатать» и «без анимации при переключении»).
  Влияние: AC6 ослабляется с ≥50% до ≥25% (записано выше честно, а не тихо); добавляются AC8 и AC9;
  затрагиваются `PainGainPanel.tsx`/`.module.css`, `DepartmentCopy.module.css`,
  `DepartmentExperience.module.css` и новый компонент печати. Мобильный аккордеон (≤767px) не
  затрагивается — там `PainGainPanel` скрыт, и двухколоночная раскладка неприменима.
  Не входит: тексты пояснений (правятся в конце проекта), направленный коннектор боль→выгода
  (Step 14), motion перехода между сценами (Step 16).
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks (обязательно): Desktop — открыть все 5 отделов, сверить различимость сцен по реквизиту
  и читаемость панели; DevTools Network — при первом открытии грузится 1 сцена, не 5; блок `*.webp` —
  контент цел; reduced-motion — переключение мгновенно (Step 8) и сцена корректна; axe/Lighthouse.
  **(Amendment 12)** Проверить печать текста и неизменность окна пояснения при переключении болей во
  всех пяти отделах.
- Risks:
  - 5 полноразмерных фонов увеличивают суммарный вес. Смягчение: ленивая загрузка активного + адаптивные
    производные (Step 10) + бюджет-проверка (OQ-A2-7 по объёму).
  - Текст поверх разнофактурных сцен читается неравномерно. Смягчение: скрим-токены, axe на каждой сцене.
- Rollback: `git revert` коммита(ов) Step 13 — возвращает единый общий фон; аддитивно.
- Профильный ревьюер: ux-strategist (различимость отделов), qa-reviewer (a11y/перф).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения). Phase B (review исполнения) —
  обязателен при выполнении шага.

---

## Step 14 — Графическая система логотипа (функциональные маркеры)

- Status: `COMPLETED` (skeptic Phase B `PASS`, 2-й раунд; закрыт по прямому указанию пользователя.
  НЕ проверено: звучание на реальном скринридере NVDA/VoiceOver — автоматически подтверждено только
  присутствие текста в дереве доступности через ariaSnapshot)
- Objective: Ввести переиспользуемую SVG-графику логотипа (стрелка/треугольник) как функциональные
  маркеры маршрута/статуса по `docs/02` «Графическая система» («должны выполнять функцию») — не декор.
- Dependencies: Step 11 (`COMPLETED`, токены/цвета маркеров). OQ-A2-5 (объём системы) закрыт ДО старта.
- In scope (минимальный функциональный объём — при OQ-A2-5 = «минимальный»):
  - Переиспользуемый SVG-примитив (напр. `src/components/graphics/RouteMarker.tsx`), производный от
    `references/logo/Logo111.svg`.
  - Функциональное применение в двух конкретных местах со смыслом: (a) направленный коннектор
    боль→выгода в `PainGainPanel` (указывает переход «проблема → результат»); (b) active-статус-маркер в
    `DepartmentNavigationRail` вместо текстового «●», с сохранением избыточности не-цветом (`docs/14`/
    `docs/11` «статусы различаются цветом, текстом и формой» + `aria-current`).
  - Декоративные экземпляры — `aria-hidden`; смысловые статусы сохраняют текстовый/ARIA-эквивалент.
- Out of scope:
  - «Линии передачи данных»/анимированные маршруты через всю сцену (Explanation-motion, `docs/07`
    уровень 3) — ближе к Этапу 3; при OQ-A2-5 = «минимальный» не входит.
  - Изменение копирайта/контента; motion — Step 16.
- Expected files:
  - `src/components/graphics/RouteMarker.tsx` (+ `.module.css`, новый).
  - `src/components/departments/PainGainPanel.tsx` + `.module.css`.
  - `src/components/office/DepartmentNavigationRail.tsx` + `.module.css` (маркер вместо «●»).
  - `src/tests/unit/components/...` (unit маркера + сохранность не-цветового статуса).
  - `docs/02-art-direction.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Маркер маршрута/статуса присутствует минимум в двух функциональных местах (pain→gain коннектор,
     active-маркер рельса) и несёт функцию, а не декор.
  2. Активный отдел в рельсе по-прежнему различим не только цветом (форма + `aria-current` + текстовый
     эквивалент); axe 0 serious/critical.
  3. Декоративные SVG — `aria-hidden`; скринридер их не объявляет.
  4. 133 unit (+ новые) и 101 e2e зелёные; прежние не ослаблены. («133 unit + 101 e2e» — устаревший
     baseline исходной редакции: фактический на старте Step 14 — 163 unit + 131 e2e.)
  5. **(по факту реализации)** Третья функциональная точка — маркер выбранной боли — появилась не
     из расширения scope, а как замена текстового глифа «▸», введённого Amendment 12 уже после
     утверждения этого шага. Объём OQ-A2-5 («минимальный») не превышен.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks (обязательно): Desktop/Mobile — маркер читается как указатель/статус, не как украшение;
  проверить NVDA/VoiceOver или axe, что статус отдела считывается без опоры на цвет.
- Risks:
  - Соблазн декоративности вопреки `docs/02`. Смягчение: жёсткая привязка к двум функциональным точкам,
    OQ-A2-5 ограничивает объём.
  - Замена «●» может ослабить не-цветовой статус. Смягчение: AC2 + unit на избыточность.
- Rollback: `git revert` коммита(ов) Step 14 — возвращает «●» и убирает маркеры; аддитивно.
- Профильный ревьюер: ux-strategist (функция vs декор), qa-reviewer (a11y-статус).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения). Phase B (review исполнения) —
  обязателен при выполнении шага.

---

## Step 15 — Адаптивное кадрирование сцен и safe-areas

- Status: `PROPOSED`
- Objective: Обеспечить корректное кадрирование мастер-сцены и сцен отделов на планшете и телефоне
  (object-position/safe-areas, `sizes`) по `docs/08-responsive-behavior.md`, без потери читаемости
  подписей/панелей и CTA.
- Dependencies: Step 12 (`COMPLETED`, overview-сцена), Step 13 (`COMPLETED`, сцены отделов), Step 10
  (адаптивные ширины).
- **Входные данные из Step 12 (skeptic Phase B, findings 1 и 5 — перенесены сюда, чтобы не потерялись):**
  1. **Mobile грузит сцену, которую не показывает.** На 390×844 браузер скачивает `overview-768.avif`
     (~47 КБ), хотя `.map` на ≤767px скрыт `display: none`, а показывается `MobileDepartmentCarousel`.
     До Step 12 mobile не грузил сцену вовсе. Вес в бюджете, но это новая мобильная трата — устранить
     здесь (например, не монтировать overview-сцену на mobile-ветке или отдавать её по `media` в
     `<source>`), а не тащить дальше.
  2. **На очень низких вьюпортах теряется пол 44px.** При 1280×400 самая низкая зона (support, 18%
     высоты кадра) рендерится 105×36px — прежний guard `min-height: 340px` снят вместе с переходом на
     пропорциональный кадр. Для целевых tablet-размеров (768×1024, 1024×768, 1279×800, 1024×600) пол
     соблюдён и e2e зелёные, но при подборе кадрирования проверить нижнюю границу высоты явно.
  3. **Проценты зон держатся на пропорции кадра 3:2.** Любое изменение `aspect-ratio`/`object-fit`
     `.scene` молча сдвигает все пять зон на другую мебель. Позиционный e2e
     (`overview-scene.spec.ts`) сейчас проверяет это только на дефолтном вьюпорте — расширить на
     брейкпоинты этого шага.
- **Входные данные из Step 13 (skeptic Phase B, hidden risk 1 — bookkeeping внутри уже утверждённого
  шага, не Amendment):**
  4. **На планшете и телефоне перекомпоновка Amendment 8 пока ничего не даёт: перекрытие 100%.**
     Ограничение `max-width: 46%` у `.experience` scoped на ≥1280px, поэтому на 1024×768 и 375×812
     карточки занимают всю ширину, и сцена видна только сквозь 10% прозрачности скрима и в зазорах.
     Формально AC6 Step 13 это разрешает (он про Desktop ≥1280), и кадрирование — предмет этого шага,
     но «ощущение перехода между отделами», ради которого затевался Amendment 8, на не-desktop ещё не
     доставлено. Решить здесь вместе с кадрированием.
  5. **Фотослой расстелен под всей `.shell10x90`, включая колонку рельса**, а не только под
     90%-областью. Читаемость не страдает (кнопки рельса непрозрачны), но при подборе кадрирования
     учитывать, что левые ~14% кадра уходят под рельс.
  6. **`<picture>` не откатывается на второй `<source>` при СЕТЕВОЙ ошибке первого** (проверено
     экспериментально в Step 13): при сбое AVIF браузер не берёт WebP, а отдаёт ошибку — срабатывает
     плейсхолдер Step 8. Это не дефект, но означает, что фотослой уязвим к одиночному сбою AVIF, а не
     только к падению обоих форматов.
- In scope:
  - Правила кадрирования/safe-area per breakpoint (Tablet 768–1279, Mobile ≤767) для overview-сцены и
    сцен отделов: `object-position`, выбор served-ширины через `sizes`, safe-area-insets для CTA/панелей.
  - Сохранение mobile-пути (`MobileDepartmentCarousel`, `docs/03` «Mobile») и tablet-раскладки (Step 7.5
    20%-рельс) — сцены встраиваются, не ломая их.
  - Честная правка `docs/08` при необходимости (фиксация фактического кадрирования).
  - e2e на tablet/mobile ширинах: сцена не обрезает ключевой реквизит зон, CTA достижима, подписи читаемы.
- Out of scope:
  - Motion-переход — Step 16; изменение самих сцен/токенов.
  - Реальная device-лаборатория/ориентация сверх эмуляции Playwright.
- Expected files:
  - `src/components/office/OfficeSemanticMap.module.css`, `OfficeExperience.module.css`,
    `DepartmentHotspot.module.css` (кадрирование/safe-areas).
  - `src/components/office/departmentPhotos.ts` (уточнение `sizes` при необходимости).
  - `src/tests/e2e/tablet-touch-flow.spec.ts` / `mobile-touch-flow.spec.ts` (дополнения) или новый спек.
  - `docs/08-responsive-behavior.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. На Tablet (напр. 1024px) и Mobile (напр. 375px) overview-сцена и сцена отдела кадрируются без
     обрезки ключевого реквизита зон; подписи/панель читаемы; контраст ≥ WCAG AA.
  2. CTA и кнопка «назад»/«Закрыть» достижимы и не перекрыты сценой на всех целевых ширинах (`docs/08`,
     `CLAUDE.md` «CTA remains easy to reach»).
  3. Браузер на узких ширинах грузит меньшую производную (проверка served-ширины через `sizes`), не
     desktop-размер.
  4. 101 e2e (+ новые на tablet/mobile) и 133 unit зелёные; axe 0 serious на обеих ширинах — **для
     этого `accessibility-scan.spec.ts` расширяется на tablet-ширину (768–1279, напр. 1024px),
     которую текущий скан не покрывает** (`WORKLOG.md` Step 9 «axe не покрывает tablet-ширину»;
     закрывает Minor-1 milestone review Этапа 1; добавлено по skeptic-review плана, finding 3);
     прежние тесты не ослаблены.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks (обязательно): эмуляция Tablet и Mobile в DevTools на `http://localhost:3100` — overview
  и отдел кадрируются корректно, CTA/назад достижимы, подписи читаемы; проверить портрет 768px;
  DevTools Network — served меньшая ширина.
- Risks:
  - `object-position` может скрыть реквизит нужной зоны на узком экране. Смягчение: браузерная сверка +
    e2e-проверка видимости ключевых элементов.
  - Safe-area/нотч на реальных устройствах отличается от эмуляции. Смягчение: `env(safe-area-inset-*)`,
    честная пометка ограничения (эмуляция ≠ device-лаб).
- Rollback: `git revert` коммита(ов) Step 15 — возвращает desktop-кадрирование на всех ширинах;
  аддитивно.
- Профильный ревьюер: frontend-architect (адаптив/`sizes`), ux-strategist (кадр/читаемость).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения). Phase B (review исполнения) —
  обязателен при выполнении шага.

---

## Step 16 — Motion overview↔отдел (контролируемое приближение)

- Status: `PROPOSED`
- Objective: Реализовать переход overview→отдел (и обратно) как контролируемое приближение между
  реальными сценами по `docs/03` «Камера» (слабый параллакс, контролируемое приближение, без
  свободного полёта) и `docs/07` «Уровень Transition», с reduced-motion fallback и без перф-регресса.
- Dependencies: Step 12 (`COMPLETED`), Step 13 (`COMPLETED`), Step 15 (`COMPLETED`, финальное
  кадрирование обоих концов перехода). OQ-A2-6 (тип motion + параллакс да/нет) закрыт ДО старта.
- **Входные данные из Step 13 (skeptic Phase B раунд 2, NON-BLOCKING-1 — bookkeeping, не Amendment):**
  1. **При переключении отдела есть окно без сцены, и лечить его должен именно этот шаг.** `key` на
     `OfficeScenePhoto` (обязательный — без него признак неудачной загрузки залипал и один сбой гасил
     фотослой на весь визит) размонтирует `<img>`, поэтому новый элемент стартует пустым вместо того,
     чтобы держать прежнюю декодированную картинку до загрузки следующей. Измерено скептиком с
     задержкой 1.2 с на файлах сцены: окно 73–1261 мс, 26 из 45 выборок без декодированной сцены; на
     нормальном канале окна нет (0 из 25). Контент, CTA и рельс при этом на месте, контраст только
     растёт (карточки светлеют), поэтому в Step 13 это не дефект. Но при реализации crossfade между
     сценами предыдущую сцену надо **удерживать до декодирования следующей**, а не гасить — иначе
     переход, ради которого шаг и делается, будет проходить через пустоту.
- In scope:
  - Переход overview→department-active как контролируемое приближение (transform/opacity, `docs/10`
    «предпочитать transform и opacity»), встроенный в существующие фазы машины
    (`department-opening/switching/closing`, длительности `docs/07`: overview→department 650–1000 мс,
    switch 450–800 мс, close 550–900 мс) — без нового состояния редьюсера, поверх существующих таймеров
    `OfficeMachine`.
  - reduced-motion fallback: короткий fade вместо приближения — через существующий
    `usePrefersReducedMotion` (Step 8), длительности схлопываются в 0 (уже реализовано) → критический
    контент не ждёт анимации (`CLAUDE.md` Motion rules).
  - **Pointer-параллакс НЕ вводится** (OQ-A2-6 = «без параллакса», решение пользователя 2026-07-18) —
    как и в Этапе 1; перф-поверхность непрерывного pointer-движения не добавляется. Соответственно и
    «пауза непрерывной анимации при скрытой вкладке» неприменима (непрерывного loop нет — переходы
    конечны).
  - e2e: переход играет и завершается; reduced-motion даёт мгновенный результат с сохранением функций;
    нет ошибок консоли; focus-management (Step 8/OfficeMachine) не регрессирует.
- Out of scope:
  - Свободный полёт камеры (`docs/03` «Нет свободного полёта») — запрещён.
  - Explanation-motion (лид/кандидат/документ), «до/после» — Этап 3.
  - Изменение state machine/URL-sync/контента.
- Expected files:
  - `src/components/office/OfficeExperience.module.css` / `OfficeMachine.module.css` /
    `DepartmentExperience.module.css` (классы перехода).
  - При параллаксе — новый хук (напр. `src/hooks/usePointerParallax.ts`) + точка применения; иначе не
    создаётся.
  - `src/tests/e2e/...` (motion-переход + reduced-motion) — дополнение существующих или новый спек.
  - `docs/07-motion-system.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md`, `README.md`.
- Acceptance criteria:
  1. Переход overview→отдел — контролируемое приближение (не мгновенная подмена, не свободный полёт),
     длительности в диапазонах `docs/07`; переключение и закрытие анимированы соответствующе.
     (Текущие таймеры `OfficeMachine` 800/600/700 мс уже в диапазоне и помечены в коде как
     «книгоучёт, не строгий acceptance» — если Step 16 их меняет, удержать в диапазонах `docs/07`;
     skeptic-review плана, finding 5.)
  2. Под `prefers-reduced-motion: reduce` приближение заменяется коротким fade; открытие/переключение/
     закрытие и возврат focus происходят без ожидания motion-длительностей (регресс Step 8 не допущен) —
     существующие reduced-motion e2e зелёные.
  3. Критический контент (заголовок, кнопки, CTA) доступен, не дожидаясь завершения анимации
     (`CLAUDE.md` Motion rules); нет постоянного тяжёлого loop в фоне (`docs/10` приёмка).
  4. (Неприменимо — параллакс не вводится, OQ-A2-6 = «без параллакса».)
  5. 101 e2e (+ новые) и 133 unit зелёные; axe 0 serious; нет ошибок консоли; прежние тесты не ослаблены.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npm run test:e2e`.
- Manual checks (обязательно): Desktop — открыть/переключить/закрыть отдел, убедиться, что приближение
  контролируемо и не мешает клику по CTA; DevTools reduced-motion — мгновенный fade, focus возвращается,
  функции целы; DevTools Performance — нет постоянного loop при неактивной сцене; при параллаксе —
  плавность и отсутствие джанка.
- Risks:
  - transform-зум крупных фотослоёв может дать джанк/перекомпоновку. Смягчение: только transform/opacity,
    Performance-профиль, ограничение DPR при необходимости.
  - (Параллакс не вводится — OQ-A2-6 = «без параллакса»; связанная перф-поверхность непрерывного
    pointer-движения отсутствует, как и в Этапе 1.)
  - Motion может замаскировать регресс reduced-motion Step 8. Смягчение: reduced-motion e2e как gate.
- Rollback: `git revert` коммита(ов) Step 16 — возвращает fade-переходы Этапа 1; аддитивно, поверх сцен.
- Профильный ревьюер: motion-engineer (переход/параллакс/перф), qa-reviewer (reduced-motion/a11y).
- Skeptic verdict (Phase A, review плана): `PASS` (2026-07-18, весь milestone одним раундом; blocking
  находок нет; non-blocking findings 1–5 внесены в план до утверждения). Phase B (review исполнения) —
  обязателен при выполнении шага.

---

## Open questions (Этап 2) — RESOLVED 2026-07-18

**Итог решений пользователя (`AskUserQuestion` 2026-07-18) + принятые по умолчанию технические
решения (озвучены, возражений не поступило). См. `DECISIONS.md`.**

- **OQ-A2-1 = (a):** overview — настоящее мастер-фото офиса на весь экран, отделы как зоны-хотспоты
  поверх фото (immersive). *(Выбор пользователя.)*
- **OQ-A2-8 = (a):** у каждого из 5 отделов — своя сцена в `department-active` (не общий фон). *(Выбор
  пользователя.)* → Step 13 остаётся в полном объёме; `docs/03` правится под per-department сцены.
- **OQ-A2-7 = «черновой арт».** 6 изображений в `references/**` — **черновые, могут
  меняться/перерисовываться**, НЕ финальные. *(Выбор пользователя.)* **Следствие для плана (см. ниже
  «Поправка на черновой арт»):** Step 10 (пайплайн) становится ещё ценнее — делает замену
  draft→final дешёвой; Step 11 (палитра) и Step 12 (координаты зон) выполняются как **предварительные,
  легко перекалибруемые**, а не финально залоченные. Это НЕ blocker (структура арт-независима), но
  меняет трактовку двух шагов.
- **OQ-A2-3 (палитра) и OQ-A2-2 (координаты зон):** не решаются абстрактно — на Step 11/Step 12
  исполнитель показывает конкретные значения/позиции **в браузере**, пользователь подтверждает глазами.
  С учётом OQ-A2-7 обе величины помечаются «предварительные до финального арта».
- **OQ-A2-4 = `sharp` devDependency + скрипт, форматы WebP+AVIF, ширины 768/1280/1536** (при нужде
  +1920), responsive-отдача через ручной `<picture>`/srcset. *(Дефолт, принят.)*
- **OQ-A2-5 = минимальные функциональные маркеры** (стрелка боль→выгода + active-маркер рельса);
  полные «линии передачи данных» — Этап 3. *(Дефолт, принят.)*
- **OQ-A2-6 = контролируемый transform-зум + crossfade между сценами, БЕЗ pointer-параллакса**
  (параллакс осознанно не вводится, как в Этапе 1). *(Дефолт, принят.)* → Step 16 In scope: пункт
  параллакса не входит; AC4 (параллакс) неприменим.
- **Нумерация = сквозная `Step 10–16`.** *(Дефолт, подтверждён skeptic'ом — коллизий нет.)*

### Поправка на черновой арт (OQ-A2-7 = черновой)

Milestone выполняется на черновых изображениях осознанно: визуальная **структура** (overview-как-фото,
per-department сцены, адаптивное кадрирование, motion, пайплайн) **арт-независима** и переживает замену
картинок. Конкретно:

- **Step 10 (пайплайн)** — регенерирует производные из любых оригиналов в `references/**`; замена
  draft→final = перекладка файлов + `npm run assets:images`. Ценность шага от чернового арта только
  растёт.
- **Step 11 (палитра/токены)** — выводит **рабочую** палитру из текущих черновых сцен; значения
  помечаются «предварительные, ревизия при финальном арте». Контрастные полы WCAG AA держатся
  независимо от конкретных hex. Комментарий «ждёт арт-дирекшна» в `tokens.css` НЕ снимается полностью —
  заменяется на «предварительный арт-дирекшн по черновым сценам».
- **Step 12 (координаты зон)** — калибровка `data/office-zones.json` под **текущую** мастер-сцену;
  координаты остаются data-driven и помечаются «предварительные до финального арта», перекалибровка при
  замене = правка данных, без кода. Не золотить пиксель-перфект под черновик.
- Прочие шаги (13/14/15/16) структурны и от чернового арта не страдают.

Эта поправка не является Amendment (план ещё `PROPOSED`, не утверждён) — это учёт ответов пользователя
до перевода в `APPROVED`.

---

## Open questions (Этап 2) — исходные формулировки (архив, RESOLVED выше)

- **OQ-A2-1 (Step 12):** overview — (a) заменить абстрактный фон мастер-фото целиком, хотспоты как
  прозрачные зоны со скримом; ИЛИ (b) мастер-фото как подложка, существующие карточки-хотспоты сверху +
  token-fallback.
- **OQ-A2-2 (Step 12):** точные координаты 5 хотспотов относительно мастер-сцены (визуальный подбор /
  утверждение обновлённого `data/office-zones.json`).
- **OQ-A2-3 (Step 11):** финальные hex-палитры (графит/дуб/янтарь/шалфей/крем + акцент ≥ 4.5:1 на белом)
  — апрув конкретных значений.
- **OQ-A2-4 (Step 10):** инструмент генерации (`sharp` devDependency + скрипт vs документированные CLI);
  форматы (WebP-only vs WebP+AVIF); набор ширин/DPR; способ отдачи responsive srcset при `<Image
  unoptimized>`.
- **OQ-A2-5 (Step 14):** объём логотипной графической системы сейчас — минимальные функциональные
  маркеры vs полноценные «линии передачи данных» (ближе к Этапу 3).
- **OQ-A2-6 (Step 16):** тип motion — реальный transform-зум между сценами vs скромный crossfade+scale;
  и вводить ли слабый pointer-параллакс сейчас.
- **OQ-A2-7 (глобально, потенциальный blocker):** подтвердить финальность 6 PNG в `references/**` как
  арта milestone (влияет на калибровку координат Step 12 и вывод палитры Step 11).
- **OQ-A2-8 (Step 13, добавлен по skeptic-review плана finding 2):** фон позади открытого отдела —
  (a) собственная сцена каждого отдела (5 разных) ИЛИ (b) сохранить общий continuity-фон офиса «то
  же, что overview» (текущее решение `docs/03`, Step 7.3). Симметрично OQ-A2-1; при (b) Step 13
  сводится к отсутствию изменения фона (или отменяется).
- **Нумерация:** подтвердить сквозную схему `Step 10–16` (по прецеденту Amendment 4).
