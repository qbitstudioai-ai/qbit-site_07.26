# WORKLOG

## 2026-07-28 — Мобильный и планшетный аудит: обход, исправления, регрессионные тесты

**Стенд.** Production-сборка (`next build` + `next start`), выделенный порт 3300. Административная
часть — на КОПИИ базы во временном каталоге (`QBIT_DATA_DIR` / `QBIT_DB_PATH` / `QBIT_UPLOADS_DIR`
переопределены) с временной учётной записью. `var/content.db` и `var/uploads/` на запись не
открывались. Коммиты не создавались.

**Обход.** 31 публичный адрес × 19 экранов = 589 проверок (7 портретных телефонов 320…430, 4
альбомных 568×320…932×430, 4 планшета 768×1024…1180×820, 4 desktop-контроля 1366…2560; dpr 1/2/2.6/3).
Отдельно 7 административных адресов на 390×844, 667×375, 768×1024. Сценарно проверены раскрытое
меню, выбор отдела касанием, аккордеон FAQ, каталог документов, список продуктов, вход и выход,
поворот экрана, `prefers-reduced-motion`.

**Найдено.** Blocker 0, High 2, Medium 4, Low 4. Реестр — `MOBILE_ISSUES.md`.

**Исправлено (6 находок, файлы).**

- `src/features/how-we-work/HowWeWorkPage.module.css` — MOB-01: точки маршрута были 8×8 px при шаге
  20 px между центрами, прямой выбор локации пальцем невозможен. Добавлен `@media (pointer: coarse)`:
  мишень 44×44, видимая точка переехала в `::before`, `gap: 0` даёт шаг центров ровно 44 px,
  `right: 16px` компенсирует ширину колонки (оптический центр остался в 38 px от края — замерено до
  и после).
- `src/components/homepage/Header.module.css`, `Header.tsx` — MOB-02: раскрытое меню кончалось на
  441 px при высоте экрана 375 px, «Контакты» и «Вход» были недоступны; добавлены
  `max-height: calc(100dvh - 72px)` (с `100vh`-фолбэком), `overflow-y: auto`,
  `overscroll-behavior: contain`. MOB-03: подложка, закрывающая меню нажатием мимо и перехватывающая
  касания фона; ловушка фокуса на Tab/Shift+Tab; возврат фокуса на кнопку.
- `src/features/products/ProductsExperience.module.css` — MOB-04: пункты списка продуктов 36 px,
  хлебные крошки 14 px. `@media (pointer: coarse)`: `min-height: 44px` + `flex-shrink: 0`; для крошек
  область попадания через `::after` (`inset-block: -15px`), чтобы не сдвигать вёрстку отступами.
- `src/features/documents/DocumentsExperience.module.css` — MOB-05: фильтры категорий и «Открыть
  полностью» 30 px. `@media (pointer: coarse)`: `min-height: 44px`, зазор фильтров 8 px.
- `src/components/homepage/HeroInfoPanel.module.css` — MOB-06: оговорка «Расчётный эффект…» 9.8 px →
  `0.72rem` в двух мобильных media query. Desktop-правило (`min-width: 1200px`) не тронуто.

**Создано.** `src/tests/e2e/helpers/layout.ts` (матрица экранов, список адресов, детектор
горизонтального переполнения, обмер мишеней), `src/tests/e2e/mobile-audit-regressions.spec.ts`
(MOB-01…MOB-06 + парные desktop-проверки + обход всей матрицы на переполнение + поворот экрана +
reduced motion), `MOBILE_AUDIT.md`, `MOBILE_ISSUES.md`, `MOBILE_ROUTE_MATRIX.md`,
`MOBILE_PRE_RELEASE_CHECKLIST.md`.

**Тексты, фотографии, данные и SEO/GEO-метаданные не изменялись.** Все правки — размеры мишеней,
ограничение высоты меню, размер шрифта одной оговорки, поведение раскрытого меню.

**Две ошибки в собственных правках, найдены собственной проверкой и устранены до фиксации
результата.** (1) Подложка меню, будучи `<button>`, получила размер 667×0: у кнопки при
`height: auto` высота считается по содержимому даже когда заданы и `top`, и `bottom`, — высота задана
явно. (2) Подложка с `aria-label="Закрыть меню"` стала вторым элементом с той же подписью, что и
кнопка меню, и уронила `header.test.tsx`; переведена на `aria-hidden` + `tabIndex={-1}`.

**Проверки.** typecheck PASS. unit 41 файл / 395 тестов PASS. build PASS. Повторный полный обход
после правок: 589 проверок — 0 переполнений, 0 ошибок навигации, 0 ошибок страницы. e2e: три полных
прогона подряд с обычной параллельностью — 406 passed / 1 skipped / 0 failed каждый.

**e2e с одним воркером (`--workers=1`): 406 passed / 1 skipped / 0 failed, 7.4 мин.** Пропущен один
тест — проверка мобильного меню на 932×430, где ширина превышает брейкпоинт 900 px и работает
desktop-навигация; пропуск объявлен в самом тесте.

**Первая попытка серийного прогона упала до тестов** — на сборке, с `Error: database is locked`
(`ERR_SQLITE_ERROR`, errcode 261) при статической генерации `/blog/[[...slug]]`. Причина не в
правках этого аудита (ни одна не касается базы или сборки): четвёртая подряд сборка стартовала, пока
предыдущий `next start:e2e` ещё удерживал WAL, и 11 параллельных воркеров генерации получили занятую
базу. После освобождения портов прогон повторён и прошёл полностью. Записано как самостоятельный
риск выката — см. ниже; таймауты и допуски при этом не менялись.

**lint и format:check** падают только на прежних out-of-scope местах: `HowWeWorkPage.tsx:231`
(`react-hooks/set-state-in-effect`, файл в этой работе не изменялся — правился только его
CSS-модуль), `artifacts/products-page/new-product-metrics.json`, `reports/blog-seo-geo-audit.md`. Те
же, что зафиксированы 2026-07-25 и 2026-07-27. Все новые и изменённые файлы проходят lint и format.

**Не исправлено, вынесено владельцу (Low).** MOB-07 обрезка текста локации на сценах 0–2
(`-webkit-line-clamp: 3`), MOB-08 `transform: scale()` у декоративной панели, MOB-09 предпросмотр
цены продукта только по наведению на касательном экране шире 767 px, MOB-10 та же оговорка мелкая и
на desktop (desktop править запрещено). Каждая требует дизайнерского или продуктового решения.

**Отдельный риск, не относящийся к мобильной версии.** `next build` может упасть с «database is
locked», если сборка идёт при работающем экземпляре приложения на той же базе. Воспроизведено один
раз из пяти сборок подряд. Для выката это означает: останавливать приложение до сборки либо собирать
на отдельной копии данных.

**Ограничение результата.** Все измерения — эмуляция устройств в Chromium. Поведение реального iOS
Safari (адресная строка, `dvh`, safe-area, системная клавиатура, скачивание файлов) и Android Chrome
не проверено и этим способом проверено быть не может. Обязательный список проверок на живых
устройствах — `MOBILE_PRE_RELEASE_CHECKLIST.md`.

## 2026-07-27 — Админ-панель: контент из базы, вход по ссылке «Вход»

**Создано.** Слой базы (`src/server/db/`: `client.ts`, `schema.mjs`), репозитории
(`departments`, `products`, `pageContent`, `articles`, `contacts`, `documents`, `revisions`),
публичное чтение (`src/server/content/*`), авторизация (`src/server/auth/*`), хранилище файлов и
предпросмотры (`src/server/storage/*`), правила API (`src/server/api/*`), `src/middleware.ts`,
роуты `/api/admin/*`, `/api/content/[section]`, `/api/files/[...path]`, интерфейс
`src/features/admin/*`, страницы `/admin/*`, seed-данные `data/seed/*.json`, скрипты
`db-migrate.mjs`, `db-seed.mjs`, `hash-admin-password.mjs`, `ADMIN_PANEL.md`.

**Изменено.** `/login` стал рабочей страницей входа. Публичные страницы (`/`, `/products`, `/blog`,
`/documents`, `/contacts`, `sitemap.ts`) читают контент из базы. Из `products.ts`, `posts.ts`,
`documents.ts`, `contactData.ts` удалены hardcoded-массивы — остались типы и чистые функции; данные
приходят пропсами в `ProductsExperience`, `BlogExperience`, `DocumentsExperience`,
`ContactsExperience`, `ContactForm`. Переадресация старых адресов продуктов переехала из
`next.config.ts` в страницу. `DocumentItem.fileSize` теперь число (байты) + `formatFileSize`.

**Проверки.** typecheck: PASS. unit: 31 файл / 273 теста PASS. build: PASS. e2e: 343/344 PASS —
падает только `pain-gain-layout.spec.ts:245` (расхождение геометрии 1,15 px при допуске 0,5), в
изоляции проходит трижды подряд; контент отдела не менялся, это прежняя нестабильность измерения.
lint и format:check падают только на прежних out-of-scope местах (`HowWeWorkPage.tsx:230,590`,
`artifacts/`, `reports/`) — те же, что зафиксированы 2026-07-25.

**Браузерная приёмка (production build, порт 3210/3211).** `/admin` без сессии → 307 на
`/login?next=%2Fadmin`; неверный логин и неверный пароль → одинаковый 401; верный вход → cookie
`HttpOnly`; все шесть разделов панели → 200; `/login` при активной сессии → 307 на `/admin`;
«Выйти» → `/admin` снова 307, `/api/admin/*` → 401. Правка телефона в контактах изменила шапку на
СТАТИЧЕСКОЙ `/documents` без пересборки; правка отдела видна на `/?department=sales`; правка
продукта — на `/products/rag-ai-assistant`; занятый slug продукта и статьи → 409 с понятным текстом.
Черновик статьи не виден в `/blog`, после публикации виден в списке, открывается по адресу и попадает
в `sitemap.xml`. Загрузка JPG/PNG/TXT/PDF/DOCX/XLSX — успешна; `.exe` и `.svg` → 422; файл 27 МБ →
422; `..` в адресе файла → 404; скачивание отдаёт `attachment`, `nosniff`, `sandbox`. Удаление
документа убрало запись и оба файла из хранилища; осиротевших файлов — 0. Консоль браузера на всех
экранах панели: 0 ошибок. Планшет 820 px: боковая панель сворачивается в меню, таблицы
прокручиваются горизонтально.

**Тестовые данные удалены**, база возвращена к seed-состоянию (8 документов, 6 статей, контакты
исходные).

## 2026-07-25 — Amendment 44 / Step 44 (final blog publication)

- Импортированы шесть финальных статей из `deep-research-report (2).md`; канонические копии хранятся
  в `src/content/blog/`, а generated-модуль содержит SHA-256 каждого исходного текста.
- Сохранены шесть существующих slugs; `/blog` стал самостоятельным индексом опубликованных статей.
- Добавлены parser Markdown, оглавление, Sources, связанные статьи, CTA, предыдущая/следующая статья,
  уникальные metadata/canonical/OG/Twitter и JSON-LD (`BlogPosting`, `BreadcrumbList`, `ItemList`).
- Sitemap расширен индексом блога и шестью статьями. RSS в проекте отсутствовал и по условию не создавался.
- SHA-256 canonical/source integrity: PASS; scoped Prettier/ESLint: PASS; typecheck: PASS;
  full unit: 27 файлов / 218 тестов PASS; production build: PASS; blog e2e: 5/5 PASS.
- Axe round 1 нашёл контраст 4,32:1 у мета-строки активной статьи; цвет затемнён до graphite-700,
  повторный axe/e2e: PASS, serious/critical violations: 0.
- Визуально проверены индекс и статья на 1440 px, полная статья на 360 px; horizontal overflow: 0.
  Финальные кадры находятся в `artifacts/blog-published-final/`.
- Полный lint падает только на двух прежних out-of-scope ошибках
  `src/features/how-we-work/HowWeWorkPage.tsx:230,590`; scoped blog lint чист.
- Полный format check падает только на прежнем `artifacts/products-page/new-product-metrics.json`;
  scoped blog formatting чист.
- Link-аудит: внешние `https://docs.n8n.io` и `https://allqbit.ru/examples` доступны; исходные
  относительные `/examples` и `/ai-assistant-for-business` не имеют маршрутов в текущем проекте и
  сохранены без молчаливой подмены.
- Skeptic: `PASS`; blocking findings: none. Подтверждены побайтовая целостность шести статей,
  согласованность metadata/JSON-LD/sitemap, responsive layout и отсутствие Amendment 44 изменений
  зависимостей или чужих страниц.
- Non-blocking: часть перечисленных в исследовании источников не содержит прямых URL; проверить их
  технически невозможно без выдумывания ссылок. Исходный материал не задаёт H3-разметку, поэтому
  выделенные смысловые заголовки представлены единым уровнем H2 без потери текста.
- Status: `COMPLETED`.

## 2026-07-25 — Amendment 43 / Step 43 (blog foundation)

- Added `public/blog/workspace-notebook-original.png` (1672×941) and 960/1672 WebP+AVIF
  derivatives; source preserved.
- Added `src/features/blog/posts.ts` as the single six-draft content/slug/menu source.
- Added `/blog` and six statically generated `/blog/[slug]` routes with draft `noindex,nofollow`.
- Added reused Header layout, desktop rail/article scroller, mobile article disclosure and document
  scroll, page-change motion and reduced-motion crossfade.
- Changed only the shared «Блог» navigation href from `#` to `/blog`; FAQ/Контакты unchanged.
- `npm run typecheck`: exit 0.
- Scoped ESLint (no fix): exit 0.
- Blog/header/content unit tests: 18 passed.
- `npm run build`: exit 0; 26 static pages, blog overview + six slugs generated; 20 pre-existing
  Turbopack AVIF passthrough warnings from office assets.
- Blog production e2e round 1: 2 passed, 1 failed — desktop scroller parent height was unbounded.
- Fixed `BlogLayout` desktop height/overflow contract; mobile explicitly restores document flow.
- Blog production e2e round 2: 3 passed; URL/direct reload/back, desktop/mobile scroll, overflow,
  mobile disclosure, reduced motion, noindex and console error checks passed.
- Visual captures: `artifacts/blog/desktop.png`, `tablet.png`, `mobile.png`; 1440/1024/390 had zero
  horizontal overflow.
- In-app Browser connection was attempted per Browser skill but unavailable due connector metadata
  failure; verification used the repository production Playwright gate and local captures.
- Final scoped ESLint + typecheck: exit 0; focused unit tests: 18 passed; production blog e2e after
  mobile Escape/focus correction: 3 passed.
- Full `npm run lint` (no fix): exit 1 on two pre-existing, out-of-scope
  `src/features/how-we-work/HowWeWorkPage.tsx` findings at lines 230 and 590; no blog lint findings.
- Skeptic round 1: `FAIL` — article paper covered too much of the physical notebook; Forward history
  was not asserted. Fix: paper narrowed/aligned to expose the right half of the notebook, paper
  opacity reduced to 0.93, mobile menu moved below the photo, Forward added to production e2e.
- Skeptic round 2: `PASS`; blocking findings: none. Confirmed desktop/tablet/mobile notebook
  composition, Forward coverage, scoped checks and no Amendment 43 product/department-page edits.

## 2026-07-25 — Amendment 41: компактный выбор продуктов

- Изменены только product overview/config/tests и live-план: `ProductsExperience.tsx`,
  `ProductsExperience.module.css`, `products.ts`, product unit/e2e, `WORKPLAN.md`.
- Сохранены исходное фото, десять прямоугольников физических зон, slugs/URL, цены, продуктовые
  фотографии, карточки, левое меню, SEO и существующий камерный переход.
- Overview: удалены постоянные рамки, номера и отдельный tooltip с тремя ценами; добавлены
  индивидуально позиционируемые компактные метки, угловые маркеры только при hover/focus и раскрытие
  одной минимальной цены внутри метки по паттерну `DepartmentHotspot`.
- Mobile: на фото видна одна выбранная метка; нижние настоящие `<a href>` выбирают продукт без
  навигации первым нажатием, компактная панель показывает одну цену, «Подробнее» запускает переход.
- Повторный design audit: touch-preview ограничен mobile ≤767 px; планшетная зона остаётся прямой
  ссылкой и не попадает в скрытый mobile-flow.
- Visual review: 1440×900, 1024×768 и 390×844 — все названия читаются, desktop/tablet метки не
  пересекаются; центральная последовательность «чертежи / мониторы / планшет / ящики» разведена;
  hover не закрывает объект крупной карточкой. Кадры: `artifacts/products-redesign/`.
- `npm run typecheck` — PASS; scoped ESLint product TS/TSX — PASS; product unit — 6/6 PASS;
  full unit — 25 файлов / 209 тестов PASS; `npm run build` — PASS с 20 прежними AVIF warnings.
- Product production e2e — 16/16 PASS, включая все 10 overview-переходов/direct URL, keyboard,
  mobile, tablet, reduced motion, axe, SEO; department overview regression — 26/26 PASS.
- Отдельный повтор всех 10 overview-переходов с перехватом `console.error` и `pageerror` — 1/1 PASS,
  runtime errors: 0.
- Полный `npm run lint` — FAIL только по двум прежним ошибкам
  `src/features/how-we-work/HowWeWorkPage.tsx:230,590`; product-файлы чисты.
- Полный `npm run format:check` — FAIL только по прежнему
  `artifacts/products-page/new-product-metrics.json`; изменённые файлы отформатированы.
- Skeptic round 1 — `FAIL`: на 768×1024 раскрытия 01/07 пересекались, раскрытие 05 выходило за кадр;
  также не хватало geometry-теста раскрытых состояний.
- Исправление round 1: точечно разведены marker-позиции 01/07/05; добавлен e2e всех 10 раскрытий на
  1440×900, 1024×768 и 768×1024 с проверкой границ кадра и пересечений со всеми остальными метками.
  Новый geometry e2e — PASS; полный product e2e после исправления — 16/16 PASS; визуальный кадр
  `artifacts/products-redesign/hover-product-05-768x1024.png` подтверждает исправление.
- Skeptic round 2 — `PASS`: независимые post-transition geometry checks всех 10 меток на трёх
  размерах не нашли пересечений или выхода за кадр; blocking findings: none.
- Status: `COMPLETED`.

## 2026-07-25 — Amendment 39: компактная шапка

- `Header.module.css`: общая высота шапки 64 px на desktop/mobile; вертикальный padding 4 px;
  логотип 48/42/38 px по breakpoints; телефон сохранён высотой 44 px; font-size меню не изменялся.
- `ProductsExperience.module.css`: верхний padding product experience 16 → 10 px, межстрочный gap
  12 → 8 px, control-row gap 12 → 8 px; кнопки сохранили минимальную высоту 44 px на desktop и
  прежние 40 px на mobile.
- `ProductsExperience.tsx`: добавлен стабильный `data-products-controls` только для измерительного
  e2e-селектора.
- `products-experience.spec.ts`: добавлена проверка 1440×900 и 390×844 — Header 60–64 px,
  phone 40–44 px, product controls ≤ 44 px.
- Visual capture: `artifacts/header-compact/products-1440x900.png` и
  `artifacts/header-compact/products-390x844.png`; переполнения и визуального сжатия текста нет.
- Header unit — 10/10 PASS; products production e2e — 9/9 PASS; scoped Prettier/ESLint,
  typecheck, production build — PASS.
- Production build сохраняет 20 известных предупреждений Turbopack по прежним office AVIF.
- Skeptic: `PASS`; независимо подтверждены Header 64 px, телефон 44 px, неизменный font-size меню,
  product controls ≤ 44 px и отсутствие побочных изменений.
- Status: `COMPLETED`.

## 2026-07-24 — Amendment 38: «Продукты и стоимость»

- Добавлены `/products` и `/products/product-01` … `/products/product-10` через optional catch-all
  route; Header и глобальные design tokens переиспользованы без правок office/department UI.
- `src/features/products/products.ts`: 10 временных названий, alt, порядок, URL, относительные
  координаты реальных зон и responsive image sources.
- 11 PNG преобразованы в 44 AVIF/WebP-производные (960 + 1448/1600), общий вес 3.39 MB.
- `ProductsExperience`: настоящие ссылки-хотспоты, камерный вход, короткий switch, прямые URL,
  Back/Forward, desktop/tablet rail, mobile disclosure, reduced-motion crossfade, lazy + adjacent
  preload.
- Визуально проверены 1440×900, 1024×768 и 390×844; сохранены кадры в
  `artifacts/products-page/`.
- `npm run format:check` — PASS.
- `npm run lint` — FAIL только по 2 ранее существующим ошибкам
  `src/features/how-we-work/HowWeWorkPage.tsx:230,590`; product-файлы проходят ESLint отдельно.
- `npm run typecheck` — PASS.
- `npm run test` — PASS, 25 файлов / 207 тестов.
- `npm run build` — PASS; 20 прежних предупреждений Turbopack об импортируемых office AVIF.
- `npm run test:e2e` — PASS, 259 тестов.
- `products-experience.spec.ts` — PASS 8/8: десять зон, прямые URL без скрытого overview preload,
  switch/history, клавиатурный возврат фокуса, mobile + Escape, reduced motion и axe.
- После первого skeptic FAIL исправлены ссылка Header на `/products`, лишнее SEO-description,
  условная загрузка overview и управление фокусом; повторные typecheck, scoped ESLint, unit 4/4,
  production build и products e2e 8/8 — PASS.
- Skeptic round 2: `PASS`; блокеров нет, Header/unit 14/14 и production products e2e 8/8
  подтверждены повторно.
- Встроенный Browser не подключился из-за ошибки интеграции среды; визуальный аудит выполнен
  штатным Playwright проекта и просмотром сохранённых кадров.

Каждая запись должна содержать:

