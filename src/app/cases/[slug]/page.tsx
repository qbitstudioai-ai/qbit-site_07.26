import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseDocument } from "@/features/cases/CaseDocument";
import { caseUrl } from "@/features/cases/casesRoutes";
import {
  caseSeoDescription,
  caseSeoTitle,
  caseSocialDescription,
  caseStudyStructuredData,
  NOT_FOUND_ROBOTS,
} from "@/features/cases/casesSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import { buildOpenGraph, buildTwitter, INDEXABLE_ROBOTS } from "@/lib/seo";
import { getCaseBySlug, getCasesPageCopy } from "@/server/content/cases";

/**
 * Страница одного кейса.
 *
 * Адрес — не оформление состояния, а настоящий маршрут: кейс открывается прямой ссылкой, переживает
 * перезагрузку, работает с Back/Forward и в новой вкладке. Содержимое приходит из `getCaseBySlug`
 * ДО отрисовки HTML — ни одна строка кейса не подгружается после монтирования. Это условие
 * SEO/GEO, и менять его нельзя даже ради анимации: страница остаётся серверной, а перелистывание
 * живёт в layout и получает готовый документ через `children`.
 *
 * `generateStaticParams` намеренно НЕТ: адреса разрешаются на запрос, поэтому кейс, созданный в
 * будущей админ-панели, откроется без пересборки проекта — то же решение, что в `/blog`.
 */
export const revalidate = 300;

interface CasePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseBySlug(slug);

  // Черновик и несуществующий адрес неразличимы снаружи — и то и другое 404.
  if (!study) {
    return { robots: NOT_FOUND_ROBOTS };
  }

  const title = caseSeoTitle(study);
  const description = caseSeoDescription(study);
  const socialDescription = caseSocialDescription(study);
  /**
   * Canonical — абсолютный адрес БЕЗ строки запроса, собранный существующим `caseUrl()`. Поэтому
   * `?utm_source=…`, `?utm_medium=…` и `?fbclid=…` не создают второго документа: все они указывают
   * на один и тот же чистый адрес.
   */
  const canonical = caseUrl(study);

  return {
    // Заголовок берётся ДОСЛОВНО из `seoTitle` (см. `caseSeoTitle`): бренд к нему не дописывается,
    // и длина строки в выдаче равна той, что утверждена. H1 документа при этом другой и длиннее.
    title,
    description,
    alternates: { canonical },
    robots: INDEXABLE_ROBOTS,
    /**
     * `type: "article"` — это Open Graph, а не schema.org: он говорит мессенджеру, что перед ним
     * материал, а не витрина. Даты (`publishedTime`/`modifiedTime`) не передаются — у кейса нет
     * подтверждённой даты публикации, и выдумывать её нельзя. Отдельная обложка кейса не рисуется:
     * используется общесайтовая (`DEFAULT_OG_IMAGE` подставляется `buildOpenGraph` сам).
     */
    openGraph: buildOpenGraph({
      title,
      description: socialDescription,
      url: canonical,
      type: "article",
    }),
    twitter: buildTwitter({ title, description: socialDescription }),
  };
}

export default async function CasePage({ params }: CasePageProps) {
  const { slug } = await params;
  const study = getCaseBySlug(slug);

  // Неопубликованный или несуществующий кейс — обычная 404, а не пустой документ.
  if (!study) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(caseStudyStructuredData(study)) }}
      />
      <CaseDocument study={study} archiveLabel={getCasesPageCopy().eyebrow} />
    </>
  );
}
