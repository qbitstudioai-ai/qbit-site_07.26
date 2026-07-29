import type { Metadata } from "next";
import { HomepageShell } from "@/components/homepage/HomepageShell";
import { getDepartmentIds } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";
import type { DepartmentId } from "@/content/types";
import { TASK_SECTION_ID, type OfficeSectionId } from "@/features/office-machine/reducer";
import { serializeJsonLd } from "@/lib/jsonLd";
import {
  buildOpenGraph,
  buildTwitter,
  INDEXABLE_ROBOTS,
  organizationNode,
  SITE_NAME,
  SITE_URL,
  webPageNode,
  webSiteNode,
} from "@/lib/seo";

interface HomePageProps {
  searchParams: Promise<{ department?: string; section?: string }>;
}

/**
 * Рендер на запрос — объявлено явно.
 *
 * Фактически страница и так рендерилась на запрос: она читает `searchParams` (`?department=…`,
 * `?section=task`), а этого достаточно, чтобы Next.js исключил её из пререндера. Строка ничего не
 * меняет в поведении, но убирает молчаливую зависимость: убери кто-нибудь работу с `searchParams`
 * — страница стала бы статической и запеклась бы с тем содержимым базы, которое было на сборке
 * образа. Ровно так 29.07.2026 в production уехали пустой блог и пустой каталог документов.
 *
 * Тексты отделов и телефон в шапке живут в базе, а база на сборке недоступна — она на постоянном
 * томе сервера. Поэтому у главной статического «состояния по умолчанию» быть не должно.
 */
export const dynamic = "force-dynamic";

/**
 * Метаданные главной.
 *
 * Заголовок и описание берутся из УЖЕ показанных на странице текстов (`headline` — видимый H1,
 * `subheadline` — видимый абзац под ним), а не сочиняются заново: правка текста в админ-панели
 * должна менять и метаданные, иначе они разойдутся с содержимым. Прежнее значение — просто
 * «QBit-Studio-Ai» — не сообщало о странице ничего.
 *
 * Canonical ВСЕГДА `https://allqbit.ru`, без параметров запроса. Отдел и раздел «Ваша задача»
 * адресуются через `?department=…` / `?section=task` — это состояния одной страницы, а не
 * отдельные документы: заголовок, описание и разметка у них общие. Собственный canonical у
 * каждого варианта означал бы набор почти одинаковых страниц-дублей. Ограничение этого решения
 * (содержимое отделов не индексируется отдельно) вынесено в SEO_GEO_CONTENT_LIMITATIONS.md.
 */
export function generateMetadata(): Metadata {
  const copy = getHomepageCopy();
  const title = `${copy.headline} — ${SITE_NAME}`;
  const description = copy.subheadline;

  return {
    title,
    description,
    alternates: { canonical: SITE_URL },
    robots: INDEXABLE_ROBOTS,
    openGraph: buildOpenGraph({ title, description, url: SITE_URL }),
    twitter: buildTwitter({ title, description }),
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const requestedDepartment = params.department;
  const requestedSection = params.section;

  const departmentId: DepartmentId | null =
    requestedDepartment && getDepartmentIds().includes(requestedDepartment as DepartmentId)
      ? (requestedDepartment as DepartmentId)
      : null;

  // Приоритет у отдела: если в адресе оказались оба параметра, побеждает более специфичный, а не
  // тот, что стоит раньше в строке запроса. Иначе `?department=sales&section=task` открывал бы
  // разное в зависимости от того, как ссылку склеили.
  const initialSectionId: OfficeSectionId | null =
    departmentId ?? (requestedSection === TASK_SECTION_ID ? TASK_SECTION_ID : null);

  // hero пропускается при ЛЮБОМ запросе раздела — в том числе с невалидным id (поведение docs/05:
  // «URL с несуществующим id деградирует к overview, но hero всё равно пропускается»). Для
  // `?section=` тот же принцип: непонятное значение раздел не откроет, но намерение «показать офис»
  // уже выражено.
  const initialRevealed = Boolean(requestedDepartment) || Boolean(requestedSection);

  const copy = getHomepageCopy();
  // Организация и сайт описываются один раз — на главной. Остальные страницы ссылаются на те же
  // `@id`, поэтому для поисковой системы это одна сущность, а не повторяющиеся однофамильцы.
  const structuredData = [
    organizationNode(),
    webSiteNode(),
    webPageNode({
      url: SITE_URL,
      name: `${copy.headline} — ${SITE_NAME}`,
      description: copy.subheadline,
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <HomepageShell initialRevealed={initialRevealed} initialSectionId={initialSectionId} />
    </>
  );
}
