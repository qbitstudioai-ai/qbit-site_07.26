# Аудит SEO и GEO раздела блога QBit-Studio-Ai

Дата аудита: 25 июля 2026 года.  
Режим: только чтение, диагностика и отчёт. Код, контент, metadata, CSS, маршруты, sitemap и конфигурация не изменялись.

## 1. Итоговое заключение

**Общий статус: WARNING / частично готово.**

Все семь ожидаемых страниц существуют: `/blog` и шесть статей. Production build создаёт их как SSG-страницы, все семь URL возвращают HTTP 200, полный текст статей присутствует в исходном HTML, canonical индивидуальны, title и description уникальны, Open Graph/Twitter metadata согласованы, валидный `BlogPosting` и `BreadcrumbList` присутствуют в HTML, все URL включены в sitemap. `noindex`, `nofollow` и запрещающий `X-Robots-Tag` не обнаружены.

| Область | Вердикт | Основание |
|---|---|---|
| SEO | WARNING | индексируемость и metadata корректны, но есть 12 битых внутренних ссылок, `href="#"`, отсутствует robots.txt и нарушена иерархия heading |
| GEO | WARNING | текст структурирован и извлекаем, однако источники не позволяют проверить значимые утверждения |
| Техническая индексируемость | PASS | 7×HTTP 200, SSG HTML, индивидуальные canonical, sitemap, запретов нет |
| Metadata | WARNING | основные поля корректны; CRM description 262 символа, у index нет `og:image:alt` |
| Structured data | WARNING | JSON синтаксически валиден и соответствует страницам; author/publisher расходятся регистром, modified отдельно не показана |
| Внутренняя структура | WARNING | семантический article и рабочее оглавление; H2 rail предшествует H1, id находятся на section |
| Готовность к публикации | WARNING | технически публикуемо, но High-проблема источников и Medium accessibility/link issues требуют решения |

Критических препятствий для индексации не найдено. Публикационный риск создают:

- **High:** разделы «Источники» у четырёх статей не содержат ни одной кликабельной ссылки, а у двух остальных содержат только по одной; многочисленные числовые и исследовательские утверждения нельзя проверить по первоисточнику.
- **Medium:** на каждой статье две ссылки из «Материалов по теме» ведут на отсутствующие локальные маршруты `/ai-assistant-for-business` и `/examples` (12 битых ссылок, HTTP 404).
- **Medium:** `/robots.txt` отсутствует (HTTP 404). Это не блокирует блог, но нет явных правил и директивы `Sitemap`.
- **Medium:** в DOM до H1 расположен служебный H2 «Блог»; id назначены контейнерам `section`, но не самим H2. Оглавление работает, однако формальная структура заголовков неидеальна.
- **Medium:** на мобильной ширине в пяти статьях горизонтально прокручиваемый блок схемы `.codeScroller` недоступен с клавиатуры. Axe классифицирует `scrollable-region-focusable` как `serious`.
- **Medium:** в глобальной шапке всех семи страниц ссылки «FAQ» и «Контакты» имеют `href="#"` и не ведут к содержательным целям.
- **Warning:** индивидуальные статьи и карточки не имеют собственных изображений; используется одна корректная общая брендовая обложка. Это допустимо для OG, но карточки не выполняют проверяемые пункты «изображение/alt».
- **Warning:** видимый автор и `BlogPosting.author` — `QBit-Studio-AI`, издатель — `QBit-Studio-Ai`; различие только в регистре последней буквы, но нейминг организации не полностью единообразен.
- **Проверено с ограничением:** все семь страниц проверены standalone Playwright на 360/768/1440 px геометрически; горизонтального переполнения не найдено. Визуально все семь просмотрены на 768 px, а 360/1440 — на репрезентативной статье, поэтому отсутствие любых pixel-level дефектов остальных страниц на этих двух ширинах — NOT VERIFIED. Lighthouse category scores, Speed Index, INP и полевые CWV не проверены.

## 2. Область проверки

Проверены исключительно:

- общая страница блога;
- шесть опубликованных статей;
- `src/app/blog`, `src/features/blog`, `src/content/blog`, `public/blog`;
- глобальные layout/metadata только в части влияния на блог;
- блоговые URL в sitemap;
- отсутствие/влияние robots.txt и RSS;
- существующие тесты, относящиеся к блогу, и общие безопасные гейты.

Другие страницы не оценивались. Для ссылок за пределы блога проверялся только HTTP-статус цели.

## 3. Среда и архитектура

| Параметр | Фактическое состояние | Статус | Доказательство |
|---|---|---|---|
| Framework | Next.js 16.2.10, React 19.2.4 | PASS | `package.json` |
| Маршрутизация | App Router, optional catch-all `/blog/[[...slug]]` | PASS | `src/app/blog/[[...slug]]/page.tsx` |
| Хранение статей | 6 Markdown-файлов | PASS | `src/content/blog/*.md` |
| Импорт | Markdown копируется в `articles.generated.ts`, SHA-256 сохраняется | PASS | `scripts/import-blog-research.mjs`, `src/features/blog/articles.generated.ts` |
| Генерация страниц | `generateStaticParams`, `dynamicParams=false` | PASS | `src/app/blog/[[...slug]]/page.tsx:21-24` |
| Режим | SSG, статический HTML | PASS | `next build`: маршрут `● /blog/[[...slug]]` |
| Общий шаблон | `BlogExperience` | PASS | `src/features/blog/BlogExperience.tsx:139` |
| Metadata | `generateMetadata` для индекса и каждой статьи | PASS | `src/app/blog/[[...slug]]/page.tsx:27-77` |
| JSON-LD | `blogIndexStructuredData`, `blogPostStructuredData` | PASS | `src/features/blog/blogSeo.ts`, вставка в `page.tsx:104-109` |
| Sitemap | Next MetadataRoute | PASS | `src/app/sitemap.ts` |
| RSS | Не реализован | WARNING | нет файлов/маршрутов; `/rss.xml`, `/feed.xml`, `/blog/rss.xml` → 404 |
| Время чтения | слова основного body / 180, округление вверх | PASS | `src/features/blog/posts.ts:91-115` |
| Общая OG-обложка | WebP 1672×941, 72 584 байта; AVIF 1672×941, 41 756 байт | PASS | `public/blog/workspace-notebook-*`, Sharp metadata, HTTP 200 |

## 4. Реестр страниц

Базовый публичный домен во всех metadata: `https://allqbit.ru`.

| № | Тип | Название | URL | Slug | Источник | Публикация |
|---:|---|---|---|---|---|---|
| 0 | Индекс | Блог QBit-Studio-Ai | `https://allqbit.ru/blog` | — | `BlogExperience.tsx` + `posts.ts` | Опубликован |
| 1 | Статья | Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM | `https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok` | `kak-avtomatizirovat-obrabotku-zayavok` | `src/content/blog/kak-avtomatizirovat-obrabotku-zayavok.md` | `draft=false`, 25.07.2026 |
| 2 | Статья | AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу | `https://allqbit.ru/blog/ai-assistent-po-baze-znaniy` | `ai-assistent-po-baze-znaniy` | `src/content/blog/ai-assistent-po-baze-znaniy.md` | `draft=false`, 25.07.2026 |
| 3 | Статья | Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить | `https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh` | `analiz-zvonkov-otdela-prodazh` | `src/content/blog/analiz-zvonkov-otdela-prodazh.md` | `draft=false`, 24.07.2026 |
| 4 | Статья | Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных | `https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai` | `avtomatizatsiya-dokumentov-s-ai` | `src/content/blog/avtomatizatsiya-dokumentov-s-ai.md` | `draft=false`, 22.07.2026 |
| 5 | Статья | Как связать сайт, CRM и мессенджеры в единый бизнес-процесс | `https://allqbit.ru/blog/sayt-crm-i-messendzhery` | `sayt-crm-i-messendzhery` | `src/content/blog/sayt-crm-i-messendzhery.md` | `draft=false`, 25.07.2026 |
| 6 | Статья | Что можно автоматизировать на n8n: практические сценарии для бизнеса | `https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n` | `chto-mozhno-avtomatizirovat-na-n8n` | `src/content/blog/chto-mozhno-avtomatizirovat-na-n8n.md` | `draft=false`, 21.07.2026 |

Число опубликованных статей равно ожидаемому: **6**.

## 5. Сводная оценка

