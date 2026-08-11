import type { Metadata } from "next";
import { casesIndexStructuredData, CASES_URL } from "@/features/cases/casesSeo";
import { CasesCoverSheet } from "@/features/cases/CasesCoverSheet";
import { serializeJsonLd } from "@/lib/jsonLd";
import { buildOpenGraph, buildTwitter, INDEXABLE_ROBOTS } from "@/lib/seo";
import { getCasesPageCopy, getPublishedCases } from "@/server/content/cases";

/**
 * Корень раздела — обложка архива.
 *
 * Страница отдаёт ТОЛЬКО лист и разметку: сцену, фотографию и картотеку рисует layout раздела. Так
 * при переходе к кейсу перестраивается ровно то, что должно перестроиться, — сам документ.
 */
export const revalidate = 300;

const copy = getCasesPageCopy();

export const metadata: Metadata = {
  title: copy.seoTitle,
  description: copy.seoDescription,
  /**
   * Canonical обязателен: страница достижима и с рекламными метками (`?utm_source=…`, `?fbclid=…`),
   * а документ там один и тот же. Значение АБСОЛЮТНОЕ и без строки запроса — поэтому любой адрес с
   * параметрами указывает на чистый `/cases`.
   */
  alternates: { canonical: CASES_URL },
  robots: INDEXABLE_ROBOTS,
  openGraph: buildOpenGraph({
    title: copy.seoTitle,
    description: copy.seoDescription,
    url: CASES_URL,
  }),
  twitter: buildTwitter({ title: copy.seoTitle, description: copy.seoDescription }),
};

export default function CasesPage() {
  const structuredData = casesIndexStructuredData({
    name: copy.seoTitle,
    description: copy.seoDescription,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <CasesCoverSheet
        eyebrow={copy.eyebrow}
        headline={copy.headline}
        intro={copy.intro}
        total={getPublishedCases().length}
      />
    </>
  );
}