- шаг;
- scope;
- изменённые файлы;
- фактически выполненные команды;
- exit codes;
- ручные проверки;
- skeptic verdict;
- исправления после FAIL;
- остаточные риски.

**Формат с 2026-07-16 (аудит workflow, см. `DECISIONS.md`):** новые записи — фактами, не
повествованием. Список изменений/команд/verdict, без пересказа хода обсуждения и без цитирования
предыдущих раундов целиком — исправленный факт заменяет старый, а не добавляется рядом с ним. Записи
до этой даты не переписываются (сохраняются как есть, это реальная история).

---

---

> ⚠️ **Архив.** Завершённое (Этапы 1–2 до Step 19) вынесено в `archive/WORKLOG.archive.md`.
> Клод НЕ читает архив без явной просьбы пользователя. Ниже — только активная работа.

---
## Step 19 — Контент-модель «до/после» для «Продаж» (данные + схема)

### Изменено

- `src/content/types.ts`: тип `ProcessStep` (`id/label/description/actor?/status?/visualAnchor?`,
  `ProcessStepStatus`) и ОПЦИОНАЛЬНЫЕ `beforeSteps?`/`automationSteps?` на `Department`.
- `src/content/schema.ts`: `processStepSchema` (status ограничен перечнем docs/12); поля опциональны,
  `min(1)` при наличии; superRefine — парность «оба или ни одного».
- `data/departments.json`: `beforeSteps`/`automationSteps` заполнены ТОЛЬКО для `sales` (по 4 шага,
  деловой язык, консистентно с painPoints; actor показывает сдвиг Менеджер→Система).
- `docs/12`: поля переведены из обязательных в опциональные, примечание о частичной реализации
  (sales) и парности. `docs/06`: «до/после» вернулась как отдельный элемент BeforeAfterSequence, не
  как основной поток (модель боль→выгода сохранена).
- Тесты: `departments.test.ts` — «до/после только у sales», «шаги sales — валидные ProcessStep»;
  `invalid-fixtures.test.ts` — отдел без полей валиден; парность (before без after и наоборот);
  пустой массив; ProcessStep без description; status вне перечня.

### Команды и результат

- `npm run format:check` / `lint` / `typecheck` — exit 0.
- `npm run test` — **180 passed** (было 171; +9).
- `npm run build` — exit 0.

Приёмка (AC1–AC4): схема валидирует sales с полями и остальные 4 без них (тест + build); инвариант
«5 отделов, 5 пар боль→выгода» не нарушен (существующие тесты зелёные); битый ProcessStep (нет
description, status вне перечня) отклоняется; docs/12 и docs/06 приведены к опциональности без
ложного «заполнены все отделы».

### Step 19 — итог

`PASS` (skeptic независимо запустил format:check/lint/typecheck/test/build — все зелёные, 180 passed;
проверил негативные фикстуры временным probe: каждая падает по НУЖНОМУ ограничению, а не постороннему
— парность `custom@[automationSteps]`, min(1) `too_small`, нет description `invalid_type`, status вне
перечня `invalid_value`). AC1 подтверждён на РЕАЛЬНЫХ данных: `departmentsSchema.parse` вызывается при
загрузке `departments.ts`, поэтому зелёный build доказывает валидность JSON, а не только фикстур.

Инвариант парности «оба или ни одного» (моё добавление сверх docs/12) skeptic оценил как оправданное
и НЕ молчаливое (задокументировано в docs/12 + комментариях) — оставлено.

Non-blocking, диспозиция: (1) «CRM» в `sales-before-2` оставлено — консистентно с утверждённой копией
`problem`/painPoint отдела (docs/06 уже упоминает CRM как текущий инструмент), не «ведёт» с CRM по
CLAUDE.md; (2) «ничего не теряется» — надёжностная формулировка, не обещание выручки/замены; (3)
ux-ревью клиентской копии «до/после» происходит на Step 20 (там ux-strategist в ревьюерах и копия
отрисована), а не на data-шаге.

## Step 20 — BeforeAfterSequence для «Продаж»: DOM/SVG-диаграмма

### Изменено

- `src/components/departments/BeforeAfterSequence.tsx` (+ `.module.css`): две колонки шагов процесса
  «Сейчас» → «После автоматизации», data-driven (props `beforeSteps`/`automationSteps`/`headingId`).
  Оба состояния и весь текст в дереве доступности ВСЕГДА (opacity 1); анимируется только
  декоративный коннектор (RouteMarker, однократный проезд 700 мс). Статус кодируется ФОРМОЙ маркера
  (треугольник — потеря/ручной шаг, галочка — результат) + текстом заголовков колонок, не цветом.
  reduced-motion снимает анимацию коннектора. Контраст: label graphite-900 (12.82:1), description/
  actor graphite-700 (7.90:1) над худшим участком скрима; graphite-500 НЕ использован (4.31:1 — ниже
  AA, посчитано).
- `DepartmentExperience.tsx`: блок рендерится между болями и кнопками ТОЛЬКО при наличии
  `beforeSteps && automationSteps` (сегодня «Продажи»). В каскад (0/1/2/3 с) НЕ входит — тайминги не
  тронуты (Amendment 16). Устаревший комментарий «BeforeAfterSequence сознательно не создаётся»
  переписан.
- `docs/07`: раздел «До/после» дополнен реализацией Step 20 и reduced-motion.

### Регрессия раскладки, найденная полным e2e, и её причина

Добавление блока (419px desktop / 670px mobile) уронило 2 существующих теста. Причина замерена
зондом, не угадана:
- 767×800: мобильный аккордеон `flex: 1; min-height: 0` СХЛОПЫВАЛСЯ в 0px — фикс-контент (copy +
  before/after + кнопки) превышал высоту панели, и единственный flex-растягиваемый элемент
  сжимался до нуля, пункты боли исчезали.
- 1440×900: `.experience` (все дети flex-shrink: 0) скроллился, CTA уходила на top 961 при
  вьюпорте 900 — под сгиб, elementFromPoint возвращал null.

Исправление — то же лечение, что уже применено к desktop-панели в Step 15 («flex отнимал высоту»):
`MobilePainGainAccordion` `flex: 1` → `flex-shrink: 0`. Теперь экран отдела прокручивается ЕДИНОЙ
колонкой на всех ширинах (как уже устроено на desktop), аккордеон — естественной высоты, пункты
боли на месте. Внутренний скролл `.experience` — установленная модель (docs/08 «низкий desktop»),
документный скролл не появляется (.shell overflow:hidden). CTA/«Закрыть» достижимы прокруткой,
Escape закрывает, на мобильном есть Prev/Next.

Тест «блок кнопок виден и кликабелен» (Step 17) обновлён: приводит CTA в вид перед замером и явно
проверяет `pointer-events !== none`. Смысл сторожа (гарантия против `pointer-events:none`/opacity)
сохранён и усилен; изменено только допущение «CTA в начальном вьюпорте», ложное после того как
экран стал выше панели.

### Тесты

- `before-after-sequence.test.tsx` (8): регион по заголовку, оба состояния одновременно, две
  упорядоченные колонки по числу шагов, actor, маркеры декоративны (aria-hidden), обобщаемость на
  произвольные данные.
- `department-experience.test.tsx` (+2): блок есть у sales, отсутствует у отдела без шагов.
- `before-after.spec.ts` (e2e, 7): оба состояния видны одновременно (AC1), две колонки, смысл не
  только цветом (AC3), reduced-motion без работающих анимаций (AC2), мобильный, изоляция (отдел без
  шагов), CTA/«Закрыть» достижимы.

### Команды и результат

- `npm run format:check` / `lint` / `typecheck` / `build` — exit 0.
- `npm run test` — **188 passed** (было 180; +8).
- `npm run test:e2e` — **215 passed** (было 208; +7) против production-сборки.
- Браузерная проверка: desktop — две колонки «СЕЙЧАС»→«ПОСЛЕ АВТОМАТИЗАЦИИ» с коннектором, читаемо;
  mobile — колонки друг под другом, коннектор вниз, аккордеон и before/after в едином скролле.

### Step 20 — итог

`PASS`, блокирующих нет. Skeptic независимо прогнал format:check/lint/typecheck/build (exit 0),
188 unit, полный e2e 215 passed, и пересчитал контраст руками над худшим композитом скрима:
graphite-900 12.78:1, graphite-700 7.88:1, graphite-500 4.22:1 (ниже AA — верно НЕ использован для
текста), sage-700 5.9:1 (проходит). Обе спорные правки признаны корректными: аккордеон
`flex:1`→`flex-shrink:0` — исправление регресса, введённого этим же шагом, и в scope (то же лечение,
что у desktop-панели в Step 15); правка теста CTA сохраняет и УСИЛИВАЕТ сторож (opacity по-прежнему
меряется по цепочке предков, `pointer-events:none` ловится двумя способами).

Non-blocking, на milestone-ревью: (1) CTA ~61px под сгибом на 1440×900 — watch-item для
ux-strategist, НЕ нарушение «CTA remains easy to reach» (внутренний скролл — модель docs/08, CTA
видна с 1 кадра, Escape закрывает); (2) reduced-motion e2e можно ужесточить (источник и так
гарантирует `animation:none`); (3) «CRM»/«ничего не теряется» — qa может смягчить копию.

## Amendment 21 — окно «Выгоды для заказчика» (замена BeforeAfterSequence)

Статус: `COMPLETED` (skeptic `PASS`, блокирующих нет). Запрос пользователя 2026-07-21 + два выбора
(список пунктов-выгод; полностью заменить «до/после»). Запись поправки — WORKPLAN.md после Step 20.

Skeptic (независимо перезапустил typecheck/lint/format/test/build + e2e customer-benefits): PASS.
Non-blocking: (1) e2e-сторож «нет прокрутки» пока на пустом списке — памятка добавлена в сам тест,
перепроверить при наполнении копирайтом; (2) вложенный region-лендмарк — на усмотрение ux/qa
milestone; (3) skeptic гонял e2e инкрементально на dev — исполнитель отдельно подтвердил полный
набор (214 passed) против production-сборки. Имя e2e-теста уточнено («окно выгод показано»).

### Файлы

- Данные/модель: `src/content/types.ts` (убран `ProcessStep`/`ProcessStepStatus`, `beforeSteps`/
  `automationSteps`; добавлен `customerBenefits: string[]`), `src/content/schema.ts` (убран
  `processStepSchema` и парность «до/после»; `customerBenefits: z.array(nonEmptyString).default([])`),
  `data/departments.json` (у «Продаж» убраны before/after; всем пяти добавлен `customerBenefits: []`).
- Компонент: удалены `BeforeAfterSequence.tsx`+`.module.css`; добавлены
  `CustomerBenefits.tsx`+`.module.css` (заголовок «Выгоды для заказчика», список `TypedText`,
  reveal через 5 с `useReducer`+`setTimeout`, reduced-motion сразу, галочка aria-hidden, печать по
  очереди префиксной суммой длин).
- Интеграция: `DepartmentExperience.tsx` — `BeforeAfterSequence` (условный) → `CustomerBenefits`
  (безусловный, `key={department.id}`).
- Тесты: удалены `before-after-sequence.test.tsx`, e2e `before-after.spec.ts`; добавлены
  `customer-benefits.test.tsx` (7), e2e `customer-benefits.spec.ts` (6: 5 с, единство, reduced-motion,
  повторный отсчёт при смене отдела, НЕТ верт./гориз. прокрутки на 1440×900, CTA/«Закрыть»); правлены
  `department-experience.test.tsx` (2 теста «до/после» → 1 тест reveal через 5 с), `departments.test.ts`
  (before/after → customerBenefits), `invalid-fixtures.test.ts` (ProcessStep → customerBenefits),
  `department-hotspot.test.tsx` (фикстура +customerBenefits), комментарий в `pain-gain-layout.spec.ts`.
- Доки: `docs/03,05,06,07,09,12` — BeforeAfterSequence/«до/после» → CustomerBenefits/«Выгоды для
  заказчика».

### Команды и результат

- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (первый прогон ловил `react-hooks/immutability` на мутации счётчика в
  render — переписано на префиксную сумму без мутации).
- `npm run format:check` — все файлы в стиле Prettier.
- `npm run test` (unit) — 183 passed.
- `npm run test:e2e` — новый `customer-benefits.spec.ts`: 6/6 passed против production-сборки;
  подтверждено: окно появляется через ~5 с, единое у отделов, reduced-motion сразу, отсчёт заново при
  смене отдела, колонка отдела `scrollHeight ≤ clientHeight` (нет полосы), нет гориз. прокрутки.
- Финальный полный гейт: `format:check` clean, `lint` exit 0, `typecheck` exit 0, `test` **183 passed**,
  `build` success, `test:e2e` **214 passed** (полный набор против production-сборки, регрессий нет).

## Amendment 22 — окно «Ваша выгода»: заголовок, позиция, задержка

Статус: `COMPLETED` (skeptic `PASS`, блокирующих нет). Запрос пользователя 2026-07-21 (три правки к
окну Amendment 21). Skeptic-находка (non-blocking): устаревшие комментарии со старым названием окна
в живом коде/тестах — исправлены инлайн (`CustomerBenefits.tsx` docstrings/CheckMark/CSS, `types.ts`,
`schema.ts`, `pain-gain-layout.spec.ts`); grep по `**/*.{ts,tsx,css}` подтверждает 0 остатков
«Выгоды для заказчика». Повторный гейт после правок комментариев: format/lint/typecheck clean,
test 183 passed.

### Изменения
- Заголовок «Выгоды для заказчика» → **«Ваша выгода»** (`CustomerBenefits.tsx`).
- Окно перенесено **ниже блока кнопок** (под CTA и «Закрыть») — порядок JSX в `DepartmentExperience.tsx`.
- Задержка появления **5 с → 10 с** (`REVEAL_DELAY_MS` 5000 → 10000).
- Тесты: unit `customer-benefits.test.tsx` (заголовок, 5000→10000, 4999→9999), `department-experience.test.tsx`
  (имя региона, 5000→10000); e2e `customer-benefits.spec.ts` (имя окна, `toBeVisible` 8000→13000,
  названия/комментарии 5→10 с). Доки `03/05/06/07/12`: заголовок и «10 секунд», позиция «ниже кнопок».

### Команды и результат
- `typecheck` exit 0; `lint` exit 0; `format:check` clean; `test` **183 passed**; `build` success
  (в составе e2e webServer); `test:e2e` **214 passed** (полный набор, production-сборка). e2e окна:
  reveal ~11 с (10 с + poll), reduced-motion сразу, повторный отсчёт при смене отдела 21 с (два по 10 с),
  нет прокрутки, CTA/«Закрыть» достижимы. Регрессий от переноса окна ниже кнопок нет (в т.ч. tab-order).

## Amendment 23 — сокращение объёма Этапа 3 (план-онли)

Статус: `APPROVED` (решения пользователя 2026-07-22). Изменение ПЛАНОВОЕ — production-код не затронут,
поэтому гейт кода/skeptic не применяется (нет диффа поведения для проверки).

### Правки
- `WORKPLAN.md`: добавлена секция «Amendment 23» (в milestone Этап 3); Steps 22/23/24/25 → `CANCELLED`;
  Step 26 ре-скоуп (OQ-3-D → D-a, Telegram, аналитика убрана); Steps 28/29 сокращены (без калькулятора,
  зависимости обновлены); блок «Порядок и параллелизм», гейты OQ-3-C/A/D, границы milestone, deliverable
  «copy» и текст закрытия milestone — приведены в соответствие.
- `docs/13`: пометка об исключении calculator/analytics из пилота. `docs/15`: пометка «ОТЛОЖЕНО».
- `DECISIONS.md`: запись решения.

### Итог: активные оставшиеся шаги Этапа 3
21 (графика сцены) → 26 (CTA→Telegram) · 27 (кадр ≥1584px) · 28 (ленивость) · 29 (a11y) → закрытие.
Сделано ранее: 19, 20 (+ окно «Ваша выгода», Amendment 21/22, в рабочем дереве, не закоммичено).

## Step 21 — ОТКАЧЕН (реализация не принята пользователем)

Первая реализация Step 21 (оверлей маршрутов сцены) была доведена до skeptic `PASS`, но пользователь
2026-07-22 не принял результат («полная ерунда») и распорядился откатить шаг. Все изменения Step 21
удалены/восстановлены из HEAD:
- удалены `src/components/graphics/{sceneRoutes.ts,SceneRouteOverlay.tsx,SceneRouteOverlay.module.css}`
  и тесты `scene-route-overlay.test.tsx`, `scene-routes.test.ts`, `scene-routes.spec.ts`;
- `git checkout HEAD` вернул `docs/02-art-direction.md`, `src/components/office/OfficeExperience.tsx` и
  `.module.css` (до Step 21 были без прочих изменений);
- `RouteMarker.*` (Step 14) не затронут; изменения Amendment 21/22/23 в рабочем дереве сохранены.

Step 21 снова `PROPOSED`. Подход к шагу пересматривается перед повторным стартом (решение — в
`DECISIONS.md` 2026-07-22).

## Step 20.5 — редизайн главной «хаос → офис»

Статус: `AWAITING_SKEPTIC`. По прямому запросу пользователя первый экран приведён к референсу без
изменения утверждённой бизнес-копии и без перестройки машины состояний hero → overview → department.

### Реализация

- Создан единый hero-композит на базе `references/office-overview/01-company-overview.png`: слева
  приглушённый процессный хаос, справа организованный офис, между ними мягкая дымка и тёплая
  диагональная световая граница. Исходник сохранён как
  `references/office-overview/02-hero-chaos-to-office.png`; добавлены оптимизированные AVIF/WebP
  варианты 960/1536 px.
- Добавлен `HeroOfficeVisual`: responsive `<picture>`, декоративные маршруты, проблемные подписи,
  статусы отделов и доступная кнопка входа в офис. Декоративные дубли скрыты от a11y-дерева.
- Hero собран в трёхчастную desktop-композицию: живая текущая копия слева, объединённый визуал в
  центре, текущие информационные карточки справа. На tablet/mobile блоки складываются вертикально.
- Обновлены Header, HeroCopy и HeroInfoPanel под референс. Слоган остаётся единственным и видимым в
  шапке во всех состояниях; заголовки hero-карточек — `h3`, чтобы `h2` оставался семантическим
  признаком открытого отдела. Scrollable-карточки доступны с клавиатуры.
- Поведение обеих CTA, возврат по логотипу, URL-синхронизация, focus-management, reduced-motion,
  обзор офиса и экраны отделов не менялись.

### Проверка

- `npm run format:check` — clean; `npm run lint` — exit 0; `npm run typecheck` — exit 0.
- `npm run test` — 23 файла, **191 passed**.
- `npm run build` — success. Turbopack вывел существующее для набора фото предупреждение о том, что
  AVIF отдаётся без собственной оптимизации; WebP fallback присутствует, сборка успешна.
- Критичный e2e-набор (`office-overview`, `desktop-10x90-shell`, `mobile-touch-flow`,
  `accessibility-scan`) — **64 passed**. Покрыты low-height desktop, 320px, keyboard/focus,
  reduced-motion, отсутствие горизонтального скролла и axe-проверки hero/overview/department.
- Визуальный review — 1680×900 и 390×844, включая прокрутку мобильного `<main>`. In-app Browser не
  запустился из-за ошибки окружения `missing field sandboxPolicy`; для того же браузерного контроля
  использован локальный Playwright screenshot против `127.0.0.1:3100`.

### Skeptic review

- Первый read-only review: `FAIL` — на 1280×500 переполненный HeroCopy центрировался выше начала
  `<main>`, поэтому верх `h1` заходил под шапку, хотя прежний тест проверял только `y >= 0`.
- Исправление: для desktop высотой ≤600px добавлена отдельная компактная ветка HeroCopy с
  `justify-content: flex-start`, уменьшенными отступами/типографикой и локальным overflow fallback.
  Проверка усилена до `heading.y >= main.y`.
- Геометрический probe после исправления: `<main>` y=86…500, `h1` y=96…182.31, внешняя CTA
  y=352.44…396.44, document scroll = 0. Повторный low-height e2e — 1 passed.
- Повторный skeptic review: **PASS**, blockers: нет. Non-blocking: обе CTA находятся в одной строке,
  при этом геометрический тест явно измеряет одну из них; вторая отдельно покрыта переходом в overview.

Итоговый статус Step 20.5: `COMPLETED`.

### Follow-up Step 20.5 — удаление подписей отделов

По прямому запросу пользователя из `HeroOfficeVisual` удалены пять декоративных плашек отделов:
`Поддержка`, `Продажи`, `Логистика`, `Дирекция`, `HR`. Вместе с JSX удалены prop `departments` и
неиспользуемые CSS-позиции/стили. Hero-композит, подписи хаоса, центральная кнопка и настоящие
интерактивные зоны overview не затронуты.

Проверка follow-up: `format:check`, `lint`, `typecheck` — clean; целевой production e2e входа в офис
— 1 passed. Визуальный review 1680×900 подтверждает отсутствие всех пяти плашек при неизменной
картинке и позиции центральной кнопки. Статус follow-up: `AWAITING_SKEPTIC`.

Skeptic follow-up: **PASS**, blockers/non-blocking findings отсутствуют. Подтверждено, что удалены
только декоративные подписи и их CSS/prop; `chaosNotes`, маршруты, центральная кнопка и настоящий
интерактивный overview сохранены. Итоговый статус follow-up: `COMPLETED`.

## Amendment 25 — ясный оффер автоматизации на главной

Статус: `COMPLETED` (skeptic round 2 `PASS`). Изменена только главная hero/header и связанные данные, стили, тесты и
документация; overview, экраны отделов, URL-sync и reducer не перестраивались.

### Реализация

