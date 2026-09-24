import { SOLUTION_PATH_BY_DEPARTMENT_ID } from "@/content/solutionPaths";
import { getDatabase, nowIso, parseJsonColumn, transaction } from "../db/client";

/**
 * Репозиторий связей между материалами.
 *
 * Единственное место, которое читает и пишет таблицу `content_relations` (миграция
 * `0004_content_relations`). Связь — это ссылка одного материала на другой: статья на продукт,
 * продукт на кейс, что угодно на отдел.
 *
 * Три правила, ради которых репозиторий существует отдельно от вызывающего кода:
 *
 * 1. Связь хранится по ИДЕНТИФИКАТОРУ, никогда по slug. Адрес материала владелец сайта меняет из
 *    админ-панели, идентификатор не меняется никогда: перелинковка обязана пережить смену адреса.
 * 2. И источник, и цель обязаны существовать. Внешнего ключа для полиморфной ссылки в SQLite нет,
 *    поэтому существование проверяется здесь — по ФИКСИРОВАННОМУ списку таблиц `ENTITY_TABLES`.
 * 3. Ссылка материала на себя и повтор одной цели у одного источника — ошибки ввода, а не данные.
 *
 * Обратная сторона правила 2: каскадного удаления у базы нет. Код, удаляющий материал, обязан
 * вызвать `deleteRelationsForEntity()`, иначе в таблице останутся ссылки в никуда.
 */

export type ContentEntityType = "article" | "product" | "case" | "department";
export type ContentRelationRole = "primary" | "related";

/**
 * Тип сущности → таблица, где лежат её строки.
 *
 * Это ЕДИНСТВЕННЫЙ источник имён таблиц для проверки существования. Имя подставляется в SQL
 * текстом, поэтому оно обязано приходить только отсюда: любое значение снаружи сначала проходит
 * `assertKnownEntityType()` и либо совпадает с ключом этого объекта, либо не доходит до запроса.
 */
const ENTITY_TABLES: Readonly<Record<ContentEntityType, string>> = Object.freeze({
  article: "articles",
  product: "products",
  case: "cases",
  department: "departments",
});

/**
 * Роли и типы материалов списками — для схем административного API.
 *
 * Экспортируются отсюда, а не перечисляются заново в `schemas.ts`: проверка на границе сервера и
 * проверка репозитория обязаны знать один и тот же набор значений, иначе форма начнёт принимать то,
 * что репозиторий отвергнет пятисотой. Тот же приём, что у `CONTACT_KINDS`.
 */
export const CONTENT_RELATION_ROLES = ["primary", "related"] as const;

export const CONTENT_ENTITY_TYPES = Object.keys(ENTITY_TABLES) as [
  ContentEntityType,
  ...ContentEntityType[],
];

const RELATION_ROLES: readonly ContentRelationRole[] = CONTENT_RELATION_ROLES;

/** Роль по умолчанию: обычная связь «рядом», а не главная. Совпадает с DEFAULT в схеме. */
const DEFAULT_ROLE: ContentRelationRole = "related";

/**
 * Коды отказов перелинковки.
 *
 * Первые пять принадлежат самому репозиторию. Последние три выдаёт составная операция
 * `updateArticleWithRelations()`: они описывают не связь как таковую, а пригодность цели для
 * ПРЕЖНЕЙ модели (`articles.related_slugs`), которую сервер выводит из структурных связей. Их место
 * здесь, а не в отдельном перечислении, по той же причине, по которой роль и типы материалов
 * экспортируются отсюда в схемы: у роута обязан быть ОДИН словарь кодов, иначе `relationErrorResponse()`
 * пришлось бы собирать из двух объединений и молча пропускать всё, чего нет ни в одном.
 */
export type ContentRelationErrorCode =
  | "unknown_entity_type"
  | "unknown_relation_role"
  | "missing_entity"
  | "self_link"
  | "duplicate_relation"
  | "too_many_legacy_targets"
  | "unpublished_target"
  | "placement_mismatch";

