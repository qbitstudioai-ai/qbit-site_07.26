import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import type { Department } from "@/content/types";
import { SolutionDocument } from "@/features/solutions/SolutionDocument";
import { departmentIdBySolutionSlug, solutionUrl } from "@/features/solutions/solutionsRoutes";
import {
  NOT_FOUND_ROBOTS,
  solutionSeoDescription,
  solutionSeoTitle,
  solutionStructuredData,
} from "@/features/solutions/solutionsSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import { buildOpenGraph, buildTwitter, INDEXABLE_ROBOTS } from "@/lib/seo";
import { getDepartmentById } from "@/server/content/departments";

/**
 * Страница одного отдела.
 *
 * Адрес — настоящий маршрут, а не состояние главной. До этого шага содержимое отдела существовало
 * ТОЛЬКО как `?department=<id>` на главной: общий `<title>`, общее описание, общий canonical
 * `https://allqbit.ru` и ни одного собственного H1. Как отдельный документ отдел поисковыми и
 * AI-системами не индексировался вовсе — это ограничение было записано в
 * `SEO_GEO_CONTENT_LIMITATIONS.md` §1 и снимается здесь.
 *
 * Главная при этом НЕ меняется. `?department=<id>` продолжает работать ровно как прежде: тот же
 * SSR-вход в отдел, тот же `history.replaceState` (решение OQ-B), те же анимации, тот же canonical
 * `https://allqbit.ru`. Переадресации между двумя адресами нет намеренно — это два разных способа
 * показать один текст, и сведение их в один сломало бы утверждённый UX офиса. Дубля при этом не
 * возникает: canonical варианта с параметром уже указывает на главную, то есть отдельным
 * документом он не является.
 *
 * `generateStaticParams` намеренно НЕТ, а режим — `force-dynamic`: тексты отделов живут в базе,
 * которой на сборке образа не существует (она на постоянном томе сервера). Статический пререндер
 * запёк бы в образ содержимое, которого там нет, — ровно так 29.07.2026 в production уехали пустой
 * блог и пустой каталог документов. То же решение, что у `/blog`, `/cases` и главной.
 */
export const dynamic = "force-dynamic";

interface SolutionPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Отдел по сегменту адреса — или `undefined`.
 *
 * Два разных «нет» неразличимы снаружи и должны быть неразличимы здесь: несуществующий сегмент и
 * отдел, снятый с публикации в админ-панели, одинаково дают 404. `getDepartmentById` работает
 * поверх `getDepartments()`, который отдаёт только опубликованные отделы, поэтому второй случай
 * закрывается тем же вызовом, что и первый, — без отдельной проверки флага, которую можно забыть.
 */
function findDepartment(slug: string): Department | undefined {
  const departmentId = departmentIdBySolutionSlug(slug);
  return departmentId ? getDepartmentById(departmentId) : undefined;
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const department = findDepartment(slug);

  if (!department) {
    return { robots: NOT_FOUND_ROBOTS };
  }

  const title = solutionSeoTitle(department);
  const description = solutionSeoDescription(department);
  /**
   * Canonical — собственный `solutionPath` отдела, приведённый к абсолютному адресу, БЕЗ строки
   * запроса. Поэтому `?utm_source=…`, `?utm_medium=…` и `?fbclid=…` не создают второго документа:
   * все они указывают на один и тот же чистый адрес.
   */
  const canonical = solutionUrl(department);

  return {
    title,
    description,
    alternates: { canonical },
    robots: INDEXABLE_ROBOTS,
    // Отдельной обложки у отдела нет: сцены офиса — иллюстрация помещения, а не карточка
    // материала. `buildOpenGraph` подставляет общесайтовую обложку сам.
    openGraph: buildOpenGraph({ title, description, url: canonical }),
    twitter: buildTwitter({ title, description }),
  };
}

export default async function SolutionPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const department = findDepartment(slug);

  if (!department) notFound();

  const copy = getHomepageCopy();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(solutionStructuredData(department)) }}
      />
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
      />
      <main>
        <SolutionDocument department={department} contactHref={copy.contactHref} />
      </main>
    </>
  );
}
