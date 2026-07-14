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
- `docs/00-product-brief.md` … `docs/19-work-log-template.md`
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
    ни одному из шагов 2–8; при повторном возникновении потребуется отдельное решение
    пользователя, аналогично тому, как не решён вопрос с MANIFEST.json.
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
    `automationSteps`/`visual` из `docs/12` — начиная со Step 5 (Desktop 10/90 shell), где по
    Core concept CLAUDE.md нужно показывать "текущий процесс/сценарий автоматизации", это будет
    видимым ограничением типов, а не скрытым. Дозаполнение `data/departments.json` — отдельная
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
      всём текущем 8-шаговом milestone, CLAUDE.md "First milestone": без backend/CRM),
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
      будущего решения — см. Risks (владелец: перед стартом Step 7, а не "без owner").
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
    `DepartmentCTA` — Step 4/5.
  - `OfficeVisualLayer`, WebGL/Canvas, GSAP, motion orchestration — не вводятся.
  - Реальный адресат `primaryCta` (диагностика/lead capture, `docs/13` Этап 8) — вне scope всего
    текущего 8-шагового milestone.
  - Использование `reference` PNG-путей отделов.
  - Полноценный error-fallback state (`docs/05`, `FallbackExperience`) — закреплён за Step 7. В
    Step 3 "fallback" означает: (a) progressive enhancement — hero и 5 кнопок реально в статичном
    server-rendered HTML, доступны с клавиатуры без JavaScript (проверяется тестом с
    `javaScriptEnabled: false`); (b) `prefers-reduced-motion` отключает CSS-переходы.
  - Mobile/tablet-раскладка (`docs/08`) — Step 6. Ручная проверка Step 3 — desktop ≥1280px.
  - Site-wide навигационное меню в `Header`.
  - Автоматизированное axe-сканирование — **не добавляется в Step 3, владелец назначен**: ручная
    проверка расширением axe DevTools сейчас; автоматизация (`@axe-core/playwright` или аналог) —
    явно закреплена за Step 8 ("Browser acceptance tests"), не оставлена без owner'а.
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
  - **`OfficeVisualLayer` без владельца до Step 7:** отсутствие декоративного визуального слоя в
    Step 3 оставляет вопрос "что вообще является visual layer, для которого Step 7 делает
    fallback" открытым до старта Step 7 — явно зафиксировано здесь, будет решаться перед
    планированием Step 7, не сейчас.
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
    вручную не прогонялся (owner: Step 8).
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

- Status: `PROPOSED` (черновик planner'а; **не может получить `APPROVED` до ответа пользователя на
  Open questions OQ-1/OQ-2/OQ-3 ниже** — planner сознательно не зашил ответы на них как факты)
- Objective: Реализовать первую клиентскую интерактивность главной страницы. **Часть (1) — решена,
  не зависит от открытых вопросов:** переход `hero → overview` по клику любой CTA (`ACTIVATE_CTA`)
  — при включённом JavaScript пять отделов по умолчанию скрыты и раскрываются только после клика;
  без JavaScript ничего не меняется относительно уже реализованного и протестированного Step 3 (все
  пять отделов видны и доступны с клавиатуры сразу). **Часть (2) — полностью зависит от OQ-2, вплоть
  до того, что её может не быть в Step 4 вообще:** явное состояние выбора отдела
  (`SELECT_DEPARTMENT`/`CLOSE_DEPARTMENT`/`ESCAPE`) с двусторонней синхронизацией
  `?department=<id>`. OQ-2 включает три равноправных варианта (см. "Open questions" ниже): (a) Step
  4 реализует полный набор `opening/active/switching/closing` с минимальным UI; (b) Step 4 реализует
  только упрощённый бинарный select/close, без под-состояний; (c) Step 4 не реализует выбор отдела
  вовсе — ограничивается `hero ↔ overview`, а весь `SELECT_DEPARTMENT`/`CLOSE_DEPARTMENT`/URL-sync
  целиком переносится в Step 5 (это буквально соответствует уже утверждённой, не тронутой этим
  планом формулировке Step 5: "Реализовать выбор, панель отделов и основное поле"). Ни один из трёх
  вариантов не выбран planner'ом заранее — решает пользователь.
  Полная 10/90-раскладка, `DepartmentNavigationRail`, `DepartmentScene`/`BeforeAfterSequence`/
  `OutcomePanel`, диагностика, mobile touch flow, GSAP-анимации — вне scope в любом случае (Step
  5/6/7/8 по уже утверждённому 8-шаговому скелету).
