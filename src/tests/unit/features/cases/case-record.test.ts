import { describe, expect, it } from "vitest";
import {
  CASE_DEFAULTS,
  CASE_SECTIONS,
  caseParagraphs,
  caseRecordToStudy,
  type CaseRecord,
} from "@/features/cases/caseRecord";
import { slugFromTitle } from "@/features/admin/slugFromTitle";
import { caseSchema } from "@/server/api/schemas";

/**
 * Превращение записи хранилища в документ архива, подсказка адреса и проверка формы.
 *
 * Всё, что здесь проверяется, — чистые функции: ни базы, ни сети. Задача файла — закрепить правила,
 * на которых держится структура кейса, созданного НЕ разработчиком: порядок разделов, место
 * цепочки и метрики, обязательность ограничения рядом с цифрами, отсутствие полуметрики.
 */

const RECORD: CaseRecord = {
  id: "case-x",
  slug: "primer-keysa",
  title: "Пример кейса",
  shortTitle: "Пример",
  folderCaption: CASE_DEFAULTS.folderCaption,
  fileNumber: "07",
  label: CASE_DEFAULTS.label,
  summary: "Итог.",
  task: "Задача.",
  implementation: "Вводный абзац.\n\nЗаключительный абзац.",
  workflowSteps: ["шаг один", "шаг два"],
  result: "Результат.\n\nОговорка рядом с цифрами.",
  metricLabel: "Показатель",
  metricBefore: "3 часа",
  metricAfter: "20 минут",
  metricSource: "По данным заказчика",
  humanControl: "Решает человек.",
  limitations: "Результат относится к конкретному внедрению.",
  ctaLabel: CASE_DEFAULTS.ctaLabel,
  ctaHref: CASE_DEFAULTS.ctaHref,
  seoTitle: "Заголовок выдачи",
  seoDescription: "Описание страницы.",
  ogDescription: "Описание карточки.",
  status: "published",
  stampEnabled: true,
  sortOrder: 7,
  publishedAt: "2026-08-11T09:00:00.000Z",
  modifiedAt: "2026-08-11T09:00:00.000Z",
  createdAt: "2026-08-11T09:00:00.000Z",
  updatedAt: "2026-08-11T09:00:00.000Z",
};

describe("абзацы раздела", () => {
  it("разделяются пустой строкой, а одиночный перенос абзаца не создаёт", () => {
    expect(caseParagraphs("Первый.\n\nВторой.")).toEqual(["Первый.", "Второй."]);
    // Перенос внутри предложения — часть набора, а не структура документа.
    expect(caseParagraphs("Одно\nпредложение.")).toEqual(["Одно\nпредложение."]);
  });

  it("переживают вставку из редактора с переносами Windows и лишние пустые строки", () => {
    expect(caseParagraphs("Первый.\r\n\r\n\r\nВторой.\r\n")).toEqual(["Первый.", "Второй."]);
    expect(caseParagraphs("   ")).toEqual([]);
  });
});

describe("документ, собранный из записи", () => {
  it("сохраняет утверждённый порядок разделов", () => {
    const study = caseRecordToStudy(RECORD);

    expect(study.sections.map((section) => section.heading)).toEqual(
      CASE_SECTIONS.map((section) => section.heading),
    );
    // Якорь заголовка привязан к номеру дела — так же, как у перенесённого первого кейса.
    expect(study.sections.map((section) => section.id)).toEqual([
      "case-07-summary",
      "case-07-task",
      "case-07-solution",
      "case-07-result",
      "case-07-human-control",
      "case-07-limitations",
    ]);
  });

  it("ставит цепочку после вводного абзаца, а метрику — перед оговоркой", () => {
    const study = caseRecordToStudy(RECORD);
    const solution = study.sections.find((section) => section.heading === "Что реализовали");
    const result = study.sections.find((section) => section.heading === "Результат");

    expect(solution?.blocks.map((block) => block.kind)).toEqual(["text", "chain", "text"]);
    /**
     * Порядок «цифра → оговорка», а не наоборот. Ограничение применимости обязано стоять ПОСЛЕ
     * метрики и в том же разделе: генеративные системы цитируют абзац вместе с ближайшим
     * контекстом, и оговорка, оторванная от цифр, перестаёт их ограничивать.
     */
    expect(result?.blocks.map((block) => block.kind)).toEqual(["text", "metrics", "text"]);
  });

  it("не рисует цепочку и метрику, если их не заполнили", () => {
    const study = caseRecordToStudy({
      ...RECORD,
      workflowSteps: [],
      metricLabel: "",
      metricBefore: "",
      metricAfter: "",
      metricSource: "",
    });

    const kinds = study.sections.flatMap((section) => section.blocks.map((block) => block.kind));
    expect(kinds).not.toContain("chain");
    expect(kinds).not.toContain("metrics");
    // Разделы при этом на месте — пропала служебная вставка, а не текст.
    expect(study.sections).toHaveLength(6);
  });

  it("пропускает незаполненный раздел вместо пустого заголовка в документе", () => {
    // Схема такого кейса не пропустит, но документ не должен ломаться и на неполной записи из базы.
    const study = caseRecordToStudy({ ...RECORD, humanControl: "" });

    expect(study.sections.map((section) => section.heading)).not.toContain(
      "Что остаётся под контролем человека",
    );
    expect(study.sections.every((section) => section.blocks.length > 0)).toBe(true);
  });

  it("отдаёт CTA, SEO и даты только когда они есть", () => {
    expect(caseRecordToStudy(RECORD).cta).toEqual({
      label: "Обсудить похожую задачу",
      href: "/contacts",
    });

    const bare = caseRecordToStudy({
      ...RECORD,
      ctaLabel: "",
      ctaHref: "",
      seoTitle: "",
      ogDescription: "",
      publishedAt: null,
      modifiedAt: null,
    });

    // Отсутствующие поля именно ОТСУТСТВУЮТ, а не равны пустой строке: `seoTitle: ""` заставил бы
    // страницу выдать пустой заголовок вместо запасного.
    expect(bare.cta).toBeUndefined();
    expect(bare.seoTitle).toBeUndefined();
    expect(bare.ogDescription).toBeUndefined();
    expect(bare.publishedAt).toBeUndefined();
    expect(bare.modifiedAt).toBeUndefined();
  });

  it("не пропускает разметку внутрь документа — текст остаётся текстом", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const study = caseRecordToStudy({ ...RECORD, task: payload });
    const task = study.sections.find((section) => section.heading === "Задача");

    expect(task?.blocks).toEqual([{ kind: "text", text: payload }]);
  });
});

