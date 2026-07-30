# Матрица маршрутов — SEO/GEO

**Дата снятия:** 2026-07-28, production-сборка (`npm run build` + `npm run start`), порт 3100.
**Источник:** первый серверный ответ, полученный без выполнения JavaScript — то есть ровно то, что
получает поисковый или AI-бот до гидратации.

Отчёт об аудите: [SEO_GEO_AUDIT.md](SEO_GEO_AUDIT.md).

## Условные обозначения

- **index** — страница индексируется: HTTP 200, есть canonical, `robots` = `index, follow`.
- **noindex** — индексация запрещена meta-тегом.
- **—** — к маршруту неприменимо (редирект, служебный файл, JSON API).
- Столбец **sitemap** — присутствует ли canonical-адрес строки в `/sitemap.xml`.
- Title и Description усечены для читаемости; полные значения — в самих страницах.

## Даты и авторы

Отдельных столбцов «дата» и «автор» в таблице нет — они относятся только к статьям и одинаковы по
структуре у всех шести. Для каждой статьи `datePublished` и `dateModified` в JSON-LD, а также
`article:published_time` и `article:modified_time` в Open Graph равны полям `publishedAt` и
`updatedAt` из базы; `author` равен полю автора статьи (у всех шести — `QBit-Studio-Ai`,
то есть организация). Совпадение всех трёх слоёв закреплено E2E-тестом
`blog-experience.spec.ts` → «keeps dates and descriptions consistent across UI, metadata and
BlogPosting». У остальных страниц собственных дат и авторов нет, и они не проставляются.

## Таблица

| URL                                           | HTTP | index   | Title                                              | Description                                                  | Canonical                                     | H1                                       | Schema                                                 | OG  | TW  | sitemap |
| --------------------------------------------- | ---- | ------- | -------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ | --- | --- | ------- |
| `/`                                           | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/?department=sales`                          | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/?department=support`                        | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/?department=management`                     | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/?department=hr`                             | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/?department=logistics`                      | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/?section=task`                              | 200  | index   | ИИ-автоматизация продаж и бизнес-процессов — QBit… | Находим ручные операции и потери между системами. Внедряем … | https://allqbit.ru                            | Автоматизируем продажи, поддержку и док… | Organization, WebSite, WebPage                         | да  | да  | да      |
| `/products`                                   | 200  | index   | Продукты и стоимость — QBit-Studio-Ai              | 10 решений QBit-Studio-Ai для автоматизации продаж, клиентс… | https://allqbit.ru/products                   | Продукты для автоматизации бизнеса       | BreadcrumbList, CollectionPage, ItemList, Organization | да  | да  | да      |
| `/products/rag-ai-assistant`                  | 200  | index   | AI-ассистент по знаниям компании — стоимость разр… | AI-ассистент по знаниям компании — это система, которая нах… | https://allqbit.ru/products/rag-ai-assistant  | AI-ассистент по знаниям компании         | BreadcrumbList, Service, Organization                  | да  | да  | да      |
| `/products/ai-manager`                        | 200  | index   | AI-менеджер для сайта и мессенджеров — стоимость … | AI-менеджер для сайта и мессенджеров — это система, которая… | https://allqbit.ru/products/ai-manager        | AI-менеджер для сайта и мессенджеров     | BreadcrumbList, Service, Organization                  | да  | да  | да      |
| `/documents`                                  | 200  | index   | Документы — QBit-Studio-Ai                         | Корпоративные материалы, презентации и официальные файлы QB… | https://allqbit.ru/documents                  | Документы                                | BreadcrumbList, CollectionPage, Organization           | да  | да  | да      |
| `/how-we-work`                                | 200  | index   | Как мы работаем — QBit-Studio-Ai                   | Не видим результата — говорим прямо. Не продаём то, что не … | https://allqbit.ru/how-we-work                | Мы проектируем автоматизацию, которая р… | BreadcrumbList, AboutPage, Organization                | да  | да  | да      |
| `/faq`                                        | 200  | index   | FAQ об AI-автоматизации бизнеса — QBit-Studio-Ai   | Ответы QBit-Studio-Ai на вопросы об AI-автоматизации: выбор… | https://allqbit.ru/faq                        | Частые вопросы об AI-автоматизации бизн… | BreadcrumbList, FAQPage, Organization                  | да  | да  | да      |
| `/contacts`                                   | 200  | index   | Контакты QBit-Studio-Ai — обсудить AI-автоматизац… | Свяжитесь с QBit-Studio-Ai в Telegram, по телефону или emai… | https://allqbit.ru/contacts                   | Обсудим вашу задачу                      | BreadcrumbList, ContactPage, Organization              | да  | да  | да      |
| `/blog`                                       | 200  | index   | Блог QBit-Studio-Ai                                | Статьи QBit-Studio-Ai об автоматизации обработки заявок, ба… | https://allqbit.ru/blog                       | Блог QBit-Studio-Ai                      | BreadcrumbList, CollectionPage, ItemList, Organization | да  | да  | да      |
| `/blog/kak-avtomatizirovat-obrabotku-zayavok` | 200  | index   | Автоматизация обработки заявок: как связать сайт,… | Автоматизация обработки заявок объединяет сайт, AI-ассистен… | https://allqbit.ru/blog/kak-avtomatizirovat-… | Автоматизация обработки заявок: как свя… | BreadcrumbList, BlogPosting, WebPage, Organization     | да  | да  | да      |
| `/blog/ai-assistent-po-baze-znaniy`           | 200  | index   | AI-ассистент по базе знаний: как работает RAG и г… | AI-ассистент по базе знаний (Knowledge Base) отвечает на во… | https://allqbit.ru/blog/ai-assistent-po-baze… | AI-ассистент по базе знаний: как работа… | BreadcrumbList, BlogPosting, WebPage, Organization     | да  | да  | да      |
| `/blog/analiz-zvonkov-otdela-prodazh`         | 200  | index   | Анализ звонков отдела продаж с помощью AI: что пр… | Анализ разговоров с клиентами с помощью AI — это многокомпо… | https://allqbit.ru/blog/analiz-zvonkov-otdel… | Анализ звонков отдела продаж с помощью … | BreadcrumbList, BlogPosting, WebPage, Organization     | да  | да  | да      |
| `/blog/avtomatizatsiya-dokumentov-s-ai`       | 200  | index   | Автоматизация документов с помощью AI: распознава… | Автоматизация документооборота с AI включает сканирование/р… | https://allqbit.ru/blog/avtomatizatsiya-doku… | Автоматизация документов с помощью AI: … | BreadcrumbList, BlogPosting, WebPage, Organization     | да  | да  | да      |
| `/blog/sayt-crm-i-messendzhery`               | 200  | index   | Как связать сайт, CRM и мессенджеры в единый бизн… | Как объединить сайт, CRM и мессенджеры: передача заявок, но… | https://allqbit.ru/blog/sayt-crm-i-messendzh… | Как связать сайт, CRM и мессенджеры в е… | BreadcrumbList, BlogPosting, WebPage, Organization     | да  | да  | да      |
| `/blog/chto-mozhno-avtomatizirovat-na-n8n`    | 200  | index   | Что можно автоматизировать на n8n: практические с… | n8n — это fair-code платформа автоматизации рабочих процесс… | https://allqbit.ru/blog/chto-mozhno-avtomati… | Что можно автоматизировать на n8n: прак… | BreadcrumbList, BlogPosting, WebPage, Organization     | да  | да  | да      |
| `/login`                                      | 200  | noindex | Вход — QBit-Studio-Ai                              | Вход в панель управления содержимым сайта.                   | —                                             | Вход                                     | —                                                      | нет | нет | нет     |
| `/admin`                                      | 307  | —       | —                                                  | —                                                            | —                                             | —                                        | —                                                      | нет | нет | нет     |
| `/robots.txt`                                 | 200  | —       | —                                                  | —                                                            | —                                             | —                                        | —                                                      | нет | нет | нет     |
| `/sitemap.xml`                                | 200  | —       | —                                                  | —                                                            | —                                             | —                                        | —                                                      | нет | нет | нет     |
| `/blog/nesuschestvuyuschaya-statya`           | 404  | noindex | QBit-Studio-Ai                                     | QBit-Studio-Ai — автоматизация бизнес-процессов для компани… | —                                             | —                                        | —                                                      | нет | нет | нет     |
| `/products/nesuschestvuyuschiy-produkt`       | 404  | noindex | QBit-Studio-Ai                                     | QBit-Studio-Ai — автоматизация бизнес-процессов для компани… | —                                             | —                                        | —                                                      | нет | нет | нет     |
| `/products/product-01`                        | 308  | —       | Продукты и стоимость — QBit-Studio-Ai              | 10 решений QBit-Studio-Ai для автоматизации продаж, клиентс… | https://allqbit.ru/products                   | —                                        | —                                                      | да  | да  | да      |
| `/products/a/b`                               | 404  | noindex | QBit-Studio-Ai                                     | QBit-Studio-Ai — автоматизация бизнес-процессов для компани… | —                                             | —                                        | —                                                      | нет | нет | нет     |
| `/nesuschestvuyuschaya-stranica`              | 404  | noindex | 404: This page could not be found.                 | QBit-Studio-Ai — автоматизация бизнес-процессов для компани… | —                                             | 404                                      | —                                                      | нет | нет | нет     |
| `/api/content/documents`                      | 200  | —       | —                                                  | —                                                            | —                                             | —                                        | —                                                      | нет | нет | нет     |