| Страница | Technical SEO | Metadata | Content SEO | Structured Data | GEO | Mobile | Performance | Итог |
|---|---|---|---|---|---|---|---|---|
| `/blog` | WARNING | PASS | PASS | PASS | PASS | PASS | WARNING | WARNING |
| Заявки | WARNING | PASS | FAIL | WARNING | WARNING | FAIL | WARNING | WARNING |
| RAG | WARNING | PASS | FAIL | WARNING | WARNING | FAIL | WARNING | WARNING |
| Звонки | WARNING | PASS | FAIL | WARNING | WARNING | FAIL | WARNING | WARNING |
| Документы | WARNING | PASS | FAIL | WARNING | WARNING | FAIL | WARNING | WARNING |
| CRM | WARNING | WARNING | FAIL | WARNING | WARNING | FAIL | WARNING | WARNING |
| n8n | WARNING | PASS | FAIL | WARNING | WARNING | PASS | WARNING | WARNING |

`FAIL` в Content SEO означает проверяемые битые ссылки и/или отсутствие первичных ссылок на источники; это не означает отсутствие основного текста. `FAIL` в Mobile — конкретное serious-нарушение Axe на ширине 360 px. Performance отмечен как WARNING, потому что локальные метрики хорошие, но Lighthouse и полевые CWV отсутствуют.

## 6. Аудит общей страницы блога

URL: `https://allqbit.ru/blog`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/маршрут | 200; `/blog/` → 308 на `/blog`; неправильных дублей не найдено | PASS |
| HTML | production HTML 33 238 байт, список всех 6 статей присутствует без выполнения JS | PASS |
| H1 | один: `Блог QBit-Studio-Ai` | PASS |
| Outline | `H2: Блог` расположен до H1 | WARNING |
| Карточки | 6 ссылок; title, URL, excerpt, дата, время, категория согласованы | PASS |
| Изображения карточек | отсутствуют; есть только общая декоративная фоновая фотография | WARNING |
| Черновики/заглушки | точный поиск по заданным маркерам — 0 совпадений | PASS |
| Семантика | один `main`, один `article`, список ссылок доступен в серверном HTML | PASS |
| JSON-LD | один `BreadcrumbList` и один `ItemList` из 6 элементов | PASS |
| GEO | H1 и первый блок прямо называют блог и темы; конкретные технологии видны в карточках | PASS |
| Header links | `FAQ` и `Контакты` имеют `href="#"` | FAIL |
| Mobile/visual | 360/768/1440 без overflow/перекрытий; Axe 360/1440 без violations | PASS |

Фактические metadata:

| Поле | Значение |
|---|---|
| title | `Блог об автоматизации бизнес-процессов — QBit-Studio-Ai` |
| description | `Статьи QBit-Studio-Ai об автоматизации обработки заявок, баз знаний, звонков, документов и интеграций бизнес-систем.` |
| canonical / og:url | `https://allqbit.ru/blog` |
| robots / X-Robots-Tag | тег отсутствует / заголовок отсутствует; запрещающих директив нет |
| og:title | совпадает с title |
| og:description | совпадает с description |
| og:type | `website` |
| og:image | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| Twitter | `summary_large_image`; title/description/image совпадают с OG |
| lang / charset / viewport | `ru` / `UTF-8` / `width=device-width, initial-scale=1, viewport-fit=cover` |

## 7. Статья 1 — автоматизация заявок

URL: `https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/indexability | 200, не soft-404, canonical собственный, sitemap есть, `draft=false`, noindex/X-Robots отсутствуют | PASS |
| title | `Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM — QBit-Studio-Ai` (86 символов) | PASS |
| description | `Автоматизация обработки заявок объединяет сайт, AI-ассистента и CRM в единый процесс.` (85) | PASS |
| OG/Twitter | собственные title/description/URL; `article`; image HTTP 200 | PASS |
| H1 | один, совпадает по смыслу с title | PASS |
| Дерево материала | H2: Что такое автоматизация заявок?; Кому и когда это подходит?; Бизнес-проблема без автоматизации; Рабочий подход; Этапы внедрения; Критерии проверки; Реальные сценарии; Ограничения и условия применения; Типичные ошибки внедрения; Краткий итог; Источники; Материалы по теме | PASS |
| Breadcrumbs | Главная → Блог → статья; видимая nav и 3 элемента JSON-LD | PASS |
| Автор/дата | `QBit-Studio-AI`; `<time datetime="2026-07-25">25 июля 2026</time>` | PASS |
| Изменение | `dateModified=2026-07-25`, отдельная видимая дата изменения отсутствует | WARNING |
| Чтение | 991 слово / 180 = 5,51 → отображается `6 мин` | PASS |
| Оглавление | 12 реальных H2; все якоря ведут на существующие уникальные section id | PASS |
| Контент/GEO | полный текст в HTML; определения, этапы, критерии, ограничения и итог автономно извлекаемы | PASS |
| Источники | числовые утверждения о ВШЭ и Ростелекоме без URL | FAIL |
| Ссылки | `/ai-assistant-for-business` и `/examples` → 404; связанные статьи и CTA валидны | FAIL |
| Изображения | только декоративный фон; индивидуальных inline-изображений нет | NOT APPLICABLE |
| CTA | после материала, отделён footer, `https://t.me/Promt_Pavel` → 200 | PASS |
| Mobile/visual | 360/768/1440 без document overflow; Axe 360: serious `scrollable-region-focusable` | FAIL |

## 8. Статья 2 — RAG-ассистент

URL: `https://allqbit.ru/blog/ai-assistent-po-baze-znaniy`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/indexability | 200, собственный canonical, sitemap, `draft=false`, без запретов | PASS |
| title | `AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу — QBit-Studio-Ai` (87) | PASS |
| description | `AI-ассистент по базе знаний (Knowledge Base) отвечает на вопросы, извлекая информацию из внутренней документации и справочников.` (128) | PASS |
| OG/Twitter | значения конкретной статьи, `article`, абсолютные URL | PASS |
| H1/outline | один H1; до него служебный H2 `Блог` | WARNING |
| H2 материала | Что такое AI-ассистент по базе знаний и RAG?; Кому и когда это подходит; Задача ассистента; Рабочий подход; Критерии проверки; Реальные примеры; Ограничения и условия применения; Типичные ошибки внедрения; Краткий итог; Источники; Материалы по теме | PASS |
| Breadcrumbs | видимая цепочка и JSON-LD согласованы | PASS |
| Автор/даты | `QBit-Studio-AI`, 25.07.2026; JSON-LD/OG совпадают | PASS |
| Чтение | 907 / 180 = 5,04 → `6 мин`; исходная строка Markdown `~7 минут` не используется | WARNING |
| Оглавление | 11 якорей, цели существуют; проверено адресным Playwright-probe | PASS |
| Контент/GEO | полное объяснение RAG, роли retrieval/generation, ограничений и контроля человеком | PASS |
| Источники | Lewis et al., Wikipedia и «эксперты» названы без URL/библиографии | FAIL |
| Ссылки | два материала по теме → 404; две связанные статьи валидны | FAIL |
| CTA | после статьи, Telegram → 200 | PASS |
| Mobile/visual | 360/768/1440 без document overflow; Axe 360: serious `scrollable-region-focusable` | FAIL |

## 9. Статья 3 — анализ звонков

