import { z } from "zod";
import { ARTICLE_PLACEMENTS, ARTICLE_STATUSES } from "@/content/article-placements";
import { CONTACT_KINDS } from "../repositories/contacts";
import { CONTENT_ENTITY_TYPES, CONTENT_RELATION_ROLES } from "../repositories/contentRelations";

/**
 * Схемы административного API.
 *
 * Валидация живёт на границе сервера — до репозиториев. Так каждое сохранение проверяется одинаково
 * независимо от того, пришло оно из формы админ-панели или прямым запросом к API.
 */

const trimmed = z.string().trim();
const required = (label: string) => trimmed.min(1, `${label}: поле обязательно`);
const optionalText = trimmed.default("");

/**
 * Необязательный SEO-заголовок с ТРЕМЯ различимыми состояниями.
 *
 * | Что прислал клиент          | Результат разбора | Что делает репозиторий          |
 * | --------------------------- | ----------------- | ------------------------------- |
 * | поля нет в JSON             | `undefined`       | колонку НЕ трогает              |
 * | `null`, `""`, `"   "`       | `null`            | очищает заголовок               |
 * | непустая строка             | строка без краёв  | сохраняет новое значение        |
 *
 * Различие между первым и вторым состоянием — не педантизм, а требование обратной совместимости.
 * После деплоя у администратора может остаться открытая вкладка со СТАРЫМ бандлом; её форма не
 * знает про поле и пришлёт `PUT` без него. С прежней схемой (`.nullish()` + `undefined → null`)
 * такой запрос молча стирал заголовок, и на странице возвращался длинный автоматический — то
 * самое, что чинил шаг SEO-06.
 *
 * `.optional()` навешен ПОСЛЕДНИМ и намеренно: `ZodOptional` возвращает `undefined` не заходя во
 * вложенное преобразование, поэтому отсутствие поля физически не может превратиться в значение.
 * `.default(...)` здесь запрещён — он и есть та самая потеря различия.
 *
 * Длина НЕ ограничивается: рекомендация «до 55–60 знаков» показывается счётчиком в форме, но
 * запрет на сохранение длинного заголовка означал бы, что владелец сайта не может описать страницу
 * так, как считает нужным. Верхняя граница в 300 знаков стоит только против случайной вставки
 * целого абзаца.
 */
const optionalSeoTitle = trimmed
  .max(300, "SEO title: не длиннее 300 символов")
  .nullable()
  .transform((value) => value || null)
  .optional();

/** Slug: строчные латинские буквы, цифры и дефисы. Именно он становится адресом страницы. */
export const slugSchema = trimmed
  .min(1, "Адрес (slug): поле обязательно")
  .max(120, "Адрес (slug): не длиннее 120 символов")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Адрес (slug): только строчные латинские буквы, цифры и дефис",
  );

const isoDate = trimmed.regex(/^\d{4}-\d{2}-\d{2}$/, "Дата: формат ГГГГ-ММ-ДД");

// ── Вход ──────────────────────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  login: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

// ── Отделы ────────────────────────────────────────────────────────────────────────────────────
const painPointSchema = z.object({
  pain: required("Проблема"),
  gain: required("Результат"),
  howItWorks: trimmed.optional(),
});

const processStepSchema = z.object({
  id: required("Идентификатор шага"),
  label: required("Название шага"),
  description: required("Описание шага"),
  actor: trimmed.optional(),
  status: z.enum(["normal", "warning", "critical", "success"]).optional(),
  visualAnchor: trimmed.optional(),
});

export const departmentUpdateSchema = z.object({
  name: required("Название отдела"),
  overviewLabel: required("Подпись в офисе"),
  overviewProblem: required("Проблема в обзоре"),
  hoverDescription: required("Описание при наведении"),
  headline: required("Заголовок"),
  problem: required("Что происходит сейчас"),
  painPoints: z.array(painPointSchema).length(5, "Нужно ровно 5 пар «проблема → результат»"),
  customerBenefits: z.array(required("Выгода")).length(4, "Нужно ровно 4 пункта выгоды"),
  beforeSteps: z.array(processStepSchema).min(1).optional(),
  automationSteps: z.array(processStepSchema).min(1).optional(),
  ctaLabel: required("Текст кнопки"),
  solutionPath: required("Адрес решения"),
  reference: required("Служебная пометка"),
  isPublished: z.boolean().default(true),
});