/**
 * Отказ репозитория связей.
 *
 * Отдельный класс с кодом, а не голый `Error`: вызывающий роут должен уметь превратить «цели нет» и
 * «дубль» в разные ответы формы, не разбирая текст сообщения.
 */
export class ContentRelationError extends Error {
  readonly code: ContentRelationErrorCode;

  constructor(code: ContentRelationErrorCode, message: string) {
    super(message);
    this.name = "ContentRelationError";
    this.code = code;
  }
}

export interface ContentRelation {
  sourceType: ContentEntityType;
  sourceId: string;
  targetType: ContentEntityType;
  targetId: string;
  role: ContentRelationRole;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Одна связь в том виде, в каком её задаёт вызывающий код.
 *
 * `sortOrder` необязателен: если он не задан, порядок берётся из позиции в массиве — форма
 * перелинковки отдаёт список в том порядке, в котором его составил человек.
 */
export interface ContentRelationInput {
  targetType: ContentEntityType;
  targetId: string;
  role?: ContentRelationRole;
  sortOrder?: number;
}

function assertKnownEntityType(type: ContentEntityType, field: string): void {
  if (!Object.hasOwn(ENTITY_TABLES, type)) {
    throw new ContentRelationError(
      "unknown_entity_type",
      `Неизвестный тип материала «${String(type)}» (${field})`,
    );
  }
}

function tableFor(type: ContentEntityType, field: string): string {
  assertKnownEntityType(type, field);
  return ENTITY_TABLES[type];
}

/** Существует ли материал. Имя таблицы — только из `ENTITY_TABLES`, идентификатор — параметром. */
function entityExists(type: ContentEntityType, id: string, field: string): boolean {
  const table = tableFor(type, field);
  return Boolean(getDatabase().prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id));
}

function requireEntity(type: ContentEntityType, id: string, field: string): void {
  if (!entityExists(type, id, field)) {
    throw new ContentRelationError(
      "missing_entity",
      `Материал «${type}:${id}» не существует (${field})`,
    );
  }
}