## Результат проверки

Автоматическая проверка требований аудита по всем 31 маршруту: **0 нарушений**.

Проверялось для каждого индексируемого маршрута: HTTP 200; ровно один непустой и уникальный
`<title>`; ровно одна уникальная `meta description`; ровно один canonical — абсолютный, `https`,
домен `allqbit.ru`, без параметров запроса; `og:url` совпадает с canonical; отсутствие `noindex`;
отсутствие противоречащих `meta robots`; наличие `og:title`, `og:description`, `og:url`, `og:type`,
`og:site_name`, `og:locale`, `og:image`; наличие `twitter:card`, `twitter:title`,
`twitter:description`, `twitter:image`; абсолютность всех адресов изображений; наличие JSON-LD и
его успешный разбор; отсутствие `</script` внутри JSON-LD; отсутствие `localhost` и внутренних
путей в `<head>` и в разметке; `lang="ru"`; ровно один H1; присутствие в `sitemap.xml`.

Проверялось для служебных маршрутов (обратные требования): `noindex` на `/login`; отсутствие в
`sitemap.xml`; реальный HTTP 404 на несуществующих адресах вместе с `noindex` и **без**
противоречащего `index, follow`.

Проверялось для дублей: canonical состояний главной (`?department=…`, `?section=task`) ведёт на
`https://allqbit.ru`.

Проверялось для служебных файлов: `robots.txt` отдаётся как `text/plain` с абсолютной ссылкой на
карту сайта и закрывает `/admin`, `/login`, `/api/`; `sitemap.xml` отдаётся как XML, не содержит
`/admin`, `/login`, `/api/`, адресов с параметрами запроса и якорями.