// ── Продукты ──────────────────────────────────────────────────────────────────────────────────
const priceSchema = z.object({
  label: required("Название тарифа"),
  value: required("Стоимость"),
  amount: z.number().int().nonnegative(),
});

export const productUpdateSchema = z.object({
  slug: slugSchema,
  menuTitle: required("Короткое название"),
  fullTitle: required("Полное название"),
  imageAlt: required("Описание фотографии"),
  seoTitle: optionalSeoTitle,
  content: z.object({
    summary: required("Описание"),
    applies: required("Где применяется"),
    examples: z.array(required("Пример")).min(1, "Нужен хотя бы один пример"),
    prices: z.array(priceSchema).min(1, "Нужен хотя бы один тариф"),
    priceNote: trimmed.optional(),
    benefit: required("Выгода"),
  }),
  sortOrder: z.number().int().min(0),
  isPublished: z.boolean(),
});

export const reorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

// ── Статьи ────────────────────────────────────────────────────────────────────────────────────
export const articleSchema = z.object({
  slug: slugSchema,
  title: required("Название"),
  excerpt: required("Краткий анонс"),
  description: optionalText,
  bodyMarkdown: required("Основной текст"),
  coverUrl: optionalText,
  coverAlt: optionalText,
  placement: z.enum(ARTICLE_PLACEMENTS.map((item) => item.value) as [string, ...string[]]),
  category: optionalText,
  tags: z.array(trimmed.min(1)).max(12).default([]),
  relatedSlugs: z.array(trimmed.min(1)).max(6).default([]),
  author: optionalText,
  seoTitle: optionalSeoTitle,
  seoDescription: optionalText,
  status: z.enum(ARTICLE_STATUSES),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  publishedAt: isoDate.nullable().default(null),
});

/**
 * Одна связь материала в теле запроса.
 *
 * Повторяет входной контракт репозитория связей (`ContentRelationInput`): цель по ИДЕНТИФИКАТОРУ,
 * никогда по адресу. `role` и `sortOrder` необязательны — репозиторий подставляет роль «связанный»
 * и порядок по позиции в массиве, и схема не должна навязывать значения, которых клиент не
 * присылал.
 *
 * Списки допустимых типов и ролей берутся из самого репозитория, а не переписываются здесь.
 */
