# SEO_FIX_BATCH_01 — первый пакет технических SEO-исправлений

Дата: **2026-07-29**. Ветка `master`, изменения **не закоммичены и не задеплоены**.
План: `WORKPLAN.md`, раздел «Plan Amendment SEO-01 / Step SEO-01».

Исходные данные — снимок production `allqbit-production-snapshot-2026-07-29.zip`
(commit `469e905`, BUILD_ID `oEDuygj9UpGTJTR-B_0di`).

---

## 1. Порядок заголовков в DOM

### 1.1 Карточки продуктов

**Было** (подтверждено снимком production, все 10 карточек):

```
H2: Обзор            ← первым шёл H2
H1: AI-ассистент по знаниям компании
H2: Где применяется
```

**Причина.** В панели «Обзор» первым элементом стоял `<h2 class="fallbackPanelTitle">Обзор</h2>` —
подпись панели для случая, когда JavaScript отключён и вкладки скрыты
(`:global(html:not(.js)) .contentTabs { display: none }`). При включённом JavaScript элемент
невидим: `:global(html.js) .fallbackPanelTitle { display: none }`.

**Правка.** `src/features/products/ProductInformation.tsx` — узел перенесён **после** `<header>`,
содержащего `<h1>`. Ни одного видимого элемента не тронуто.

**Стало:**

```
H1: AI-ассистент по знаниям компании
H2: Обзор
H2: Где применяется
H2: Примеры применения
H2: Стоимость
H2: Выгода для клиента
```

Проверено на собранном сайте: `getComputedStyle` у перенесённого `<h2>` — `display: none`
и в desktop, и в mobile. Пиксельное расхождение скриншотов карточки продукта — **0.000 %**.

### 1.2 `/how-we-work`

**Было:** четыре `<h3>` заметок корковой доски шли раньше единственного `<h1>` страницы.

**Правка.** `src/features/how-we-work/HowWeWorkPage.tsx` — блок `office-route-panel` (в нём `<h1>`)
перенесён в разметке выше слоёв `office-surface-layer`.

**Чем удержана отрисовка.** `.office-route-panel` и `.office-surface-layer` имели одинаковый
`z-index: 3`, а при равных значениях порядок наложения задаёт позиция в документе. Простой перенос
увёл бы панель под корковую доску. Поэтому в `HowWeWorkPage.module.css` проставлены явные значения:

| Селектор              | Было | Стало | Зачем                                               |
| --------------------- | ---- | ----- | --------------------------------------------------- |
| `.office-route-panel` | 3    | **4** | остаётся над слоями поверхностей, как и была        |
| `.office-progress`    | 3    | **5** | шёл в документе после панели и рисовался поверх неё |
| `.office-wheel-hint`  | 3    | **5** | то же                                               |
| `.office-route-dots`  | 3    | **5** | то же                                               |

Других объявлений `z-index` в файле нет, в медиазапросах они не переопределяются.

**Стало:** `H1 → H3 → H3 → H3 → H3`.

**Визуальная сверка.** Собраны две версии (HEAD и с правками), сняты все пять сцен в desktop
(1440×900) и mobile (iPhone 13) на одном локальном production-сервере:

| Кадр                              | Расхождение   |
| --------------------------------- | ------------- |
| сцены 0, 1 (desktop и mobile)     | 0.000–0.004 % |
| сцены 2, 3, 4 desktop             | 0.072–0.152 % |
| сцена 4 mobile                    | 0.304 %       |
| **сцена 3 mobile (первый замер)** | **9.049 %**   |

Расхождение 9 % разобрано, а не списано: причина — ступенчатая анимация появления заметок
(`--note-index`), второй стикер попал в кадр в разной фазе. Повторный замер с ожиданием полного
завершения анимации: **0.005 %**, геометрия всех четырёх заметок совпала до пикселя
(`37,329 158×143` / `197,331 156×141` / `37,473 158×143` / `197,475 154×139`, `opacity: 1`).

---

## 2. Реальные `lastmod` в `sitemap.xml`

Новый модуль `src/server/content/lastModified.ts` читает **только** колонки `updated_at`.
`new Date()` без аргумента в нём не встречается ни разу; каждое чтение базы обёрнуто в `try/catch`
и при недоступной базе возвращает `undefined` — то есть строку без `lastmod`, а не выдуманную дату.