- Точная категорийная подпись/H1/подзаголовок, четыре маркера результата, CTA и пояснение перенесены
  в `data/homepage-copy.json`; медным выделена только фраза «работала быстрее».
- Desktop hero: независимые колонки 39% / 40% / 21%; на <1200px порядок copy → visual → cards.
- Сохранён композит «хаос → офис»; на нём ровно три проблемные метки и доступная цепочка
  «Заявка → CRM → задача сотруднику → ответ клиенту» с reduced-motion веткой.
- Три тёмные карточки/исследования/проценты удалены с hero; правая колонка заменена двумя светлыми
  карточками без внутренних scrollbar.
- «Получить разбор процессов» и «Обсудить автоматизацию» используют существующий `contactHref`
  Telegram; «Посмотреть карту процессов» использует существующий `ACTIVATE_CTA`.
- Browser review нашёл на 768px потерю accessible name кнопки логотипа при скрытом тексте бренда;
  добавлен стабильный `aria-label="QBit-Studio-Ai"`, повторный e2e зелёный.

### Проверка

- `npm run format:check` — clean; `npm run lint` — exit 0; `npm run typecheck` — exit 0.
- `npm run test` — **24 файла, 191 passed**.
- `npm run build` — success; прежние предупреждения Turbopack об AVIF без собственной оптимизации
  сохранились, WebP fallback есть.
- Production e2e `homepage-offer` + `office-overview` — **30 passed**; `accessibility-scan` —
  **11 passed** (hero/overview/department на desktop/tablet/mobile).
- Playwright browser review: 1920×920 имеет document 1920×920 и 0 internal overflow в карточках;
  1440/1280/1024/768/390 — без horizontal scroll, на <1200px геометрически подтверждён порядок
  copy → visual → cards. Скриншоты проверены на 1920×920 и 390×844.
- In-app Browser bootstrap недоступен из-за ошибки окружения `missing field sandboxPolicy`; по
  инструкции browser skill использован локальный Playwright fallback против `127.0.0.1:3100`.
- Скриншоты browser review: `test-results/homepage-1920-final.png` и
  `test-results/homepage-390.png` (diagnostic artifacts, каталог игнорируется Git).

### Skeptic round 1 — `FAIL`

- Blocking: mobile визуально ставил маркеры раньше CTA; исправлено responsive order и добавлен e2e
  геометрии primary → secondary → markers.
- Blocking: `<picture sizes>` сохранил старые 76vw при новой колонке 40vw; исправлено на 40vw
  desktop / 90vw tablet / `100vw - 24px` mobile, чтобы 1920/DPR1 выбирал 960px, а не 1536px.
- Non-blocking: пути browser-review артефактов записаны выше. `h3` правых карточек сохранены:
  существующие jsdom-тесты используют отсутствие `h2` как структурный признак неоткрытого отдела,
  а CSS-скрытие hero в jsdom не применяется; это не WCAG/HTML-ошибка и не блокер skeptic.

Проверка после исправлений round 1: format clean; typecheck/lint exit 0; целевые unit **29 passed**;
production e2e `homepage-offer` **9 passed**. E2e и browser probe подтверждают primary → secondary →
markers на 390px и выбор `hero-chaos-office-960.avif` на 1920×920/DPR1; document/internal overflow не
изменились. Скриншоты round 2: `test-results/homepage-1920-round2.png`,
`test-results/homepage-390-round2.png`.

Skeptic round 2: **PASS**, blocking findings: нет. Non-blocking: H3 правых карточек допустим по
HTML/WCAG, но будущий рефакторинг может перевести их на H2 вместе с точечным scoping старых jsdom
проверок состояния отдела. После исправлений полный `npm run test` — **24 файла, 191 passed**.

## Amendment 26 — цельная многослойная hero-композиция

Статус: `COMPLETED`. Изменён только homepage hero/header, его copy, стили и проверки; state machine,
overview, экраны отделов, URL-sync, Telegram и обработчик `ACTIVATE_CTA` сохранены.

### Реализация

- Точная копия из ТЗ записана в `data/homepage-copy.json`: новый H1 с единственным медным акцентом
  «с помощью ИИ», новый подзаголовок, четыре коротких результата и CTA «Найти потери в своём отделе».
- Desktop hero переведён с 39/40/21 на 12-колоночную техническую сетку: image-cell проходит от второй
  линии почти до правого края, copy и info-card накладываются поверх него отдельными слоями.
- `picture` получает диагональные `mask-image`/`-webkit-mask-image`; тёплые radial/linear overlay дают
  fallback и локальную дымку. Слева зона перехода шире, справа уже; центральная сцена не размывается.
- Карточки получили разные ширину/смещение, полупрозрачный тёплый фон, blur 20px, тонкую границу и
  мягкую общую тень. На 1024px они частично перекрывают низ изображения; на ≤800px поток линейный.
- Три problem-marker интегрированы круглыми тёплыми плашками и линиями-привязками. Маршрут получил
  подпись «КАК РАБОТАЕТ АВТОМАТИЗАЦИЯ» и графитовый floating-контейнер поверх сцены.
- Motion: H1 поднимается на 10px, visual плавно проявляется, карточки/метки входят с задержкой, по
  маршруту за 6.4с проходит световая точка, CTA-анимация двигает только стрелку. Reduced-motion
  отключает все эти анимации; сильный параллакс не добавлялся.
- После расширения изображения desktop `sizes` изменён с 40vw на 92vw: 1920/DPR1 выбирает резкий
  `hero-chaos-office-1536`, tablet/mobile продолжают выбирать подходящую меньшую производную.

### Проверка

- Точечное форматирование изменённых файлов + `npm run format:check` — clean; `npm run lint` и
  `npm run typecheck` — exit 0.
- `npm run test` — **24 файла, 192 passed**.
- `npm run build` — success. Сохранились прежние предупреждения Turbopack о самостоятельной
  оптимизации AVIF; WebP fallback присутствует.
- Production e2e `homepage-offer` + `office-overview` + `accessibility-scan` — **42 passed**.
- Геометрия 1920/1440/1280: H1 по 3 строки; 1024/768 также 3 строки; 390 — 5 строк. На всех шести
  ширинах horizontal scroll отсутствует, у карточек нет internal overflow. Desktop 1920×920 имеет
  document 1920×920; карточки полностью лежат внутри image-bounds.
- Встроенный Browser не подключился из-за ошибки окружения `missing field sandboxPolicy`; по browser
  skill использован локальный Playwright fallback против `127.0.0.1:3100`.
- Итоговые viewport-снимки: `test-results/hero-redesign/final-1920x920.png`,
  `final-1440x900.png`, `final-1280x800.png`, `final-1024x768.png`, `final-768x1024.png`,
  `final-390x844.png`. Дополнительно сняты mobile visual/cards после прокрутки:
  `final-390x844-visual.png`, `final-390x844-cards.png`.

### Собственный skeptic-review по прямому ТЗ пользователя — `PASS`

- Изображение не выглядит вставленным прямоугольником: обе границы растворяются, copy и cards лежат
  поверх сцены; на mobile сложное перекрытие заменено на мягкую маску и скругление.
- Читаемость не потеряна: после первого visual-review две конфликтующие метки смещены с H1/value-
  marker к диагональному переходу; desktop H1 укладывается в 3 строки.
- Эффектов не слишком много: без неона, 3D, общего blur и параллакса; grain почти незаметен, motion
  последовательный и reduced-motion-safe.
- Композиция стала цельнее и дороже исходной: исчезли однотонные боковые колонки/вертикальные швы,
  уровни фото, текста, маркеров, маршрута и карточек различаются по глубине.
- Услуга считывается за 3–5 секунд из H1 «продажи, поддержка и документы … ИИ», двух карточек и
  видимой главной CTA. Blocking/non-blocking findings после исправлений: нет.

## Amendment 27 — облегчение и точечная полировка homepage hero

Статус: `AWAITING_SKEPTIC`. Scope ограничен homepage hero и связанными content/test-файлами;
Header, видимая copy, CTA, Telegram, reducer/`ACTIVATE_CTA`, overview и отделы не изменялись.

### Реализация

- `HeroOfficeVisual` теперь рендерит только адаптивный `<picture>` и декоративный scrim. Нижняя
  flow-панель и три problem-marker удалены из DOM; их CSS, анимации, props и поля
  `visualProblemPoints`/`visualProcessSteps` удалены из data/schema/types/tests.
- Левая вуаль ослаблена ориентировочно на 20%: основные alpha уменьшены `0.96 → 0.76`,
  `0.90 → 0.72`, `0.78 → 0.62`; локальный radial-overlay visual уменьшен `0.76 → 0.58`.
- Светло-размытый fade вокруг диагонали сужен: расширение copy-overlay `-10vw → -6vw`,
  прозрачный край `92% → 79%`, blur `2px → 1.5px`. Исходная диагональная линия и hero-растр
  сохранены.
- Карточки: фон `0.74/0.72 → 0.56/0.54`, blur `20px → 24px`, рамка alpha `0.18 → 0.12`,
  тень `54px/0.10 → 72px/0.07`; иконки `30px → 28px`, stroke `1.65 → 1.45`. Верхняя карточка
  сдвинута вправо, нижняя влево; на 1920px их `x` равен 1548 и 1468.
- Добавлен воспроизводимый capture-probe `scripts/capture-hero-polish.mjs`.

### Проверка

- Точечный `prettier --write` + `npm run format:check` — clean; `npm run lint` и
  `npm run typecheck` — exit 0.
- Целевые unit — **5 файлов, 34 passed**; полный `npm run test` — **24 файла, 191 passed**.
- `npm run build` — success; сохранились прежние предупреждения Turbopack об отсутствии собственной
  AVIF-оптимизации, WebP fallback присутствует.
- Первый production e2e-run (`homepage-offer`, `accessibility-scan`, `reduced-motion-and-fallback`,
  `office-overview`) — **47 passed / 2 failed**: все hero/overview-проверки прошли; один устаревший
  общий селектор ожидал 6 WebP до появления hero picture и исправлен scoping на rail + активную
  сцену; отдельный существующий mobile department contrast 3.41:1 в `MobilePainGainAccordion`
  остаётся вне scope Amendment 27.
- Повторный production e2e hero/hero-a11y/reduced-motion guard — **14 passed**. В первом run все
  проверки `office-overview` также прошли.
- Playwright visual probe: на 1920/1440/1280/1024/768/390 horizontal scroll отсутствует,
  `removedTextPresent=false`, hero image decoded, у карточек нет internal overflow. Secondary CTA
  открывает navigation «Отделы компании»; primary/header CTA сохраняют Telegram URL.
- Встроенный Browser не подключился из-за ошибки окружения `missing field sandboxPolicy`; после
  обязательного чтения browser skill использован локальный Playwright fallback против production
  `127.0.0.1:3200`.
- Итоговые viewport-снимки: `test-results/hero-polish/final-1920x920.png`,
  `final-1440x900.png`, `final-1280x800.png`, `final-1024x768.png`, `final-768x1024.png`,
  `final-390x844.png`. Дополнительно: `final-390x844-visual.png`,
  `final-390x844-cards.png`.

### Skeptic round 1 — `FAIL`

- Blocking: повторный Playwright e2e-run очистил `test-results`, поэтому перечисленные PNG не
  сохранились к моменту review и визуальная приёмка не имела проверяемых артефактов.
- Non-blocking: удаление flow/markers, численные изменения вуали/fade/blur/cards и scoping
  устаревшего WebP-теста признаны корректными. Mobile department contrast 3.41:1 подтверждён как
  реальный, но существующий вне scope дефект в неизменённом `MobilePainGainAccordion`.
- Fix: переснять все viewport PNG после завершения e2e и не запускать очищающий Playwright-run до
  повторного skeptic review.

После fix: capture-probe повторно завершён с exit 0; все 10 PNG присутствуют в
`test-results/hero-polish` (обязательные 6 viewport + mobile visual/cards + 2 диагностических full).
Размеры обязательных файлов — от 267 KB до 1.87 MB. После capture e2e не запускался; production
сервер остановлен по точному PID. Статус возвращён в `AWAITING_SKEPTIC`.

### Skeptic round 2 — `PASS`

- Blocking findings: нет.
- Визуально подтверждены отсутствие flow/markers, непроваленный низ hero, ослабленная дымка,
  более узкая мягкая диагональ и облегчённые/смещённые карточки на обязательных viewport PNG.
- Tablet/mobile сохраняют порядок copy → visual → cards без горизонтальной обрезки; copy/CTA/header,
  Telegram, `ACTIVATE_CTA`, overview/departments, reduced motion и отсутствие card overflow
  подтверждены кодом и проверками.
- Диагностические `*-full.png` совпадают с viewport из-за внутренней scroll-модели приложения, но
  не входят в обязательные шесть кадров; mobile visual/cards сохранены отдельно.
- Итоговый статус Amendment 27: `COMPLETED`.

## Amendment 28 — проектные сценарии и редакционный P.S. в homepage hero

Статус: `AWAITING_SKEPTIC`. Scope ограничен homepage hero, связанными content/schema/test-файлами
и точечным укреплением старых e2e-селекторов; state machine, Telegram-маршрут, overview и экраны
отделов не изменялись.

### Реализация

- Основной CTA изменён на «Получить бесплатный разбор процессов».
- Две правые карточки заменены одной семантической панелью «ПРОЕКТНЫЕ СЦЕНАРИИ» с тремя
  сценариями: контроль качества менеджеров (20–25 ч/мес), возврат упущенных продаж
  (до 700 000 ₽/мес потенциальной выручки), анализ полевой команды (до 75–80 ч/мес).
  Каждый сценарий явно маркирован как расчётный эффект/потенциал; отдельных карточек, иконок,
  графиков и dashboard-паттернов нет.
- Под панелью добавлен отдельный редакционный P.S. со ссылкой на существующий Telegram,
  доступным именем и `focus-visible`. На tablet/mobile порядок остаётся
  copy → visual → scenarios → P.S.
- Диагональ приглушена узким локальным multiply-overlay без расширения светового тумана.
  Header, H1, подзаголовок, четыре преимущества, офисный visual, secondary CTA и `ACTIVATE_CTA`
  сохранены.
- Content JSON, типы, runtime-schema, unit/e2e-контракты и продуктовая документация обновлены.
  Старые глобальные e2e-селекторы `picture` ограничены `[data-scene-crossfade]`, чтобы hero-picture
  не подменял измерения office-сцены.

### Проверка

- `npm run format:check`, `npm run lint`, `npm run typecheck` — exit 0.
- `npm run test` — **24 файла, 193 passed**.
- `npm run build` — success; остаются существующие предупреждения Turbopack о собственной
  AVIF-оптимизации, WebP-fallback присутствует.
- Целевой production e2e (`homepage-offer`, `office-overview`, `accessibility-scan`,
  `reduced-motion-and-fallback`) — **50 passed**.
- После укрепления scene-селекторов их отдельный regression-run — **53 passed**; полный
  `npm run test:e2e -- --reporter=dot` — **224 passed**.
- Production capture-probe на 1920×920, 1440×900, 1280×800, 1024×768, 768×1024 и 390×844:
  `scrollWidth === innerWidth`, internal overflow отсутствует, hero-image декодирована,
  `scenarioCount=3`, CLS=0, основной/header/P.S. CTA ведут в Telegram, secondary CTA —
  на `#office-map` и открывает навигацию отделов.
- Итоговые PNG сохранены в `test-results/hero-scenarios`: шесть обязательных viewport-кадров,
  отдельные scenario/P.S. состояния для tablet/mobile и мобильный visual. После capture e2e
  не запускался; production-сервер остановлен по проверенному PID.
- Встроенный Browser не стартовал из-за ошибки окружения `missing field sandboxPolicy`; после
  чтения browser skill выполнен локальный Playwright fallback против production
  `127.0.0.1:3200`.

### Самопроверка продукта

- За 3–5 секунд считываются услуга, бесплатный следующий шаг и три количественных ориентира.
- Числа не выдаются за гарантированные кейсы: панель названа примерами решений, а подписи —
  расчётным эффектом/потенциалом.
- На desktop панель занимает только правую часть сцены и не перекрывает её целиком; на
  tablet/mobile сценарии идут после visual без горизонтальной обрезки.
- P.S. остаётся отдельной редакционной строкой, а не четвёртой карточкой или кнопкой.

### Skeptic round 1 — `FAIL`

- Blocking: на 390px локальные `order` ставили CTA перед преимуществами, хотя мобильный порядок
  по ТЗ требует подзаголовок → четыре преимущества → основной CTA → вторичный CTA. Старый e2e
  ошибочно закреплял обратный порядок.
- Non-blocking: количественное ослабление диагонали не имеет сравнительного pixel-probe;
  P.S. на широких desktop смещён левее панели ради одной строки; capture-метрики записаны в
  WORKLOG, но не отдельным JSON. Визуальная и функциональная приёмка этих пунктов пройдена.
- Plan amendment не нужен: исправление находится внутри утверждённого scope.

После fix:

- На `max-width: 600px` восстановлен порядок `.valuePoints` (4) → `.ctaRow` (5) →
  `.ctaNote` (6); отступ перенесён под преимущества.
- E2E теперь проверяет нижнюю границу последнего преимущества относительно primary CTA и
  порядок primary → secondary, то есть защищает весь требуемый mobile reading order.
- `npm run typecheck` — exit 0; targeted unit — **2 файла, 11 passed**; `homepage-offer` e2e —
  **11 passed**.
- После e2e заново выполнен production capture-probe; все шесть viewport снова имеют
  `scrollWidth === innerWidth`, internal overflow отсутствует, CLS=0, ссылки и три сценария
  корректны. Обновлённый `final-390x844.png` визуально подтверждает порядок
  преимущества → CTA → note → visual.
- После capture тесты не запускались; production-сервер остановлен по проверенному PID.

### Skeptic round 2 — `PASS`

- Оба прежних blocking-пункта закрыты: CSS, e2e и production PNG подтверждают полный порядок
  преимущества → primary CTA → secondary CTA.
- Blocking findings, unmet acceptance criteria и required corrections: нет.
- Non-blocking: нет отдельного сравнительного pixel-probe точных 10–15% диагонали и отдельного
  JSON-артефакта capture-метрик; визуальная и функциональная приёмка подтверждены.
- Итоговый статус Amendment 28: `COMPLETED`.

## Amendment 29 — облегчение редакционного P.S. и приглушение диагонали

- `HeroInfoPanel.tsx`/CSS: P.S. остаётся одной Telegram-ссылкой с прежними текстом и aria-label;
  периметральная рамка, фоновая полоса, backdrop blur, фиксированная высота и круглая кнопка удалены.
  Акцентная линия реализована `::before`, стрелка `→` встроена в конец текста; hover двигает стрелку
  на 4px и удлиняет линию, focus/active сохранены, reduced motion снимает оба transform.
- Desktop P.S. получает мягкое эллиптическое локальное осветление через `::after`, светлый
  text-shadow и смещение вниз 22–30px, чтобы строка уверенно читалась и проходила ниже лиц; у
  осветления нет прямоугольной границы, рамки или box-shadow. На ≤1199px светлый фон потока делает
  осветление ненужным, поэтому смещение, псевдоэлемент и text-shadow сняты.
- `HeroOfficeVisual.module.css`: stops/геометрия/ширина диагонали не менялись; альфы узкого
  multiply-overlay увеличены с `0.12/0.20/0.09` до `0.128/0.213/0.096` (+6.5% к локальному
  затемнению), поэтому воспринимаемая яркость встроенного свечения снижена без новой дымки.
- Панель сценариев, её DOM/CSS/copy, данные, Header, H1, преимущества, CTA, Telegram,
  `ACTIVATE_CTA`, visual-растр, overview и отделы не изменялись в Amendment 29.
- `npm run format:check`, `npm run lint`, `npm run typecheck` — exit 0; `npm run test` —
  **24 файла, 193 passed**; `npm run build` — success с прежними предупреждениями Turbopack об AVIF.
- Целевой production e2e (`homepage-offer`, `accessibility-scan`, `reduced-motion-and-fallback`,
  `office-overview`) — **51 passed**. P.S.-контракт проверяет прозрачный фон, отсутствие рамки/тени,
  CSS-линию, inline-стрелку, hover/focus и отсутствие движения при reduced motion.
- Production capture-probe на 1920×920, 1440×900, 1280×800, 1024×768, 768×1024 и 390×844:
  `scrollWidth === innerWidth`, internal overflow отсутствует, CLS=0, `scenarioCount=3`, image
  decoded, commercial/P.S. CTA ведут в Telegram, secondary CTA открывает навигацию отделов.
  Итоговые PNG сохранены в `test-results/hero-postscript`.
- Встроенный Browser не подключился из-за ошибки окружения `missing field sandboxPolicy`; после
  чтения browser skill визуальная проверка и capture выполнены локальным Playwright против
  production `127.0.0.1:3200`. Production-сервер остановлен по проверенному PID.
- Skeptic round 1: `FAIL` — text-shadow без локального осветления был недостаточен на тёмном фото.
  После fix повторные desktop PNG подтверждают читаемую строку ниже лиц; final format/lint/typecheck/
  build и **51 targeted e2e passed**, production capture-probe снова без overflow/CLS.
- Skeptic round 2: `PASS`; blocking findings и required corrections отсутствуют. На 1280px
  осветление близко к верхней границе допустимого локального эффекта, но остаётся мягким и не
  образует карточку/баннер. Итоговый статус Amendment 29: `COMPLETED`.

## Amendment 30 / Step 30.1 — единый Header и телефон

- Final skeptic confirmation: `PASS`; blocking/non-blocking findings: none.
- Status: `COMPLETED`.
- `Header.tsx`/CSS: общий компонент показывает `tel:+79375346575` с видимым номером и точным
  aria-label, сохраняет state-machine кнопку логотипа на homepage и использует semantic `Link` на
  внутренних страницах; desktop nav содержит 5 пунктов в заданном порядке.