URL: `https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/indexability | 200, собственный canonical/sitemap, нет запретов | PASS |
| title | `Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить — QBit-Studio-Ai` (88) | PASS |
| description | `Анализ разговоров с клиентами с помощью AI — это многокомпонентный процесс, позволяющий проверять качество продаж и обучать менеджеров.` (135) | PASS |
| OG/Twitter | согласованы, `article`, абсолютные URL | PASS |
| H1/H2 | один тематический H1; 12 H2 материала; перед H1 есть H2 `Блог` | WARNING |
| H2 материала | Что проверяет AI в звонках?; Кому и когда это подходит; Бизнес-проблема; Рабочий подход; Этапы внедрения; Проверяемый список критериев; Реальные сценарии; Ограничения и условия применения; Типичные ошибки внедрения; Краткий итог; Источники; Материалы по теме | PASS |
| Автор/дата | `QBit-Studio-AI`, 24.07.2026; metadata/JSON-LD совпадают | PASS |
| Чтение | 1067 / 180 = 5,93 → `6 мин` | PASS |
| Оглавление | 12 уникальных целей, ссылки разрешаются | PASS |
| GEO | ясные ASR/диаризация/критерии; ограничения и роль человека обозначены | PASS |
| Источники | общие ссылки на «исследования» без названия и URL | FAIL |
| Ссылки | оба материала по теме → 404 | FAIL |
| CTA | после основного материала, Telegram → 200 | PASS |
| Mobile/visual | 360/768/1440 без document overflow; Axe 360: serious `scrollable-region-focusable` | FAIL |

## 10. Статья 4 — документы

URL: `https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/indexability | 200, canonical/sitemap собственные, без запретов | PASS |
| title | `Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных — QBit-Studio-Ai` (99) | PASS |
| description | `Автоматизация документооборота с AI включает сканирование/распознавание текста, классификацию документов и извлечение ключевых реквизитов с последующей проверкой.` (162) | PASS |
| OG/Twitter | согласованы; общая обложка доступна | PASS |
| H1/H2 | один H1; 12 H2 материала; служебный H2 идёт до H1 | WARNING |
| H2 материала | Что такое автоматизация документов?; Кому и когда это подходит; Бизнес-проблема; Рабочий подход; Этапы внедрения; Проверяемый список критериев; Реальные сценарии; Ограничения и условия применения; Типичные ошибки внедрения; Краткий итог; Источники; Материалы по теме | PASS |
| Автор/дата | `QBit-Studio-AI`, 22.07.2026; согласованы | PASS |
| Чтение | 1019 / 180 = 5,66 → `6 мин` | PASS |
| Оглавление/адаптив | якорь проверен адресным Playwright-probe; 1440 и 360 px без горизонтального overflow; mobile menu/Escape работают | PASS |
| Доступность | Axe 360: serious `scrollable-region-focusable`; Axe 1440: 0 violations | FAIL |
| GEO | OCR, извлечение, валидация, сценарии и ограничения разделены | PASS |
| Источники | кейсы «Татспиртпром» и «Альфа Капитал» без ссылок | FAIL |
| Ссылки | два материала по теме → 404 | FAIL |
| CTA | видим после материала в адресном Playwright-probe, Telegram → 200 | PASS |
| Mobile/visual | 360/768/1440 без document overflow; Axe 360: serious `scrollable-region-focusable` | FAIL |

## 11. Статья 5 — сайт, CRM и мессенджеры

URL: `https://allqbit.ru/blog/sayt-crm-i-messendzhery`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/indexability | 200, собственный canonical/sitemap, нет запретов | PASS |
| title | `Как связать сайт, CRM и мессенджеры в единый бизнес-процесс — QBit-Studio-Ai` (76) | PASS |
| description | полный текст длиной 262 символа; не оборван и уникален, но чрезмерно подробен для сниппета | WARNING |
| OG/Twitter | согласованы с description и canonical | PASS |
| H1/H2 | один H1; 9 H2 материала; H2 `Блог` до H1 | WARNING |
| H2 материала | Что включает связность каналов?; Этапы внедрения; Проверяемый список критериев; Реальные сценарии; Ограничения и условия применения; Типичные ошибки внедрения; Краткий итог; Источники; Материалы по теме | PASS |
| Автор/дата | `QBit-Studio-AI`, 25.07.2026; согласованы | PASS |
| Чтение | 891 / 180 = 4,95 → `5 мин`; Markdown содержит `~6 минут` | WARNING |
| Оглавление | 9 уникальных целей, все существуют | PASS |
| GEO | webhook/API, нормализация, дедупликация и ограничения названы явно | PASS |
| Источники | `n8n docs` → HTTP 200; неподтверждённый кейс «одной компании» без ссылки | WARNING |
| Ссылки | `/examples`, `/ai-assistant-for-business` → 404 | FAIL |
| CTA | Telegram → 200 | PASS |
| Mobile/visual | 360/768/1440 без document overflow; Axe 360: serious `scrollable-region-focusable` | FAIL |

## 12. Статья 6 — n8n

URL: `https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n`.

| Параметр | Факт | Статус |
|---|---|---|
| HTTP/indexability | 200, собственный canonical/sitemap, без запретов | PASS |
| title | `Что можно автоматизировать на n8n: практические сценарии для бизнеса — QBit-Studio-Ai` (85) | PASS |
| description | `n8n — это fair-code платформа автоматизации рабочих процессов, объединяющая логику бизнес-процессов и AI-компоненты.` (116) | PASS |
| OG/Twitter | согласованы, абсолютные URL | PASS |
| H1/H2 | один H1; 9 H2 материала; H2 `Блог` до H1 | WARNING |
| H2 материала | Особенности n8n (лицензия); Сценарии автоматизации на n8n; Пошаговое описание; Важные моменты и ограничения; Ограничения n8n и лицензия; Примеры реального применения; Краткий итог; Источники; Материалы по теме | PASS |
| Автор/дата | `QBit-Studio-AI`, 21.07.2026; согласованы | PASS |
| Чтение | 945 / 180 = 5,25 → `6 мин`; Markdown содержит `~7 минут` | WARNING |
| Оглавление | 9 уникальных целей, все существуют | PASS |
| GEO | конкретные workflow, входы/выходы, ограничения лицензии и критерии выбора извлекаемы | PASS |
| Источники | `https://allqbit.ru/examples` → 200; утверждения о лицензии и GitHub-звёздах не ведут на первоисточник | WARNING |
| Ссылки | локальные `/examples` и `/ai-assistant-for-business` → 404 | FAIL |
| CTA | Telegram → 200 | PASS |
| Mobile/visual | 360/768/1440 без document overflow; Axe 360/1440 без violations | PASS |

## 13. Метаданные

Общие HTML/content/image/link проверки статей:

| Параметр | Фактический результат |
|---|---|
| Основной текст | 6/6 полностью в SSG HTML; scripts не нужны для чтения |
| Семантика | по одному `main` и `article`, вложенных `article` нет; списки семантические |
| Код/схемы | `<pre><code>`; у пяти схем мобильный keyboard issue описан как `BLOG-A11Y-010` |
| Таблицы / blockquote | в переданном контенте отсутствуют, проверка структуры N/A |
| Изображения | общий декоративный фон: `alt=""`, 1672×941, `fetchPriority="high"`, `decoding="async"`; WebP srcset 960/1672, AVIF preload; hotlink отсутствует |
| Logo | декоративный `alt=""`, 90×64; локальный `/logo.svg` |
| Inline/card images | отсутствуют; N/A для loading/alt каждого материала, отдельное наблюдение `BLOG-CARD-008` |
| External link safety | все внешние ссылки открываются с `target="_blank"` и `rel="noopener noreferrer"` |

Полный реестр внешних ссылок:

| Статья/секция | Anchor | URL | HTTP | Тип источника | target / rel |
|---|---|---|---:|---|---|
| CRM / Источники | `n8n docs` | `https://docs.n8n.io/` | 200 | официальная документация | `_blank` / `noopener noreferrer` |
| n8n / Источники | `Примеры AI-автоматизации` | `https://allqbit.ru/examples` | 200 | собственные примеры/secondary | `_blank` / `noopener noreferrer` |
| все 6 / CTA | текст CTA связи | `https://t.me/Promt_Pavel` | 200 | контактный канал, не источник | `_blank` / `noopener noreferrer` |

У статей 1–4 внешних ссылок в «Источниках» нет. Две 404-ссылки «Материалов по теме» являются внутренними (`/ai-assistant-for-business`, `/examples`) и учтены отдельно.