- In scope — безусловно, не зависит от OQ-1/OQ-2/OQ-3 (реализуется при любом ответе, включая
  OQ-2 = (c)):
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
    `src/content/*.ts` (zod-adapter'ы) остаются server-only. Любой новый `'use client'`-компонент
    получает данные (`Department[]`, `HomepageCopy`, `OfficeZone[]`) только как plain-serializable
    props от компонента-предка без директивы `'use client'`, а не через прямой импорт adapter'ов.
    Практическое следствие: `HeroCopy.tsx`/`OfficeSemanticMap.tsx`/`DepartmentHotspot.tsx` в
    текущем виде (Server Components, вызывающие adapter'ы напрямую) не могут одновременно держать
    `onClick`/состояние — потребуется либо разделение "server-обёртка получает данные" + "client-
    часть держит интерактивность", либо явная передача данных как props в новый client-компонент.
  - **Расположение состояния** — по `docs/09` "Возможная структура", `src/features/office-machine/`
    (уже указан в дереве каталогов как owner фичи "state machine"); точное имя модуля/API зависит
    от **OQ-1**.
  - **Keyboard/focus для hero → overview (безусловно):** скрытые до `ACTIVATE_CTA` хотспоты не
    должны быть в Tab-последовательности, пока скрыты (не полагаться на визуальное `opacity:0`,
    если элемент при этом остаётся focusable); после раскрытия — Tab обходит все 5 в том же
    порядке, что в Step 3.
  - **Keyboard/Escape для выбора отдела — условно, только если OQ-2 ≠ (c)** (источник —
    `docs/11-accessibility.md` "Keyboard": "Tab по отделам; Enter/Space открывает; Escape закрывает;
    после закрытия focus возвращается; скрытые элементы не фокусируются"): `Escape` при активном
    отделе закрывает его (`CLOSE_DEPARTMENT`), фокус возвращается на исходный hotspot; `Enter`/
    `Space` на видимом hotspot открывает отдел — инверсия текущего теста Step 3 `"Enter/Space on a
    hotspot is a no-op"`, который в этом случае заменяется. **Если OQ-2 = (c), ничего из этого не
    входит в Step 4** — хотспоты после раскрытия `overview` остаются no-op при Enter/Space (как в
    Step 3) до тех пор, пока Step 5 не реализует выбор; существующий тест `"Enter/Space on a
    hotspot is a no-op"` в этом случае НЕ инвертируется, а лишь дополняется предварительным
    `ACTIVATE_CTA`-шагом.
  - **`prefers-reduced-motion` — сохранение функции, не только длительности.** Step 3 уже обнулил
    CSS transition duration глобально. **Безусловно:** раскрытие `hero → overview` по
    CLAUDE.md Motion rules ("critical content must not depend on animation completion") должно быть
    функционально завершено сразу после клика (элемент реально в DOM, focusable, кликабелен),
    независимо от визуальной анимации. **Только если OQ-2 ≠ (c):** то же требование
    распространяется на открытие/закрытие отдела (см. acceptance criterion 18).
  - **URL при boot (безусловно, минимальная часть):** при валидном `?department=<id>` в query
    string при первой загрузке не показывать голый `hero`-без-раскрытия ("шаринг ссылки не должен
    требовать лишнего клика" из `docs/05`) — как минимум сразу показывается раскрытый `overview`.
    Открывается ли сам отдел автоматически — зависит от **OQ-3**, и физически невозможно, если
    **OQ-2 = (c)** (Step 4 тогда не умеет открывать отделы вообще; в этом случае OQ-3(b) не
    применим, вариант (a) — единственный возможный).
  - **Регрессионное обновление существующих Step 3 тестов — безусловная часть:**
    - `src/tests/e2e/office-overview.spec.ts`: `"renders the hero and all 5 department hotspots"` —
      делится на "hero виден сразу, хотспоты скрыты до клика" и "после `ACTIVATE_CTA` видны все 5";
      low-height (1280×500) тест — тоже сначала выполняет `ACTIVATE_CTA`.
    - `src/tests/e2e/office-overview-keyboard.spec.ts`: Tab-порядок и reduced-motion-тест — должны
      сначала выполнить `ACTIVATE_CTA` (клик/Enter на CTA), прежде чем измерять хотспоты.
  - **Регрессионное обновление — условная часть (зависит от OQ-2/OQ-3):**
    - `"Enter/Space on a hotspot is a no-op"` — **заменяется** (Enter/Space открывает отдел), если
      OQ-2 ≠ (c); **дополняется** предварительным `ACTIVATE_CTA`-шагом, но не инвертируется, если
      OQ-2 = (c) (хотспоты остаются no-op до Step 5).
    - `"ignores the ?department= query string..."` — переписывается под фактически решённое
      поведение OQ-3/OQ-2 (не просто удаляется без замены).
    - `src/tests/unit/components/homepage/hero-copy.test.tsx`,
      `src/tests/unit/components/office/department-hotspot.test.tsx`,
      `src/tests/unit/components/office/office-semantic-map.test.tsx` — обновляются под новые
      props/обработчики; форма правки (добавляется ли `onSelect`/`isActive` и т.п.) зависит от
      **OQ-1**/**OQ-2**; сама правка под hero/overview-видимость (`isRevealed`-подобный проп) —
      безусловна.
  - **Новые unit-тесты для `office-machine` (`src/tests/unit/features/office-machine/*`,
    независимо от итоговой библиотеки) — минимальный набор безусловен, полный набор только если
    OQ-2 ≠ (c):** безусловно — начальное состояние `hero` (отделы скрыты), `ACTIVATE_CTA` →
    `overview`. Дополнительно, **только если OQ-2 ≠ (c):** `SELECT_DEPARTMENT(id)` → активен ровно
    один отдел; `CLOSE_DEPARTMENT`/`ESCAPE` → назад к `overview`; невалидный `id` в
    `SELECT_DEPARTMENT`/URL не создаёт "битого" состояния. Если OQ-2 = (c), этот файл всё равно
    существует как Expected file, но содержит только безусловную часть — `office-machine` в этом
    случае покрывает единственное состояние в Step 4 (`hero` ↔ `overview`), без `SELECT_DEPARTMENT`.
  - Новые/обновлённые e2e-тесты — безусловно: скрытие хотспотов до клика при включённом JS, реальное
    раскрытие по клику любой CTA, отсутствие console errors и заметного "мигания" видимых-затем-
    скрытых хотспотов при первой загрузке с включённым JS (см. Risks). **Только если OQ-2 ≠ (c)**:
    Escape/focus-return, URL-обновление при выборе отдела без полной перезагрузки страницы.
- Out of scope:
  - Полная 10/90-раскладка, `DepartmentNavigationRail`, содержимое отдела (сцена, до/после,
    outcome-панель, `DepartmentCTA`) — Step 5, независимо от решения по **OQ-2**.
  - `beforeSteps`/`automationSteps`/структурированный `visual` — физически отсутствуют в
    `data/departments.json` (известный, принятый gap Step 2); Step 4 не полагается на них.
  - GSAP, любые motion-timeline библиотеки — не вводятся; переходы состояния реализуются
    show/hide через классы/атрибуты, не анимационным движком.
  - Диагностика (`OPEN_DIAGNOSTIC`, `diagnostic-*`), `contact-open`, полноценный `error-fallback` —
    Step 7/8, `docs/13` Этап 8.
  - Mobile/tablet-раскладка и touch-специфика (`docs/08` Tablet/Mobile) — Step 6; ручная проверка
    Step 4 — desktop ≥1280px, как в Step 3.
  - Правка `data/departments.json`, `MANIFEST.json`, CI pipeline.
- Dependencies: Step 3 (`COMPLETED`). Дополнительно: решение пользователя по **OQ-1**/**OQ-2**/
  **OQ-3** обязательно до перехода этого шага в `APPROVED` — без него Expected files/Acceptance
  criteria ниже не могут быть зафиксированы окончательно (см. пометки **OQ-1**/**OQ-2**/**OQ-3** по
  всему тексту ниже и раздел "Open questions" в конце).
- Expected files _(часть — условно, см. пометки; часть — точно, см. In scope выше)_:
  - `src/features/office-machine/*` — новый модуль состояния (состав файлов зависит от **OQ-1**).
  - `src/components/homepage/HeroCopy.tsx` (+ `.module.css`) — правка обязательна (CTA-обработчики);
    возможно разделение на server data-обёртку + client CTA-часть.
  - `src/components/office/OfficeExperience.tsx`, `OfficeSemanticMap.tsx`, `DepartmentHotspot.tsx`
    (+ `.module.css`) — правка обязательна как минимум для скрытия-по-умолчанию/раскрытия по
    `ACTIVATE_CTA` (безусловно). Дополнительный `onClick`/`onSelect` для выбора отдела — **только
    если OQ-2 ≠ (c)**; глубина этой дополнительной правки (просто открыть/закрыть vs полноценная
    active-content ветка) — сама по себе решается вариантом (a) vs (b) внутри OQ-2.
  - `src/components/homepage/HomepageShell.tsx` — вероятная правка (композиция server-данных/
    client-обёртки, чтение `searchParams` для **OQ-3**).
  - `src/app/page.tsx` — вероятная правка (проброс `searchParams` вниз для чтения
    `?department=<id>` при boot, см. **OQ-3**).
  - `src/app/layout.tsx` — **условно**: только если выбранная техника анти-flash требует
    блокирующего inline-скрипта в `<head>`; при выборе `<noscript>`-дублирования — не требуется.
  - `package.json`/`package-lock.json` — **только если OQ-1 = Zustand** (новая зависимость,
    отдельная запись в `DECISIONS.md` с согласованием пользователя, по прецеденту `zod` в Step 2).
  - Обновления существующих тестов, перечисленных в In scope выше (unit + e2e).
  - Новые unit-тесты `src/tests/unit/features/office-machine/*`.
  - Новый(е) e2e-файл(ы) для выбора отдела (например `office-department-selection.spec.ts`) —
    **только если OQ-2 ≠ (c)**.
  - Возможная точечная правка `docs/05-homepage-state-machine.md` — **только если OQ-3 потребует
    уточнения формулировки**, по прецеденту Step 3 ("honesty-правка docs/05"), с отдельной записью
    в `DECISIONS.md`, не тихая правка.
  - `README.md`, `WORKPLAN.md`, `WORKLOG.md`, `DECISIONS.md` (процессные).
- Acceptance criteria — точная нумерация фиксируется после ответа на OQ-1/OQ-2/OQ-3, но условность
  каждого пункта уже явно помечена, чтобы ни один вариант ответа не читался как заранее решённый:

  **Безусловно (выполняются при любом ответе на OQ-1/OQ-2/OQ-3, включая OQ-2 = (c)):**
  1. При включённом JavaScript хотспоты не видны и не focusable до клика по `primaryCta` ИЛИ
     `secondaryCta`; после клика — все 5 видны, focusable, `overviewLabel`/`overviewProblem`
     идентичны Step 3 (регрессии нет).
  2. Без JavaScript поведение полностью идентично текущему Step 3 (все существующие
     `javaScriptEnabled: false`-тесты продолжают проходить без изменений в своих ожиданиях).
  3. Нет заметного "мигания" видимых-затем-скрытых хотспотов при первой загрузке с включённым JS, и
     нет hydration-mismatch предупреждений в консоли браузера.
  4. Скрытые до `ACTIVATE_CTA` хотспоты не встречаются в Tab-последовательности; после раскрытия —
     все 5 доступны по Tab в прежнем порядке.
  5. `?department=<валидный id>` при первой загрузке как минимум пропускает `hero` и показывает
     раскрытый `overview` (точная дополнительная глубина — **OQ-3**, невозможна при OQ-2 = (c)).
  6. `?department=<невалидный id>` не приводит к ошибке/пустой странице — деградирует к `overview`.
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
  13. `DECISIONS.md` содержит записи по каждому решению из OQ-1/OQ-2/OQ-3 (и, если применимо, по
      технике анти-flash) с реальным согласованием пользователя, а не проставленные исполнителем.

  **Только если OQ-2 ≠ (c)** (Step 4 реально реализует выбор отдела в каком-то виде — вариант (a)
  или (b)):
  14. `Escape` при открытом отделе закрывает его и возвращает focus на исходный hotspot.
  15. `Enter`/`Space` на видимом hotspot открывает отдел (не no-op, в отличие от Step 3).
  16. В любой момент времени активен не более одного отдела (инвариант `docs/05`), проверено
      unit-тестом на state-модуле.
  17. Выбор отдела обновляет URL; переключение/закрытие не вызывает полную перезагрузку страницы
      (проверяется отсутствием полного document-навигационного события в e2e).
  18. `prefers-reduced-motion: reduce` — выбор/закрытие отдела работает идентично по результату
     (в дополнение к безусловному пункту 7 про hero → overview).

  **Если OQ-2 = (c):** пункты 14–18 не применяются к Step 4 вообще (переносятся в Step 5 целиком —
  их условная формулировка при планировании Step 5 будет заново решена перед стартом того шага, а
  не унаследована автоматически из этого черновика).
- Verification commands:
  ```bash
  npm install    # только если OQ-1 добавляет зависимость (Zustand)
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
    же порядке, что в Step 3. **Только если OQ-2 ≠ (c):** Enter/Space открывает отдел; Escape
    закрывает и возвращает фокус.
  - **Только если OQ-2 ≠ (c):** ручная проверка URL — клик по отделу обновляет адресную строку;
    кнопка "назад" браузера возвращает к overview/предыдущему отделу без полной перезагрузки
    (проверить по Network-панели DevTools — нет полного document-запроса).
  - Прямой переход на `http://localhost:3100/?department=sales` — подтвердить поведение, решённое
    по **OQ-3** (при OQ-2 = (c) — единственно возможный результат: пропуск `hero`, показ `overview`
    без автоматического открытия отдела).
  - `prefers-reduced-motion: reduce` в DevTools — все переходы состояния по-прежнему функциональны.
  - Отключить JavaScript, перезагрузить `/` — поведение идентично Step 3 (все 5 видны сразу).
  - Проверить 1280×500 (low-height) после раскрытия `overview` (безусловно, acceptance criterion
    8) — заголовок/CTA не обрезаны. **Дополнительно, только если OQ-2 ≠ (c):** повторить ту же
    проверку после открытия конкретного отдела.
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
  - **Механизм URL-обновления в Next.js App Router не тривиален (только если OQ-2 ≠ (c) — при
    OQ-2 = (c) URL при выборе отдела в Step 4 не обновляется вовсе, риск неприменим):**
    `router.push('/?department=…')` из `next/navigation` по умолчанию может вызвать серверный
    re-render `page.tsx` при каждой смене отдела — потенциально конфликтует с духом инварианта
    `docs/05` "не происходит полной перезагрузки". Альтернатива — прямой `history.pushState`/
    `replaceState` в обход `next/navigation` ("shallow routing"). Выбор — задача исполнения, но
    должен быть явно проверен acceptance criterion 17, а не просто заявлен.
  - **Регрессия на уже сформулированных Step 3 тестах**, описывающих поведение, которое Step 4
    целенаправленно меняет — риск того, что при коррекции эти тесты будут молча ослаблены/удалены
    вместо честной замены, повторяя класс проблемы из Step 3 round 2. Явно перечислены в In scope/
    Expected files, чтобы не повториться.
  - **docs/05 остаётся неточным относительно фактической глубины deep-link поведения** до ответа на
    **OQ-3** — если реализация разойдётся с буквальным текстом документа, потребуется honesty-правка
    по прецеденту Step 3, не откладывается молча.
  - **Момент введения Zustand** — `docs/09` "Стек" перечисляет Zustand без альтернативы, формально
    выглядя как уже решённая технология, но она не установлена в `package.json`, и Step 1 явно вывел
    её в "Out of scope" (отложена на момент реальной клиентской интерактивности — то есть именно
    сейчас). Трактовка "раз в стеке — значит можно добавлять без вопроса" отклонена как повторение
    прецедента BLOCKED (Step 2, zod) — вопрос вынесен пользователю (**OQ-1**) явно.
  - **GSAP — не открытый вопрос, уже решено (не путать с Zustand выше):** `docs/09` "Стек"
    перечисляет GSAP рядом с Zustand, но это решение уже принято этим планом, а не отложено на
    OQ-1 — см. Objective и Out of scope выше ("GSAP-анимации — вне scope в любом случае";
    "GSAP… не вводятся"), безусловно и независимо от OQ-1/OQ-2/OQ-3. Указано отдельным пунктом,
    чтобы не создавать впечатление, будто вопрос о GSAP тоже адресован пользователю в этом шаге.
  - **Low-height fallback (Step 3 correction) взаимодействие с hidden-by-default хотспотами** —
    `min-height: 340px` на `.zoneList` при `max-height: 700px` рассчитан для уже видимых хотспотов;
    нужно перепроверить, что раскрытие после `ACTIVATE_CTA` на 1280×500 не ломает уже
    зафиксированные измерения (81.6–122.4px).
  - Scope creep: соблазн реализовать реальную 10/90-раскладку "заодно" — явно отклоняется ссылкой на
    уже утверждённый 8-шаговый скелет (Step 5 — отдельный шаг).
- Rollback: `git revert` диапазона коммитов Step 4 (аддитивно относительно Step 3: новый
  state-модуль + точечные правки существующих компонентов/тестов; возможная точечная правка
  `docs/05` — включается в тот же диапазон, по прецеденту Step 3). Деструктивный
  `git reset --hard` — только с явного разрешения пользователя, как в предыдущих шагах.
- Skeptic verdict: _(review плана ещё не запрошен)_
- Skeptic findings:
- Completion evidence:

### Open questions (Step 4) — должны быть заданы пользователю до `APPROVED`

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
  `outcomes`, без 10/90-разбивки, без `DepartmentNavigationRail`/сцены), но Step 4 берёт на себя всю
  сложность переходов состояния до того, как доказана реальная потребность в конкретном UI — Step 5
  переоформляет уже работающую state machine в реальную 10/90-раскладку, не трогая логику переходов.
- (b) Step 4 реализует ТОЛЬКО `hero → overview` (`ACTIVATE_CTA`) плюс упрощённый бинарный
  `SELECT_DEPARTMENT`/`CLOSE_DEPARTMENT` (без промежуточных `opening`/`closing`-подсостояний и без
  какого-либо видимого контента отдела); Step 5 реализует поверх уже существующего бинарного
  состояния одновременно и 10/90-раскладку, и полноценные `opening/switching/closing`-переходы.
- (c) Step 4 не реализует выбор отдела вовсе — ограничивается только `hero ↔ overview` (раскрытие
  пяти скрытых хотспотов по `ACTIVATE_CTA`); хотспоты после раскрытия остаются no-op при клике/
  Enter/Space, как в Step 3, до тех пор, пока Step 5 не реализует `SELECT_DEPARTMENT`/
  `CLOSE_DEPARTMENT`/URL-sync/`opening`/`active`/`switching`/`closing` с нуля вместе с
  10/90-раскладкой — наиболее буквально соответствует уже утверждённой формулировке Step 5
  ("Реализовать выбор, панель отделов и основное поле").

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
  формулировка это не описывает.

## Step 5 — Desktop 10/90 shell

- Status: `PROPOSED`
- Objective: Реализовать выбор, панель отделов и основное поле.
- Dependencies: Step 4 (`COMPLETED`).
- Expected files: _(детализируется перед стартом шага)_
- Acceptance criteria:
  1. Переключение не возвращает overview.
  2. Escape закрывает отдел.
  3. Focus возвращается.
- Verification commands: _(детализируется перед стартом шага)_
- Manual checks: _(детализируется перед стартом шага)_
- Risks: _(детализируется перед стартом шага)_
- Rollback: _(детализируется перед стартом шага)_
- Skeptic verdict:
- Skeptic findings:
- Completion evidence:

## Step 6 — Mobile touch flow

- Status: `PROPOSED`
- Objective: Создать самостоятельный touch-интерфейс.
- Dependencies: Step 5 (`COMPLETED`).
- Expected files: _(детализируется перед стартом шага)_
- Acceptance criteria:
  1. Нет зависимости от hover.
  2. CTA доступна.
  3. Есть явная навигация назад.
- Verification commands: _(детализируется перед стартом шага)_
- Manual checks: _(детализируется перед стартом шага)_
- Risks: _(детализируется перед стартом шага)_
- Rollback: _(детализируется перед стартом шага)_
- Skeptic verdict:
- Skeptic findings:
- Completion evidence:

## Step 7 — Reduced motion and fallback

- Status: `PROPOSED`
- Objective: Реализовать reduced-motion и visual fallback.
- Dependencies: Step 6 (`COMPLETED`).
- Expected files: _(детализируется перед стартом шага)_
- Acceptance criteria:
  1. Функции сохраняются.
  2. Visual layer error не блокирует контент.
- Verification commands: _(детализируется перед стартом шага)_
- Manual checks: _(детализируется перед стартом шага)_
- Risks: _(детализируется перед стартом шага)_
- Rollback: _(детализируется перед стартом шага)_
- Skeptic verdict:
- Skeptic findings:
- Completion evidence:

## Step 8 — Browser acceptance tests

- Status: `PROPOSED`
- Objective: Зафиксировать основные потоки Playwright.
- Dependencies: Step 7 (`COMPLETED`).
- Expected files: _(детализируется перед стартом шага)_
- Acceptance criteria:
  1. Desktop, keyboard, mobile, URL и reduced-motion flows проходят.
  2. Console не содержит критических ошибок.
- Verification commands: _(детализируется перед стартом шага)_
- Manual checks: _(детализируется перед стартом шага)_
- Risks: _(детализируется перед стартом шага)_
- Rollback: _(детализируется перед стартом шага)_
- Skeptic verdict:
- Skeptic findings:
- Completion evidence:

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