- Mobile ≤900px: телефон остаётся видимым; disclosure-menu имеет `aria-expanded`/`aria-controls`,
  touch targets ≥44px, Escape закрывает меню и возвращает focus; horizontal overflow проверяется.
- `data/homepage-copy.json`, schema/types и `docs/04`: старый Header Telegram CTA удалён,
  `contactHref` Telegram коммерческих CTA не изменён; добавлены `/contacts` и `/login`.
- `npx prettier --write <touched files>` — exit 0.
- `npm run format:check` — exit 0.
- `npm run lint` — exit 0 после удаления единственного warning в новом unit-тесте.
- `npm run typecheck` — exit 0.
- Targeted unit: 3 files, 32 passed.
- Targeted production e2e (`homepage-offer`, `office-overview-redesign`) — 17 passed; production
  build внутри Playwright webServer успешен с прежними Turbopack AVIF warnings.
- `ui-ux-pro-max`: выполнены обязательный design-system query для calm/premium B2B automation,
  UX query для responsive navigation и Next.js stack query. Рекомендации применены к семантическим
  `Link`, touch targets, focus/overflow и shared App Router layout; предложенные синие цвета/новые
  шрифты отклонены в пользу действующих проектных токенов и art direction.
- Skeptic round 1: `FAIL` — DOM-порядок mobile disclosure ставил nav до trigger; `#`-ссылка могла
  закрыть меню с focus в скрытом элементе; не хватало task-state и manual viewport evidence.
- После исправлений DOM-порядок — brand → phone → trigger → nav; placeholder-ссылки сохраняют
  disclosure открытым, Escape возвращает focus на trigger, task-state добавлен в e2e.
- Повторные `lint`/`typecheck` — exit 0; targeted unit — **3 файла, 33 passed**.
- После исправления только тестового локатора mobile trigger повторный production-run
  `office-overview-redesign.spec.ts` — **6 passed**; build успешен с прежними предупреждениями
  Turbopack об AVIF.
- Production manual probe: на 1024×768 телефон 150.8×44 px, desktop nav видим; на 768×1024
  телефон 142.9×44 px, на 390×844 — 129.6×44 px. На обоих mobile viewport первый Tab после
  trigger попадает в «Как мы работаем», Escape возвращает focus на «Открыть меню», все пять
  nav targets имеют высоту 44 px, `scrollWidth === innerWidth`.
- В промежуточной сборке console фиксирует два ожидаемых 404 от prefetch ещё не созданных
  `/contacts` и `/login`; маршруты входят в Step 30.3. PNG сохранены в `artifacts/step30-header/`
  для 1024×768, 768×1024 и 390×844.
- Визуальная проверка выявила неоднозначный знак disclosure вместо ясного крестика; геометрия
  трёх линий переведена на абсолютное центрирование без изменения target 44×44 px.
- Skeptic round 2: `PASS`; blocking findings и required corrections отсутствуют. Step 30.1
  завершён, Step 30.2 переведён в `IN_PROGRESS`.

## Amendment 30 / Step 30.2 — единая control row и крупный overview

- Status: `AWAITING_SKEPTIC`.
- `OfficeExperience`: отдельные action/instruction rows объединены в один блок с DOM-порядком
  `← На главную` → `Выберите отдел` → `Получить бесплатный разбор`; запрещённый
  `instructionHint` удалён из data/schema/types/DOM. Центральная инструкция не имеет background,
  border или box-shadow, маленький медный маркер сохранён.
- Desktop-сетка overview изменена только распределением свободного места:
  `1fr / 3fr / 1fr` и gap `18–42px` → `0.86fr / 3.7fr / 0.86fr` с floor 180px и gap `14–28px`.
  Пропорция сцены остаётся 3:2.
- Production before/after высота сцены:
  - 1920×920: 679.3 → **731.0px**, +51.7px / **+7.6%**;
  - 1440×900: 532.6 → **613.8px**, +81.2px / **+15.2%**;
  - 1280×800: 471.3 → **543.2px**, +71.9px / **+15.3%**;
  - 1024×768, 768×1024 и 390×844 остаются width-limited и сохраняют 650.7/480/238.7px без
    изменения пропорции или crop.
- На 1920×920, 1440×900 и 1280×800 у document, `.office`, `.stageRow`, `.officeCenter` и обеих
  story columns overflow равен 0; все пять зон целиком внутри сцены. На 1920×920 сцена занимает
  доступный бюджет до нижнего padding: y=165, h=731, bottom=896 при viewport 920 и padding 24.
- Основной side copy смешан на 10% в сторону `graphite-700`: вычисленный цвет ≈ `#6b6155`,
  контраст на surface растёт с 5.29:1 до **5.62:1** (+6.2%), AA сохраняется. Заголовки не менялись.
- Before/after SHA-256 совпадают для `data/office-zones.json`, `DepartmentHotspot.tsx`/CSS,
  `OfficeSemanticMap.tsx`/CSS и `SceneCrossfade.tsx`/CSS. Блоки `stagePhoto`, edge mask,
  `object-fit`, координаты, corner markers и motion не редактировались.
- Targeted unit — **3 файла, 42 passed**; `typecheck`, `lint`, `format:check` — exit 0.
  Targeted production e2e после корректировки допуска только half-pixel rounding — **8 passed**;
  build успешен с прежними предупреждениями Turbopack об AVIF.
- `scripts/probe-amendment-30.mjs` сохраняет воспроизводимые метрики и PNG. Актуальные кадры шести
  заданных viewport и hover «Продажи» находятся в `artifacts/office-overview/`, точные значения —
  в `amendment-30-metrics.json`. Временные 404 на desktop/1024 относятся только к prefetch
  `/contacts` и `/login`; Step 30.3 создаёт эти маршруты.
- Визуальная проверка 1920/1440/1280/768/390 подтверждает: офис стал главным объектом, истории не
  обрезаны, инструкция спокойная и центрирована, mobile reading order и office carousel сохранены.
- Skeptic round 1: `FAIL` — на 390px инструкция занимала правую ячейку первой строки и была
  смещена относительно центра сцены; desktop и остальные AC подтверждены.
- После fix на ≤600px control group использует три компактные полноширинные области в том же
  DOM/визуальном порядке: return → instruction → CTA. Инструкция имеет `justify-self:center`;
  390×844 e2e сравнивает её горизонтальный центр одновременно с control group и сценой (допуск
  1px), а также проверяет вертикальный reading order.
- Повторный production e2e — **8 passed**. Обновлённый 390×844: control group y=84, h=124px,
  сцена y=220, h=238.7px; horizontal overflow отсутствует, пять зон целиком внутри сцены.
  PNG переснят и визуально подтверждает центральную ось инструкции.
- Skeptic round 2: `PASS`; blocking findings и required corrections отсутствуют. Step 30.2
  завершён, Step 30.3 переведён в `IN_PROGRESS`.

## Amendment 30 / Step 30.3 — `/contacts`, `/login` и финальная приёмка

- Status: `COMPLETED`.
- Добавлен общий `src/app/(public)/layout.tsx`, который использует тот же `Header`, data-contract
  телефона и `heroLinks`, что homepage state machine. Разметка Header не дублируется.
- `/contacts`: точные `h1`/текст из ТЗ, два рабочих semantic link (`tel:+79375346575` и прежний
  `https://t.me/Promt_Pavel`), `← На главную`; выдуманные адрес/email/режим работы отсутствуют.
- `/login`: точные `h1`/текст и `← На главную`; form/input/password/auth/API/admin-link отсутствуют.
- Обе страницы имеют точные title `… — QBit-Studio-Ai`, metadata `robots: noindex, nofollow`,
  статически пререндерятся, используют проектные токены, адаптивный редакционный layout и один h1.
- `public-routes.spec.ts`: `200`, exact copy/title/noindex, общий Header/nav/phone, no «Админ»,
  destinations, отсутствие form/mailto, mobile 44px links/route navigation/no overflow и axe для
  обеих страниц. Targeted production e2e — **7 passed**.
- `capture-public-pages.mjs`: contacts/login 1440×900 и 390×844 плюс открытое mobile menu.
  Четыре capture имеют status 200, точные titles, `scrollWidth === clientWidth` и 0 console/page
  errors. Визуально заглушки читаются как фирменные editorial pages, не как системная ошибка;
  phone остаётся спокойным outline и не конкурирует с контентом.
- Финальные overview captures заново сняты после появления маршрутов: 6 viewport, 0 console errors,
  0 desktop document scroll, все пять зон `insideStage=true`; актуальные JSON/PNG находятся в
  `artifacts/office-overview/`.
- `npm run format` — выполнен, все matched files unchanged; финальные `format:check`, `lint`,
  `typecheck` — exit 0.
- Полный unit: **24 файла, 198 passed**.
- Отдельный `npm run build` — success; `/contacts` и `/login` показаны как static routes. Сохраняются
  прежние предупреждения Turbopack о собственной AVIF-оптимизации; WebP fallback и production
  отрисовка изображений подтверждены.
- Первый полный e2e дал 239/240 из-за старого direct-URL task-теста, отправлявшего Escape до
  hydration window-listener; другие проверки того же Escape прошли. Тест стабилизирован ожиданием
  React client handlers без изменения production logic; targeted task spec — **10 passed**.
- Итоговый полный production `npm run test:e2e -- --reporter=line` — **240 passed** за 1.5 min,
  включая все пять отделов, возврат, Telegram, tel, оба маршрута, mobile menu, reduced motion и
  desktop/tablet/mobile axe.
- Финальная UI/UX + B2B-проверка по `allqbit-art-direction`, `allqbit-product-ux`,
  `ui-ux-pro-max`, `frontend-quality` и `browser-qa`: офис доминирует, control group не перегружен,
  телефон вторичен главному CTA, side copy читается лучше, заглушки честны и без новых обещаний.
  Production server после captures остановлен по проверенному PID.
- Обязательный независимый skeptic review Step 30.3 / Amendment 30 — **PASS**, blocking findings и
  required corrections отсутствуют. Подтверждены exact copy/routes, общий Header, доступность,
  отсутствие overflow, сохранность пяти зон и записанные unit/build/e2e gates.

## 2026-07-23 — Amendment 31 / Step 31: premium one-screen departments

- Для арт-дирекшна использован проектный skill `.claude/skills/ui-ux-pro-max`: сохранена исходная
  композиция, увеличена плотность, унифицированы лёгкие полупрозрачные поверхности, bronze
  active/focus и transform/opacity motion без нового макета.
- `BeforeAfterSequence` снят с рабочего экрана отдела; центральная «Закрыть» удалена. Возврат
  «← Назад к офису» расположен над rail и использует прежний route/state-machine close path.
- Добавлен обобщаемый `CustomerBenefits`: место зарезервировано, результат появляется через 10 с,
  заголовок/основной текст/две ключевые фразы входят последовательно, CTA — последней через 760 мс.
  Оба timeout очищаются; `key` отдела перезапускает состояние. Reduced motion показывает полный
  результат сразу.
- Решение печатается адаптивно не дольше ~1.9 с. Rail и карточки уплотнены, активная миниатюра
  получает `scale(1.03)` за 200 мс, crossfade сцены — 800 мс и `scale(1.015) → 1`.
- Все пять сцен отделов прогреваются одной responsive AVIF-производной с `fetchPriority="low"` в
  idle-окне; PNG-оригиналы не запрашиваются. Основной `<picture>` сохраняет WebP fallback.
- Расширенная матрица 5 отделов × 4 desktop viewport поймала overflow длинных выгод Поддержки и
  Дирекции. Исправлено фиксированной CTA-колонкой, двухколоночными highlights и low-height слотом
  120 px. Итог: document/internal overflow отсутствует на 1366×768, 1440×900, 1763×864,
  1920×1080; контроль 1763×864 — document `864/864`, experience `734/734`, console errors `[]`.
- Проверены все пять отделов и все pain→solution пары при переключении через rail в одной сессии.
  Network preload, 10-секундный reset, CTA-last, keyboard, mobile/tablet, reduced motion и
  accessibility входят в production e2e.
- Gates: scoped Prettier — PASS; `npm run typecheck` — PASS; `npm run lint` — PASS;
  `npm run test` — **23 files / 195 passed**; `npm run test:e2e -- --workers=1` —
  **245 passed**. Production build выполняется самим Playwright webServer. Сохраняются 20 известных
  предупреждений Turbopack о собственной AVIF-оптимизации; браузер получает готовые AVIF/WebP.
- Skeptic round 1: `FAIL` — не было stagger ключевых фраз, preload сцен, +3% active thumbnail,
  `docs/07` описывал старый экран. Все четыре blocker-а исправлены.
- Skeptic round 2: **PASS**; blocking findings и required corrections отсутствуют. Неблокирующий
  hardening на будущее: отдельный preload WebP для клиентов без AVIF и retry idle-preload.
- Финальный production capture:
  `artifacts/departments-final-1763x864.png`. Визуальная проверка подтверждает заметный фон,
  компактные поверхности, целые result/CTA и отсутствие обрезки.

## 2026-07-23 — Amendment 32 / Step 32: старт

- Status: `IN_PROGRESS`.
- До правок применены проектный `.claude/skills/ui-ux-pro-max` и установленный
  `frontend-design`: композиция и типографическая иерархия признаны рабочими; блокирующие визуальные
  дефекты — однотонные тяжёлые поверхности, статичный не привязанный к строке коннектор, отсутствие
  входящего отклика решения и несинхронная с ним печать. Планируемые правки ограничены файлами Step 32.
- Baseline: `artifacts/amendment-32/baseline-1763x864.png`; document `1763×864`, selected pain
  `x=293.09 y=267.75 w=607.34 h=49.25`, solution `x=937.44 y=231.75 w=422.23 h=279.5`,
  panel `x=280.09 y=231.75 w=1079.58 h=279.5`.
- Контрольные SHA-256 до правок:
  - `data/departments.json` — `caf146e9a10e87e684b3f1501f959de61770a0f91d0367e87872787d8e50aefa`;
  - `data/homepage-copy.json` — `0529c47f387f4cb73947267e7923ef836bfee7c1fc3219c646bf57c7bec046ad`;
  - `Header.tsx` — `3ba9d1bae036d8408056aa92306342d7d08279f4fecfa799ea57ab3a91dd0384`;
  - `Header.module.css` — `b98323fe2ab10548d3ff3313ec514cc8e1dcd851eafbb06b2b2ad3c0c12b275e`;
  - `departmentPhotos.ts` — `85e3ea624ac80f401bd86e5c2a85975b9e4949e3118fd96785b92e3d69fc73bc`;
  - `reducer.ts` — `84d4592f73ffb0444bf9439e0b20fc0d5afb08bacd74a790bb900fb2f0eaf066`;
  - `url-sync.ts` — `d33d1edb3f9e6ad81d224af737b8c135c1258658e8bf763825615fa6cd1d6b5d`.

## 2026-07-23 — Amendment 32 / Step 32: реализация и локальная проверка

- Status: `AWAITING_SKEPTIC`.
- Визуальная полировка ограничена экраном активного отдела: унифицированы тёплые полупрозрачные
  поверхности и локальные scrim-слои; rail/back/pain/result/CTA получили более ясные состояния без
  изменения текущей одноэкранной композиции.
- Статичный коннектор заменён одним измеряемым SVG-импульсом от реальной строки боли к карточке
  решения. Запуск имеет монотонный id, отменяет предыдущие таймеры/observer, пересчитывает путь при
  resize и синхронизирует входящий отклик/печать. Повторный клик по текущей боли — no-op;
  `prefers-reduced-motion` показывает итог сразу без импульса и печати.
- Post-implementation designer critique (`ui-ux-pro-max` + `frontend-design`): блокирующих находок
  нет. Поверхности стали легче и последовательнее; фотография остаётся главным фоновым слоем;
  rail/pain активны не только цветом; движение короткое и пространственно понятное; result разделён
  на результат/highlights/CTA, CTA остаётся первичным действием; новой визуальной перегрузки нет.
- Артефакты:
  - final: `artifacts/departments-amendment-32-1763x864.png`;
  - impulse: `artifacts/amendment-32/impulse-1763x864.png`;
  - baseline: `artifacts/amendment-32/baseline-1763x864.png`.
- Проверки:
  - focused Playwright: `33 passed` — 5 отделов, все pain→solution переходы, rapid/repeat/resize,
    rail indicator, reduced motion, 4 desktop viewport и отсутствие page/internal scroll;
  - `npm run format:check` — PASS;
  - `npm run lint` — PASS (0 warnings);
  - `npm run typecheck` — PASS;
  - `npm run test` — `23 files / 196 tests passed`;
  - `npm run build` — PASS; сохранены 20 известных предупреждений Turbopack об AVIF;
  - `npm run test:e2e -- --workers=1` — `249 passed`;
  - `git diff --check` — PASS.
- Контрольные SHA-256 после реализации совпадают с baseline для `data/departments.json`,
  `data/homepage-copy.json`, homepage `Header.tsx/.module.css`, `departmentPhotos.ts`, `reducer.ts`
  и `url-sync.ts`.
- Production DOM на контрольном снимке: document `1763×864`, stage `1763×782` при `y=82`, photo
  `x=24 y=106 w=1715 h=734`; document/internal overflow и console/page errors отсутствуют.

## 2026-07-23 — Amendment 32 / Step 32: skeptic round 1

- Verdict: `FAIL`.
- Blocker 1: SVG получал новый `runId` как prop, но без React `key`, поэтому CSS/SMIL timeline мог
  не перезапуститься при новом выборе до cleanup предыдущего узла.
- Fix: `PainSolutionImpulse` теперь keyed по `geometry.runId`; e2e сохраняет старый element handle,
  подтверждает его detach и проверяет, что timeline нового узла начинается с начала.
- Blocker 2: border arrival анимировал `box-shadow`, что нарушало критерий transform/opacity-only.
- Fix: статическая тонкая рамка перенесена на `::after`; её одноразовый arrival меняет только
  `opacity` и `transform`, как и radial wave.
- Post-fix verification: `format:check`, `lint`, `typecheck`, `23/196` unit tests, production build,
  `git diff --check` — PASS; focused production Playwright `9/9` — PASS, включая явную проверку
  remount/reset последнего impulse-run.
- Status: `AWAITING_SKEPTIC` (round 2).

## 2026-07-24 — Amendment 34 / Step 34: завершение

- Skeptic round 2: `PASS`; blocking findings: none.
- Final status: `COMPLETED`.
- Non-blocking follow-up: устаревшие комментарии/опциональные типы
  `beforeSteps`/`automationSteps` можно удалить отдельной cleanup-задачей; текущий UI и данные их не
  используют.

## 2026-07-23 — Amendment 32 / Step 32: завершение

- Skeptic round 2: `PASS`; blocking findings: none.
- Локальный reduced-motion selector дополнительно синхронизирован с новым `::after`; после cleanup
  `format:check`, `lint`, `typecheck`, `git diff --check` и production reduced-motion e2e — PASS.
- Final status: `COMPLETED`.

## 2026-07-24 — Amendment 33 / Step 33: старт

- Status: `IN_PROGRESS`.
- Designer before (`ui-ux-pro-max` + `frontend-design`): поверхности выглядят слишком равными;
  highlights нижнего блока имеют 12px/16.2px и уступают по читаемости; «Ваша задача» имеет 44px
  target, но визуально почти не отличается от обычной rail-строки и не имеет directional affordance.
- Scope ограничен четырьмя CSS Modules и scoped e2e; TSX/data/Header/photo/state/motion не меняются.
- Baseline screenshot: `artifacts/amendment-33/baseline-1763x864.png`.
- Baseline matrix: `artifacts/amendment-33/baseline-matrix.json`, 20/20 cases, console/page errors
  `[]`, document/internal overflow `[]`; at 1366×768 result is 120px, highlights 12px/16.2px,
  primary 14px/19.6px, task 166.52×44px and `::after` content is `none`.
- Protected SHA-256 baseline recorded for `data/departments.json`, `data/homepage-copy.json`,
  homepage Header, `departmentPhotos.ts`, reducer/url-sync, rail TSX, CustomerBenefits TSX,
  PainGainPanel/TypedText/PainSolutionImpulse sources and DepartmentCTA TSX.

## 2026-07-24 — Amendment 33 / Step 33: реализация и проверка

- Status: `AWAITING_SKEPTIC`.
- Изменены только четыре CSS Modules: copy светлее; pain нейтральнее; gain слегка теплее; result
  глубже; primary/highlights подняты с 14/12px до 15/13px; неактивная «Ваша задача» получила
  контур, CSS-стрелку и hover/focus без сдвига собственного бокса.
- Final screenshot: `artifacts/departments-amendment-33-1763x864.png`.
- Final matrix: `artifacts/amendment-33/final-matrix.json`; 20/20 cases, geometry violations `[]`,
  overflow cases `[]`, console/page errors `[]`; result остался 120/132px, task 44px, arrow hover
  shift 2px, task box delta 0.
- Designer after (`ui-ux-pro-max` + `frontend-design`): иерархия поверхностей читается яснее без
  смены палитры; нижний блок быстрее сканируется; task affordance заметен, но слабее active state;
  перегрузки и потери фотографии нет; one-window сохранён.
- Checks: `format:check`, `lint`, `typecheck`, `git diff --check` — PASS; unit `196/196`; build —
  PASS с 20 известными AVIF warnings; focused production e2e `34/34`; full production e2e
  `250/250`.
- Все protected SHA-256 после реализации совпали с baseline; тексты, Header, фото, TSX, state/URL и
  motion byte-identical.

## 2026-07-24 — Amendment 33 / Step 33: skeptic и завершение