| URL | Title | Description | Canonical | Robots | OG type | OG URL | OG image |
|---|---|---|---|---|---|---|---|
| `/blog` | `Блог об автоматизации бизнес-процессов — QBit-Studio-Ai` (55) | `Статьи QBit-Studio-Ai об автоматизации обработки заявок, баз знаний, звонков, документов и интеграций бизнес-систем.` (116) | `https://allqbit.ru/blog` | meta и X-Robots отсутствуют | `website` | `https://allqbit.ru/blog` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| `/blog/kak-avtomatizirovat-obrabotku-zayavok` | `Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM — QBit-Studio-Ai` (86) | `Автоматизация обработки заявок объединяет сайт, AI-ассистента и CRM в единый процесс.` (85) | `https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok` | отсутствуют | `article` | `https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| `/blog/ai-assistent-po-baze-znaniy` | `AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу — QBit-Studio-Ai` (87) | `AI-ассистент по базе знаний (Knowledge Base) отвечает на вопросы, извлекая информацию из внутренней документации и справочников.` (128) | `https://allqbit.ru/blog/ai-assistent-po-baze-znaniy` | отсутствуют | `article` | `https://allqbit.ru/blog/ai-assistent-po-baze-znaniy` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| `/blog/analiz-zvonkov-otdela-prodazh` | `Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить — QBit-Studio-Ai` (88) | `Анализ разговоров с клиентами с помощью AI — это многокомпонентный процесс, позволяющий проверять качество продаж и обучать менеджеров.` (135) | `https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh` | отсутствуют | `article` | `https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| `/blog/avtomatizatsiya-dokumentov-s-ai` | `Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных — QBit-Studio-Ai` (99) | `Автоматизация документооборота с AI включает сканирование/распознавание текста, классификацию документов и извлечение ключевых реквизитов с последующей проверкой.` (162) | `https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai` | отсутствуют | `article` | `https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| `/blog/sayt-crm-i-messendzhery` | `Как связать сайт, CRM и мессенджеры в единый бизнес-процесс — QBit-Studio-Ai` (76) | `Связать сайт, CRM и мессенджеры означает построить автоматический канал передачи данных: когда посетитель взаимодействует с сайтом (оставляет заявку или запускает чат), информация сразу поступает в CRM и при необходимости в мессенджеры ответственных сотрудников.` (262) | `https://allqbit.ru/blog/sayt-crm-i-messendzhery` | отсутствуют | `article` | `https://allqbit.ru/blog/sayt-crm-i-messendzhery` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |
| `/blog/chto-mozhno-avtomatizirovat-na-n8n` | `Что можно автоматизировать на n8n: практические сценарии для бизнеса — QBit-Studio-Ai` (85) | `n8n — это fair-code платформа автоматизации рабочих процессов, объединяющая логику бизнес-процессов и AI-компоненты.` (116) | `https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n` | отсутствуют | `article` | `https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n` | `https://allqbit.ru/blog/workspace-notebook-1672.webp` |

Все семь `title`, `description`, canonical и `og:url` уникальны. На каждой странице ровно один title и один canonical. Canonical абсолютные, HTTPS, на `allqbit.ru`, не содержат localhost и совпадают с sitemap/OG. Twitter использует `summary_large_image`; title, description и image совпадают с OG. У статей есть `og:image:alt` «Рабочий стол с открытым блокнотом», у `/blog` этот тег отсутствует. Description CRM не оборван, но 262 символа создают высокий риск переписывания/обрезки сниппета.

Фактические article/social-поля шести статей:

| Статья | og:title | og:description | article published / modified / author | Twitter |
|---|---|---|---|---|
| Заявки | `Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM` | `Автоматизация обработки заявок объединяет сайт, AI-ассистента и CRM в единый процесс.` | `2026-07-25` / `2026-07-25` / `QBit-Studio-AI` | `summary_large_image`; title/description/image равны OG |
| RAG | `AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу` | `AI-ассистент по базе знаний (Knowledge Base) отвечает на вопросы, извлекая информацию из внутренней документации и справочников.` | `2026-07-25` / `2026-07-25` / `QBit-Studio-AI` | `summary_large_image`; title/description/image равны OG |
| Звонки | `Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить` | `Анализ разговоров с клиентами с помощью AI — это многокомпонентный процесс, позволяющий проверять качество продаж и обучать менеджеров.` | `2026-07-24` / `2026-07-24` / `QBit-Studio-AI` | `summary_large_image`; title/description/image равны OG |
| Документы | `Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных` | `Автоматизация документооборота с AI включает сканирование/распознавание текста, классификацию документов и извлечение ключевых реквизитов с последующей проверкой.` | `2026-07-22` / `2026-07-22` / `QBit-Studio-AI` | `summary_large_image`; title/description/image равны OG |
| CRM | `Как связать сайт, CRM и мессенджеры в единый бизнес-процесс` | `Связать сайт, CRM и мессенджеры означает построить автоматический канал передачи данных: когда посетитель взаимодействует с сайтом (оставляет заявку или запускает чат), информация сразу поступает в CRM и при необходимости в мессенджеры ответственных сотрудников.` | `2026-07-25` / `2026-07-25` / `QBit-Studio-AI` | `summary_large_image`; title/description/image равны OG |
| n8n | `Что можно автоматизировать на n8n: практические сценарии для бизнеса` | `n8n — это fair-code платформа автоматизации рабочих процессов, объединяющая логику бизнес-процессов и AI-компоненты.` | `2026-07-21` / `2026-07-21` / `QBit-Studio-AI` | `summary_large_image`; title/description/image равны OG |

## 14. Структурированные данные

JSON во всех блоках успешно разобран `JSON.parse`. На каждой статье найден ровно один `BreadcrumbList` и один `BlogPosting`; конфликтующих `Article`, `FAQPage`, `HowTo`, `Product`, `Review`, `AggregateRating`, `LocalBusiness` нет.

Полный фактический шаблон `BreadcrumbList` статьи (значения `TITLE`/`URL` ниже заменяются значениями конкретной строки):

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Главная","item":"https://allqbit.ru"},{"@type":"ListItem","position":2,"name":"Блог","item":"https://allqbit.ru/blog"},{"@type":"ListItem","position":3,"name":"TITLE","item":"URL"}]}
```

Точные подстановки третьего элемента (позиции 1–2 во всех шести блоках равны показанному шаблону):

| Статья | `name` | `item` |
|---|---|---|
| Заявки | `Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM` | `https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok` |
| RAG | `AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу` | `https://allqbit.ru/blog/ai-assistent-po-baze-znaniy` |
| Звонки | `Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить` | `https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh` |
| Документы | `Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных` | `https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai` |
| CRM | `Как связать сайт, CRM и мессенджеры в единый бизнес-процесс` | `https://allqbit.ru/blog/sayt-crm-i-messendzhery` |
| n8n | `Что можно автоматизировать на n8n: практические сценарии для бизнеса` | `https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n` |