| Адрес              | Источник даты                                                      |
| ------------------ | ------------------------------------------------------------------ |
| `/`                | `page_content.homepage` + `updated_at` пяти опубликованных отделов |
| `/products`        | `page_content.products` + все опубликованные продукты              |
| `/products/{slug}` | `updated_at` самого продукта                                       |
| `/documents`       | `page_content.documents` + опубликованные документы                |
| `/contacts`        | `page_content.contacts` + каналы связи                             |
| `/blog`            | `page_content.blog` + позднейшая дата изменения статей             |
| `/blog/{slug}`     | `updated_at` статьи (было и раньше)                                |
| `/faq`             | константа `FAQ_PUBLISHED_AT` (было и раньше)                       |
| **`/how-we-work`** | **`lastmod` не проставляется**                                     |

`/how-we-work` — единственная страница без даты: её содержимое целиком лежит в коде
(`HowWeWorkPage.tsx`), в базе у неё нет ни строки. Дата сборки или «сегодня» на её месте были бы
выдумкой, поэтому поля нет вовсе — ровно как требовало задание.

Заодно исправлена дата раздела «Блог»: раньше бралось `blogPosts[0]?.modifiedAt`, то есть первая
строка списка, отсортированного по `sort_order`. Правка старого материала не двигала дату вовсе.
Теперь берётся позднейшая из дат раздела и всех статей.

**Оговорка о точности, которую важно знать владельцу.** У записи, которую ни разу не правили через
админ-панель, `updated_at` равен моменту `db:seed`. Это настоящая дата появления содержимого в
системе, а не отметка времени сборки, и она станет индивидуальной после первой же правки — но
выдавать её за «дату последней содержательной правки текста» нельзя. Это зафиксировано в
док-комментарии модуля.

---

## 3. Meta description продуктов

**Было:** `summary` целиком + цена — от 166 до 251 символа. Выдача обрезала строку механически.

**Стало:** функция `buildProductDescription` (`src/features/products/products.ts`) собирает
кандидатов из **целых предложений** видимого текста — с повтором названия в начале и без него,
с ценой и без неё — и берёт самый длинный, укладывающийся в 160 символов.

| Продукт           | Длина | Цена в описании |
| ----------------- | ----- | --------------- |
| rag-ai-assistant  | 151   | нет             |
| ai-manager        | 156   | да              |
| leads-to-crm      | 141   | нет             |
| crm-ai-assistant  | 150   | да              |
| call-analysis     | 160   | нет             |
| hr-ai-assistant   | 142   | нет             |
| sales-analytics   | 138   | нет             |
| document-analysis | 137   | да              |
| meeting-protocol  | 136   | да              |
| n8n-automation    | 144   | да              |

Все десять — в диапазоне 136–160, все заканчиваются точкой, ни одно не обрывается на полуслове.
Цена добавляется только когда помещается целиком. Видимый текст продуктов не изменён.

Тест: `src/tests/unit/features/products/product-description.test.ts` — длина, отсутствие обрыва,
происхождение текста из видимого `summary`, обращение с ценой и два граничных случая.

**Ограничение.** Функция гарантирует верхнюю границу 160. Нижние 120 — свойство текущих текстов:
если через админ-панель вписать в `summary` одно короткое предложение, description окажется
короче 120, и тест этого не поймает, потому что работает на seed-фикстуре. Вынесено как задача
следующего пакета.

---

## 4. 404 раздела «Блог»

Новые файлы: `src/app/blog/not-found.tsx`, `src/app/blog/not-found.module.css`.

Содержит: `<h1>Статья не найдена</h1>`, объяснение, ссылку «Вернуться в блог» на `/blog`,
фотографию-фон и типографику раздела. `robots: { index: false, follow: false, noarchive: true }`.
HTTP-статус 404 сохраняется — его выставляет `notFound()`, страница отвечает только за содержимое.

Проверено на собранном сайте: статус **404**, `<title>Статья не найдена — QBit-Studio-Ai</title>`,
`<meta name="robots" content="noindex, nofollow, noarchive">`, в браузере ровно один `<h1>`.

### Ограничение, которое НЕ решено этим пакетом

**Тело страницы не отрисовывается на сервере.** В HTML нет ни `<h1>`, ни `<main>` — разметка
приезжает только в RSC-payload и рисуется браузером. Это поведение Next.js 16 при вызове
`notFound()` из компонента маршрута, а не следствие правки:

- до правки та же страница в production отдавала такой же пустой документ (11 040 байт, 0 заголовков);
- `/products/<неизвестный-slug>` ведёт себя точно так же;
- а вот `/несуществующий-адрес`, не совпавший ни с одним маршрутом, отдаётся из пререндеренного
  `/_not-found` и **содержит** `<h1>` в серверном HTML.

Обойти это, отрисовав страницу-заглушку прямо в компоненте, нельзя: она вернула бы статус 200,
то есть «мягкую 404», а это строго хуже для индексации и прямо противоречит требованию сохранить 404. Статус ответа и `noindex` — то, чем на самом деле управляется индексация, — отдаются сервером
корректно, а Google исполняет JavaScript и увидит заголовок.

---

## 5. Редирект `www → non-www` — правка подготовлена, НЕ применена

### Текущее состояние (прочитано с сервера, только чтение)

Файл `/opt/supabase/volumes/proxy/caddy/Caddyfile`, последний блок:

```caddy
allqbit.ru, www.allqbit.ru {
	encode gzip zstd
	reverse_proxy allqbit-site:3000
	header -Server
}
```

Оба имени обслуживаются одним блоком, поэтому `www` отдаёт **полную копию сайта со статусом 200**.
Проверено запросом: `https://www.allqbit.ru/products` → `status=200, redirects=0`. Это полноценный
дубль всего сайта, включая canonical, который на обеих версиях указывает на `https://allqbit.ru`.

### Требуемая правка

Заменить блок выше на два:

```caddy
allqbit.ru {
	encode gzip zstd
	reverse_proxy allqbit-site:3000
	header -Server
}

www.allqbit.ru {
	redir https://allqbit.ru{uri} permanent
	header -Server
}
```

В виде диффа:

```diff
-allqbit.ru, www.allqbit.ru {
+allqbit.ru {
 	encode gzip zstd
 	reverse_proxy allqbit-site:3000
 	header -Server
 }
+
+www.allqbit.ru {
+	redir https://allqbit.ru{uri} permanent
+	header -Server
+}
```

**Почему именно так:**

- `{uri}` — это путь **вместе со строкой запроса**, поэтому `?utm_source=…` и любые параметры
  сохраняются. Плейсхолдер `{path}` их бы потерял;
- `permanent` в Caddy — это **301**, один ответ, без промежуточных переходов:
  `https://www.allqbit.ru/products` → `301` → `https://allqbit.ru/products` → `200`;
- `reverse_proxy` в блоке `www` не нужен: до приложения запрос не доходит вовсе, редирект отдаёт
  сам Caddy — это и гарантирует отсутствие цепочки;
- `encode` в блоке редиректа не нужен — сжимать нечего.

**Единственная неизбежная двухшаговость:** запрос по `http://www.allqbit.ru/...` сначала получит
автоматический редирект Caddy на HTTPS, и только потом — этот 301. Для `https://www...`, а именно
так ходят поисковые системы, переход ровно один.

### Как применить (владельцу, когда решит)

```bash
# 1. Резервная копия
cp /opt/supabase/volumes/proxy/caddy/Caddyfile /opt/supabase/volumes/proxy/caddy/Caddyfile.bak
# 2. Внести правку выше
# 3. Проверить синтаксис и перезагрузить конфиг без простоя
docker exec supabase-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec supabase-caddy caddy reload  --config /etc/caddy/Caddyfile
# 4. Проверить результат
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.allqbit.ru/products
#    ожидается: 301 https://allqbit.ru/products
```

**Правка на сервере не выполнялась.** Конфигурация Caddy только прочитана; ни один файл на сервере
не изменён, ни один контейнер не перезапущен.

---

## 6. Результаты проверок

| Проверка                | Команда                                                                                         | Результат                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Типы                    | `npm run typecheck`                                                                             | **PASS**, без ошибок                             |
| Формат                  | `npm run format:check` (весь проект)                                                            | **PASS**, exit 0                                 |
| Линт (изменённые файлы) | `npx eslint <файлы>`                                                                            | **PASS**, 0 проблем                              |
| Линт (весь проект)      | `npm run lint`                                                                                  | **FAIL — 1 ошибка, предсуществующая** (см. ниже) |
| Unit-тесты              | `npm run test`                                                                                  | **PASS**, 425 из 425 (было 415)                  |
| Сборка                  | `npm run build`                                                                                 | **PASS**                                         |
| E2E                     | `npx playwright test` products-experience, how-we-work-analysis, blog-experience, public-routes | **PASS**, 35                                     |
| E2E accessibility       | `npx playwright test accessibility-scan`                                                        | **PASS**, 11                                     |
| Визуальная сверка       | скриншоты до/после, 12 кадров                                                                   | **PASS**, максимум 0.005 % на устоявшихся кадрах |

