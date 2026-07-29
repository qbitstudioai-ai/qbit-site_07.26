import type { Metadata } from "next";
import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import { HowWeWorkPage } from "@/features/how-we-work/HowWeWorkPage";
import { serializeJsonLd } from "@/lib/jsonLd";
import {
  breadcrumbNode,
  buildOpenGraph,
  buildTwitter,
  INDEXABLE_ROBOTS,
  organizationNode,
  SITE_URL,
  webPageNode,
  withBrand,
} from "@/lib/seo";

const HOW_WE_WORK_URL = `${SITE_URL}/how-we-work`;

const title = withBrand("Как мы работаем");

/**
 * Описание — видимый текст первой сцены страницы (`HowWeWorkPage.tsx`, сцена «Миссия и ценности»);
 * он же стоит под заголовком в серверном HTML.
 *
 * Прежнее значение — «Интерактивная офисная сцена QBit-Studio-Ai: миссия, анализ, внедрение,
 * подход и письмо» — описывало устройство компонента и перечисляло внутренние имена сцен. В
 * поисковой выдаче это ничего не сообщало о содержании страницы.
 *
 * Строка продублирована из компонента намеренно: сцены объявлены внутри клиентского компонента
 * (`useMemo`), а `generateMetadata` исполняется только на сервере. При правке текста первой сцены
 * обновите и это значение.
 */
const description =
  "Не видим результата — говорим прямо. Не продаём то, что не принесёт пользы. Партнёрство для нас важнее одного чека.";

const ogImage = {
  url: `${SITE_URL}/how-we-work/mission-values.webp`,
  alt: "Рабочее место с заметками о ценностях компании",
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: HOW_WE_WORK_URL },
  robots: INDEXABLE_ROBOTS,
  openGraph: buildOpenGraph({
    title,
    description,
    url: HOW_WE_WORK_URL,
    images: [ogImage],
  }),
  twitter: buildTwitter({ title, description, images: [ogImage.url] }),
};

export default function Page() {
  const copy = getHomepageCopy();

  const structuredData = [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Как мы работаем", url: HOW_WE_WORK_URL },
    ]),
    webPageNode({
      url: HOW_WE_WORK_URL,
      name: title,
      description,
      type: "AboutPage",
    }),
    organizationNode(),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
      />
      <main>
        <HowWeWorkPage />
      </main>
    </>
  );
}