describe("подсказка адреса по названию", () => {
  it("транслитерирует русское название в допустимый адрес", () => {
    expect(slugFromTitle("AI-анализ звонков отдела продаж")).toBe(
      "ai-analiz-zvonkov-otdela-prodazh",
    );
    expect(slugFromTitle("Ещё один кейс: сокращение времени!")).toBe(
      "eshche-odin-keys-sokrashchenie-vremeni",
    );
  });

  it("выдаёт строку, которую принимает проверка адреса на сервере", () => {
    for (const title of ["Кейс № 2", "  Пробелы  по краям  ", "Тире — и дефис-в-слове"]) {
      expect(slugFromTitle(title)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("не выдумывает адрес, когда его не из чего собрать", () => {
    expect(slugFromTitle("«»!?…")).toBe("");
  });
});

describe("проверка кейса на сервере", () => {
  const VALID = {
    slug: "primer-keysa",
    title: "Пример кейса",
    shortTitle: "Пример",
    fileNumber: "07",
    summary: "Итог.",
    task: "Задача.",
    implementation: "Реализация.",
    result: "Результат.",
    humanControl: "Решает человек.",
    limitations: "Ограничение.",
    seoTitle: "Заголовок",
    seoDescription: "Описание",
  };

  it("принимает заполненный кейс и приводит необязательные поля к пустым значениям", () => {
    const parsed = caseSchema.parse(VALID);

    expect(parsed.workflowSteps).toEqual([]);
    expect(parsed.metricLabel).toBe("");
    expect(parsed.ogDescription).toBe("");
    expect(parsed.stampEnabled).toBe(true);
  });

  it("не пропускает кейс без обязательного раздела", () => {
    for (const field of [
      "title",
      "shortTitle",
      "summary",
      "task",
      "implementation",
      "result",
      "humanControl",
      "limitations",
      "seoTitle",
      "seoDescription",
    ] as const) {
      const result = caseSchema.safeParse({ ...VALID, [field]: "   " });
      expect(result.success, `${field} прошло пустым`).toBe(false);
    }
  });

  it("не пропускает адрес с пробелами, кириллицей и заглавными буквами", () => {
    for (const slug of ["Пример", "primer keysa", "Primer-Keysa", "primer_keysa", ""]) {
      expect(caseSchema.safeParse({ ...VALID, slug }).success, slug).toBe(false);
    }
  });

  it("требует номер дела цифрами", () => {
    expect(caseSchema.safeParse({ ...VALID, fileNumber: "02" }).success).toBe(true);
    expect(caseSchema.safeParse({ ...VALID, fileNumber: "дело" }).success).toBe(false);
    expect(caseSchema.safeParse({ ...VALID, fileNumber: "" }).success).toBe(false);
  });

  it("требует метрику целиком, если заполнена хотя бы одна её часть", () => {
    const half = caseSchema.safeParse({ ...VALID, metricBefore: "4 часа" });

    expect(half.success).toBe(false);
    const paths = half.success ? [] : half.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["metricLabel", "metricAfter", "metricSource"]));

    const full = caseSchema.safeParse({
      ...VALID,
      metricLabel: "Показатель",
      metricBefore: "4 часа",
      metricAfter: "20 минут",
      metricSource: "По данным заказчика",
    });
    expect(full.success).toBe(true);
  });

  it("отбрасывает поля, которых форма не редактирует", () => {
    /**
     * Ссылка в конце досье, служебные подписи, статус, даты и идентификатор задаются моделью и
     * сервером. Прислать их «мимо формы» нельзя: схема их не знает, и zod убирает лишние ключи.
     */
    const parsed = caseSchema.parse({
      ...VALID,
      ctaHref: "https://example.com",
      label: "ЧУЖАЯ МЕТКА",
      status: "draft",
      publishedAt: "2020-01-01T00:00:00.000Z",
      id: "подделанный-id",
    }) as Record<string, unknown>;

    expect(parsed.ctaHref).toBeUndefined();
    expect(parsed.label).toBeUndefined();
    expect(parsed.status).toBeUndefined();
    expect(parsed.publishedAt).toBeUndefined();
    expect(parsed.id).toBeUndefined();
  });
});
