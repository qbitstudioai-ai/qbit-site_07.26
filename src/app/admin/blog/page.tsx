import { articlePlacementLabel } from "@/content/article-placements";
import { BlogEditor, type ArticleRecordView } from "@/features/admin/BlogEditor";
import { toRelationValues, type RelationOption } from "@/features/admin/relationTargets";
import { listAllArticles, type ArticleRecord } from "@/server/repositories/articles";
import { listAllCases } from "@/server/repositories/cases";
import { listRelationsFrom } from "@/server/repositories/contentRelations";
import { listAllDepartments } from "@/server/repositories/departments";
import { listAllProducts } from "@/server/repositories/products";

/**
 * Раздел «Блог»: список статей, создание, редактирование, публикация и удаление.
 *
 * СВЯЗИ И КАТАЛОГ МАТЕРИАЛОВ ЧИТАЮТСЯ ЗДЕСЬ, на сервере, и уходят в редактор готовыми. Отдельного
 * административного адреса для них не заводится — не потому, что «так меньше кода», а потому что
 * любой второй запрос из формы создаёт промежуток, в котором список связей на экране ещё пуст.
 * Сохранение в этот промежуток отправило бы пустой список как намеренную очистку и стёрло бы
 * перелинковку. Одного ответа такого промежутка не существует.
 *
 * Связи читаются по одной статье за раз. При сегодняшних объёмах раздела это несколько выборок по
 * первичному ключу; если статей станет заметно больше, здесь имеет смысл один сгруппированный
 * запрос — но менять это без замера незачем.
 */
export default function AdminBlogPage() {
  const articles = listAllArticles();

  const records: ArticleRecordView[] = articles.map((article) => ({
    ...article,
    relations: toRelationValues(listRelationsFrom("article", article.id)),
  }));

  return <BlogEditor articles={records} relationOptions={buildRelationOptions(articles)} />;
}

/**
 * Каталог материалов, на которые можно сослаться.
 *
 * Четыре типа складываются в один плоский список: редактору связей нужен ОДИН словарь, в котором
 * пара «тип + идентификатор» однозначно находит материал. Раздел (`placement`) есть только у
 * статей — у остальных типов его не существует, и `null` здесь означает именно это, а не «раздел
 * неизвестен».
 *
 * `detail` — то, по чему владелец сайта узнаёт материал в выпадающем списке: обычно адрес. У отдела
 * уточнением служит слово «отдел главной страницы» — историческая формулировка времён, когда
 * собственного адреса у отдела не было. С Amendment 62 адрес есть (`/solutions/<slug>`), а с
 * Amendment 64 связь на отдел выводится публично именно по нему; заменить это уточнение на сам
 * `solutionPath` — отдельная правка админ-текста, в scope SOLREL-02 она не входит.
 */
function buildRelationOptions(articles: readonly ArticleRecord[]): RelationOption[] {
  const fromArticles: RelationOption[] = articles.map((article) => ({
    type: "article",
    id: article.id,
    label: article.title,
    detail: `/blog/${article.slug}${
      article.status === "published" ? "" : " · черновик"
    } · ${articlePlacementLabel(article.placement)}`,
    isPublished: article.status === "published",
    placement: article.placement,
  }));

  const fromProducts: RelationOption[] = listAllProducts().map((product) => ({
    type: "product",
    id: product.id,
    label: product.menuTitle,
    detail: `/products/${product.slug}${product.isPublished ? "" : " · скрыт"}`,
    isPublished: product.isPublished,
    placement: null,
  }));

  // У кейса в модели ровно одно состояние публикации: черновиков кейсов не существует.
  const fromCases: RelationOption[] = listAllCases().map((study) => ({
    type: "case",
    id: study.id,
    label: study.shortTitle || study.title,
    detail: `/cases/${study.slug}`,
    isPublished: true,
    placement: null,
  }));

  const fromDepartments: RelationOption[] = listAllDepartments().map((department) => ({
    type: "department",
    id: department.id,
    label: department.name,
    detail: `отдел главной страницы${department.isPublished ? "" : " · скрыт"}`,
    isPublished: department.isPublished,
    placement: null,
  }));

  return [...fromArticles, ...fromProducts, ...fromCases, ...fromDepartments];
}
