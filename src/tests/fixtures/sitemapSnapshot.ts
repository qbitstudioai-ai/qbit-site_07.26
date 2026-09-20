/**
 * Снимок production-карты сайта на 2026-09-18 — ровно 39 canonical-адресов, прочитанных с живого
 * домена (`curl https://allqbit.ru/sitemap.xml`).
 *
 * Фикстура намеренно перечисляет адреса строками, а не собирается из источников контента: она
 * изображает ВНЕШНИЙ ответ, который проверяет предполётная логика. Сборка её из тех же модулей,
 * что и сам `sitemap.ts`, превратила бы тест в тавтологию.
 *
 * Состав: 8 код-роутов + 5 отделов + 10 продуктов + 8 статей + 8 кейсов.
 */
const ORIGIN = "https://allqbit.ru";

export const CODE_PATHS = [
  "",
  "/products",
  "/documents",
  "/how-we-work",
  "/faq",
  "/contacts",
  "/blog",
  "/cases",
] as const;

export const SOLUTION_PATHS = [
  "/solutions/sales",
  "/solutions/support",
  "/solutions/management",
  "/solutions/hr",
  "/solutions/logistics",
] as const;

export const PRODUCT_PATHS = [
  "/products/ai-manager",
  "/products/call-analysis",
  "/products/crm-ai-assistant",
  "/products/document-analysis",
  "/products/hr-ai-assistant",
  "/products/leads-to-crm",
  "/products/meeting-protocol",
  "/products/n8n-automation",
  "/products/rag-ai-assistant",
  "/products/sales-analytics",
] as const;

export const ARTICLE_PATHS = [
  "/blog/ai-assistent-po-baze-znaniy",
  "/blog/analiz-zvonkov-otdela-prodazh",
  "/blog/avtomatizatsiya-dokumentov-s-ai",
  "/blog/chto-mozhno-avtomatizirovat-na-n8n",
  "/blog/kak-avtomatizirovat-obrabotku-zayavok",
  "/blog/kak-ponyat-chto-avtomatizirovat-v-biznes",
  "/blog/pochemu-ii-ne-rabotaet-v-biznes",
  "/blog/sayt-crm-i-messendzhery",
] as const;

export const CASE_PATHS = [
  "/cases/analiz-raboty-polevoy-komandy",
  "/cases/analiz-zvonkov-otdela-prodazh",
  "/cases/kontrol-prodazh-wildberries-ozon",
  "/cases/obrabotka-dokumentov-schetov-zayavok",
  "/cases/podderzhka-po-baze-znaniy",
  "/cases/sbor-zayavok-v-crm",
  "/cases/upravlencheskiy-otchet-sobstvenniku",
  "/cases/yandex-direct-metrika-analytics",
] as const;

export const absolute = (path: string) => `${ORIGIN}${path}`;

/** Ровно то, что отдаёт production: 39 адресов. */
export function productionSitemapUrls(): string[] {
  return [...CODE_PATHS, ...SOLUTION_PATHS, ...PRODUCT_PATHS, ...ARTICLE_PATHS, ...CASE_PATHS].map(
    absolute,
  );
}
