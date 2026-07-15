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
- Amendment 3 (2026-07-15): скелет шагов расширен с 8 до 9 по прямому решению пользователя (OQ-D
  = (b) — "Разбить на два шага", см. `DECISIONS.md`, 2026-07-15 "Step 5: разбиение на два
  отдельных шага WORKPLAN (OQ-D, Amendment 3)"). Единый черновик "Step 5 — Desktop 10/90 shell"
  формально разбит на "Step 5 — Department selection state machine" и "Step 6 — Desktop 10/90
  shell"; бывшие Step 6/7/8 сдвинуты на Step 7/8/9. Полная формальная запись — см. `Plan
  amendments` → `Amendment 3` ниже.

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

- Status: `PROPOSED`
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
  - `src/app/page.tsx` — вычисление/валидация `activeDepartmentId` из `searchParams` через
    `getDepartmentIds()`.
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
- Skeptic verdict: **round 1** (review плана после разбиения, Amendment 3) — `FAIL`: устаревшие
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
  теперь Step 6. Ожидает **round 6**. Предыдущий review плана единого нераздельного черновика
  "Step 5 — Desktop 10/90 shell" вернул `PASS` (тот, более ранний round 1) — этот более ранний
  verdict утратил силу после формального разбиения на два шага, так как форма плана изменилась.
- Skeptic findings: round 1 (после разбиения) — Blocker/Critical/Major: 1 (устаревшие/ложные
  перекрёстные ссылки на номера шагов в `WORKPLAN.md`, см. выше) — исправлено; Minor: (1)
  Tab-порядок между оставшимися хотспотами overview и временным минимальным блоком активного
  отдела не специфицирован; (2) клавиатурное переключение между уже открытыми отделами не покрыто
  отдельным acceptance criterion (только начальный выбор) — оба Minor не блокируют, к исправлению
  до начала
  реализации не обязательны.
- Completion evidence: _(шаг не начат — план не реализован.)_

## Step 6 — Desktop 10/90 shell

- Status: `PROPOSED`
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
- Skeptic verdict: **round 1** (review плана после разбиения, Amendment 3) — `FAIL`, вместе со
  Step 5 (общая находка на весь разбитый план — устаревшие/ложные перекрёстные ссылки на номера
  шагов в уже `COMPLETED` секциях Step 3/Step 4, см. Step 5 → Skeptic verdict выше и `DECISIONS.md`
  2026-07-15 "Коррекция: устаревшие перекрёстные ссылки..."). **round 2** — `FAIL`, тоже вместе со
  Step 5 (та же коррекция не была применена к `WORKLOG.md` Entry 3/4, исправлено). **round 3** —
  `FAIL`, тоже вместе со Step 5 (тот же класс находки — на этот раз в `DECISIONS.md`, третьем
  source-of-truth документе; исправлено). **round 4** — `FAIL`, тоже вместе со Step 5 (риск-записи
  Step 1 в `WORKPLAN.md`/`WORKLOG.md`, "2–8" вместо "2–9"; исправлено). **round 5** — `FAIL`, тоже
  вместе со Step 5 (bare-упоминание "панель... переносятся в Step 5" в Objective Step 4;
  исправлено). Ожидает **round 6**. Этот шаг выделен из бывшего единого черновика "Step 5 —
  Desktop 10/90 shell" по Amendment 3 (см. `DECISIONS.md` 2026-07-15 "OQ-D").
- Skeptic findings: см. Step 5 → Skeptic findings (общие находки round 1/2/3/4/5 на оба новых шага,
  так как оба — части одного и того же разбитого документа); специфичных для именно Step 6 находок
  ни один из раундов не выявил.
- Completion evidence: _(шаг не начат; зависит от завершения и `COMPLETED`-статуса "Step 5 —
  Department selection state machine".)_

## Step 7 — Mobile touch flow

- Status: `PROPOSED`
- Objective: Создать самостоятельный touch-интерфейс.
- Dependencies: Step 6 (`COMPLETED`).
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

## Step 8 — Reduced motion and fallback

- Status: `PROPOSED`
- Objective: Реализовать reduced-motion и visual fallback.
- Dependencies: Step 7 (`COMPLETED`).
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

## Step 9 — Browser acceptance tests

- Status: `PROPOSED`
- Objective: Зафиксировать основные потоки Playwright.
- Dependencies: Step 8 (`COMPLETED`).
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