function toRelation(raw: unknown): ContentRelation {
  const row = raw as Record<string, unknown>;
  return {
    sourceType: String(row.source_type) as ContentEntityType,
    sourceId: String(row.source_id),
    targetType: String(row.target_type) as ContentEntityType,
    targetId: String(row.target_id),
    role: String(row.relation_role) as ContentRelationRole,
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const SELECT = `SELECT source_type, source_id, target_type, target_id,
                       relation_role, sort_order, created_at, updated_at
                  FROM content_relations`;

/**
 * Связи, исходящие из материала: «что показать рядом с этой страницей».
 *
 * Сортировка полная, а не только по `sort_order`: при равном порядке решают тип и идентификатор
 * цели, иначе список тасовался бы между запросами и блок перелинковки менял бы состав от захода к
 * заходу. Роль стоит последним ключом — она замыкает порядок до однозначного даже для строк,
 * записанных мимо репозитория: первичный ключ таблицы роль различает, и без этого ключа пара
 * «главная и обычная связь на одну цель» упорядочивалась бы тем, как SQLite вернёт строки.
 *
 * Существование источника здесь НЕ требуется — у удалённого материала связей просто нет.
 */
export function listRelationsFrom(
  sourceType: ContentEntityType,
  sourceId: string,
): ContentRelation[] {
  assertKnownEntityType(sourceType, "source_type");
  return getDatabase()
    .prepare(
      `${SELECT} WHERE source_type = ? AND source_id = ?
        ORDER BY sort_order ASC, target_type ASC, target_id ASC, relation_role ASC`,
    )
    .all(sourceType, sourceId)
    .map(toRelation);
}

/**
 * Связи, ведущие В материал: «кто на него ссылается».
 *
 * Нужен для обратной перелинковки — страница продукта показывает статьи, которые на него ссылаются,
 * не заводя для этого второй, зеркальной записи. Порядок так же полный и по той же причине, только
 * ключи считают источник: `sort_order` здесь приходит из ЧУЖИХ списков и совпадает сплошь и рядом.
 */
export function listRelationsTo(
  targetType: ContentEntityType,
  targetId: string,
): ContentRelation[] {
  assertKnownEntityType(targetType, "target_type");
  return getDatabase()
    .prepare(
      `${SELECT} WHERE target_type = ? AND target_id = ?
        ORDER BY sort_order ASC, source_type ASC, source_id ASC, relation_role ASC`,
    )
    .all(targetType, targetId)
    .map(toRelation);
}

/** Публичный материал блока статьи. Та же форма, что `PublicRelatedMaterial` публичного слоя. */
export interface PublishedRelatedMaterial {
  type: "article" | "product" | "case" | "department";
  id: string;
  slug: string;
  title: string;
  href: string;
}

/**
 * Адрес публичной страницы цели по её адресуемому имени.
 *
 * Отдела здесь нет и быть не может: у трёх остальных типов адрес — это префикс раздела плюс `slug`
 * из строки материала, а у отдела адрес задан ТАБЛИЦЕЙ (см. ниже), потому что сегмент пути и
 * идентификатор отдела — разные слова (`executive` → `/solutions/management`).
 */
const PUBLIC_PATH_PREFIX: Readonly<Record<"article" | "product" | "case", string>> = Object.freeze({
  article: "/blog/",
  product: "/products/",
  case: "/cases/",
});

/**
 * Адрес страницы отдела — по идентификатору, из ЕДИНСТВЕННОЙ утверждённой таблицы.
 *
 * До Amendment 62 отдел не выводился вовсе: у него не было собственного адреса, и связь на него
 * показать было нечем. Теперь адрес есть — `/solutions/<slug>`, отдельный индексируемый документ.
 *
 * Берётся ИМЕННО `SOLUTION_PATH_BY_DEPARTMENT_ID`, а не `json_extract(content, '$.solutionPath')`
 * из строки отдела. Причина: значение в колонке проверяется схемой (`superRefine` в
 * `@/content/schema`) только при чтении отдела ПУБЛИЧНЫМ слоем, а прямой SQL эту проверку обходит —
 * разошедшееся значение дало бы ссылку на несуществующий адрес. Таблица же и есть то, с чем схема
 * сверяет. Второго списка адресов при этом не появляется: модуль `@/content/solutionPaths` —
 * первоисточник, его читают и приложение, и скрипт пакетной отправки IndexNow.
 *
 * `Map` вместо прямого доступа по ключу — чтобы неизвестный идентификатор честно давал `undefined`:
 * `target_id` приходит строкой из базы, а не значением типа `DepartmentId`.
 */
const SOLUTION_PATH_BY_ID: ReadonlyMap<string, string> = new Map(
  Object.entries(SOLUTION_PATH_BY_DEPARTMENT_ID),
);

/**
 * Адрес и адресуемое имя цели. `null` — цель показать нечем, строка пропускается.
 *
 * `slug` у отдела — последний сегмент его же адреса, а не отдельно заведённое слово: иначе в
 * проекте появился бы второй список сегментов, расходящийся с адресами молча.
 */
function publicLocation(
  type: PublishedRelatedMaterial["type"],
  id: string,
  slug: unknown,
): { slug: string; href: string } | null {
  if (type === "department") {
    const path = SOLUTION_PATH_BY_ID.get(id);
    if (!path) return null;
    return { slug: path.slice(path.lastIndexOf("/") + 1), href: path };
  }

  const value = String(slug);
  return { slug: value, href: `${PUBLIC_PATH_PREFIX[type]}${value}` };
}

/**
 * Публичный блок «Материалы по теме» (Amendment 61 / REL-02F.2): материалы для КАЖДОЙ опубликованной
 * статьи раздела, одним запросом.
 *
 * Источник — ТОЛЬКО эта таблица. Прежняя колонка `articles.related_slugs` и legacy-секция текста
 * здесь не читаются и не служат запасным вариантом: пустой результат означает пустой блок.
 *
 * Карта, а не список для одной статьи, по двум причинам. Клиентский `BlogExperience` при переходе
 * между статьями без перезагрузки берёт материалы из уже полученного списка, поэтому актуальные связи
 * нужны каждой статье списка, а не только открытой. И один запрос на раздел вместо запроса на статью:
 * страница блога рендерится на каждый запрос.
 *
 * Условия отбора:
 * - источник — опубликованная статья запрошенного раздела;
 * - цель-статья — опубликованная статья ТОГО ЖЕ раздела, не сама статья (её запрещает и CHECK схемы);
 * - цель-продукт — `is_published = 1`, цель-кейс — `status = 'published'`: ровно те условия, при
 *   которых публичная страница цели отвечает, а не 404;
 * - цель-отдел — `is_published = 1` (Amendment 64), по тому же правилу: страница `/solutions/<slug>`
 *   у снятого с публикации отдела отвечает 404, и связь на него обязана исчезать из блока САМА,
 *   без правки самой связи. До Amendment 62 отдел отсекался здесь целиком — у него не было
 *   собственного адреса; теперь есть;
 * - тип цели проверяется в условии соединения, поэтому совпадение идентификаторов у разных типов не
 *   превращает продукт в статью;
 * - адрес и название — из строки цели по `target_id`: смена адреса или названия видна сразу.
 *
 * Порядок — ОБЩИЙ для всех типов и тот же, что в `listRelationsFrom()`: `sort_order`, затем тип,
 * идентификатор цели и роль. Первичный ключ различает роль, поэтому одна цель может встретиться у
 * источника дважды; в блоке она остаётся один раз, на месте первого вхождения.
 */
export function listPublishedArticleRelatedMaterials(
  placement: string,
): Map<string, PublishedRelatedMaterial[]> {
  const rows = getDatabase()
    .prepare(
      `SELECT relation.source_id AS source_id,
              relation.target_type AS target_type,
              relation.target_id AS target_id,
              COALESCE(article.slug, product.slug, study.slug) AS target_slug,
              COALESCE(article.title, product.full_title, study.short_title,
                       department.display_name) AS target_title
         FROM content_relations AS relation
         JOIN articles AS source
           ON source.id = relation.source_id
          AND source.status = 'published'
          AND source.placement = ?
         LEFT JOIN articles AS article
           ON relation.target_type = 'article'
          AND article.id = relation.target_id
          AND article.status = 'published'
          AND article.placement = ?
         LEFT JOIN products AS product
           ON relation.target_type = 'product'
          AND product.id = relation.target_id
          AND product.is_published = 1
         LEFT JOIN cases AS study
           ON relation.target_type = 'case'
          AND study.id = relation.target_id
          AND study.status = 'published'
         LEFT JOIN departments AS department
           ON relation.target_type = 'department'
          AND department.id = relation.target_id
          AND department.is_published = 1
        WHERE relation.source_type = 'article'
          AND relation.target_type IN ('article', 'product', 'case', 'department')
          AND NOT (relation.target_type = 'article' AND relation.target_id = relation.source_id)
          AND COALESCE(article.id, product.id, study.id, department.id) IS NOT NULL
        ORDER BY relation.source_id ASC, relation.sort_order ASC, relation.target_type ASC,
                 relation.target_id ASC, relation.relation_role ASC`,
    )
    .all(placement, placement) as {
    source_id: unknown;
    target_type: unknown;
    target_id: unknown;
    target_slug: unknown;
    target_title: unknown;
  }[];

  const materialsBySource = new Map<string, PublishedRelatedMaterial[]>();
  const seenBySource = new Map<string, Set<string>>();

  for (const row of rows) {
    const sourceId = String(row.source_id);
    const type = String(row.target_type) as PublishedRelatedMaterial["type"];
    const id = String(row.target_id);

    /**
     * Адрес считается ДО отметки о повторе. Отдел с идентификатором, которого нет в таблице
     * адресов, показать нечем — такая строка не материал, и занимать собой место в списке
     * «уже виденных» она не должна.
     */
    const location = publicLocation(type, id, row.target_slug);
    if (!location) continue;

    const seen = seenBySource.get(sourceId) ?? new Set<string>();
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seenBySource.set(sourceId, seen);

    const materials = materialsBySource.get(sourceId) ?? [];
    materials.push({
      type,
      id,
      slug: location.slug,
      title: String(row.target_title),
      href: location.href,
    });
    materialsBySource.set(sourceId, materials);
  }

  return materialsBySource;
}

/**
 * Один материал блока перелинковки НА СТРАНИЦЕ ОТДЕЛА (`/solutions/<slug>`, SOL-OUT-02).
 *
 * Отдельный тип, а не `PublishedRelatedMaterial`, по двум причинам, и обе содержательные.
 *
 * Во-первых, типы целей здесь СУЖЕНЫ до продукта и кейса. Отдел не ссылается ни на статью, ни на
 * другой отдел: блок отвечает на вопрос «чем это закрывается и где это уже сработало», а не
 * «что ещё почитать». Сужение выражено типом, а не проверкой в компоненте, — иначе вёрстке
 * пришлось бы обрабатывать ветки, которых запрос не вернёт.
 *
 * Во-вторых, у карточки отдела есть `summary`, которого у карточки статьи нет. Он необязателен
 * (`string | null`) и у кейса ВСЕГДА `null` — см. `DEPARTMENT_MATERIAL_SELECT` ниже.
 */
export interface PublishedDepartmentMaterial {
  type: "product" | "case";
  id: string;
  slug: string;
  title: string;
  href: string;
  /** Существующее краткое описание цели. `null` — описания нет или его нельзя показывать. */
  summary: string | null;
}

/**
 * Материалы, связанные с отделом: продукты и кейсы для блоков «Подходящие решения» и
 * «Примеры внедрения» на `/solutions/<slug>`.
 *
 * Принимает СТАБИЛЬНЫЙ идентификатор отдела, а не сегмент адреса: `executive`, а не `management`.
 * Разбор сегмента — дело `departmentIdBySolutionSlug()`, и повторять его здесь значило бы завести
 * второе отображение адресов (ровно то, от чего защищает `@/content/solutionPaths`).
 *
 * Условия отбора — те же, что у блока статьи, и по той же причине: показывается только то, чья
 * публичная страница ответит 200, а не 404.
 *
 * - цель-продукт — `is_published = 1`;
 * - цель-кейс — `status = 'published'`;
 * - тип цели проверяется В УСЛОВИИ СОЕДИНЕНИЯ, поэтому совпадение идентификаторов у продукта и
 *   кейса не превращает одно в другое;
 * - связи на статью и на отдел не отбираются вовсе — у блока отдела таких целей нет;
 * - название, адрес и описание берутся из АКТУАЛЬНОЙ строки цели по `target_id`: переименование
 *   продукта или смена его адреса видны сразу, без правки связи.
 *
 * Существование самого отдела здесь НЕ требуется — как и в `listRelationsFrom()`. Неизвестный или
 * снятый с публикации отдел просто не имеет связей, и пустой список — корректный ответ, а не
 * ошибка: страница такого отдела всё равно отвечает 404 раньше (`findDepartment()`).
 *
 * Порядок — ТОТ ЖЕ, что в `listRelationsFrom()`: `sort_order`, затем тип, идентификатор цели и
 * роль. Полный, а не только по `sort_order`: при равном порядке (а его выставляет человек, и
 * совпадения обычны) список иначе тасовался бы между запросами, и блок менял бы состав от захода к
 * заходу. Роль замыкает порядок до однозначного даже для строк, записанных мимо репозитория, —
 * первичный ключ таблицы роль различает.
 *
 * Роль в выдаче НЕ участвует: `primary` и `related` задают порядок через `sort_order`, а не два
 * разных блока. Делить блок по роли значило бы показать посетителю нашу внутреннюю разметку
 * важности.
 */
const DEPARTMENT_MATERIAL_SELECT = `
  SELECT relation.target_type AS target_type,
         relation.target_id AS target_id,
         COALESCE(product.slug, study.slug) AS target_slug,
         COALESCE(product.full_title, study.short_title) AS target_title,
         product.content AS product_content
    FROM content_relations AS relation
    LEFT JOIN products AS product
      ON relation.target_type = 'product'
     AND product.id = relation.target_id
     AND product.is_published = 1
    LEFT JOIN cases AS study
      ON relation.target_type = 'case'
     AND study.id = relation.target_id
     AND study.status = 'published'
   WHERE relation.source_type = 'department'
     AND relation.source_id = ?
     AND relation.target_type IN ('product', 'case')
     AND COALESCE(product.id, study.id) IS NOT NULL
   ORDER BY relation.sort_order ASC, relation.target_type ASC,
            relation.target_id ASC, relation.relation_role ASC`;

export function listPublishedDepartmentRelatedMaterials(
  departmentId: string,
): PublishedDepartmentMaterial[] {
  const rows = getDatabase().prepare(DEPARTMENT_MATERIAL_SELECT).all(departmentId) as {
    target_type: unknown;
    target_id: unknown;
    target_slug: unknown;
    target_title: unknown;
    product_content: unknown;
  }[];

  const materials: PublishedDepartmentMaterial[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const type = String(row.target_type) as PublishedDepartmentMaterial["type"];
    const id = String(row.target_id);

    /**
     * Одна цель показывается один раз, на месте первого вхождения. Первичный ключ таблицы
     * различает роль, поэтому одна и та же цель может стоять у отдела и `primary`, и `related`:
     * репозиторий такую пару не запишет, но прямой SQL — запишет.
     */
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const slug = String(row.target_slug);

    /**
     * Описание есть ТОЛЬКО у продукта, и это решение содержания, а не оформления.
     *
     * У кейса единственные краткие тексты — `summary`, `seo_description` и `og_description`, и во
     * всех трёх стоит измеренный результат конкретного внедрения («4–5 часов в неделю»,
     * «10–15 минут в неделю», суммы роста продаж). На странице отдела такая подпись читалась бы
     * как обещание того же результата любому посетителю — прямой запрет copy-правил проекта
     * (CLAUDE.md, «Do not make unsupported promises about revenue, savings…»), и именно поэтому
     * карточка кейса несёт только `short_title`. Оговорки, при которых цифра правдива, живут на
     * самой странице кейса и в карточку не переносятся.
     *
     * `content.summary` продукта — обычное определение продукта одним предложением, без цифр и без
     * обещаний; оно уже показывается на `/products/<slug>`.
     */
    const summary =
      type === "product"
        ? (parseJsonColumn<{ summary?: unknown }>(row.product_content, {}).summary ?? null)
        : null;

    materials.push({
      type,
      id,
      slug,
      title: String(row.target_title),
      href: `${PUBLIC_PATH_PREFIX[type]}${slug}`,
      summary: typeof summary === "string" && summary.length > 0 ? summary : null,
    });
  }

  return materials;
}

/**
 * Полная замена исходящих связей материала.
 *
 * Форма перелинковки присылает итоговый список целиком, а не разницу, поэтому операция одна:
 * старые связи источника удаляются, новые записываются. Всё — ОДНОЙ транзакцией: материал не должен
 * оказаться без связей из-за отказа на середине списка.
 *
 * Проверки идут ДО удаления, а не по ходу вставки: отказ по несуществующей цели, ссылке на себя или
 * дублю не должен зависеть от того, успел ли `DELETE` выполниться (транзакция откатит его в любом
 * случае, но порядок делает это очевидным без разбора отката).
 *
 * Повтором считается вторая связь с ТОЙ ЖЕ целью, даже если роли разные. Первичный ключ таблицы
 * роль различает, но для одного источника «главный» и «связанный» один и тот же материал — ошибка
 * ввода. Это правило репозитория, а не схемы: строку с той же целью и другой ролью прямой SQL
 * запишет, поэтому однозначность порядка обеспечивает не оно, а ключ сортировки по роли в
 * `listRelationsFrom()`.
 *
 * `created_at` у переживших замену связей ставится заново: замена — это новый список, а не правка
 * старого, и различать «когда связь появилась впервые» здесь нечем и незачем.
 *
 * Операция разделена на ядро без транзакции и обёртку с ней. Причина та же, что у статей:
 * «сохранить материал вместе со связями» — одна транзакция на две таблицы, а `BEGIN` внутри `BEGIN`
 * в этом проекте не просто падает, его `ROLLBACK` отменяет ВНЕШНЮЮ транзакцию. Контракт обёртки
 * при разделении не изменился.
 *
 * Это — ЯДРО, без собственной транзакции. Синхронно намеренно: `transaction()` не ждёт промисов, и
 * `await` внутри означал бы `COMMIT` до конца работы. Вызывать напрямую можно ТОЛЬКО изнутри уже
 * открытой транзакции — иначе отказ на середине списка оставит материал без связей. Во всех
 * остальных случаях — `replaceRelationsFrom()`.
 */
export function replaceRelationsFromCore(
  sourceType: ContentEntityType,
  sourceId: string,
  relations: readonly ContentRelationInput[],
): ContentRelation[] {
  requireEntity(sourceType, sourceId, "источник связи");

  const seen = new Set<string>();
  const rows = relations.map((relation, index) => {
    const role = relation.role ?? DEFAULT_ROLE;
    if (!RELATION_ROLES.includes(role)) {
      throw new ContentRelationError(
        "unknown_relation_role",
        `Неизвестная роль связи «${String(role)}»`,
      );
    }

    requireEntity(relation.targetType, relation.targetId, "цель связи");

    if (relation.targetType === sourceType && relation.targetId === sourceId) {
      throw new ContentRelationError(
        "self_link",
        `Материал «${sourceType}:${sourceId}» не может ссылаться сам на себя`,
      );
    }

    const key = `${relation.targetType}:${relation.targetId}`;
    if (seen.has(key)) {
      throw new ContentRelationError(
        "duplicate_relation",
        `Материал «${key}» указан в связях источника «${sourceType}:${sourceId}» дважды`,
      );
    }
    seen.add(key);

    return {
      targetType: relation.targetType,
      targetId: relation.targetId,
      role,
      sortOrder: relation.sortOrder ?? index,
    };
  });

  const db = getDatabase();
  db.prepare("DELETE FROM content_relations WHERE source_type = ? AND source_id = ?").run(
    sourceType,
    sourceId,
  );

  const timestamp = nowIso();
  const insert = db.prepare(
    `INSERT INTO content_relations
       (source_type, source_id, target_type, target_id, relation_role, sort_order,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  rows.forEach((row) => {
    insert.run(
      sourceType,
      sourceId,
      row.targetType,
      row.targetId,
      row.role,
      row.sortOrder,
      timestamp,
      timestamp,
    );
  });

  return listRelationsFrom(sourceType, sourceId);
}

/** Замена связей отдельной операцией: то же ядро, своя транзакция. Контракт не менялся. */
export function replaceRelationsFrom(
  sourceType: ContentEntityType,
  sourceId: string,
  relations: readonly ContentRelationInput[],
): ContentRelation[] {
  return transaction(() => replaceRelationsFromCore(sourceType, sourceId, relations));
}

/**
 * Уборка связей удалённого материала — с ОБЕИХ сторон.
 *
 * Не только исходящие: если удалить продукт, ссылки статей на него останутся ссылками в никуда, и
 * блок перелинковки попытается показать несуществующую страницу. Каскада у базы нет (полиморфная
 * ссылка не выражается внешним ключом), поэтому вызвать это обязан код удаления материала.
 *
 * Существование материала здесь НЕ проверяется намеренно: метод зовут после удаления строки, когда
 * материала уже нет. Проверяется только сам тип. Возвращает число снятых связей.
 */
export function deleteRelationsForEntity(type: ContentEntityType, id: string): number {
  assertKnownEntityType(type, "тип материала");
  const result = getDatabase()
    .prepare(
      `DELETE FROM content_relations
        WHERE (source_type = ? AND source_id = ?)
           OR (target_type = ? AND target_id = ?)`,
    )
    .run(type, id, type, id);
  return Number(result.changes);
}