Полные фактические блоки общей страницы:

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Главная","item":"https://allqbit.ru"},{"@type":"ListItem","position":2,"name":"Блог","item":"https://allqbit.ru/blog"}]}
```

```json
{"@context":"https://schema.org","@type":"ItemList","name":"Статьи QBit-Studio-Ai","url":"https://allqbit.ru/blog","numberOfItems":6,"itemListElement":[{"@type":"ListItem","position":1,"name":"Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM","url":"https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok"},{"@type":"ListItem","position":2,"name":"AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу","url":"https://allqbit.ru/blog/ai-assistent-po-baze-znaniy"},{"@type":"ListItem","position":3,"name":"Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить","url":"https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh"},{"@type":"ListItem","position":4,"name":"Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных","url":"https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai"},{"@type":"ListItem","position":5,"name":"Как связать сайт, CRM и мессенджеры в единый бизнес-процесс","url":"https://allqbit.ru/blog/sayt-crm-i-messendzhery"},{"@type":"ListItem","position":6,"name":"Что можно автоматизировать на n8n: практические сценарии для бизнеса","url":"https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n"}]}
```

Полные фактические `BlogPosting` (массив keywords приведён полностью):

```json
{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok#article","headline":"Автоматизация обработки заявок: как связать сайт, AI-ассистента и CRM","description":"Автоматизация обработки заявок объединяет сайт, AI-ассистента и CRM в единый процесс.","datePublished":"2026-07-25","dateModified":"2026-07-25","wordCount":991,"inLanguage":"ru-RU","articleSection":"Процессы","keywords":["обработка заявок","AI-ассистент","CRM"],"author":{"@type":"Organization","name":"QBit-Studio-AI","url":"https://allqbit.ru"},"publisher":{"@type":"Organization","@id":"https://allqbit.ru/#organization","name":"QBit-Studio-Ai","url":"https://allqbit.ru","logo":{"@type":"ImageObject","url":"https://allqbit.ru/logo.svg"}},"mainEntityOfPage":{"@type":"WebPage","@id":"https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok"},"url":"https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok","image":"https://allqbit.ru/blog/workspace-notebook-1672.webp"}
```

```json
{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://allqbit.ru/blog/ai-assistent-po-baze-znaniy#article","headline":"AI-ассистент по базе знаний: как работает RAG и где он полезен бизнесу","description":"AI-ассистент по базе знаний (Knowledge Base) отвечает на вопросы, извлекая информацию из внутренней документации и справочников.","datePublished":"2026-07-25","dateModified":"2026-07-25","wordCount":907,"inLanguage":"ru-RU","articleSection":"AI-ассистенты","keywords":["RAG","база знаний","AI-ассистент"],"author":{"@type":"Organization","name":"QBit-Studio-AI","url":"https://allqbit.ru"},"publisher":{"@type":"Organization","@id":"https://allqbit.ru/#organization","name":"QBit-Studio-Ai","url":"https://allqbit.ru","logo":{"@type":"ImageObject","url":"https://allqbit.ru/logo.svg"}},"mainEntityOfPage":{"@type":"WebPage","@id":"https://allqbit.ru/blog/ai-assistent-po-baze-znaniy"},"url":"https://allqbit.ru/blog/ai-assistent-po-baze-znaniy","image":"https://allqbit.ru/blog/workspace-notebook-1672.webp"}
```

```json
{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh#article","headline":"Анализ звонков отдела продаж с помощью AI: что проверять и как внедрить","description":"Анализ разговоров с клиентами с помощью AI — это многокомпонентный процесс, позволяющий проверять качество продаж и обучать менеджеров.","datePublished":"2026-07-24","dateModified":"2026-07-24","wordCount":1067,"inLanguage":"ru-RU","articleSection":"Продажи","keywords":["анализ звонков","отдел продаж","AI"],"author":{"@type":"Organization","name":"QBit-Studio-AI","url":"https://allqbit.ru"},"publisher":{"@type":"Organization","@id":"https://allqbit.ru/#organization","name":"QBit-Studio-Ai","url":"https://allqbit.ru","logo":{"@type":"ImageObject","url":"https://allqbit.ru/logo.svg"}},"mainEntityOfPage":{"@type":"WebPage","@id":"https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh"},"url":"https://allqbit.ru/blog/analiz-zvonkov-otdela-prodazh","image":"https://allqbit.ru/blog/workspace-notebook-1672.webp"}
```

```json
{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai#article","headline":"Автоматизация документов с помощью AI: распознавание, извлечение и проверка данных","description":"Автоматизация документооборота с AI включает сканирование/распознавание текста, классификацию документов и извлечение ключевых реквизитов с последующей проверкой.","datePublished":"2026-07-22","dateModified":"2026-07-22","wordCount":1019,"inLanguage":"ru-RU","articleSection":"Документы","keywords":["OCR","обработка документов","AI"],"author":{"@type":"Organization","name":"QBit-Studio-AI","url":"https://allqbit.ru"},"publisher":{"@type":"Organization","@id":"https://allqbit.ru/#organization","name":"QBit-Studio-Ai","url":"https://allqbit.ru","logo":{"@type":"ImageObject","url":"https://allqbit.ru/logo.svg"}},"mainEntityOfPage":{"@type":"WebPage","@id":"https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai"},"url":"https://allqbit.ru/blog/avtomatizatsiya-dokumentov-s-ai","image":"https://allqbit.ru/blog/workspace-notebook-1672.webp"}
```

```json
{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://allqbit.ru/blog/sayt-crm-i-messendzhery#article","headline":"Как связать сайт, CRM и мессенджеры в единый бизнес-процесс","description":"Связать сайт, CRM и мессенджеры означает построить автоматический канал передачи данных: когда посетитель взаимодействует с сайтом (оставляет заявку или запускает чат), информация сразу поступает в CRM и при необходимости в мессенджеры ответственных сотрудников.","datePublished":"2026-07-25","dateModified":"2026-07-25","wordCount":891,"inLanguage":"ru-RU","articleSection":"Интеграции","keywords":["CRM","мессенджеры","интеграция сайта"],"author":{"@type":"Organization","name":"QBit-Studio-AI","url":"https://allqbit.ru"},"publisher":{"@type":"Organization","@id":"https://allqbit.ru/#organization","name":"QBit-Studio-Ai","url":"https://allqbit.ru","logo":{"@type":"ImageObject","url":"https://allqbit.ru/logo.svg"}},"mainEntityOfPage":{"@type":"WebPage","@id":"https://allqbit.ru/blog/sayt-crm-i-messendzhery"},"url":"https://allqbit.ru/blog/sayt-crm-i-messendzhery","image":"https://allqbit.ru/blog/workspace-notebook-1672.webp"}
```

```json
{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n#article","headline":"Что можно автоматизировать на n8n: практические сценарии для бизнеса","description":"n8n — это fair-code платформа автоматизации рабочих процессов, объединяющая логику бизнес-процессов и AI-компоненты.","datePublished":"2026-07-21","dateModified":"2026-07-21","wordCount":945,"inLanguage":"ru-RU","articleSection":"n8n","keywords":["n8n","бизнес-процессы","интеграции"],"author":{"@type":"Organization","name":"QBit-Studio-AI","url":"https://allqbit.ru"},"publisher":{"@type":"Organization","@id":"https://allqbit.ru/#organization","name":"QBit-Studio-Ai","url":"https://allqbit.ru","logo":{"@type":"ImageObject","url":"https://allqbit.ru/logo.svg"}},"mainEntityOfPage":{"@type":"WebPage","@id":"https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n"},"url":"https://allqbit.ru/blog/chto-mozhno-avtomatizirovat-na-n8n","image":"https://allqbit.ru/blog/workspace-notebook-1672.webp"}
```

Все обязательные поля заполнены и согласованы с metadata/видимым H1. Изображение и logo возвращают 200. Единственный конфликт доверия — регистр `AI`/`Ai` в author/publisher. Видимая дата изменения отсутствует, поэтому `dateModified` подтверждается моделью данных, но не отдельной подписью на странице.

## 15. Sitemap, robots.txt и RSS

Sitemap: `http://127.0.0.1:3401/sitemap.xml`, production HTTP 200, генерируется `src/app/sitemap.ts`.

| URL | В sitemap | Canonical совпадает | Дубли | Lastmod | Статус |
|---|---|---|---|---|---|
| `https://allqbit.ru/blog` | да | да | нет | 2026-07-25 | PASS |
| `.../kak-avtomatizirovat-obrabotku-zayavok` | да | да | нет | 2026-07-25 | PASS |
| `.../ai-assistent-po-baze-znaniy` | да | да | нет | 2026-07-25 | PASS |
| `.../analiz-zvonkov-otdela-prodazh` | да | да | нет | 2026-07-24 | PASS |
| `.../avtomatizatsiya-dokumentov-s-ai` | да | да | нет | 2026-07-22 | PASS |
| `.../sayt-crm-i-messendzhery` | да | да | нет | 2026-07-25 | PASS |
| `.../chto-mozhno-avtomatizirovat-na-n8n` | да | да | нет | 2026-07-21 | PASS |

Всего 7 блоговых URL, 7 уникальных. Старых, draft-, localhost- и slash-дублей нет.

`/robots.txt` возвращает 404. Следовательно, явного `Disallow: /blog` нет и CSS/JS правилами robots не блокируются; одновременно отсутствует `Sitemap:`. На страницах нет `noindex`/`nofollow`, ответы не содержат `X-Robots-Tag`. Статус: **WARNING**, а не блокирующий FAIL.

RSS не найден: `/rss.xml`, `/feed.xml`, `/blog/rss.xml` → 404, файлов RSS/feed нет. Для архитектуры статического блога RSS не является обязательным условием индексации, поэтому **WARNING / NOT APPLICABLE для проверки записей**, но канал распространения отсутствует.

## 16. GEO-аудит

| Статья | Понятность темы | Структура | Источники | Авторство | Извлекаемость | Цитируемость | Ограничения | Итог |
|---|---|---|---|---|---|---|---|---|
| Заявки | PASS | PASS | FAIL | WARNING | PASS | PASS | PASS | WARNING |
| RAG | PASS | PASS | FAIL | WARNING | PASS | PASS | PASS | WARNING |
| Звонки | PASS | PASS | FAIL | WARNING | PASS | PASS | PASS | WARNING |
| Документы | PASS | PASS | FAIL | WARNING | PASS | PASS | PASS | WARNING |
| CRM | PASS | PASS | WARNING | WARNING | PASS | PASS | PASS | WARNING |
| n8n | PASS | PASS | WARNING | WARNING | PASS | PASS | PASS | WARNING |

Общие положительные признаки:

- тема сформулирована в H1 и первом абзаце;
- текст, списки и код находятся в HTML, а не изображениях/вкладках;
- каждый раздел посвящён одной задаче;
- ограничения технологий и участие человека явно обозначены;
- скрытых «ответов для ChatGPT», FAQ-разметки без FAQ, keyword stuffing и AI-only блоков не найдено;
- шесть Markdown и шесть полных HTML-текстов различны; скрытых мобильных дублей нет.

Недостаточный контекст чаще всего возникает в разделах «Источники»: «исследования показывают», «эксперты указывают», «одна компания» не идентифицируют источник. Наиболее автономны определения, списки этапов, критерии и ограничения. Заголовки «Рабочий подход», «Реальные сценарии» и «Краткий итог» понятны только вместе с H1 статьи, но внутри одной article-структуры это приемлемо.

Обоснование по статьям:

- **Заявки:** тема и определение появляются сразу, этапы и критерии автономно цитируемы; упоминания ВШЭ и Ростелекома не снабжены URL, поэтому проверяемость недостаточна.
- **RAG:** retrieval/generation, границы применимости и human control разделены ясно; Lewis et al., Wikipedia и «эксперты» названы без библиографических ссылок.
- **Звонки:** ASR, диаризация, критерии и роль человека извлекаются как законченные фрагменты; раздел источников не идентифицирует исследования.
- **Документы:** OCR pipeline, классификация, валидация и ограничения структурированы; числовые/исследовательские утверждения нельзя связать с первоисточником.
- **CRM:** workflow, нормализация, дедупликация и ошибки описаны конкретно; есть рабочая ссылка на n8n Docs, но анонимный кейс Telegram–CRM не проверяем.
- **n8n:** сценарии имеют входы/выходы и ограничения лицензии; ссылка на примеры работает, но fair-code/licensing и число GitHub stars не связаны с первичной страницей.

## 17. Мобильная и визуальная проверка

Все семь production-страниц проверены standalone Playwright при ширинах 360, 768 и 1440 px — 21 геометрическая комбинация. В каждой измерены viewport/document width, положение H1 и наличие ключевых блоков. Контактный лист всех страниц на 768 px и верх/низ репрезентативной статьи на 360 и 1440 px просмотрены визуально. Поэтому pixel-level читаемость/перекрытия пяти остальных статей и index на 360/1440 — **NOT VERIFIED**. Временные снимки находились вне проекта и удалены.

| Проверка | 360 px | 768 px | 1440 px |
|---|---|---|---|
| Горизонтальный overflow документа | 0 на 7/7 | 0 на 7/7 | 0 на 7/7 |
| H1 внутри viewport, без обрезания | PASS 7/7 | PASS 7/7 | PASS 7/7 |
| Источники/материалы/related/CTA в DOM и достижимы | PASS 6/6 | PASS 6/6 | PASS 6/6 |
| Визуальные перекрытия/сломанная сетка | не найдено у репрезентативной статьи; остальные NOT VERIFIED | не найдено на 7/7 | не найдено у репрезентативной статьи; остальные NOT VERIFIED |
| Axe serious/critical | FAIL 5/7 | не запускался | PASS 7/7 |

Мобильный Axe:

| Страница | Результат на 360 px |
|---|---|
| `/blog` | PASS, 0 violations |
| Заявки | FAIL: `scrollable-region-focusable`, serious |
| RAG | FAIL: `scrollable-region-focusable`, serious |
| Звонки | FAIL: `scrollable-region-focusable`, serious |
| Документы | FAIL: `scrollable-region-focusable`, serious |
| CRM | FAIL: `scrollable-region-focusable`, serious |
| n8n | PASS, 0 violations |

Причина: `<div className={styles.codeScroller}>` (`src/features/blog/BlogExperience.tsx:100`) получает `overflow-x:auto` (`BlogExperience.module.css:436-439`), но не фокусируется и не содержит фокусируемого элемента. Нарушаются требования клавиатурного доступа WCAG 2.1.1/2.1.3. На desktop область не становится scrollable, поэтому Axe 1440 px не сообщает ошибку.

Дополнительно проверено: все ссылки оглавления имеют уникальную существующую цель и корректно меняют hash; Escape закрывает мобильное меню и возвращает focus; у сфокусированной кнопки меню видимая сплошная рамка 3 px. У ряда inline-ссылок в breadcrumbs/TOC/материалах измеренная высота 16–21 px; для текстовых ссылок действуют исключения WCAG target-size, поэтому это наблюдение, а не подтверждённый FAIL.

Ограничения visual checklist: H1 на всех 21 геометрических проверках находился внутри viewport, но точное число строк переноса не записывалось; таблиц в контенте нет (N/A); клик TOC проверен адресно, но не повторён на каждой из трёх ширин каждой статьи. Эти подпункты не следует считать полным pixel-level PASS.

## 18. Производительность

Lighthouse в проекте не установлен и новые зависимости не добавлялись. Поэтому Lighthouse Performance/SEO/Accessibility/Best Practices, Speed Index, INP и полевые Core Web Vitals — **NOT VERIFIED**. Ниже — фактические Navigation/PerformanceObserver measurements локального production-сервера, cold context, Chromium, без CPU/network throttling. Они пригодны для сравнения, но не являются полевыми CWV или Lighthouse.

| Страница | TTFB | FCP | LCP | CLS | TBT | DCL | load | requests | transfer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/blog` | 7,1 ms | 124 ms | 124 ms | 0 | 4 ms | 25,3 ms | 160,8 ms | 56 | 440 189 B |
| `/blog/avtomatizatsiya-dokumentov-s-ai` | 6,7 ms | 236 ms | 236 ms | 0 | 50 ms | 40,7 ms | 242,5 ms | 56 | 445 503 B |

Разбивка transfer:

| Страница | Document | Script | CSS | Image | Fetch |
|---|---:|---:|---:|---:|---:|
| `/blog` | 7 680 B | 203 916 B | 24 183 B | 160 224 B | 44 186 B |
| статья «Документы» | 12 492 B | 203 916 B | 24 183 B | 160 224 B | 44 688 B |

Production HTML всех статей — 45 154–49 929 байт, index — 33 238 байт. Console errors и page errors: 0 на всех семи страницах. Пара speculative Next RSC-prefetch запросов к корню завершалась `net::ERR_ABORTED`; это отменённые prefetch, не поломка CSS/JS/image. Все обязательные локальные ресурсы возвращают 200.

| URL | Production HTML |
|---|---:|
| `/blog` | 33 238 B |
| заявки | 47 152 B |
| RAG | 46 639 B |
| звонки | 49 827 B |
| документы | 49 929 B |
| CRM | 47 327 B |
| n8n | 45 154 B |

Общая для страниц тяжёлая картинка — фоновый WebP 1672×941, 72 584 B (браузерный image transfer с оптимизированными вариантами отражён выше). Сторонних runtime-script/style/image не обнаружено; внешние URL находятся только в ссылках и не блокируют рендер. Blocking-resource/Lighthouse opportunities отдельно не рассчитаны.

## 19. Дубликаты и конфликты

| Параметр | Найденный дубль/конфликт | Страницы | Критичность | Статус |
|---|---|---|---|---|
| title | нет | все 7 | — | PASS |
| description | нет | все 7 | — | PASS |
| canonical / og:url / JSON-LD URL | нет | все 7 | — | PASS |
| H1 / slug / полный Markdown hash | нет | 6 статей | — | PASS |
| Общая OG-обложка | один файл | все 7 | допустимо | PASS |
| og:image:alt | одинаковый описательный alt | 6 статей | Low | WARNING |
| Section id | одинаковые слова на разных URL, но уникальны внутри страницы | статьи | не конфликтует | PASS |
| Author/publisher | `QBit-Studio-AI` ↔ `QBit-Studio-Ai` | 6 статей | Low | WARNING |
| Видимое/JSON-LD dateModified | отдельная видимая дата изменения отсутствует | 6 статей | Low | WARNING |
| Ссылки header | `FAQ` и `Контакты` имеют `href="#"` | все 7 | Medium | FAIL |
| Мобильные code scroller | 5 одинаковых unfocusable scroll regions | статьи 1–5 | Medium | FAIL |

Матрица согласованности:

| Статья | H1 ↔ title | URL ↔ canonical | Canonical ↔ OG | Автор ↔ JSON-LD | Дата ↔ JSON-LD | Sitemap | RSS | Карточка |
|---|---|---|---|---|---|---|---|---|
| Заявки | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS |
| RAG | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS |
| Звонки | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS |
| Документы | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS |
| CRM | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS |
| n8n | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS |

## 20. Найденные проблемы

Сводный реестр ниже содержит обязательные поля; развёрнутые доказательства следуют после него. Номера строк относятся к состоянию файлов на дату аудита.

| ID / severity | URL | Файл/строка или компонент | Факт → ожидание | Доказательство | Последствие | Рекомендация (не применена) |
|---|---|---|---|---|---|---|
| `BLOG-GEO-001` High | 6 статей | `src/content/blog/*.md`, «Источники» | 0/0/0/0/1/1 URL → первичные URL для значимых claims | HTML + `rg` по разделам | низкая проверяемость/GEO trust | добавить прямые первоисточники |
| `BLOG-SEO-002` Medium | 6 статей | `src/content/blog/*.md`, «Материалы» | 12 ссылок дают 404 → цели 200 | HTTP probe двух путей на каждой статье | потеря crawl/user path | заменить цели или создать маршруты |
| `BLOG-SEO-003` Medium | `/robots.txt` | route/file отсутствует | HTTP 404 → явная crawl policy + Sitemap | production HTTP probe | управление crawling неявно | добавить MetadataRoute robots |
| `BLOG-HTML-004` Medium | все 7 | `BlogExperience.tsx`, rail | DOM начинается H2, затем H1 → H1 до подчинённых H2 | heading-tree из production DOM | менее ясный outline | изменить семантику rail heading |
| `BLOG-HTML-005` Medium | 6 статей | `markdown.ts`, `BlogExperience.tsx` | id на section → по ТЗ id на H2/H3 | DOM: H2 id=null, parent section id задан | формальное расхождение контракта | согласовать/перенести id |
| `BLOG-A11Y-010` Medium | статьи 1–5 | `BlogExperience.tsx:100`, CSS `436-439` | scroll region не focusable → keyboard reachable | Axe 360 `serious` | схема недоступна клавиатурой | добавить корректный focus contract |
| `BLOG-LINK-011` Medium | все 7 | `data/homepage-copy.json:37-43`, `blog/layout.tsx:11` | FAQ/Контакты `href="#"` → реальные цели | production DOM href | ложная навигация | указать URL/anchor или убрать link |
| `BLOG-META-006` Low | 6 статей | `blogSeo.ts`/данные автора | `AI` ↔ `Ai` → одно entity name | visible author + JSON-LD parse | слабый entity signal | унифицировать написание |
| `BLOG-META-007` Low | 6 статей | `BlogExperience.tsx`, `BlogPosting` | modified есть только в schema → видимая дата при реальном update | один visible time, JSON-LD dates | неясна свежесть | показывать update либо не сигнализировать |
| `BLOG-CARD-008` Low | `/blog` | карточки `BlogExperience` | 0 card images → осознанный text-only контракт или images+alt | DOM: 6 cards, 0 card img | менее различимые previews | документировать решение/добавить обложки |
| `BLOG-META-009` Low | CRM | metadata статьи | description 262 символа → компактный snippet | фактический meta content/length | вероятное переписывание сниппета | сократить без потери смысла |
| `BLOG-META-012` Low | `/blog` | index metadata | нет `og:image:alt` → alt как у articles | parsed head | неполный social metadata | добавить точный alt |
| `BLOG-A11Y-013` Low | все 7 mobile | breadcrumbs/TOC/material links | 16–21 px высота → удобная touch area/spacing | Playwright geometry 360 px | возможны miss-taps | ручной touch-аудит и spacing |

### Critical

Не найдено.

### High

**BLOG-GEO-001 — непроверяемые/неполные источники.**

- URL: все шесть статей.
- Файлы: `src/content/blog/*.md`, раздел `Источники`.
- Факт: статьи 1–4 не содержат ни одного URL в «Источниках»; статья 5 содержит только `https://docs.n8n.io`; статья 6 — только `https://allqbit.ru/examples`. При этом присутствуют конкретные цифры, организации, исследования и кейсы.
- Ожидание: каждое значимое внешнее утверждение связано с идентифицируемым первоисточником и кликабельным URL.
- Доказательство: production HTML и `rg -n "Источники|https?://" src/content/blog`.
- Последствие: низкая проверяемость и доверие, ухудшение GEO-цитируемости.
- Рекомендация (не применена): добавить прямые первичные источники и связать их с конкретными утверждениями.

### Medium

**BLOG-SEO-002 — 12 битых внутренних ссылок.**

- URL: все шесть статей.
- Файл/компонент: `src/content/blog/*.md`, раздел `Материалы по теме`; рендер `BlogExperience.tsx`.
- Факт: `/ai-assistant-for-business` → 404 и `/examples` → 404; по две ссылки на статью.
- Ожидание: существующие релевантные цели.
- Последствие: потеря crawl path и плохой пользовательский переход.
- Рекомендация: заменить на существующие маршруты или создать цели отдельной задачей.

**BLOG-SEO-003 — отсутствует robots.txt.**

- URL: `/robots.txt`.
- Факт: production HTTP 404; файлов robots нет.
- Ожидание: явные разрешающие правила и `Sitemap: https://allqbit.ru/sitemap.xml`, если это политика проекта.
- Последствие: блог не заблокирован, но управление crawling и обнаружение sitemap неявны.
- Рекомендация: добавить MetadataRoute robots отдельной задачей.

**BLOG-HTML-004 — H2 предшествует H1.**

- URL: `/blog` и все статьи.
- Компонент: `BlogExperience.tsx`, rail heading перед article header.
- Факт: итоговый outline начинается `H2: Блог`, затем H1.
- Ожидание: логичная иерархия, в которой основной H1 предшествует подчинённым H2.
- Последствие: менее ясный document outline для парсеров/assistive technology.
- Рекомендация: изменить семантический уровень служебного заголовка без визуального изменения.

**BLOG-HTML-005 — id находятся на section, а не H2.**

- URL: все статьи.
- Компоненты: `markdown.ts`, `BlogExperience.tsx`.
- Факт: `<section id="..."><h2>...</h2>`; H2 без id. Все TOC href работают.
- Ожидание ТЗ: уникальные стабильные id у H2/H3.
- Последствие: функционально якоря корректны, формальное требование не выполнено.
- Рекомендация: согласовать контракт и при необходимости переносить id на H2.

**BLOG-A11Y-010 — мобильная прокручиваемая область недоступна с клавиатуры.**

- URL: статьи «Заявки», RAG, «Звонки», «Документы», CRM.
- Компонент: `src/features/blog/BlogExperience.tsx:100`; стили `BlogExperience.module.css:436-439`.
- Факт: Axe на 360 px: `scrollable-region-focusable`, impact `serious`; `.codeScroller` имеет `overflow-x:auto`, но не попадает в tab order.
- Последствие: пользователь клавиатуры не может прокрутить широкую текстовую схему.
- Рекомендация: сделать область программно фокусируемой с доступным именем либо изменить структуру содержимого; проверить keyboard scroll и повторить Axe.

**BLOG-LINK-011 — служебные ссылки header ведут на `#`.**

- URL: `/blog` и все шесть статей.
- Источник: `data/homepage-copy.json:37-43`, передача через `src/app/blog/layout.tsx:11`.
- Факт: «FAQ» и «Контакты» имеют `href="#"`; клик не открывает целевой раздел/страницу.
- Последствие: ложные crawl/user paths и неработающая навигация.
- Рекомендация: указать реальные локальные URL/anchors или убрать семантику ссылки.

### Low

**BLOG-META-006 — неединообразный регистр имени организации.**

- Факт: author `QBit-Studio-AI`, publisher/title `QBit-Studio-Ai`.
- Последствие: слабый entity-consistency сигнал.
- Рекомендация: выбрать одно написание во всех видимых и структурированных данных.

**BLOG-META-007 — дата изменения не показана пользователю.**

- Факт: `dateModified` всегда равна `datePublished`; видим только один `<time>`.
- Последствие: пользователь не может отличить публикацию от обновления.
- Рекомендация: либо явно показывать обновление, либо не создавать отдельный сигнал без реального обновления.

**BLOG-CARD-008 — нет изображений карточек.**

- URL: `/blog`.
- Факт: 6 карточек, 0 `img` внутри списка; фон общий и декоративный.
- Последствие: не выполнены пункты проверки per-card image/alt, хотя текстовая доступность не страдает.
- Рекомендация: считать это осознанным design decision либо добавить содержательные обложки.

**BLOG-META-009 — длинный description статьи CRM.**

- Факт: 262 символа, не оборван, уникален.
- Последствие: поисковая система вероятно сформирует/обрежет сниппет.
- Рекомендация: сократить без потери смысла; длина сама по себе не является технической ошибкой.

**BLOG-META-012 — у index OG-изображения нет alt.**

- URL: `/blog`.
- Факт: `og:image` присутствует, `og:image:alt` отсутствует; у шести статей alt есть.
- Последствие: неполное описание social preview и конфликт консистентности metadata.
- Рекомендация: задать содержательное `og:image:alt`, согласованное с изображением.

**BLOG-A11Y-013 — небольшая высота некоторых inline-ссылок.**

- Факт: на 360 px breadcrumbs, TOC и ссылки материалов имеют измеренную высоту 16–21 px.
- Последствие: возможное снижение удобства касания; inline-text exception не позволяет считать это автоматическим нарушением WCAG.
- Рекомендация: при следующем ручном touch-аудите проверить расстояние между соседними целями и реальную область нажатия.

## 21. Что не удалось проверить

- Lighthouse category scores, Speed Index и INP: инструмент отсутствует.
- Полевые LCP/CLS/INP: нет RUM/CrUX/Search Console данных.
- Встроенный in-app Browser не подключился из-за ошибки sandboxPolicy среды. Проверка выполнена standalone Playwright; это не ограничило DOM/visual/axe-результаты.
- Профильный `blog-experience.spec.ts` запустил пять тестов, но общий запуск прерван внешним timeout через 240,3 с до итогового verdict. Поэтому результат самого suite — NOT VERIFIED; эквивалентные адресные probes завершились успешно, кроме отдельно описанного мобильного Axe.
- Реальность юридического лица/организации автора вне данных самого блога: внешняя проверка автора не входила в задачу.
- Фактическая индексация публичным поисковиком: проверялась техническая индексируемость локальной production-сборки.

## 22. Выполненные команды

| Команда/проверка | Код | Длительность | Результат | Относится к блогу |
|---|---:|---:|---|---|
| `git status --short` до аудита | 0 | <1 c | рабочее дерево уже было сильно изменено/содержало untracked blog | фиксация состояния |
| `npm.cmd run lint` | 1 | 21,6 c | 2 существующие ошибки в `HowWeWorkPage.tsx:230,590` | нет; не исследовались |
| `npm.cmd run typecheck` | 0 | 3,6 c | ошибок нет | да |
| `npm.cmd run test` | 0 | 20,8 c | 27 files, 218 tests passed | да, включая unit блога |
| `npm.cmd run build` | 0 | 19,9 c | production build успешен; 26 страниц; блог SSG | да |
| `npx.cmd eslint src/app/blog src/features/blog src/app/sitemap.ts src/tests/e2e/blog-experience.spec.ts src/tests/unit/features/blog/posts.test.ts scripts/import-blog-research.mjs` | 0 | 6,6 c | ошибок нет | да |
| `npx.cmd playwright test src/tests/e2e/blog-experience.spec.ts --project=chromium` | 124 | 240,3 c | timeout до итогового verdict | да; NOT VERIFIED |
| `node node_modules/next/dist/bin/next start -p 3401` (через скрытый `Start-Process`) | 0 | отдельно не зафиксирована | сервер готов, затем штатно остановлен | да |
| inline Node/Playwright HTTP/DOM/JSON-LD/links probes | 0 | 0,6–21 c на серию | 7×200, metadata/schema/links извлечены | да |
| inline Playwright 360/768/1440 + Axe probes | 0 | до 21 c на серию | 21 viewport; mobile serious на 5 статьях | да |
| Node + Sharp `metadata()`/file-size probe для `public/blog/*` | 0 | <1 c | AVIF/WebP размеры подтверждены | да |
| `npm.cmd ls lighthouse --depth=0` | 1 | <1 c | `(empty)`, Lighthouse отсутствует | да |
| `curl.exe -I` для внешних целей | 0 | 3,2 c | n8n Docs, allqbit examples, Telegram → 200 | да |

Build выдал 20 предупреждений Turbopack `AVIF image not supported` для импортированных офисных сцен вне блога. Сборка успешна; блоговые файлы `public/blog` доступны с HTTP 200.

Первый буквальный вызов `npm` через PowerShell не дошёл до проекта: execution policy заблокировал `npm.ps1`; все project-команды затем запускались через `npm.cmd`. Тексты одноразовых inline probe-скриптов не сохранялись по правилу «только один файл отчёта», поэтому таблица фиксирует их точный класс, exit code, диапазон времени и результат, но не воспроизводит многострочный исходник — это ограничение журнала команд.

## 23. Состояние Git

До аудита `git status --short` уже показывал большое число пользовательских `M`, `D` и `??`, включая untracked-каталоги блога, `src/app/sitemap.ts`, `artifacts/` и `reports/`. Файл `reports/blog-seo-geo-audit.md` также уже существовал; его исходный SHA-256: `0899B1C51D6645F51B7A078C817F8141771F102F958917716E7AA11BD514A7B8`, размер 58 150 байт.

Для полного porcelain-снимка до аудита вычислен стабильный hash:

```text
d8aebea432830db62e77a17645cf62098f0c1447
```

После обновления только разрешённого отчёта `git status --porcelain=v1` даёт тот же hash:

```text
d8aebea432830db62e77a17645cf62098f0c1447
```

Причина: `reports/` был untracked и до проверки, поэтому изменение содержимого находящегося в нём отчёта не меняет porcelain-перечень. Ни один код состояния файла сайта не добавился и не изменился. Production preview остановлен, порт 3401 не слушается; временных `blog-audit-*` снимков в `%TEMP%` не осталось. Единственное намеренное файловое изменение этой задачи — обновление данного отчёта.

## 24. Финальный вердикт

| № | Вопрос | Ответ | Краткое доказательство |
|---:|---|---|---|
| 1 | Может ли робот получить полный текст? | ДА | весь article присутствует в production HTML SSG |
| 2 | Индексируется ли каждая статья по собственному URL? | ДА | 6×200, canonical индивидуальны, noindex нет |
| 3 | Уникальны ли title и description? | ДА | 7/7 уникальны |
| 4 | Правильны ли canonical? | ДА | абсолютные HTTPS, текущие URL, совпадают с OG/sitemap |
| 5 | Корректны ли OG/Twitter? | ЧАСТИЧНО | согласованы, image доступен; у index отсутствует `og:image:alt` |
| 6 | Соответствует ли JSON-LD видимому содержанию? | ЧАСТИЧНО | H1/description/date/author совпадают; publisher отличается регистром, modified не видна отдельно |
| 7 | Все ли статьи в sitemap? | ДА | 6 статей + индекс, без дублей |
| 8 | Не блокирует ли robots.txt блог? | ДА | robots.txt отсутствует, noindex/X-Robots отсутствуют; отсутствие файла — warning |
| 9 | Сохранены ли источники? | ЧАСТИЧНО | разделы сохранены и hashes совпадают, но большинство первичных URL отсутствуют |
| 10 | Согласованы ли автор и даты? | ЧАСТИЧНО | author/date совпадают; регистр publisher расходится, modified отдельно не видна |
| 11 | Работает ли оглавление? | ДА | href разрешаются в уникальные section id; адресный Playwright-клик прошёл |
| 12 | Нет ли старого чернового текста? | ДА | точный поиск по заданным маркерам — 0 |
| 13 | Доступен ли контент без клиентского JS? | ДА | полный текст в SSG HTML |
| 14 | Пригодна ли структура для генеративного извлечения? | ЧАСТИЧНО | структура сильная, источники и entity consistency слабее |
| 15 | Есть ли critical/high препятствия публикации? | ДА | Critical нет; High — непроверяемые источники; дополнительно serious mobile Axe |
| 16 | Можно ли считать SEO правильным? | ЧАСТИЧНО | core metadata/indexability исправны; robots, ссылки и семантика требуют внимания |
| 17 | Можно ли считать GEO правильным? | ЧАСТИЧНО | темы/структура/извлекаемость хороши; проверяемость источников недостаточна |

**Решение:** техническая публикация и индексация возможны, но считать настройку полностью завершённой нельзя. До релиза желательно устранить High-проблему источников и Medium-проблемы битых/пустых ссылок, robots, outline и клавиатурного доступа к мобильным схемам. Никакие исправления сайта в рамках аудита не применялись.