Про строку «Формат» отдельно. В первой редакции этого отчёта здесь стояло «PASS» по выборочному
прогону `npx prettier --check` со списком изменённых файлов — а сам отчёт в тот список не входил и
формату не соответствовал. То есть документ, написанный ради честной фиксации проверок, утверждал
о формате не то, что было в репозитории. Найдено независимым ревью, исправлено: отчёт отформатирован,
`npm run format:check` прогнан по всему проекту, exit 0. Выборочные прогоны в этой таблице больше
не используются — только проектные команды из Quality gate.

### Про красный `npm run lint`

```
src/features/how-we-work/HowWeWorkPage.tsx
  231:7  error  react-hooks/set-state-in-effect
```

Ошибка **предсуществующая, этим пакетом не внесена**. Проверено прямо: рабочее дерево убрано в
`git stash`, линт запущен на чистом `HEAD` — та же ошибка, та же строка. Мой диф строк 225–240
не касается (затронуты строки 455+ и 602+). Исправление требует переделки эффекта анимации сцен —
это отдельная работа, и она вне scope этого пакета.

**Общий quality gate CLAUDE.md сейчас не зелёный** из-за этой строки. Умалчивать об этом нельзя,
даже если причина не в текущей правке.

### Наблюдение: один флейк

В одном прогоне `npm run test` упал
`src/tests/unit/components/office/office-scenes.test.ts > keeps every sceneId … resolvable`.
Три последующих полных прогона — 425/425, изолированный прогон файла — 10/10. Диф этого пакета
модулей офисных сцен не касается. Зафиксировано как наблюдение, а не как результат правки.

---

## 7. Что НЕ делалось (по прямому запрету)

Редиректы старых URL, изменение кеширования, оптимизация изображений и JavaScript, подключение
аналитики, изменение дизайна и видимых текстов, деплой. Правка Caddy на сервер не применялась.

## 8. Файлы

Изменены: `src/features/products/ProductInformation.tsx`, `src/features/products/products.ts`,
`src/features/how-we-work/HowWeWorkPage.tsx`, `src/features/how-we-work/HowWeWorkPage.module.css`,
`src/app/sitemap.ts`, `src/tests/unit/features/products/products.test.ts`,
`src/tests/unit/app/robots-and-sitemap.test.ts`, `.gitignore`, `WORKPLAN.md`, `WORKLOG.md`.

Добавлены: `src/server/content/lastModified.ts`, `src/app/blog/not-found.tsx`,
`src/app/blog/not-found.module.css`, `src/tests/unit/features/products/product-description.test.ts`,
`src/tests/unit/app/blog-not-found.test.ts`, `src/tests/unit/server/lastModified.test.ts`,
`SEO_FIX_BATCH_01_REPORT.md`.

## 9. Откат

```bash
git checkout -- src/features/products/ProductInformation.tsx src/features/products/products.ts \
  src/features/how-we-work/HowWeWorkPage.tsx src/features/how-we-work/HowWeWorkPage.module.css \
  src/app/sitemap.ts src/tests/unit/features/products/products.test.ts \
  src/tests/unit/app/robots-and-sitemap.test.ts .gitignore
rm -f src/server/content/lastModified.ts src/app/blog/not-found.tsx src/app/blog/not-found.module.css \
  src/tests/unit/features/products/product-description.test.ts \
  src/tests/unit/app/blog-not-found.test.ts src/tests/unit/server/lastModified.test.ts
```

## 10. Предложения для следующего пакета

1. Применить подготовленную правку Caddy — это единственный пункт пакета, дающий эффект только
   после действия на сервере.
2. `/products/<неизвестный-slug>` отдаёт встроенную англоязычную заглушку Next.js
   («404 — This page could not be found.») на русском сайте — тот же дефект, что был у блога.
3. Нижняя граница длины description не гарантирована функцией — сделать её свойством кода,
   а не текущих текстов.
4. Предсуществующая ошибка линта `react-hooks/set-state-in-effect` в `HowWeWorkPage.tsx:231`.