- Skeptic round 1: `FAIL` — текстовая CSS-стрелка попадала в accessible name кнопки как
  `«Ваша задача →»`.
- Fix: стрелка сохранена визуально, но теперь рисуется пустым `::after` (`content: ""`,
  `14×8px`, `background + clip-path`); DOM/TSX и видимый текст не менялись. Scoped e2e проверяет
  точное accessible name `«Ваша задача»`, геометрию стрелки и hover-shift 2px.
- Post-fix production probe: exact accessible-name count `1`, snapshot `button "Ваша задача"`,
  task height 44px, document/client `1763×864`, console/page errors `[]`; финальный скриншот обновлён.
- Post-fix checks: `format:check`, `lint`, `typecheck`, `git diff --check`, unit `196/196`, build и
  focused production e2e `1/1` — PASS; все protected hashes по-прежнему совпадают.
- Skeptic round 2: `PASS`; blocking findings: none. Final status: `COMPLETED`.

## 2026-07-24 — Amendment 34 / Step 34: реализация и проверка

- Status: `AWAITING_SKEPTIC`.
- `data/departments.json`: порядок `support → sales → logistics → hr → executive`; перенесены
  5 headline, 5 subtitle, 25 пар pain/gain, 5 support-only `howItWorks`, 5 основных и
  15 дополнительных результатов; прежние `beforeSteps`/`automationSteps` удалены.
- Автоматическая повторная выборка из вложения: `SOURCE_MATCH` (`5 departments / 25 scenarios /
  5 howItWorks / 20 results`).
- Общая модель/схема: `PainPoint.howItWorks?`; обязательные 4 `customerBenefits`; схема фиксирует
  порядок отделов. Desktop/mobile показывают `Как работает` только при наличии; result показывает
  основной и все три дополнительных результата.
- CTA labels/href, фотографии, rail/back, state/URL, импульс, typing, 10-секундный reveal и
  reduced-motion не изменены.
- По фактическому overflow-прогону уплотнена только внутренняя responsive-типографика headline,
  solution/how-it-works и result; структура/размеры основных блоков не менялись.
- Browser matrix: все 25 сценариев × 4 viewport (`1366×768`, `1440×900`, `1763×864`,
  `1920×1080`) — document/internal overflow `[]`, gain/result clipping `[]`, CTA в кадре.
- Visual QA: `artifacts/amendment34-support-1366.png`,
  `artifacts/amendment34-executive-1763.png`; композиция и фон сохранены, полный текст читается.
- Checks: `format:check`, `lint`, `typecheck`, `git diff --check` — PASS; unit `200/200`; build —
  PASS с 20 известными AVIF warnings.
- Targeted production e2e: `16` исходных сценариев — `14/16`, затем оба исправленных `2/2`;
  overflow/25-state/typing/impulse/reduced-motion/result/CTA проверки зелёные.
- Full production e2e: `249/250`; единственное падение — устаревший тест открывал явный
  `?department=sales`, но после требуемой смены порядка ожидал `departments[0]` (`support`).
  Ожидание привязано к явному `sales`; повторный production e2e этого теста `1/1` — PASS.

## 2026-07-24 — Amendment 34 / Step 34: skeptic round 1

- Verdict: `FAIL`.
- Blocker 1: после правки устаревшего ожидания не был повторён полный e2e на финальном дереве.
- Fix/evidence: `npm run test:e2e -- --workers=1` повторён без последующих правок реализации или
  тестов — `250/250 PASS`.
- Blocker 2: не было browser evidence для длинного контента на mobile.
- Fix/evidence: browser matrix `5 departments × 5 scenarios × 2 viewports` (`375×812`,
  `390×844`) — `MOBILE_50_STATES_ACCESSIBLE_AT_375_AND_390`; каждый expanded gain содержит полный
  исходный solution и условный `howItWorks`, gain не имеет собственного overflow/clipping,
  horizontal document overflow отсутствует, все четыре результата и CTA достижимы в существующем
  mobile-flow.
- Mobile screenshots: `artifacts/amendment34-support-mobile-390.png`,
  `artifacts/amendment34-support-mobile-result-390.png`.
- Non-blocking: комментарии/типы `beforeSteps`/`automationSteps` всё ещё описывают прежний sales
  pilot; runtime и Amendment 34 это не затрагивает, отдельная cleanup-задача допустима позже.
- Status: `AWAITING_SKEPTIC` (round 2).

## 2026-07-24 — Amendment 35 / Step 35: старт

- Status: `IN_PROGRESS`.
- Найдена причина: `data-content-active` одновременно запускал обе CSS-заставки, появление терминала
  и JS-печать; поэтому текст печатался поверх последовательности логотипов.
- Scope: только тайминги сцены «Анализ», focused tests и журналы.

## 2026-07-24 — Amendment 35 / Step 35: реализация и проверка

- `HowWeWorkPage.tsx`: общий boot duration `5200ms`; terminal handoff после ухода QBit на 72%
  (`3744ms`); JS-печать ждёт тот же handoff; текущие character/backspace-интервалы умножены на
  `0.9`.
- `HowWeWorkPage.module.css`: длительности Windows/QBit используют общий CSS custom property;
  терминал скрыт до общего handoff.
- Unit: focused `1/1 PASS`; полный набор `24 files, 201/201 PASS`.
- `typecheck`, `git diff --check`, production `build` — PASS; build сохранил 20 известных AVIF
  warnings.
- `lint` — два существовавших до Amendment 35 нарушения в `HowWeWorkPage.tsx`
  (`react-hooks/set-state-in-effect` строка 230 и `<a href="/">` строка 590); новых lint findings
  нет.
- Production Chromium e2e `how-we-work-analysis.spec.ts`: `1/1 PASS`; измерен порядок появления
  Windows → QBit → первый символ, opacity QBit при первом символе `< 0.05`.
- In-app browser connection был недоступен из-за ошибки окружения; визуально-временная проверка
  выполнена тем же Chromium через локальный production Playwright.
- Status: `AWAITING_SKEPTIC`.

## 2026-07-24 — Amendment 35 / Step 35: skeptic и завершение

- Verdict: `PASS`; blocking findings: none.
- Non-blocking: отдельные assertions для typo/backspace, повторного входа и reduced-motion не
  добавлены; reviewer подтвердил эти ветки чтением реализации. Два lint findings — baseline.
- Status: `COMPLETED`.

## 2026-07-24 — Amendment 36 / Step 36: старт

- Status: `IN_PROGRESS`.
- Текущий список: «Как мы работаем», «О нас», «Блог», «Контакты», «Вход»; «Главная» отсутствует.
- Принято соответствие: «О нас» → `/how-we-work`; «Главная» → `/` + homepage callback;
  «Стоимость»/«Блог»/«FAQ»/«Контакты» → безопасные заглушки; «Вход» → `/login`.

## 2026-07-24 — Amendment 36 / Step 36: реализация и проверка

- `data/homepage-copy.json`: установлен точный порядок семи пунктов и требуемые href.
- `Header.tsx`: рабочая «Главная» закрывает mobile menu; на homepage предотвращает same-route
  переход и вызывает `onReturnHome`, на внутренних страницах остаётся обычным App Router Link.
- `docs/04-homepage-copy.md` синхронизирован с новым контрактом.
- Unit focused: `14/14 PASS`; full unit: `24 files, 203/203 PASS`.
- `typecheck`, scoped Prettier, `git diff --check` — PASS.
- `lint`: только два ранее документированных baseline findings в `HowWeWorkPage.tsx`; Header новых
  findings не добавил.
- Production Chromium e2e: основной файл `9/10`, единственное падение — неоднозначный тестовый
  `locator("header")`; после замены на семантический `getByRole("banner")` исправленный сценарий
  `1/1 PASS`. Функциональный переход «Главная», семь mobile-пунктов и остальные 9 сценариев прошли
  в первом прогоне.
- Production build выполнялся обоими e2e-прогонами: PASS с 20 известными AVIF warnings.
- Измерения шапки на `901`, `1024`, `1180`, `1440`: `scrollWidth <= clientWidth`.
- Status: `AWAITING_SKEPTIC`.

## 2026-07-24 — Amendment 36 / Step 36: skeptic и завершение

- Verdict: `PASS`; blocking findings: none.
- Non-blocking: interaction assertion напрямую кликает одну из четырёх заглушек; общий
  `link.href === "#"` branch и data-contract одинаковы для всех четырёх. Два lint findings —
  baseline вне Amendment 36.
- Status: `COMPLETED`.

## 2026-07-24 — Amendment 37 / Step 37: старт

- Status: `IN_PROGRESS`.
- Scope: только подпись «Стоимость» → «Продукт и Стоимость», документация и проверки.

## 2026-07-24 — Amendment 37 / Step 37: реализация и проверка

- Подпись заменена в `heroLinks`, документации и header unit fixture; `href="#"` сохранён.
- Header unit: `10/10 PASS`.
- Production Chromium: mobile seven-link menu + desktop overflow matrix `2/2 PASS`; build PASS с
  20 известными AVIF warnings.
- Status: `AWAITING_SKEPTIC`.

## 2026-07-24 — Amendment 37 / Step 37: skeptic и завершение

- Verdict: `PASS`; blocking findings: none.
- Non-blocking: исторические записи Amendment 36 сохраняют прежнюю подпись и явно переопределены
  Amendment 37.
- Status: `COMPLETED`.

## 2026-07-25 — Amendment 40 / Step 40: продукты, URL, контент и индексация

- `src/features/products/products.ts`: единая конфигурация 10 продуктов; сохранены hotspot и
  product-01…10, добавлены точные тексты, цены, slug, layout и SEO.
- `ProductInformation.tsx` + `ProductsExperience.module.css`: четыре доступных desktop-состояния,
  один H1, общий раскрываемый P.S., индивидуальная сторона панели; mobile показывает все разделы
  последовательно и прокручивает контент.
- `/products` и 10 `/products/{slug}` статически сгенерированы; 10 старых `product-XX` адресов
  получают permanent redirect из той же конфигурации.
- Metadata: unique title/description/canonical/Open Graph; JSON-LD ItemList на обзоре и
  BreadcrumbList/Service/Offer/Organization на продуктах; sitemap включает 10 продуктов.
- Ручная Chromium-матрица `artifacts/products-verification.json`: 10/10 status 200, по одному H1,
  active menu/photo/title/price/canonical/schema совпадают; panel inside viewport, overflow false,
  console/page errors `[]`. Скриншоты: `artifacts/products-pages-contact-sheet.png`,
  `product-10-overview-desktop.png`, `product-10-mobile-top.png`.
- Раскрытый P.S.: `product-10-price-formats-expanded.png`; geometry `inside=true`, document
  overflow false.
- Проверки: `format:check`, scoped lint, `typecheck`, unit `209/209`, build, product production e2e
  `12/12`, full production e2e `265/265`, `git diff --check` — PASS. Full lint сохраняет только два
  известных baseline finding в `HowWeWorkPage.tsx`.
- Skeptic 1 (config/text/routes): `PASS`; исправлены дубли slug редиректов и minimum price.
- Skeptic 2 (UI/SEO/adaptive): `PASS`; дополнены проверки всех 10 redirect, OG/schema, sitemap,
  mobile semantics и раскрытого P.S.
- Status: `AWAITING_SKEPTIC`.
## 2026-07-25 — Amendment 42 / Step 42: старт

- Status: `IN_PROGRESS`.
- Git baseline: branch `master`, HEAD `fcdb611`; рабочее дерево уже содержит изменения предыдущих
  задач, включая untracked продуктовый слой.
- Единый источник данных: `src/features/products/products.ts`; SEO builder:
  `src/features/products/productSeo.ts`.
- Границы: Блог, FAQ, Контакты, `href="#"`, `/contacts`, цены, URL, фото и зоны не изменяются.

## 2026-07-25 — Amendment 42 / Step 42: реализация и проверка

- `/products`: добавлены видимые eyebrow, единственный H1 и описание внутри существующей строки
  управления; 1440/1024/768/390 без горизонтального overflow, на desktop без page-scroll и без
  пересечения кнопок.
- `products.ts`: заменены только 10 `summary`; title-бренд унифицирован, цены/применение/примеры/
  выгоды/slugs/layout не изменены.
- `productSeo.ts`: продукты 1–9 дают по три Offer, продукт 10 — один; верхнеуровневого `price` нет,
  сумма передаётся как `PriceSpecification.minPrice`, валюта `RUB`, поддержка описана отдельно.
- `ProductInformation.tsx`: серверная разметка больше не содержит постоянный `hidden`; без JS видны
  Обзор/Примеры/Стоимость/Выгода, с `html.js` сохранены вкладки и клавиатурное управление.
- Бренд унифицирован в глобальных/product/how-we-work metadata, Organization, product titles,
  видимом терминале и тексте заявки; домен `allqbit.ru` сохранён. Остаточный `Allqbit` найден только
  в техническом комментарии `src/styles/tokens.css:2`.
- Checks: scoped ESLint PASS; `typecheck` PASS; focused unit `9/9` PASS; production build PASS с 20
  известными AVIF warnings; product production Chromium `17/17` PASS; `git diff --check` PASS.
- Global `format:check`: единственная находка — прежний untracked
  `artifacts/products-page/new-product-metrics.json`; все файлы Amendment 42 прошли Prettier.
- Full scoped lint с `HowWeWorkPage.tsx`: только два ранее документированных baseline finding
  (`react-hooks/set-state-in-effect`, `@next/next/no-html-link-for-pages`); продуктовый lint чистый.
- Status: `AWAITING_SKEPTIC`.

## 2026-07-25 — Amendment 42 / Step 42: skeptic round 1 и исправление

- Verdict: `FAIL`; blocking finding: no-JS fallback раскрывал первый раздел, но не показывал
  отдельный видимый заголовок «Обзор».
- Исправление: добавлен один fallback-only H2 «Обзор»; при `html.js` он скрыт CSS, обычный дизайн
  вкладок не изменён, атрибут `hidden` не используется.
- Проверки после исправления: `typecheck` PASS; no-JS + keyboard tabs production Chromium `2/2`
  PASS; `git diff --check` PASS.
- Skeptic round 2: `PASS`; blocking findings: none.
- Status: `COMPLETED`.

## 2026-07-26 — Раздел FAQ: визуальный каркас `/faq`

- Созданы `src/app/faq/page.tsx`, `src/features/faq/FaqExperience.{tsx,module.css}`,
  `src/tests/e2e/faq-experience.spec.ts`; фон `public/faq/*` (webp/avif из присланного PNG через
  существующий `sharp`, новых зависимостей нет).
- Геометрия доски измерена по пикселям исходника (1672×941; доска x 359…1317, y 98…666) и повторена
  в CSS через cover-математику на `cqw/cqh`; e2e проверяет совпадение рамки с расчётом <2px.
- Аккордеон — нативный `<details name="faq">` без клиентского JS: эксклюзивность даёт браузер, весь
  текст лежит в SSG-HTML. Известная деградация: Safari <17.2 / Firefox <130 допускают несколько
  открытых ответов; контент при этом не теряется.
- Skeptic round 1: `FAIL` — на узко-высоких вьюпортах ≥901px панель уезжала за края и была
  недостижима из-за `overflow: hidden` (1024×1366 → x = −148). Исправлено переходом в обычный поток
  вне окна пропорций 1.2…2.33; добавлен e2e на 7 таких вьюпортов. Skeptic round 2: `PASS`.
- Ссылка «FAQ» в общей навигации сделана рабочей: `data/homepage-copy.json` (`#` → `/faq`) и
  `src/app/blog/layout.tsx` (пункт убран из `inactiveLinkLabels`). Пункт «Контакты» не трогали.
- Checks: scoped Prettier/ESLint PASS; `typecheck` PASS; `test` 219/219 PASS; production build PASS;
  FAQ e2e 8/8 PASS (axe 360 и 1440 — 0 serious/critical).

## 2026-07-26 — Раздел FAQ: наполнение утверждённым содержанием

- Создан `src/features/faq/faqData.ts` (14 утверждённых Q&A) взамен удалённого `faqDraftData.ts`;
  создан `src/features/faq/faqSeo.ts` — единый источник `FAQ_URL` для canonical и sitemap.
- Ответ хранится как массив абзацев из сегментов (`string | {text, href}`) — это позволило вставить
  6 внутренних ссылок внутрь предложений без HTML-строк и `dangerouslySetInnerHTML`.
- `page.tsx`: metadata (title, description, canonical `https://allqbit.ru/faq`, OG, Twitter,
  `index/follow`); черновые флаги и TODO удалены. `sitemap.ts`: добавлен `/faq`. `robots.txt` не
  менялся — существующий `Allow: /` уже открывает раздел, OAI-SearchBot не блокируется.
- Отклонение от ТЗ (обосновано, подтверждено скептиком): ссылки на анализ звонков и на обработку
  документов поставлены в ответы 01 и 07, а не 10/13 и 11 — в утверждённых текстах 10, 11 и 13 нет
  ни одной подходящей фразы, а править утверждённый текст запрещено.
- CSS: только стиль ссылок, интервал между абзацами, `overflow-wrap` для длинных вопросов и сжатие
  вертикальных отступов на десктопе ради высоты списка (163 → 194 px на 1366×768, 187 → 221 px на
  1440×900). Типографика, сетка, цвета, положение и размеры доски не менялись.
- Checks: scoped Prettier/ESLint PASS; `typecheck` PASS; `test` 219/219 PASS; production build PASS;
  FAQ e2e 11/11 PASS (axe 360 и 1440 — 0 serious/critical); полный e2e 289 passed / 1 failed —
  `pain-gain-layout.spec.ts` (расхождение 1.85px, падал стабильно до этой задачи, код не пересекается).
- Skeptic, проверка содержания: `PASS`. Skeptic, проверка реализации: `PASS`; блокирующих находок
  нет, пиксельный diff со скриншотами предыдущего шага локализован строго внутри доски.
- Status: `COMPLETED`.

## 2026-07-26 — Раздел FAQ: кросс-браузерный аккордеон и подскролл

- Создан `src/features/faq/FaqAccordion.tsx` — единственный клиентский код раздела. Контент он не
  рендерит: разметка приходит с сервера через `children`, компонент возвращает тот же
  `<div class=list>` и в `useEffect` вешает ОДИН слушатель `toggle` в фазе перехвата (`toggle` не
  всплывает, но capture проходит через предков).
- Эксклюзивность больше не зависит от поддержки `<details name>`: при открытии контроллер закрывает
  остальные `details[open]`. Атрибут `name` сохранён как no-JS fallback для браузеров, которые его
  понимают. Защита от зацикливания — ранний выход по `!item.open`.
- Подскролл: rAF сразу + повтор через 320 ms (после CSS-перехода 280 ms, когда высота окончательна).
  Ветка выбирается по фактическому `overflow-y` списка: на доске прокручивается только внутренний
  список (`window.scrollY` остаётся 0), в мобильном потоке — документ и только если элемент не виден.
  При `prefers-reduced-motion` поведение прокрутки — `auto` вместо `smooth`.
- `FaqExperience.tsx`: `<div class=list>` заменён на `<FaqAccordion>`, обновлён док-комментарий.
  CSS, тексты, ссылки, metadata, canonical, sitemap, robots НЕ менялись.
- Пиксельный diff состояния покоя `artifacts/faq-accordion/before` vs `after` на 360×800, 768×1024,
  1366×768, 1440×900, 1920×1080 — 0 отличающихся субпикселей, max delta 0. Скептик пересчитал
  независимо и получил тот же результат.
- Checks: scoped Prettier/ESLint PASS; `typecheck` PASS; `test` 219/219 PASS; production build PASS
  (`/faq` остаётся статическим); FAQ e2e 16/16 PASS (axe 360 и 1440 — 0 serious/critical); консоль
  без ошибок и hydration-предупреждений.
- Полный e2e нестабилен вне зоны FAQ: `pain-gain-layout.spec.ts` падает в разных прогонах разным
  числом тестов (1–5), `how-we-work-analysis.spec.ts` — флейк. Оба спека к FAQ не относятся, код не
  пересекается.
- Skeptic: `PASS`, блокирующих находок нет. Попутно исправлены три неблокирующих замечания
  (эта запись, комментарий про `isSyncing`, связь `REVEAL_SETTLE_MS` с CSS).
- Status: `COMPLETED`.

## 2026-07-26 — Правки по итогам SEO/GEO-аудита FAQ: Header, logo.svg, ответы 04/13/14

- `data/homepage-copy.json`: пункт меню «Контакты» переведён с `href="#"` на `/contacts` — маршрут
  существует, собран как статический и отдаёт 200. Текст, порядок пунктов и стили Header не менялись.
  Проверено на `/`, `/faq`, `/products`, `/how-we-work`, `/contacts`, `/login`: `a[href="#"]` = 0.
- `/blog` НЕ затронут намеренно: его layout передаёт `inactiveLinkLabels={["Контакты"]}`, поэтому
  пункт там остаётся `span[aria-disabled]`. Это отдельное решение страницы блога, вне границ задачи.
- Ветка `link.href === "#"` в `Header.tsx` стала недостижимой (реальных данных с "#" больше нет).
  Код не тронут — `Header.tsx` вне разрешённых к правке файлов; удаление предложено отдельно.
- `public/logo.svg`: 162 445 → 81 519 B (−49.8 %). Причина исходного веса — файл не вектор: это
  SVG-обёртка вокруг встроенного base64-PNG 2490×1779 RGBA (121 612 B, +33 % от base64). Растр
  содержит ровно 17 уникальных RGBA-значений — чистый чёрный на 17 уровнях альфы, — поэтому он
  перекодирован в индексный PNG (PLTE + tRNS, 17 записей, bitDepth 8, filter None, zlib level 9)
  средствами встроенного `node:zlib`. Новых зависимостей нет.
