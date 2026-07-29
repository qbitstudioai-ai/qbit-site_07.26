import type { Metadata } from "next";
import { getHomepageCopy } from "@/content/homepage-copy";
import { DocumentsExperience } from "@/features/documents/DocumentsExperience";
import { SITE_URL } from "@/features/products/productSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import {
  breadcrumbNode,
  buildOpenGraph,
  buildTwitter,
  INDEXABLE_ROBOTS,
  organizationNode,
  webPageNode,
  withBrand,
} from "@/lib/seo";
import {
  getDocumentCategories,
  getDocumentsPageCopy,
  getPublishedDocuments,
} from "@/server/content/documents";

/**
 * Рендер на запрос — по той же причине, что и у блога (см. `src/app/blog/[[...slug]]/page.tsx`):
 * каталог документов читается только из базы, запасного списка в `data/` для него нет, а образ
 * собирается до того, как база появится. Пререндер запекал пустой раздел, и загруженные документы
 * не показывались, хотя лежали в базе.
 *
 * Здесь у статики есть и вторая беда: ссылка на файл содержит ключ хранилища, который выдаётся
 * при загрузке. Запечённый на сборке адрес указывал бы на файл, которого на томе нет.
 */
export const dynamic = "force-dynamic";

const DOCUMENTS_URL = `${SITE_URL}/documents`;
// Фон раздела — единственная относящаяся к нему картинка; отдельной обложки у раздела нет.
const DOCUMENTS_OG_IMAGE = {
  url: `${SITE_URL}/dox/dox-1600.webp`,
  alt: "Полки с папками корпоративного архива",
};

export async function generateMetadata(): Promise<Metadata> {
  const copy = getDocumentsPageCopy();
  const title = withBrand(copy.headline);

  return {
    title,
    description: copy.seoDescription,
    alternates: { canonical: DOCUMENTS_URL },
    robots: INDEXABLE_ROBOTS,
    openGraph: buildOpenGraph({
      title,
      description: copy.seoDescription,
      url: DOCUMENTS_URL,
      images: [DOCUMENTS_OG_IMAGE],
    }),
    twitter: buildTwitter({
      title,
      description: copy.seoDescription,
      images: [DOCUMENTS_OG_IMAGE.url],
    }),
  };
}

export default function DocumentsPage() {
  const copy = getHomepageCopy();
  const pageCopy = getDocumentsPageCopy();
  // Каталог отдаётся сервером — список и первый предпросмотр видны сразу, без скелетона. Клиентская
  // загрузка через `/api/content/documents` остаётся сценарием повторной попытки после ошибки.
  const documents = getPublishedDocuments();
  const categories = getDocumentCategories();

  /**
   * Раздел описывается как страница-каталог. Отдельными сущностями файлы НЕ описываются: у сайта
   * нет ни авторов, ни дат создания, ни лицензий этих документов в проверяемом виде, а
   * придуманные свойства в разметке хуже её отсутствия.
   */
  const structuredData = [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: pageCopy.headline, url: DOCUMENTS_URL },
    ]),
    webPageNode({
      url: DOCUMENTS_URL,
      name: withBrand(pageCopy.headline),
      description: pageCopy.seoDescription,
      type: "CollectionPage",
    }),
    organizationNode(),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <link
        rel="preload"
        as="image"
        href="/dox/dox-1600.avif"
        imageSrcSet="/dox/dox-960.avif 960w, /dox/dox-1600.avif 1600w"
        imageSizes="100vw"
        type="image/avif"
        fetchPriority="high"
      />
      <DocumentsExperience
        initialDocuments={documents}
        categories={categories}
        pageCopy={pageCopy}
        taskCtaLabel={copy.taskSection.overviewCtaLabel}
        taskCtaHref={copy.contactHref}
      />
    </>
  );
}
