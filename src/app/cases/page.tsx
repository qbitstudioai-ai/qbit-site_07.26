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
 *
 * Рендер НА ЗАПРОС. С переездом раздела в базу (миграция `0003_cases`) запасных текстов в `data/`
 * у кейсов не осталось: единственный источник — таблица `cases`. Образ же собирается там, где базы
 * ещё нет, и статический пререндер запёк бы в production пустой архив — ровно та ошибка первого
 * деплоя 29.07.2026, из-за которой блог и документы объявлены `force-dynamic`
 * (см. `src/tests/unit/app/rendering-mode.test.ts`). Заодно это означает, что опубликованный в
 * админ-панели кейс виден на сайте сразу, а не через пять минут.
 */
export const dynamic = "force-dynamic";

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