- Перекодирование ЛОССЛЕСС: обратное декодирование даёт 0 отличающихся байт raw RGBA. Пиксельный
  diff отрисовки в Chromium @2x на светлом и тёмном фоне для размеров Header 48px и 42px,
  HowWeWork 144px, боксов 128×128 и 512×512 и натурального 598×427 — 0 отличающихся субпикселей,
  max delta 0. `viewBox`, `transform="scale(.24)"`, размеры `<image>` и intrinsic 2490×1779
  сохранены; убраны только XML-декларация и метаданные Illustrator (`id`, `data-name`).
- Отдельный favicon НЕ создавался: условие из задания («если из-за favicon нельзя безопасно
  уменьшить основной файл») не выполнилось — файл уменьшен вдвое без потерь независимо от этого,
  а `src/app/favicon.ico` в проекте уже есть. `layout.tsx` не тронут.
- `faqData.ts`: переписаны первый абзац ответа 04, оба абзаца 13 и оба абзаца 14 — строго по
  утверждённым в задании формулировкам. Вопросы, порядок 14 пунктов, остальные ответы и все шесть
  внутренних ссылок не менялись; ссылка на `/blog/sayt-crm-i-messendzhery` осталась внутри первого
  абзаца 04. Все шесть новых абзацев совпадают с заданием посимвольно в серверном HTML.
- `FAQ_PUBLISHED_AT` уже равен `2026-07-26` — дате выполнения задачи; правка не потребовалась,
  новая константа не создавалась. В sitemap `<lastmod>2026-07-26</lastmod>`, `/faq` ровно один раз.
- Metadata, canonical, title, description, robots.txt, structured data (0 блоков JSON-LD),
  CSS и разметка FAQ не менялись — подтверждено сверкой отданного HTML.
- Тесты: +2 unit (реальные данные меню: «Контакты» → `/contacts`, нет "#"; Header рендерит пункт
  как фокусируемую ссылку), +2 e2e в `public-routes.spec.ts` (общий Header на шести маршрутах,
  переход по Enter на `/contacts`; вес и геометрия `logo.svg`), +1 e2e в `faq-experience.spec.ts`
  (первые абзацы 04/13/14, сохранённая ссылка, показатели 13, условия поддержки 14, отсутствие
  формулировок обязательности) и проверка `lastmod` = `FAQ_PUBLISHED_AT`.
- `office-overview-redesign.spec.ts` перенацелен: его блок проверял Enter по заглушке `href="#"`,
  премисса исчезла вместе с заглушкой. Теперь проверяется достижимость «Контакты» через Tab и её
  href; сценарий навигации закреплён в `public-routes.spec.ts`. Остальные проверки не тронуты.
- Checks: scoped Prettier PASS; scoped ESLint PASS; `typecheck` PASS; `test` 221/221 PASS;
  production build PASS (`/faq` остаётся `○ Static`); FAQ + public-routes e2e 26/26 PASS
  (axe 360/768/1440 — 0 нарушений всех уровней); визуальная проверка на 360×800, 390×844, 768×1024,
  1366×768, 1440×900, 1920×1080 — overflowX = 0, 14 вопросов без обрезки, автопрокрутка работает,
  CTA достижим, консоль и сеть без ошибок.
- Полный e2e: 297 passed / 1 failed. Падает `pain-gain-layout.spec.ts:245` — расхождение 1.15 px в
  `toBeCloseTo`, спек падал так же ДО этой задачи, к FAQ/Header/логотипу не относится. Скептик в
  своём прогоне получил 298 passed / 0 failed: спек — флейк под полной параллельностью, не регрессия.
- Skeptic: `PASS`, блокирующих находок нет. Неблокирующая находка «тест логотипа фиксирует только
  вес, лоссовая перекодировка прошла бы его» исправлена сразу: тест разбирает IHDR встроенного PNG и
  требует 2490×1779, bitDepth 8 и colourType 3 (индексный) — уменьшение растра или уход в лоссовый
  формат теперь падает. Остальные неблокирующие находки лежат вне границ задачи (см. ниже).
- Вне границ задачи, требует отдельного решения: (a) `src/app/blog/layout.tsx:15` держит
  `inactiveLinkLabels={["Контакты"]}`, из-за чего на `/blog` пункт остаётся `span[aria-disabled]`;
  (b) ветка `link.href === "#"` в `Header.tsx:100-112` стала мёртвой и удаляется вместе с фикстурой
  в `header.test.tsx`; (c) `npm run format:check` красный из-за двух untracked-файлов от 25.07
  (`artifacts/products-page/new-product-metrics.json`, `reports/blog-seo-geo-audit.md`).
- Status: `COMPLETED`.

## 2026-07-26 — Страница `/contacts`: переговорная, прямые контакты, форма заявки → n8n

- Маршрут перенесён: `src/app/(public)/contacts/page.tsx` удалён, создан `src/app/contacts/page.tsx`.
  URL не изменился, второго маршрута нет. Причина: layout группы `(public)` — светлая центрированная
  оболочка, общая с `/login`, в неё полноэкранная фотосцена не помещается, а `/login` трогать нельзя.
  Схема повторяет `/faq`: страница держит собственный shell с общим `Header`.
- Создано: `src/features/contacts/{ContactsExperience.tsx, ContactsExperience.module.css,
  ContactForm.tsx, contactData.ts, contactSchema.ts, contactsSeo.ts}`, `src/app/api/contact/route.ts`,
  `src/tests/unit/features/contacts/{contact-schema,contact-route}.test.ts`,
  `src/tests/e2e/contacts-experience.spec.ts`, `scripts/capture-contacts-page.mjs`.
- Изменено: `src/app/sitemap.ts` (+`/contacts`), `Header.tsx` (+необязательный проп `activeHref` →
  `aria-current="page"`), `Header.module.css` (+правило `a[aria-current="page"]`), `.env.example`,
  `README.md`, `src/tests/e2e/public-routes.spec.ts` (сняты ожидания прежней заглушки `/contacts`).
- Фон: из `public/contacts/contacts-meeting-room-background.png` (1672×941) сгенерированы
  720/1080/1672 в AVIF и WebP теми же параметрами кодеков, что и остальной фотослой (WebP q80/e6,
  AVIF q50/e6), sharp уже был в devDependencies — новых пакетов не ставилось. Сеть: на 1440×900
  грузится только `-1672.avif` (68 КБ), на 390×844 — только `-720.avif` (18 КБ), PNG не
  запрашивается, CLS = 0.
- Геометрия раскладки выведена измерением исходника: телевизор занимает x 688…972, y 225…388
  (41…58 % / 24…41 % кадра). Сетка `auto / 1fr / auto` отдаёт свободное место середине кадра;
  замер на восьми размерах: верхняя кромка панели ниже нижней кромки телевизора везде (запас
  от 14 px на 1024×768 до 115 px на 1440×900).
- Контраст верхнего блока измерен по ХУДШЕМУ (самому светлому) пикселю фона под каждой строкой на
  восьми размерах. Первый замер: подзаголовок на 1440×900 — 2.70:1, ниже AA. Исправлено локально:
  к эллипсу добавлен горизонтальный слой скрима с маской вертикального растворения краёв, у вводного
  абзаца снята полупрозрачность (`rgba(238,232,223,0.87)` → `#e9e3da`). Итог: минимум по всем
  строкам и размерам 5.90:1 (1920×1080), максимум 13.43:1. Фотография целиком не темнеет и не
  размывается.
- Форма: одна схема `contactSchema.ts` на клиент и сервер. Телефон и Telegram по отдельности
  необязательны, одновременно пустыми быть не могут (issue по пути `contact`). Телефон
  нормализуется к `+<цифры>` (ведущая 8 в 11-значном номере → `+7`), Telegram — к `@username`,
  полная ссылка отвергается с понятным текстом. Ошибки — только после submit или blur, `aria-invalid`
  + `aria-describedby`, фокус на первое ошибочное поле.
- Роут `POST /api/contact`: Content-Type, лимит тела 16 КБ (по заголовку и по факту), honeypot
  `company` и слишком быстрая отправка отбрасываются молча (200, без вызова n8n), повторная
  валидация схемой, 503 без `N8N_CONTACT_WEBHOOK_URL`, `AbortSignal.timeout(9000)`, секрет в
  заголовке `X-QBit-Webhook-Secret`, повторов нет, в журнал уходят только статус и `submissionId`.
  Payload: `submissionId` (`crypto.randomUUID`), `source`, `page`, `name`, `phone|null`,
  `telegram|null`, `process`, `submittedAt` — honeypot и `elapsedMs` в n8n не уходят.
- `elapsedMs` приходит от клиента и в коде прямо назван отсевом примитивных скриптов, а не защитой.
  Полноценный rate limit — на reverse proxy, хостинге или внутри n8n; в приложении он не заводился
  намеренно (несколько инстансов сделали бы in-memory счётчик фикцией).
- Checks: `typecheck` PASS; `test` 251/251 PASS (29 файлов, +30 новых); production build PASS
  (`/contacts` — `○ Static`, `/api/contact` — `ƒ`); `contacts-experience` + `public-routes` 39/39
  PASS, `contacts-experience --repeat-each=2` 66/66 PASS (Axe на 1440×900 и 390×844, в обычном
  состоянии и с показанными ошибками — 0 serious/critical); scoped ESLint и Prettier PASS.
- Полный e2e: 327 passed / 1 failed — `pain-gain-layout.spec.ts:245`, расхождение 1.41 px в
  `toBeCloseTo` на странице отдела. Тот же спек падал так же до этой задачи (см. запись от
  2026-07-26 по итогам SEO/GEO-аудита FAQ). Проверено, что новое правило Header к нему не
  относится: элементы с `aria-current` вне `/contacts` есть только в рельсе отдела, списке продуктов
  и меню блога, ни один не лежит внутри `nav#site-navigation`, поэтому селектор
  `.navigation a[aria-current="page"]` не совпадает нигде, кроме `/contacts`.
- `npm run format:check` красный по-прежнему из-за тех же двух untracked-файлов от 25.07
  (`artifacts/products-page/new-product-metrics.json`, `reports/blog-seo-geo-audit.md`) — вне границ
  задачи, не трогались.
- Страницы политики обработки персональных данных в проекте нет — текст согласия под кнопкой НЕ
  добавлялся и фиктивная ссылка не создавалась. Вопрос вынесен перед публикацией формы.
- Скриншоты: `artifacts/contacts-page/` — `idle-*` на восьми размерах, `focus/validation-error/
  sending/success/error-*` на 1440×900 и 390×844.
- Skeptic: прогон оборван лимитом сессии до вердикта. Критическая проверка проведена своими
  измерениями (контраст, геометрия панели относительно телевизора, сеть, отсутствие `aria-current`
  на других страницах); вердикт скептика по этой задаче НЕ получен.

## 2026-07-26 — Step 42: раздел «Документы»

- Создано: `src/app/documents/{layout.tsx,page.tsx,DocumentsLayout.module.css}`;
  `src/features/documents/{documents.ts,useDocuments.ts,DocumentsExperience.tsx,DocumentsList.tsx,
  DocumentPreview.tsx,DocumentMeta.tsx,DocumentIcons.tsx,DocumentsExperience.module.css}`;
  `scripts/generate-documents-assets.mjs`; `src/tests/unit/features/documents/{documents.test.ts,
  documents-experience.test.tsx}`; `src/tests/e2e/documents-experience.spec.ts`;
  ассеты `public/dox/{dox-960,dox-1600}.{webp,avif}`, `public/dox/previews/*.svg` (3),
  `public/dox/files/*` (7 образцов).
- Изменено: `data/homepage-copy.json` (+«Документы» → `/documents` после «Продукт и Стоимость»),
  `src/app/sitemap.ts` (+`/documents`), `package.json` (+`assets:documents`),
  `docs/04-homepage-copy.md` (навигация), `WORKPLAN.md` (Amendment 42).
- Данные: `documentFixtures` — 8 записей, из них одна `isPublished: false` (не попадает в каталог).
  Набор намеренно неоднородный: длинное название, запись без описания/размера/даты, форматы с
  предпросмотром (PDF → SVG-страница, PNG → сам файл) и без него (XLSX, DOCX, TXT → заглушка).
- Файлы в `public/dox/files/` — валидные, но пустые ОБРАЗЦЫ, порождаемые скриптом: PDF собирается
  вручную (xref-смещения считаются), DOCX/XLSX — минимальный OOXML в zip методом «stored» (свой
  писатель, без новой зависимости), PNG растрируется из SVG через уже имеющийся sharp.
  Проверено: `unzip -t` — OK для обоих OOXML; смещения xref PDF указывают на `N 0 obj`.
- Фон: `object-fit: cover`, `object-position: 50% 58%`, без `filter` и без blur изображения.
  Скрим — два градиента (горизонтальный 0.62→0.22 и слабый вертикальный). Правая колонка светлеет
  в средней полосе (0.80→0.34→0.78 по вертикали): подписи «Устав QBit», «Документы Павла», «Архив
  компаний-партнёров», «Реализованные проекты QBit», «Проекты автоматизации в работе» остаются
  читаемыми через панель. `backdrop-filter: blur(2px)`.
- Предпросмотр: лист держит пропорции верхних ~60% A4; изображение вставляется `width:100%,
  height:auto` (без искажений), низ обрезается контейнером и уходит в градиент. Горизонтальные
  файлы (слайд 1280×720) распознаются по `naturalWidth/naturalHeight` в `onLoad` и показываются
  целиком — иначе им срезало бы края. Пропорция «предпросмотр : метаданные» = 3:2 (замер в e2e:
  доля 0,5…0,68 от панели); на мобильном информационная зона берёт естественную высоту.
- Смена документа: 130 мс уход (`translateY` + прозрачность) → 220 мс появление нового, итого
  ~350 мс; при `prefers-reduced-motion` таймер обнуляется. Каскад появления: панели 90/170 мс,
  строки 200…480 мс — весь интерфейс появляется менее чем за 0,8 с.
- Checks: `typecheck` PASS; `lint` — 0 новых замечаний (остались две унаследованные ошибки в
  `HowWeWorkPage.tsx`); `test` 272/272 PASS (31 файл, +21 новый); `build` PASS (`/documents` —
  `○ Static`); `documents-experience.spec.ts` 13/13 PASS; полный `test:e2e` 340 passed / 1 failed.
- Единственное падение полного e2e — `pain-gain-layout.spec.ts:245` (расхождение 2 px в
  `toBeCloseTo`). Проверено прямым экспериментом: спек падает так же при удалённом пункте
  «Документы» из `heroLinks`, то есть к этой задаче не относится (то же падение записано
  в журнале от 2026-07-26 по задаче «Контакты»).
- `npm run format:check` красный по-прежнему из-за трёх унаследованных файлов
  (`artifacts/products-page/new-product-metrics.json`, `reports/blog-seo-geo-audit.md`,
  `src/features/contacts/ContactsExperience.module.css`) — вне границ задачи, не трогались.
  Все новые файлы отформатированы Prettier.
- Браузерная приёмка (production build, порт 3200): 1920×1080, 1440×900, 1280×800, 1024×768,
  768×1024, 390×844, 360×740 — горизонтальной и вертикальной прокрутки документа нет ни на одном;
  console errors 0; axe 0 serious/critical на десктопе и мобильном.
- Skeptic: не вызывался — пользователь потребовал реализацию сразу после анализа, без
  промежуточного плана. Формально это отступление от протокола CLAUDE.md §3.5.

## 2026-07-27 — Предрелизный аудит безопасности и технический аудит

- Область: весь репозиторий, не diff. Ветка `master`, коммит на старте `fcdb611`. Коммиты не
  создавались, `git reset/clean/checkout` не запускались, `var/content.db` не изменялась
  (сверено по размеру и метке времени до и после).
- `/security-review` (встроенный) НЕ работает в этом репозитории: команда строит `git diff
  origin/HEAD...`, а remote отсутствует и ветка одна. Официальный файл Anthropic
  (`anthropics/claude-code-security-review`) загружен — он такой же diff-ориентированный.
  Попытка подставить базу из пустого дерева отклонена git («no merge base»); временный ref
  удалён сразу. Итог: `.claude/commands/security-review.md` — проектный вариант с критериями
  Anthropic и областью «весь рабочий каталог»; регламент исполнен двумя независимыми аудиторами
  + ручная перепроверка на живой production-сборке.
