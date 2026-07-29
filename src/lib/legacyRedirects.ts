/**
 * Постоянные переадресации адресов, которые существовали до текущей структуры сайта.
 *
 * Список живёт отдельным модулем, а не прямо в `next.config.ts`, по одной причине: его читают три
 * потребителя — сама конфигурация Next.js, unit-тест (состав, отсутствие цепочек, существование
 * получателей) и e2e-тест (реальные коды ответа production-сборки). Разъехавшийся между ними
 * список означал бы, что тесты проверяют не то, что применено.
 *
 * Почему `redirects()` в конфигурации, а не middleware. Middleware исполняется на Edge для каждого
 * подходящего запроса, а его текущий `matcher` покрывает только `/admin`; расширение matcher'а ради
 * пяти неизменных адресов добавило бы работу на каждый запрос и втянуло бы SEO-переадресации в
 * модуль, отвечающий за авторизацию. `redirects()` попадает в routes-manifest и обрабатывается
 * маршрутизатором до рендера — дешевле и не трогает защиту админ-панели.
 *
 * ВАЖНО про изменяемые адреса. Комментарий в начале `next.config.ts` предупреждает: список
 * `redirects()` фиксируется на сборке, а slug продукта редактируется в админ-панели. Здесь это
 * ограничение принято сознательно — требование заказчика: ровно один переход без цепочек, поэтому
 * `/integrations` обязан вести сразу на конечный адрес, а не на `/products/product-03`, который
 * страница продукта развернула бы вторым переходом. Плата за это — если slug продукта или статьи
 * переименуют в админ-панели, переадресация начнёт вести на 404 до следующей сборки. Сторожем
 * служит unit-тест: он падает, как только адрес получателя пропадает из исходных данных.
 */

export interface LegacyRedirect {
  /** Прежний адрес. Без завершающего слэша и без query — параметры Next.js переносит сам. */
  readonly source: string;
  /** Действующий адрес. Никогда не главная: переадресация обязана сохранять смысл страницы. */
  readonly destination: string;
}

export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  { source: "/pricing", destination: "/products" },
  { source: "/integrations", destination: "/products/leads-to-crm" },
  { source: "/blog/ai-document-automation", destination: "/blog/avtomatizatsiya-dokumentov-s-ai" },
  { source: "/blog/lead-automation-telegram-crm", destination: "/blog/sayt-crm-i-messendzhery" },
  {
    source: "/blog/n8n-business-automation",
    destination: "/blog/chto-mozhno-avtomatizirovat-na-n8n",
  },
];

/**
 * Адреса, которые этот пакет обязан оставить нетронутыми (прямое ограничение задачи).
 *
 * Список здесь, а не в тестах, намеренно: это часть контракта самой таблицы переадресаций, и
 * держать его рядом с ней — единственный способ не дать следующей правке молча добавить один из
 * этих адресов в `LEGACY_REDIRECTS`. Тесты на него опираются, но не владеют им.
 */
export const REDIRECT_EXCLUDED_URLS: readonly string[] = [
  "/ai-assistant-for-business",
  "/blog/ai-assistant-business-tasks",
  "/blog/ai-agents-for-business",
  "/blog/data-parser-automation",
  "/blog/telegram-bot-dlya-biznesa",
];