const contentRelationInputSchema = z.object({
  targetType: z.enum(CONTENT_ENTITY_TYPES),
  targetId: required("Идентификатор цели связи"),
  role: z.enum(CONTENT_RELATION_ROLES).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Правка статьи (PUT) — та же статья плюс необязательные связи.
 *
 * Отдельная схема, а не расширение `articleSchema` на месте: создание (POST) связи не принимает, и
 * общее поле означало бы, что присланный при создании список молча отбрасывается.
 *
 * У `relations` НЕТ `.default([])`, и это главное свойство схемы. Различаются три состояния:
 * поля нет — связи не трогаются; `[]` — связи очищаются; непустой список — полная замена. С
 * `.default([])` первое состояние стало бы вторым, и каждое сохранение текста статьи из формы,
 * которая про связи ещё не знает, молча стирало бы всю перелинковку.
 *
 * Верхняя граница списка — предел здравого смысла, а не требование схемы БД: перелинковку
 * составляет человек, и сотня связей у одной статьи означала бы не перелинковку, а ошибку клиента.
 * Она заметно выше, чем `.max(6)` у прежнего `relatedSlugs`: новые связи ведут на материалы четырёх
 * типов, а не только на статьи.
 */
export const articleUpdateSchema = articleSchema.extend({
  relations: z.array(contentRelationInputSchema).max(24).optional(),
});

// ── Кейсы ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Кейс архива.
 *
 * Обязательно всё, из чего состоит утверждённая структура досье: без задачи, результата, оговорки
 * о человеке или ограничения применимости документ не кейс, а рекламная заметка. Поэтому проверка
 * стоит здесь, на границе сервера, а не в форме: она одинаково действует и на запрос из
 * админ-панели, и на прямой запрос к API.
 *
 * Чего в схеме НЕТ намеренно: `ctaLabel`/`ctaHref`, `folderCaption`, `label`, `status`, даты и
 * `id`. Ссылка в конце досье и служебные подписи одинаковы у всех дел архива и задаются моделью;
 * статус и даты ставит сервер; идентификатор клиент не выбирает. Неизвестные поля тела запроса zod
 * отбрасывает — прислать их «мимо схемы» нельзя.
 *
 * Длина SEO-полей НЕ ограничивается сверх разумного: рекомендация показывается счётчиком в форме,
 * но запрет на сохранение из-за пары лишних символов означал бы, что владелец сайта не может
 * описать страницу так, как считает нужным (то же решение, что у статей и продуктов).
 */
export const caseSchema = z
  .object({
    slug: slugSchema,
    title: required("Название кейса"),
    shortTitle: required("Короткое название"),
    fileNumber: trimmed
      .min(1, "Номер дела: поле обязательно")
      .regex(/^\d{1,4}$/, "Номер дела: только цифры, например 02"),
    summary: required("Краткий итог"),
    task: required("Задача"),
    implementation: required("Что реализовали"),
    workflowSteps: z.array(required("Шаг процесса")).max(12, "Не больше 12 шагов").default([]),
    result: required("Результат"),
    metricLabel: optionalText,
    metricBefore: optionalText,
    metricAfter: optionalText,
    metricSource: optionalText,
    humanControl: required("Что остаётся под контролем человека"),
    limitations: required("Ограничение результата"),
    seoTitle: required("SEO title").max(300, "SEO title: не длиннее 300 символов"),
    seoDescription: required("Meta description").max(
      600,
      "Meta description: не длиннее 600 символов",
    ),
    ogDescription: trimmed.max(600, "OG description: не длиннее 600 символов").default(""),
    stampEnabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .superRefine((study, ctx) => {
    /**
     * Метрика — либо целиком, либо никак.
     *
     * Цифра без подписи, без второй половины пары «до/после» или без указания источника — это уже
     * не измеренный результат, а обещание. Раздел построен на обратном правиле, и полупустой блок
     * ломал бы его молча: в документе появилась бы строка «До: 4 часа» без «После» и без того, кто
     * это измерил.
     */
    const filled = [study.metricLabel, study.metricBefore, study.metricAfter, study.metricSource];
    if (filled.some(Boolean) && !filled.every(Boolean)) {
      for (const [field, label] of [
        ["metricLabel", "Название показателя"],
        ["metricBefore", "Значение «До»"],
        ["metricAfter", "Значение «После»"],
        ["metricSource", "Источник данных"],
      ] as const) {
        if (!study[field]) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: `${label}: заполните весь блок измеримого результата или очистите его целиком`,
          });
        }
      }
    }
  });

// ── Контакты ──────────────────────────────────────────────────────────────────────────────────
const contactHref = trimmed.refine(
  (value) => /^(https?:\/\/|mailto:|tel:|\/)/.test(value),
  "Ссылка: допустимы https://, mailto:, tel: или внутренний адрес, начинающийся с /",
);

export const contactItemSchema = z
  .object({
    id: trimmed
      .min(1, "Идентификатор: поле обязательно")
      .regex(/^[a-z0-9-]+$/, "Идентификатор: строчные латинские буквы, цифры и дефис"),
    kind: z.enum(CONTACT_KINDS),
    label: required("Подпись"),
    value: required("Значение"),
    href: contactHref,
    accessibleLabel: optionalText,
    headerLabel: optionalText,
    isExternal: z.boolean().default(false),
    isPublished: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .superRefine((contact, ctx) => {
    // Проверка формата по роли канала: телефон обязан быть tel:, почта — mailto:. Иначе ссылка
    // выглядит правильно, но у посетителя не открывается ни звонилка, ни почтовый клиент.
    if (contact.kind === "email" && !contact.href.startsWith("mailto:")) {
      ctx.addIssue({
        code: "custom",
        path: ["href"],
        message: "Email: ссылка должна быть mailto:",
      });
    }
    if (
      (contact.kind === "phone" || contact.kind === "phone-extra") &&
      !contact.href.startsWith("tel:")
    ) {
      ctx.addIssue({ code: "custom", path: ["href"], message: "Телефон: ссылка должна быть tel:" });
    }
    if (contact.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Некорректный адрес почты" });
    }
  });

export const contactsUpdateSchema = z.object({
  items: z.array(contactItemSchema).min(1, "Нужен хотя бы один контакт"),
});

// ── Документы ─────────────────────────────────────────────────────────────────────────────────
export const documentUpdateSchema = z.object({
  title: required("Название"),
  description: optionalText,
  category: required("Категория"),
  documentDate: isoDate.nullable().default(null),
  sortOrder: z.number().int().min(0),
  isPublished: z.boolean(),
});

// ── Общие тексты страниц ──────────────────────────────────────────────────────────────────────
export const pageContentSchema = z.object({
  content: z.record(z.string(), z.unknown()),
});