- `/code-review` НЕ запускался — ограничение сессии («You've hit your session limit»). Пункт
  задания остался невыполненным, зафиксирован в TECHNICAL_AUDIT.md §10.
- Найдено: Critical 0, High 2, Medium 2, Low 3, Informational 2. Исправлены все High и Medium,
  2 из 3 Low, 1 из 2 Informational. Открыты осознанно: SEC-07 (снятие с публикации не отзывает
  файл), SEC-09 (`pageContentSchema` без структуры).
- Исправления: `src/lib/jsonLd.ts` (экранирование JSON-LD, закрыт stored XSS);
  `src/server/net/{clientAddress,publicRateLimit}.ts` + `src/server/auth/{rateLimit,constants}.ts`
  (доверие X-Forwarded-For только при `TRUST_PROXY=1`, последний элемент цепочки);
  `next.config.ts` (CSP, HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy,
  `poweredByHeader:false`, `no-store` для админ-путей); `src/middleware.ts` (проверка Origin для
  мутирующих `/api/admin/*`); `src/app/api/contact/route.ts` (лимита не было вовсе);
  `src/app/robots.ts`; `.env.example` (`TRUST_PROXY`); `.prettierignore` (отчёты аудита).
- Два дефекта внесены самими исправлениями и найдены на ревью: (1) общий счётчик попыток входа
  применялся и к известному адресу — давал бессрочный lockout владельца ~7 запросами в минуту;
  (2) базовая CSP из `next.config.ts` перекрывала `sandbox; default-src 'none'` на `/api/files`.
  Оба устранены и проверены на живом сервере.
- Checks: `typecheck` PASS; `test` 301/301 PASS (34 файла, +28 к 273 на старте); `build` PASS;
  `prettier --check .` — те же 2 унаследованных файла, что и до аудита; `lint` — те же 2
  унаследованные ошибки в `HowWeWorkPage.tsx`, не трогались.
- E2E нестабильны: между тремя прогонами состав падений 1 → 2 → 3, `how-we-work-analysis:3` и
  `pain-gain-layout:351` то падают, то проходят. Устойчиво падает только `pain-gain-layout:245`
  — то же падение записано в журнале от 2026-07-26 и 2026-07-27 по задачам «Контакты» и
  «Документы», то есть предсуществующее. Следствие: набор сейчас не позволяет отличить
  регрессию от случайного падения — вынесено в PRE_RELEASE_CHECKLIST.md §B.
- Живая проверка production-сборки: заголовки подтверждены curl; `/api/admin/*` POST без Origin
  и с чужим Origin → 403, со своим → 401, GET без сессии → 401; traversal к `.env.local` и
  `content.db` → 404; `/api/files/*` отдаёт `sandbox`-политику, файл скачивается целиком.
- Skeptic: два раунда. Раунд 1 — FAIL (5 замечаний, из них 1 устаревшее). Раунд 2 — FAIL, одно
  блокирующее: отчёты аудита ухудшали `prettier --check .` с 2 файлов до 4, а документ это
  отрицал. Устранено внесением отчётов в `.prettierignore` по действующей конвенции проекта.
- Отчёты: `SECURITY_AUDIT.md`, `TECHNICAL_AUDIT.md`, `PRE_RELEASE_CHECKLIST.md`.

## 2026-07-27 (продолжение) — SEC-07, SEC-09, стабилизация E2E

- Пользователь вручную проверил админ-панель: редактирование контента работает, изменения видны на
  публичном сайте. Полный ручной обход 5 отделов и 10 продуктов в этой задаче повторно НЕ
  выполнялся по прямому указанию.
- `/code-review` (встроенный) выполнить нельзя: skill помечен `disable-model-invocation` и
  запускается только пользователем. Заменён полным review всего дерева отдельным reviewer-агентом
  с упором на файлы, изменённые аудитом, плюс независимый скептик. Заявление «команда выполнена»
  не делается.
- SEC-07 закрыт. `src/app/api/files/[...path]/route.ts` переписан: файл сверяется с каталогом через
  новую `findDocumentByStorageKey` (ищет по storage_key, auto_preview_key, manual_preview_key).
  Неопубликованное отдаётся только при действующей сессии, иначе 404 — тело и статус совпадают с
  ответом для несуществующего файла. `Cache-Control: private, no-store` для неопубликованного.
  Форма публичных ссылок НЕ менялась: сохранённые `original_file_url`/`preview_url` работают.
  Файл-сирота (запись удалена, файл остался) наружу больше не выдаётся.
- Проверка на живом сервере против реальных данных: опубликованный → 200 (812 б); неопубликованный
  `2e77b858…docx` → 404 «Файл не найден»; несуществующий UUID → тот же 404; traversal к
  `.env.local` → 404. Страница `/documents` → 200, все 7 ссылок опубликованных документов → 200.
  Главная, `/contacts`, `/products`, `/blog` → 200. Регрессии нет.
- SEC-07-a (новое, открыто): предпросмотры трёх seed-документов раздаются статикой из
  `public/dox/previews/*.svg` мимо `/api/files` — проверку публикации к ним применить нечем.
  Переписывать `preview_url` не стал: это изменение пользовательских данных. Все НОВЫЕ превью
  создаются в `var/uploads` и проверку проходят.
- SEC-09 закрыт тремя уровнями. Новый `src/server/content/pageContentSchemas.ts`: строгая схема на
  каждый из 5 ключей (`PAGE_CONTENT_SCHEMAS` с `satisfies Record<PageKey, …>` — ключ без схемы не
  соберётся). Роут `/api/admin/pages/[key]` проверяет содержимое своей схемой и отвечает 422 до
  записи. Читатели `products/documents/contacts/articles` получили `safePageCopy` — негодная запись
  заменяется seed-текстами, подробности уходят в серверный лог без значений полей. Новый read-only
  `scripts/check-page-content.mjs`.
- Важное на калибровке схем: первая версия требовала непустых строк. Скрипт проверки показал, что в
  записи `contacts` поля `address` и `workingHours` — пустые строки. Такая схема отвергла бы запись,
  и читатель подставил бы seed-тексты, то есть проверка САМА изменила бы содержимое сайта.
  Исправлено: проверяется ТИП и потолок длины, пустая строка допускается. Разовой проверкой
  подтверждено, что все 5 записей реальной базы проходят новые схемы.
- Причина падения `pain-gain-layout.spec.ts:245` найдена: у кнопки боли
  `:hover { transform: translateX(2px) }` с переходом 200 мс, курсор наводит сам клик, а геометрия
  импульса снималась синхронно в обработчике — до конца перехода. `ResizeObserver` смещения не
  видит по устройству (следит за размером). Отсюда устойчивые 1,152 px при допуске 0,5.
  Исправлена ПРИЧИНА: в `PainGainPanel` добавлен пересчёт по `transitionend`. Допуск не менялся,
  тест дожидается устоявшегося состояния через `expect.poll`.
- Причина падения `how-we-work-analysis.spec.ts:3`: синтетический `wheel` отправлялся до гидратации
  и терялся (обработчик навешивается в `useEffect`). Событие повторяется до сдвига сцены с паузой
  больше `WHEEL_RESET_DELAY` (140 мс), перелёт исключён.
- Ни один тест не отключён, допуски не ослаблены, `test.skip`/`fixme`/retries не добавлялись,
  глобальные таймауты не поднимались.
- Checks: `typecheck` PASS; `test` 344/344 PASS (36 файлов, +43 к 301); `build` PASS;
  `prettier --check .` — те же 2 унаследованных файла; `lint` — те же 2 унаследованные ошибки в
  `HowWeWorkPage.tsx`, новых нет (два появившихся предупреждения в новом тесте исправлены).
- E2E: `pain-gain-layout -g "измеряемый импульс" --repeat-each=10` → 10/10 (12:05:48–12:06:18);
  `how-we-work-analysis --repeat-each=10` → 10/10; весь спек каскада ×3 → 72/72; полный набор три
  прогона подряд → 344/344, 344/344, 344/344 (12:15:20–12:22:45).
- Данные не тронуты: `var/content.db` 294912 б, метка 2026-07-26 21:34 — без изменений; 8 файлов в
  `var/uploads/documents` на месте; коммитов не создавалось. Тесты работают на временной базе
  (`mkdtemp` + `QBIT_DB_PATH`) и во временной директории загрузок (`QBIT_UPLOADS_DIR`).

## 2026-07-28 — Исправления по полному code review

- `/code-review` (встроенный) снова НЕ запускался: skill помечен `disable-model-invocation`.
  Выполнен полноценный эквивалент — review всего дерева независимым агентом.
- Review дал 12 подтверждённых находок. Исправлены Critical, High-часть и все Medium:
  - C-1 (Critical): снятие ЛЮБОГО отдела с публикации роняло главную (500 у каждого посетителя).
    `getDepartments()` фильтрует по `is_published = 1`, fallback срабатывал только при полностью
    пустом списке, а зон офиса ровно 5 с безусловным `throw`. Исправлено: `HomepageShell`
    согласует зоны с опубликованными отделами; `OfficeExperience` и `OfficeSemanticMap` вместо
    исключения пропускают зону без отдела.
  - C-3 (Medium): `safePageCopy` откатывал ВСЮ страницу из-за одного негодного поля — дефект,
    внесённый правкой SEC-09 накануне. Починка сделана пофайловой.
  - C-4 (Medium): `scripts/check-page-content.mjs` печатал «OK homepage», ни разу его не проверив,
    и не проверял потолки длины — тоже дефект вчерашней правки. Исправлено: honest-вывод
    «скриптом не проверяется» + проверка длин.
  - C-5 (Medium): содержимое отдела читалось из базы без проверки; битая JSON-колонка становилась
    `{}` и роняла главную. Добавлен разбор `departmentsSchema` при чтении с заменой на seed-текст
    того же отдела.
  - C-6 (Medium): «скрыть всё» показывало seed-каталог вместо пустого раздела. Различаются
    «таблица пуста» (seed) и «всё снято с публикации» (пусто) — departments, products, contacts.
  - C-7 (Medium): `/sitemap.xml` не сбрасывался при публикации статьи или продукта.
  - C-8 (Medium): в откате POST документов не удалялся `autoPreviewKey` — осиротевший файл.
  - C-9 (Medium/Low): в `/api/task` не было ограничения размера тела. Добавлено 64 КБ.
- Не исправлены осознанно: C-2 (2 предсуществующие ошибки lint в `HowWeWorkPage.tsx` — правка
  затрагивает motion-логику), C-10 (индекс по `storage_key` — миграция схемы), C-11 (`javascript:`
  в markdown статей — self-XSS, автор только администратор), C-12 (мелочи).
- Тесты: `src/tests/unit/server/contentFallbacks.test.ts` (6) на C-1/C-5/C-6.
- Регрессия от собственной правки и её устранение: первый прогон E2E после исправлений дал
  343/344 в двух прогонах из трёх. Причина — добавленный накануне слушатель `transitionend`
  срабатывал на все четыре переходящих свойства кнопки и всплывал от дочерних узлов, давая пять с
  лишним пересчётов на клик и сдвигая тайминги соседних анимаций. Сужен до `event.target === source
  && propertyName === "transform"`. После правки три затронутых спека — 49/49.
- Checks: `typecheck` PASS; `test` 351/351 PASS (37 файлов); `build` PASS; `prettier --check .` и
  `lint` — ровно предсуществующий уровень (2 файла / 2 ошибки), новых нет.
- Skeptic по этой волне НЕ отработал: агент прерван ограничением сессии
  («You've hit your session limit»). Независимая проверка второй волны исправлений остаётся
  невыполненной — это отступление от протокола CLAUDE.md §3.5, зафиксировано явно.
- Данные не тронуты: `var/content.db` без изменений, коммитов нет.

## 2026-07-28 (продолжение) — подтверждение исправлений

- Регрессия от собственной правки устранена: слушатель `transitionend` в `PainGainPanel` сужен до
  `event.target === source && event.propertyName === "transform"`. До этого он срабатывал на все
  четыре переходящих свойства кнопки и всплывал от дочерних узлов, давая лишние пересчёты и сдвиг
  таймингов; падали `departments-premium.spec.ts:119` и `scene-transition.spec.ts:230`.
- E2E после правки: три затронутых спека 49/49; полный набор ТРИ ПРОГОНА ПОДРЯД —
  344/344, 344/344, 344/344 (07:16:50→07:23:29).
- C-1 проверен вживую на КОПИИ базы (пользовательская не изменялась):
  все пять отделов опубликованы → HTTP 200, 65 027 б, в разметке пять названий;
  `hr` снят с публикации → HTTP 200, 58 565 б, четыре названия, «HR» отсутствует.
  До исправления второй случай давал исключение и HTTP 500.
- Финальные проверки: `typecheck` PASS; `test` 351/351 PASS (37 файлов); `build` PASS;
  `lint` — 2 предсуществующие ошибки; `prettier --check .` — 2 предсуществующих файла.
- Данные не тронуты: `var/content.db` 294912 б, метка 2026-07-26 21:34; коммитов нет.

## 2026-07-28 — Skeptic FAIL по C-5 и исправление

- Skeptic (вторая попытка, первая была прервана лимитом сессии) вернул FAIL с одним блокирующим
  замечанием — и оно оказалось верным.
- B-1: исправление C-5 применяло к ОДНОМУ отделу схему КОЛЛЕКЦИИ. `departmentsSchema` — это
  `z.array(departmentSchema).length(5)` плюс superRefine «все пять id без дублей в фиксированном
  порядке» (`src/content/schema.ts:84-104`). Массив из одного элемента её не проходит НИКОГДА.
  Следствие: `validateDepartment` уходил в ветку ошибки для КАЖДОГО отдела и возвращал
  seed-вариант, то есть публичный сайт всегда показывал исходные тексты, а правки отделов через
  админ-панель переставали появляться. Плюс 5 `console.error` и 5 заведомо провальных разборов на
  каждый рендер главной.
- Почему не поймал сам: содержимое `var/content.db` побайтово совпадает с `data/departments.json`,
  поэтому подмена невидима; E2E идёт против той же базы; мои тесты проверяли только скрытие и
  порчу и ни одним случаем не утверждали, что ОТЛИЧНЫЙ ОТ SEED корректный контент доходит до
  читателя. Живая проверка C-1 («hr скрыт → 4 названия») дефект тоже не опровергала.
- Исправлено: `validateDepartment` использует `departmentSchema` (схему одного отдела).
  Коллекционные инварианты к выборке опубликованных отделов неприменимы по существу — список
  штатно неполон, когда отдел скрыт.
- Добавлены 2 регрессионных теста: отредактированный текст отдела доходит до читателя без подмены
  и без единого `console.error`; то же для всех пяти отделов. Проверено, что тесты ЛОВЯТ дефект:
  на прежней (сломанной) реализации оба падают, на исправленной — проходят.
- Непроблокирующие замечания скептика закрыты: скрипт `check-page-content.mjs` больше не пишет
  «Все записи соответствуют схемам», когда часть записей он не проверял; добавлена проверка длины
  элементов `implementationFormats.items`; из `safePageCopy` убран лишний повторный разбор, пути
  негодных полей отдаются структурно (`topLevelPaths`), а не выделяются из текста сообщения;
  комментарий приведён к фактическому поведению (точность — до поля верхнего уровня).
- Оставлено с обоснованием: `/api/task` буферизует тело до проверки байт — тот же паттерн, что во
  всех остальных роутах проекта; отдельного исправления не делалось.
- Checks после правок: `typecheck` PASS; `test` 353/353 PASS (37 файлов); `build` PASS;
  `lint` и `prettier --check .` — предсуществующий уровень (2 ошибки / 2 файла).

## 2026-07-28 — Завершение

- E2E после исправления C-5: три полных прогона подряд — 344/344, 344/344, 344/344
  (07:39:06→07:45:46).
- Живая проверка B-1 на КОПИИ базы: `headline` отдела «Продажи» заменён уникальным маркером →
  HTTP 200, маркер на странице присутствует (1 вхождение), жалоб «не соответствует схеме» в
  серверном логе 0. На прежней реализации маркера не было бы, а жалоб было бы пять.
- Финальные проверки: `typecheck` PASS; `test` 353/353 PASS (37 файлов); `build` PASS;
  `lint` 2 предсуществующие ошибки; `prettier --check .` 2 предсуществующих файла.
- Данные не тронуты: `var/content.db` 294912 б, метка 2026-07-26 21:34; 8 файлов в
  `var/uploads/documents`; коммитов не создавалось (HEAD остался fcdb611).

## 2026-07-28 — SEO/GEO-аудит: техническая индексируемость без изменения контента

**Условие задачи.** Ни одного нового видимого слова, ни одного изменения оформления. Соблюдено:
сравнение нормализованного видимого текста 31 маршрута до/после — 0 изменённых строк; попиксельное
сравнение 20 скриншотов (10 страниц × desktop 1440×900 + mobile 390×844) — 0.0000 % расхождения.
Единственное расхождение в текстовом сравнении — внутри самого `/robots.txt`.

**Готовый SEO-skill не использовался — его нет** среди установленных. Аудит проведён вручную по
документации Next.js 16 (`generateMetadata`, слияние метаданных), Google Search Central, Schema.org
и Open Graph Protocol. Инструменты (обходчик первого серверного ответа без JS, сравниватель текста,
попиксельный сравниватель, автопроверка требований) написаны под задачу.

**Создано.** `src/lib/seo.ts` (общесайтовые константы, `buildOpenGraph`/`buildTwitter`,
`INDEXABLE_ROBOTS`, `withBrand`, узлы `organizationNode`/`webSiteNode`/`webPageNode`/
`breadcrumbNode`); `scripts/generate-og-image.mjs` + `public/og/qbit-og-1200x630.png` (существующий
логотип на существующем фирменном фоне, без нового текста); тесты
`src/tests/unit/lib/seo.test.ts`, `src/tests/unit/app/robots-and-sitemap.test.ts`,
`src/tests/unit/features/blog/blog-seo.test.ts`, `src/tests/unit/features/faq/faq-seo.test.ts`;
отчёты `SEO_GEO_AUDIT.md`, `SEO_GEO_ROUTE_MATRIX.md`, `SEO_GEO_CONTENT_LIMITATIONS.md`,
`SEO_GEO_PRE_RELEASE_CHECKLIST.md`.

**Исправлено (14 подтверждённых дефектов).** Нет canonical на `/`, её шести состояниях и
`/how-we-work` → canonical на всех 15 индексируемых страницах. Title главной состоял из одного
бренда → собирается из видимого H1. `/blog` отдавал бренд дважды («Блог QBit-Studio-Ai —
QBit-Studio-Ai») → `withBrand()`. Description `/how-we-work` описывала устройство компонента
(«Интерактивная офисная сцена… миссия, анализ, внедрение, подход и письмо») → видимый текст первой
сцены. Нет Open Graph на `/`, состояниях, `/how-we-work`; нет `og:site_name`/`og:locale` нигде; нет
Twitter на `/products`, `/documents` → полный набор на всех 15 страницах через общий сборщик
(метаданные Next.js сливаются поверхностно, поэтому общие поля нельзя задать один раз в layout).
Нет JSON-LD на `/`, `/documents`, `/faq`, `/contacts`, `/how-we-work` → `Organization`, `WebSite`,
`WebPage`, `CollectionPage`, `FAQPage`, `ContactPage`, `AboutPage`, `BreadcrumbList`; узел
`Organization` дублировался тремя литералами → один узел с общим `@id`. `Disallow: /admin/` не
покрывал сам `/admin` (директива работает как префикс) → `Disallow: /admin`. Добавлен `noarchive`
на `/login` и `/admin`. Внутренняя ссылка «Вернуться» на `/how-we-work` была голым `<a href="/">`
(полная перезагрузка вместо клиентского перехода; ловилось ESLint) → `next/link`; попиксельное
сравнение до/после — 0.0000 %. Добавлен `metadataBase`.

**Регрессия, найденная и устранённая в ходе работ.** Правила индексирования сначала задали один раз
в корневом layout. На собранном сайте значение доставалось и странице 404, к которой Next.js
добавляет собственный `noindex`: в `<head>` оказывались `noindex` и `index, follow` одновременно.
Правила перенесены в `INDEXABLE_ROBOTS` и проставляются постранично. Добавлен регрессионный тест.

**Безопасность JSON-LD.** Существующий `serializeJsonLd` используется во всех новых блоках, прямой
`JSON.stringify` внутри `<script>` не применяется нигде. К проверкам самого сериализатора добавлена
сквозная регрессия: вредоносное название статьи `</script><script>…</script>` проходит путь
«админ-панель → сборка разметки → строка в `<script>`»; проверяется отсутствие `</script`, `<`, `>`
в выводе и неискажённость данных после `JSON.parse`.

**Спорные решения, принятые явно.** Canonical состояний главной (`?department=…`, `?section=task`)
сведён на `https://allqbit.ru` — заголовок, описание и разметка у них общие, отдельные canonical
дали бы семь дублей; плата (содержимое отделов не индексируется отдельно) вынесена в
`SEO_GEO_CONTENT_LIMITATIONS.md` пунктом 1. `FAQPage` добавлена: все 14 вопросов и ответов реально
видимы и приходят в серверном HTML; прежний запрет в E2E («преждевременной FAQ-разметки нет»)
заменён требованием совпадения разметки с видимым содержимым. `Service`, а не `Product`, для
продуктов; `Offer` только с `priceSpecification.minPrice`, потому что цены минимальные и видимые.
`SearchAction` не добавлен — поиска на сайте нет. Автор статей — только хранимое значение; Павел из
текста `/how-we-work` в разметку не подставлен.

**Checks.** `typecheck` PASS; `test` 395/395 PASS (41 файл); `test:e2e` 344/344 PASS (в первом
прогоне 1 падение спецификаций слоя фотографий — в изоляции 12/12, второй полный прогон 344/344;
нестабильность при полной параллельности, не регрессия); `build` PASS; `start` PASS; обход 31
маршрута собственной автопроверкой — 0 нарушений. `lint` — 1 предсуществующая ошибка
(`react-hooks/set-state-in-effect` в `HowWeWorkPage.tsx:231`, к SEO не относится; вторая ошибка того
же файла, `no-html-link-for-pages`, исправлена). `prettier --check .` — 2 предсуществующих файла
(`artifacts/products-page/new-product-metrics.json`, `reports/blog-seo-geo-audit.md`), все
изменённые файлы отформатированы.

**Lighthouse не запущен:** пакет не установлен, сетевого доступа для установки в среде нет
(`npm error network 'proxy' config is set`). Раздел SEO закрыт собственной автопроверкой по всем
маршрутам, Accessibility — сканированием `@axe-core/playwright` в 7 E2E-спецификациях,
Best Practices — проверкой заголовков ответа. **Performance остаётся неизмеренным**, вынесен в
`SEO_GEO_PRE_RELEASE_CHECKLIST.md`, раздел F.

**Данные не тронуты.** `var/content.db`, `var/uploads/*`, `data/seed/*` и админ-панель не
изменялись. Коммитов не создавалось, HEAD остался `fcdb611`.

## 2026-07-29 — Amendment 43 / Step 43: заявка `/contacts` → n8n → Telegram

**Причина.** Узел Telegram сценария «Qbit_sait/Webhook → Telegram notification» подставляет
`{{ $json.body?.message || $json.message || '⚠ Webhook received in n8n' }}`. Payload роута поля
`message` не содержал, поэтому даже при настроенном webhook в чат ушла бы заглушка без данных
заявки. Вторая, независимая причина отказа формы — незаданный `N8N_CONTACT_WEBHOOK_URL`: роут
отвечает 503 (`route.ts:115`), это настройка окружения, кодом не решается.

**Изменения.**
- `src/features/contacts/contactMessage.ts` (новый): `buildContactMessage` — заголовок, имя,
  заполненные способы связи, описание процесса, время в `Europe/Moscow` и `submissionId`. Без
  Markdown/HTML: узел Telegram настроен без `parse_mode`.
- `src/app/api/contact/route.ts`: `submissionId`/`submittedAt` подняты в переменные, в payload
  добавлено `message`; структурированные поля оставлены для других веток сценария. `chat_id` не
  отправляется — получатель остаётся фолбэком внутри n8n.
- `src/tests/unit/features/contacts/contact-message.test.ts` (новый, 4 теста).
- `src/tests/unit/features/contacts/contact-route.test.ts`: `message` в списке ключей payload,
  новый тест на содержимое текста и на отсутствие `chat_id`.
- `README.md`, `.env.example`: адрес webhook в виде
  `https://<n8n>/webhook/webhook-telegram-notification`, различие production и `/webhook-test/`,
  описание поля `message`, отмечено, что предоставленный сценарий заголовок
  `X-QBit-Webhook-Secret` не проверяет.

**Checks.** `typecheck` PASS; `test` 400/400 PASS (42 файла, было 395/41). `lint` — 1
предсуществующая ошибка (`react-hooks/set-state-in-effect`, `HowWeWorkPage.tsx:231`), к задаче
отношения не имеет. `prettier --check .` — 3 предсуществующих файла (`artifacts/…`,
`CLEANUP_PLAN.md`, `reports/…`), все изменённые файлы отформатированы. `build` и `test:e2e` не
запускались: изменения ограничены серверным payload и покрыты unit-тестами.

**Не проверено вживую.** Реальная доставка в Telegram не подтверждена — требуется задать
`N8N_CONTACT_WEBHOOK_URL` в `.env.local` и отправить тестовую заявку. Коммитов не создавалось.

## Step SEO-01 — первый пакет технических SEO-исправлений (2026-07-29)

Нумерация `SEO-01`, не «44»: номер 44 уже занят шагом «final research publication» (запись от
2026-07-25 выше).

### Изменённые файлы

- `src/features/products/ProductInformation.tsx` — `<h2 class=fallbackPanelTitle>` перенесён после
  `<header>` с `<h1>`. Элемент скрыт при включённом JS (`html.js .fallbackPanelTitle{display:none}`).
- `src/features/how-we-work/HowWeWorkPage.tsx` — блок `office-route-panel` (единственный `<h1>`)
  перенесён выше слоёв `office-surface-layer`, где лежат четыре `<h3>`.
- `src/features/how-we-work/HowWeWorkPage.module.css` — `.office-route-panel` 3→4;
  `.office-progress`, `.office-wheel-hint`, `.office-route-dots` 3→5. Без этого перенос увёл бы
  панель под корковую доску: у равных `z-index` порядок задаёт позиция в документе.
- `src/app/sitemap.ts` — `lastModified` из настоящих `updated_at`; дата раздела «Блог» — позднейшая
  из даты раздела и всех статей (было `blogPosts[0]?.modifiedAt`, бравшее первую строку списка,
  отсортированного по `sort_order`).
- `src/features/products/products.ts` — `buildProductDescription`, описание ≤160 символов.
- `.gitignore` — `/allqbit-*.zip` (75 МБ архивов выгрузки лежали неигнорируемыми).
- `src/tests/unit/features/products/products.test.ts` — снята `toContain(summary)`: описание
  намеренно перестало содержать `summary` целиком. Замена сильнее и живёт в отдельном файле.
- `src/tests/unit/app/robots-and-sitemap.test.ts` — прежняя проверка «lastModified ≠ сегодня»
  упала на `/documents` с НАСТОЯЩИМ сегодняшним `updated_at`; проверка была неверна по существу.
  Заменена на подмену модуля дат стабами и сверку точного соответствия.

### Новые файлы

- `src/server/content/lastModified.ts`, `src/app/blog/not-found.tsx`,
  `src/app/blog/not-found.module.css`, `src/tests/unit/features/products/product-description.test.ts`,
  `src/tests/unit/app/blog-not-found.test.ts`, `src/tests/unit/server/lastModified.test.ts`,
  `SEO_FIX_BATCH_01_REPORT.md`.

### Команды и результат

- `npm run typecheck` — exit 0.
- `npx prettier --check` по изменённым файлам — exit 0.
- `npx eslint` по изменённым файлам — exit 0.
- `npm run lint` (весь проект) — **exit 1**: `react-hooks/set-state-in-effect`,
  `HowWeWorkPage.tsx:231`. ПРЕДСУЩЕСТВУЮЩАЯ: рабочее дерево убрано в `git stash`, линт запущен на
  чистом HEAD — та же ошибка, та же строка. Диф шага строк 225–240 не касается.
- `npm run test` — 425/425 (было 415/415).
- `npm run build` — exit 0.
- `npx playwright test` products-experience, how-we-work-analysis, blog-experience,
  public-routes — 35 passed; accessibility-scan — 11 passed.

### Проверенные факты

- Порядок заголовков на собранном сайте: продукт `H1 → H2×5`; `/how-we-work` `H1 → H3×4`.
- `getComputedStyle` перенесённого `<h2>` — `display: none` в desktop и mobile.
- `/sitemap.xml` с живой базы: 23 адреса, `/how-we-work` без `lastmod`, остальные — настоящие даты.
- Длины description десяти продуктов: 136–160, все заканчиваются точкой.
- `/blog/<неизвестный>`: HTTP 404, `<title>Статья не найдена — QBit-Studio-Ai</title>`,
  `noindex, nofollow, noarchive`, в браузере ровно один `<h1>`.
- Caddy: прочитан `/opt/supabase/volumes/proxy/caddy/Caddyfile`; `allqbit.ru` и `www.allqbit.ru`
  обслуживаются одним блоком, `https://www.allqbit.ru/products` → 200 без редиректа. Точный текст
  правки — в `SEO_FIX_BATCH_01_REPORT.md` §5. **На сервер не применялась**, ни один файл на
  сервере не изменён, контейнеры не перезапускались.

### Визуальная сверка до/после

Собраны две версии на одном локальном production-сервере (HEAD через `git stash` и версия с
правками), сняты `/how-we-work` (5 сцен × desktop 1440×900 + mobile iPhone 13) и карточка продукта.
Расхождение: 0.000–0.304 % на всех кадрах, кроме `scene3.mobile` — 9.049 %. Разобрано: причина —
фаза ступенчатой анимации заметок (`--note-index`), а не сдвиг вёрстки. Повторный замер с
ожиданием завершения анимации — **0.005 %**, геометрия всех четырёх заметок совпала попиксельно
(37,329 158×143 / 197,331 156×141 / 37,473 158×143 / 197,475 154×139, opacity 1).

### Ограничения, оставленные открытыми

- Тело 404 блога не отрисовывается на сервере (нет `<h1>`, `<main>` в HTML) — поведение Next.js 16
  при `notFound()` из компонента маршрута. ПРЕДСУЩЕСТВУЮЩЕЕ: в снимке production до правки та же
  страница отдавала 11 040 байт с 0 заголовков; `/products/<неизвестный>` ведёт себя так же.
  Отрисовать заглушку прямо в компоненте нельзя — это дало бы «мягкую 404» со статусом 200.
- Нижняя граница 120 символов у description — свойство текущих текстов, не гарантия функции.
- `updated_at` ни разу не правленной записи равен моменту `db:seed`; оговорено в док-комментарии.

### Наблюдение

Один прогон `npm run test` уронил `office-scenes.test.ts > keeps every sceneId … resolvable`.
Три последующих полных прогона — 425/425, изолированный прогон файла — 10/10; независимое ревью
дало ещё четыре чистых прогона (итого 7 чистых против 1 падения). Диф шага модулей офисных сцен
не касается. Вероятная причина, зафиксирована для будущего: тест на уровне модуля делает
`readFileSync` двух исходников от `process.cwd()` и потому чувствителен к конкурентному доступу к
файлам между воркерами vitest — на Windows это типичная причина разового сбоя. При повторении
смотреть сюда, а не в диф шага.

### Skeptic

Раунд 1 — `FAIL`. Блокирующее (B1): отсутствовала запись в `WORKLOG.md` и файл
`SEO_FIX_BATCH_01_REPORT.md`, из-за чего критерий «правка Caddy показана» не подтверждался ничем.
Кода находка не касалась. Исправлено этой записью, отчётом, статусом `AWAITING_SKEPTIC` и
переименованием шага в `SEO-01`. Попутно закрыты неблокирующие: `.gitignore` для архивов,
смягчён док-комментарий про `updated_at`, добавлены тесты на `latestDate` и метаданные 404 блога.

Раунд 2 — `FAIL`. Блокирующее (B2): `npm run format:check` из Quality gate стал красным, и
нарушителем был сам добавленный `SEO_FIX_BATCH_01_REPORT.md` — при том что §6 отчёта заявлял по
формату PASS. Причина ошибки: prettier прогонялся ВЫБОРОЧНО, списком изменённых файлов, куда новый
отчёт не попал. То есть документ, созданный ради честной фиксации проверок, расходился с
состоянием репозитория. Исправлено: отчёт отформатирован, `npm run format:check` прогнан по всему
проекту (exit 0), строка «Формат» в §6 переписана на проектную команду и дополнена абзацем о том,
что там стояло раньше и почему было неверно. Выборочные прогоны в таблице проверок больше не
используются. Попутно: остаточное «шаг 44» в тексте плана, удалена тавтологичная проверка
`Date.now() - before >= 0` в тесте `latestDate`, в наблюдение о флейке дописана вероятная причина.

Раунд 3 — `PASS`. Проверено независимо: `format:check` exit 0, `typecheck` exit 0, `test` 425/425,
статистика диффа производственных файлов побайтно совпадает с раундом 1 (код под ревью не
переписывался). Обязательных исправлений нет. Шаг переведён в `COMPLETED`.

Остаётся долгом проекта, а не этого шага: `npm run lint` красный одной предсуществующей ошибкой
`react-hooks/set-state-in-effect` в `HowWeWorkPage.tsx:231` — общий Quality gate CLAUDE.md не
зелёный.

## Step SEO-02 — устранение ошибки линта `react-hooks/set-state-in-effect` (2026-07-29)

### Изменённый файл

`src/features/how-we-work/HowWeWorkPage.tsx` — единственный.

### Что было

Эффект ступенчатого появления акцента начинался с ТРЁХ синхронных `setState`: при
`prefers-reduced-motion` помечал акцент готовым, иначе сбрасывал `accentReadyScene` и
`accentContentReadyScene` в `null`. Готовность хранилась как «номер готовой сцены» и сравнивалась
с `activeIndex`. Каждый синхронный `setState` в теле эффекта — лишний каскадный рендер.

### Что стало

- `activeIndex` и номер включения сцены объединены в ОДНО состояние `scene = { index, activation }`;
  `activation` строго возрастает при каждом переходе. Одно состояние, а не два соседних: иначе
  индекс и номер включения разъехались бы на один рендер и появление акцента моргнуло бы.
- Введён `revealToken` = `${scene.activation}:${reduced|full}`.
- Готовность выводится: `isAccentReady = prefersReducedMotion || accentReadyToken === revealToken`.
- Эффект только заводит таймеры и чистит их; при reduced motion сразу `return`.
- Потребитель `accentContentReadyScene !== activeIndex` в эффекте печати текста на ноутбуке
  заменён на `!isAccentContentReady`; производные флаги подняты выше по файлу.

### Почему токен, а не просто снятие сброса

`SCENE_TRANSITION_LOCK` = 1120 мс короче `ACCENT_REVEAL_DELAY` = 1500 мс, поэтому есть окно ~380 мс,
в котором можно уйти в соседнюю сцену и вернуться ДО срабатывания таймера. При наивном сравнении по
номеру сцены старое значение совпало бы с текущим индексом, и акцент показался бы МГНОВЕННО вместо
повторного проигрывания. Возрастающий `activation` делает совпадение невозможным. Режим движения
входит в токен, поэтому переключение системной настройки тоже проигрывает появление заново — как и
в прежнем коде.

### Команды и результат

- `npm run lint` — **exit 0** (было: 1 ошибка).
- `npm run format:check` — exit 0.
- `npm run typecheck` — exit 0.
- `npm run test` — 425/425.
- `npm run build` — exit 0.
- `npx playwright test` (ВЕСЬ набор) — **406 passed, 1 skipped**.

### Проверки без обхода правила

- `git diff | grep '^+.*eslint-disable'` — в коде совпадений нет.
- `grep -c eslint-disable src/features/how-we-work/HowWeWorkPage.tsx` → 0.
- `eslint.config.mjs` не изменён.
- Три `eslint-disable` в проекте — предсуществующие, по `@next/next/no-img-element`, файлы не трогались.

### Визуальная и поведенческая сверка

Скриншоты версии до правки линта vs после, `/how-we-work` 5 сцен × desktop/mobile + карточка
продукта: максимум 0.311 %, остальное ≤0.18 %.

Поведенческий замер на desktop и mobile, 6 проверок, все пройдены:
вход в сцену — акцент не активен на 250 мс и активен на 1850 мс; **быстрый возврат в окне 1200 мс** —
акцент снова не активен сразу и включается по таймеру; reduced motion — акцент активен сразу.

### Известное отличие на один кадр

При `prefers-reduced-motion` прежний код на ОДИН рендер после смены сцены давал
`isAccentReady === false` (состояние ещё хранило прежний индекс), новый — сразу `true`. Это
устранение однокадрового мигания в режиме, который обязан показывать всё мгновенно. Найдено
независимым ревью; считаю улучшением, а не регрессией, но фиксирую явно.

### Долг, не внесённый этим шагом

`startTransitionLock` вызывается ВНУТРИ updater'а `setScene` (приём предсуществующий, был и у
`setActiveIndex`). Updater обязан быть чистым: React вправе вызвать его повторно. Правилом линта
не покрыто, лишним рендером не грозит, но это тот же класс проблемы. Записано как долг проекта.

### Skeptic

Раунд 1 по SEO-02 — `BLOCKED`. По коду претензий нет: ревью независимо подтвердило exit 0 у линта,
отсутствие `eslint-disable`, сохранение краевого случая с возвратом в сцену, живой перенос `<h1>`
из SEO-01 во всех пяти сценах и весь quality gate. Блокировали три процедурные вещи: (1) шаг
смешивал критерии, проверяемые до и после выкатки; (2) не было записи в `WORKLOG.md`; (3) откат не
был записан до рискованного действия. Исправлено: шаг разделён на `SEO-02` (правка линта) и
`SEO-03` (деплой и Caddy), заведена эта запись, опорные точки и процедура отката записаны в
`WORKPLAN.md` ДО выкатки — включая оговорку, что `supabase-caddy` обслуживает и боевой Supabase.

## Step SEO-03 — деплой пакета и применение редиректа Caddy (2026-07-29)

### Резервная копия (до любых изменений)

- `./backup.sh` → `/opt/allqbit-data/backups/allqbit-20260729-173950.tar.gz` (68 КБ, `VACUUM INTO`).
- `cp Caddyfile Caddyfile.bak-2026-07-29`, sha256 копии совпал с оригиналом
  `7bf55465852f268cbc3f5a075248c23b130d75bb1e31a9da3278a031f92a8f61`.

### Версии

| | до | после |
| --- | --- | --- |
| commit | `469e905` | `9c529e223adfff19f2073d9ac9903281af7e92f3` |
| image ID | `sha256:83a425ebc838…` | `sha256:739b2443d436…` |
| BUILD_ID | `oEDuygj9UpGTJTR-B_0di` | `5wVqZ4NpA_9bjL07DBxu0` |
| `Caddyfile` sha256 | `7bf55465…` | `38c3b34b948cb0f8e55b923b2e025a6e761199916cdf14ad1f802dc3438a4e60` |

Миграции: «Схема уже актуальна». Контейнер сайта пересоздан, `healthy`, restarts=0.
Прежний образ не удалён — остался как `<none>:<none>`, доступен по ID (проверено).

### Две находки при применении Caddy

1. **`caddy validate` для этого конфига нерабочий.** Падает на `http_basic: base64-decoding
   password`. Проверено, что **та же ошибка возникает на текущем работающем конфиге** — то есть это
   свойство конфигурации, а не следствие правки: пароль basic-auth хранится открытым, хеш
   вычисляется на старте контейнера. Вместо `validate` использован `caddy adapt` (синтаксис без
   provisioning): exit 0 у обоих файлов, сравнение JSON показало изменение ровно хостов
   (`['allqbit.ru','www.allqbit.ru']` → два блока), `supabase.allqbit.ru` не тронут.
2. **Обычный `caddy reload` сломал бы basic-auth Supabase.** Контейнер стартует командой
   `PROXY_AUTH_PASSWORD=$(caddy hash-password …) && caddy run …`; у работающего процесса пароль
   захеширован, а `docker exec` получает открытый. Reload из exec подставил бы нехешированное
   значение. Применён reload с воспроизведением логики entrypoint. Механизм проверен ХОЛОСТЫМ
   reload неизменённого конфига до правки: exit 0, сайт 200, Supabase Studio 401.

`reload`, не `restart`: `supabase-caddy` работает с 2026-06-29, RestartCount 0, простоя не было.

### Проверки после деплоя

- Четыре варианта `/test?x=1` — все заканчиваются на `https://allqbit.ru/test?x=1`; путь и query
  сохранены; с `https://www` ровно **один 301**; с `http://www` два перехода (неизбежный
  автоматический http→https Caddy). Статус 404 корректен — адреса `/test` на сайте нет.
- 23 адреса `sitemap.xml` — все **200**; `lastmod` у 22, без даты только `/how-we-work`; canonical
  у всех на non-www, ни одного с `www.`; `sitemap.xml` и `robots.txt` — 200.
- Заголовки в production: карточки продуктов `H1 → H2`, `/how-we-work` `H1 → H3×4`.
- 404 блога: 404, `<title>Статья не найдена — QBit-Studio-Ai</title>`, `noindex, nofollow, noarchive`.
- Браузер, 46 загрузок: 0 ошибок консоли, 0 исключений, 0 HTTP-ошибок, везде один `H1`, 0
  изображений без `alt`, `lang=ru`. 201 событие `net::ERR_ABORTED` — отменённый префетч `?_rsc=`.
- Соседи на общем прокси: `supabase.allqbit.ru` 401, `/rest/v1/` 401, контейнер Up 4 weeks.

### Визуальная сверка production до/после

45 кадров из 46 — 0.000 %. Кадр `how-we-work.mobile.png` — 32.7 %. РАЗОБРАНО, не списано: на кадре
«после» видна панель обзора офиса, на кадре «до» нет. Она появляется через 1500 мс, а браузерная
проверка снимает кадр сразу по `networkidle`. Замер НА ЖИВОМ production: `aria-hidden=true` на
400 мс и `aria-hidden=false` на 3000 мс, и на desktop, и на mobile — панель появляется по таймеру,
как и должна. Расхождение — момент съёмки, а не регрессия.

### Отчёт

`SEO_FIX_BATCH_01_DEPLOY_REPORT.md` — версии, обе находки по Caddy, результаты всех проверок и
пошаговый откат (код, Caddy с обязательным хешированием пароля, база).

### Step SEO-03 — закрытие

Skeptic — `PASS`. Ревью независимо перепроверило на живом домене: смену BUILD_ID в отдаваемом HTML,
состав коммита (`git diff 9c529e2 -- src/` пуст), все четыре варианта редиректа, 23 адреса по 200 с
одним `<h1>` первым и canonical на non-www, длины десяти описаний, 404 блога, отсутствие ошибок
консоли на девяти страницах, сохранность переноса `<h1>` во всех пяти сценах и живость Supabase.
Расхождение кадра 32.7 % подтверждено как момент съёмки: геометрия панели на мобильном идентична
в обоих замерах, меняется только видимость.

Закрыты две рекомендации ревью:

1. **Подлинность basic-auth Supabase.** Анонимный 401 не отличает рабочий пароль от испорченного.
   Проверено чтением работающего конфига через админ-API Caddy (значение не выводилось):
   `длина 60, префикс $2a$, валидный bcrypt: True`. То есть reload подставил хеш, а не открытую
   строку; исходный пароль тот же — entrypoint и reload читают одну переменную окружения
   контейнера, entrypoint переопределял её лишь внутри своего процесса.
2. **Артефакты отката доказаны выводом команд**, вклеенным в §3 отчёта: прежний образ
   `83a425eb…` на месте как `<none>:<none>` (321 МБ), архив копии 68 787 байт, sha256 копии
   `Caddyfile` совпадает с записанным до деплоя, контейнер `healthy`, restarts=0.

Остаётся незакоммиченным сам отчёт о деплое и записи журналов — коммит по запросу пользователя.

## Step SEO-04 — постоянные переадресации старых адресов (2026-07-29)

**Изменённые и созданные файлы (4 + журналы).**

- `src/lib/legacyRedirects.ts` — создан: таблица из пяти пар «источник → получатель» и список пяти
  адресов, которые запрещено трогать. Единый источник для конфигурации и обоих тестов.
- `next.config.ts` — добавлен `redirects()`, разворачивающий таблицу с `permanent: true` (308).
  Существующие `headers()`, CSP и `output: "standalone"` не изменены.
- `src/tests/unit/app/legacy-redirects.test.ts` — создан, 10 проверок.
- `src/tests/e2e/legacy-redirects.spec.ts` — создан, 17 проверок против production-сборки.

**Решения.**

- `redirects()` в конфигурации, а не middleware: текущий `matcher` middleware покрывает только
  `/admin`, расширение втянуло бы SEO в модуль авторизации и добавило бы работу Edge на каждый
  запрос. Переадресация страницей (как у `/products/product-01`) неприменима: страниц `/pricing` и
  `/integrations` не существует, разворачивать неоткуда.
- `permanent: true` = 308, а не 301: запрещает посреднику менять метод, для поисковых систем
  равнозначен 301.
- `/integrations` ведёт сразу на `/products/leads-to-crm`, а не на `/products/product-03`: второй
  вариант дал бы цепочку из двух переходов (страница продукта развернула бы id в slug), что прямо
  запрещено постановкой.

**Проверки (exit status).**

| Команда | Итог |
| --- | --- |
| `npm run format:check` | 0 (после `prettier --write` одного нового файла) |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run test` | 0 — 47 файлов, 435 тестов (было 425) |
| `npm run build` | 0 |
| `npx playwright test` | 0 — 423 passed, 1 skipped (было 406 passed; +17 новых) |

**Фактические ответы локальной production-сборки** (`curl`, порт 3200): все пять источников —
`HTTP/1.1 308 Permanent Redirect`, `Location` ровно на заказанный адрес, `?utm_source=test&x=1`
перенесён без изменений. Пять исключённых адресов — 404, ни одного 3xx.

**Найдено и записано честно, не устранено.** Варианты с завершающим слэшем (`/pricing/`) дают два
перехода: сначала штатная нормализация Next.js `/:path+/ → /:path+`, затем переадресация. Это
предсуществующее поведение фреймворка, одинаковое для всех адресов сайта (`/products/` тоже даёт
один переход нормализации), а не следствие этой правки. Заказанные адреса без слэша — ровно один
переход. Устранение потребовало бы `skipTrailingSlashRedirect` для всего сайта — вне объёма шага.

**Остаточный риск.** Список фиксируется на сборке, а slug продукта и статьи редактируются в
админ-панели: переименование `leads-to-crm` или любого из трёх slug статей сделает переадресацию
путём к 404 до следующей сборки. Сторож — unit-тест на существование получателя в `data/seed`;
правку slug прямо в базе он не увидит.

**Тексты, дизайн, компоненты и данные не изменялись.** Изменения — только конфигурация
маршрутизации и тесты.

**Независимое ревью `skeptic` (до деплоя): `PASS`, блокирующих находок нет.** Ревьюер
перепроверил своими командами манифест сборки, весь quality gate, живые ответы production-сборки,
целость `/products/product-01` и защиты `/admin`. Пять неблокирующих находок:

1. Завершающий слэш — два перехода (уже записано выше; подтверждено независимо).
2. Ответ-переадресация из `redirects()` не несёт заголовков безопасности: `headers()` к
   config-level переадресациям не применяется. Класс предсуществующий (внутренняя нормализация
   `/products/` ведёт себя так же), правка добавляет пять таких ответов. Тело ответа тривиально,
   HTTPS обеспечивает Caddy — вносится в отчёт как факт, не устраняется.
3. Полный Playwright у ревьюера с первого раза дал 3 падения (`departments-premium:119`,
   `documents-experience:209`, `scene-transition:230`), все прошли при повторе и поодиночке. Это
   известная нестабильность под 6 воркерами, к переадресациям отношения не имеет. Запись
   «423 passed» выше относится к прогону исполнителя и не означает детерминированности этих трёх.
4. Не покрыт обратный риск: если в админ-панели создадут статью со slug, совпадающим с ИСТОЧНИКОМ
   (`n8n-business-automation` и два других), переадресация молча перекроет живую страницу. Файловой
   проверки для slug из базы не существует. Внесено в остаточные риски.
5. AC 8 (проверка на production) по определению не мог быть выполнен до деплоя — закрывается ниже.
