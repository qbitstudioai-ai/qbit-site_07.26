import { getDatabase, nowIso, transaction } from "../db/client";

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

const RELATION_ROLES: readonly ContentRelationRole[] = ["primary", "related"];

/** Роль по умолчанию: обычная связь «рядом», а не главная. Совпадает с DEFAULT в схеме. */
const DEFAULT_ROLE: ContentRelationRole = "related";

export type ContentRelationErrorCode =
  | "unknown_entity_type"
  | "unknown_relation_role"
  | "missing_entity"
  | "self_link"
  | "duplicate_relation";

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
 */
export function replaceRelationsFrom(
  sourceType: ContentEntityType,
  sourceId: string,
  relations: readonly ContentRelationInput[],
): ContentRelation[] {
  return transaction(() => {
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
  });
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
