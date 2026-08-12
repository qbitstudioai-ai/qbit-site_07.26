import { describe, expect, it } from "vitest";
import { CASES_PAGE_COPY } from "@/features/cases/casesPageCopy";
import { casePath, caseUrl, CASES_PATH } from "@/features/cases/casesRoutes";
import {
  CASES_URL,
  caseSeoDescription,
  caseSeoTitle,
  caseSocialDescription,
  caseStudyStructuredData,
  casesIndexStructuredData,
} from "@/features/cases/casesSeo";
import { firstTextBlock, type CaseMetric, type CaseStudy } from "@/features/cases/types";
import { CASES_LINK } from "@/content/casesLink";
import { getHomepageCopy } from "@/content/homepage-copy";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { CASE_SALES_CALL_ANALYSIS } from "@/tests/fixtures/firstCase";

/**
 * Содержимое первого кейса, его SEO, адреса раздела и пункт меню.
 *
 * Проверки идут по ЗАМОРОЖЕННОЙ копии первого кейса (`src/tests/fixtures/firstCase.ts`) — это тот
 * самый документ, который был на production до переезда раздела в базу. Совпадение копии с тем, что
 * сегодня отдаёт база, доказывается отдельно и целиком в `src/tests/unit/server/casesRepository.
 * test.ts`; здесь же закрепляется САМ утверждённый текст: шесть разделов, цифры рядом с источником,
 * оговорка вплотную к метрике, отсутствие непредоставленных сведений и дословный заголовок выдачи.
 *
 * Разделение намеренное: содержимое кейса — предмет договорённости с заказчиком и меняться не
 * должно, а способ хранения — деталь реализации, и он уже поменялся однажды.
 */

/** Весь видимый посетителю текст кейса — заголовки и содержимое блоков. */
function visibleText(study: CaseStudy): string {
  const parts: string[] = [study.title, study.shortTitle, study.summary ?? ""];

  for (const section of study.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if (block.kind === "text") parts.push(block.text);
      if (block.kind === "chain") parts.push(...block.steps);
      if (block.kind === "metrics") {
        parts.push(
          ...block.items.flatMap((metric) => [
            metric.label,
            metric.before,
            metric.after,
            metric.sourceNote ?? "",
          ]),
        );
      }
    }
  }

  return parts.join(" ");
}

/** `@id` есть не у каждого узла графа — у `BreadcrumbList` его нет, отсюда проверка через `in`. */
function nodeIds(nodes: readonly object[]): (string | undefined)[] {
  return nodes.map((node) => ("@id" in node ? String(node["@id"]) : undefined));
}

function metricsOf(study: CaseStudy): CaseMetric[] {
  return study.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.kind === "metrics" ? block.items : [])),
  );
}

describe("первый реальный кейс — анализ звонков отдела продаж", () => {
  const study = CASE_SALES_CALL_ANALYSIS;

  it("занимает дело № 01, опубликован и сохраняет прежний адрес и H1", () => {
    expect(study.slug).toBe("analiz-zvonkov-otdela-prodazh");
    expect(study.fileNumber).toBe("01");
    expect(study.sortOrder).toBe(1);
    expect(study.stampEnabled).toBe(true);
    expect(study.status).toBe("published");
    // Адрес и H1 не менялись ни при публикации, ни при переезде раздела в базу.
    expect(study.title).toBe(
      "AI-анализ звонков отдела продаж: от нескольких часов проверки к 10–15 минутам",
    );
    expect(study.shortTitle).toBe("AI-анализ звонков отдела продаж");
  });

  it("имеет стабильный адрес и непустое досье", () => {
    expect(study.slug).toMatch(/^[a-z0-9-]+$/);
    expect(casePath(study)).toBe(`${CASES_PATH}/${study.slug}`);
    expect(caseUrl(study)).toBe(`${SITE_URL}${CASES_PATH}/${study.slug}`);
    expect(new Set(study.sections.map((section) => section.id)).size).toBe(study.sections.length);
    // Пустых разделов не бывает: раздел без блоков — дыра в документе, а не оформление.
    expect(study.sections.every((section) => section.blocks.length > 0)).toBe(true);
    expect(firstTextBlock(study)).toBeTruthy();
  });

  it("состоит ровно из шести смысловых разделов в утверждённом порядке", () => {
    /**
     * Шесть, а не восемь. Разделы «Как было раньше» и «Как работает решение» сняты, а их содержание
     * перенесено в «Задачу» и «Что реализовали» соответственно: три пересказа одного и того же
     * процесса подряд утяжеляли первый экран и ничего не добавляли ни читателю, ни выдаче.
     */
    expect(study.sections.map((section) => section.heading)).toEqual([
      "Краткий итог",
      "Задача",
      "Что реализовали",
      "Результат",
      "Что остаётся под контролем человека",
      "Об измеримом результате",
    ]);

    // Снятые разделы не должны вернуться ни под каким видом.
    expect(study.sections.map((section) => section.id)).not.toContain("case-01-before");
    expect(study.sections.map((section) => section.id)).not.toContain("case-01-workflow");
  });

  it("не дублирует «Краткий итог» вводной строкой над ним", () => {
    // `summary` не заполнен намеренно: иначе один и тот же текст попал бы в HTML дважды.
    expect(study.summary).toBeUndefined();
    expect(firstTextBlock(study)).toContain("4–5 часов в неделю");
  });

  it("содержит метрику «до/после» с указанием источника — внутри раздела «Результат»", () => {
    const metrics = metricsOf(study);

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toEqual({
      label: "Время руководителя на контроль звонков",
      before: "4–5 часов в неделю",
      after: "10–15 минут в неделю",
      sourceNote: "По данным заказчика",
    });

    const result = study.sections.find((section) => section.heading === "Результат");
    expect(result?.blocks.some((block) => block.kind === "metrics")).toBe(true);
    // Метрика — не отдельный дашборд: она стоит между абзацами того же раздела.
    expect(result?.blocks.filter((block) => block.kind === "text").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  /**
   * Оговорка о неповторимости результата стоит ВПЛОТНУЮ к цифрам — сразу после блока метрики,
   * внутри того же раздела. Это и есть закрытый GEO-риск: пока единственное ограничение лежало
   * через два раздела, цифры могли быть процитированы генеративной системой как общее обещание.
   */
  it("держит оговорку о применимости в одном разделе с цифрами результата", () => {
    const result = study.sections.find((section) => section.heading === "Результат");
    const kinds = result!.blocks.map((block) => block.kind);
    const metricIndex = kinds.indexOf("metrics");
    const bridge = result!.blocks[metricIndex + 1];

    expect(metricIndex).toBeGreaterThanOrEqual(0);
    expect(bridge?.kind, "сразу после метрики нет текстового блока").toBe("text");
    expect(bridge.kind === "text" && bridge.text).toContain(
      "не гарантирует такой же экономии времени в другой компании",
    );
    expect(bridge.kind === "text" && bridge.text).toContain("подробнее ниже");
  });

  /**
   * Последний абзац досье обязан быть понятен ВНЕ документа: генеративные системы цитируют абзац
   * вместе с ближайшим контекстом, и «Он не является гарантией…» без подлежащего теряет смысл.
   */
  it("заканчивается автономно понятной оговоркой, а не местоимением", () => {
    const limitations = study.sections.at(-1)!;
    const last = limitations.blocks.at(-1)!;

    expect(limitations.heading).toBe("Об измеримом результате");
    expect(last.kind).toBe("text");
    expect(last.kind === "text" && last.text.startsWith("Полученный результат")).toBe(true);
    expect(last.kind === "text" && last.text.startsWith("Он ")).toBe(false);
  });

  it("описывает процесс цепочкой шагов, а не абзацем со стрелками", () => {
    const workflow = study.sections.find((section) => section.heading === "Что реализовали");
    const chain = workflow?.blocks.find((block) => block.kind === "chain");

    expect(chain).toBeDefined();
    expect(chain?.kind === "chain" && chain.steps).toEqual([
      "звонки менеджеров",
      "автоматическая обработка",
      "AI-анализ",
      "структурированный отчёт",
      "руководитель",
    ]);
    // Цепочка не написана текстом внутри абзаца — иначе она была бы просто строкой со стрелками.
    expect(
      workflow?.blocks.some((block) => block.kind === "text" && block.text.includes("→")),
    ).toBe(false);
  });

  it("сохраняет оговорку о человеке и об отсутствии гарантии повторения результата", () => {
    const text = visibleText(study);

    expect(text).toContain("Окончательную оценку работы менеджеров и любые управленческие решения");
    expect(text).toContain(
      "не является гарантией аналогичной экономии времени для другой компании",
    );
  });

  it("не содержит ни одного непредоставленного сведения", () => {
    /**
     * Прямой запрет этапа. Проверяются именно те сущности, которых в утверждённом тексте нет:
     * название и отрасль заказчика, стек, сроки, стоимость, проценты и рубли. Тест существует
     * ровно для того, чтобы такие данные нельзя было «дописать для полноты» при следующей правке.
     */
    const text = visibleText(study);

    expect(text).not.toMatch(/ООО|\bАО\b|CRM|amoCRM|Битрикс|n8n|Supabase|GPT|Claude|Whisper|STT/i);
    expect(text).not.toMatch(/телефони|интеграци|разработ(ка|ку) заняла|срок|стоимость|бюджет/i);
    expect(text).not.toMatch(/\d+\s*(%|₽|руб|млн|тыс|сотрудник|менеджеров\s+в|звонк(ов|а)\s+в)/i);
    expect(text).not.toMatch(/сэконом|окупаем|прибыл|выручк|замен(а|ит|яет)\s+сотрудник/i);

    // Раздела «Технологии» в досье нет: заполнить его нечем, кроме догадок.
    expect(study.sections.map((section) => section.heading)).not.toContain("Технологии");
  });

  it("заканчивается одной спокойной ссылкой на «Контакты» и никакой другой", () => {
    expect(study.cta).toEqual({ label: "Обсудить похожую задачу", href: "/contacts" });

    // Ни одной другой ссылки в содержимом досье: связей с конкретными продуктами заказчик не
    // подтверждал, и придумывать их нельзя.
    expect(visibleText(study)).not.toMatch(/https?:\/\/|\]\(|<a\s/i);
  });
});

describe("SEO первого реального кейса", () => {
  const study = CASE_SALES_CALL_ANALYSIS;

  it("берёт заголовок выдачи ДОСЛОВНО и не дописывает бренд", () => {
    const title = caseSeoTitle(study);

    expect(title).toBe("AI-анализ звонков отдела продаж: с 4–5 часов до 10–15 минут");
    // Проверяется именно отсутствие автоматической приписки: она удлинила бы строку в выдаче и
    // разошлась бы с утверждённым заголовком.
    expect(title).not.toContain(SITE_NAME);
    expect(title.endsWith(`— ${SITE_NAME}`)).toBe(false);
    // H1 при этом другой и остаётся длиннее — у него своя задача.
    expect(title).not.toBe(study.title);
    expect(title.length).toBeLessThan(study.title.length);
  });

  it("описывает страницу утверждённым текстом разумной длины", () => {
    const description = caseSeoDescription(study);

    expect(description).toBe(
      "Кейс: AI-анализ звонков сократил время руководителя на контроль отдела продаж с 4–5 часов " +
        "до 10–15 минут в неделю. По данным заказчика.",
    );
    expect(description.length).toBeLessThanOrEqual(200);

    // Описание для соцсетей отличается сознательно: карточка читается без поискового запроса.
    expect(caseSocialDescription(study)).toBe(
      "Кейс QBit-Studio-Ai: анализ звонков автоматизирован, руководитель получает готовый " +
        "AI-отчёт. По данным заказчика.",
    );
  });

  it("не имеет выдуманной даты публикации", () => {
    /**
     * Подтверждённой даты у кейса нет, и переезд в базу её не создал: любое значение здесь — дата
     * сборки, «сегодня» или дата миграции — было бы заявлением о материале, которого никто не
     * делал. Из этого же следует отсутствие `Article`-разметки: см. следующий тест.
     */
    expect(study.publishedAt).toBeUndefined();
    expect(study.modifiedAt).toBeUndefined();
  });

  it("собирает разметку из общесайтовых сущностей и не выдумывает новых", () => {
    const nodes = caseStudyStructuredData(study);
    const types = nodes.map((node) => node["@type"]);

    expect(types).toEqual(["BreadcrumbList", "WebPage", "Organization"]);

    // Ни `Article` (нет подтверждённой даты), ни разметки, для которой на странице нет содержимого.
    const serialized = JSON.stringify(nodes);
    for (const forbidden of [
      "Article",
      "BlogPosting",
      "CaseStudy",
      "FAQPage",
      "Review",
      "AggregateRating",
      "Offer",
      "author",
      "datePublished",
    ]) {
      expect(serialized, `в разметке появился ${forbidden}`).not.toContain(forbidden);
    }

    // «Хлебные крошки» ведут по настоящим адресам: Главная → Кейсы → короткое имя дела.
    const breadcrumb = nodes[0] as { itemListElement: { name: string; item: string }[] };
    expect(breadcrumb.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Кейсы", item: CASES_URL },
      { "@type": "ListItem", position: 3, name: study.shortTitle, item: caseUrl(study) },
    ]);

    // Организация и сайт остаются ОДНОЙ сущностью графа: общие `@id` не переопределяются.
    expect(nodeIds(nodes)).toEqual([
      undefined,
      `${caseUrl(study)}#webpage`,
      `${SITE_URL}/#organization`,
    ]);
  });

  it("canonical кейса — абсолютный адрес без строки запроса", () => {
    expect(caseUrl(study)).toBe(`${SITE_URL}/cases/analiz-zvonkov-otdela-prodazh`);
    expect(caseUrl(study)).not.toContain("?");
  });
});

describe("обложка архива `/cases`", () => {
  it("сохраняет H1 и не содержит ни одной preview-фразы", () => {
    expect(CASES_PAGE_COPY.headline).toBe("Архив реализованных проектов");

    const text = [CASES_PAGE_COPY.headline, ...CASES_PAGE_COPY.intro].join(" ");
    expect(text).not.toContain("Раздел готовится");
    expect(text).not.toMatch(/будет добавлен|как будет выглядеть|в разработке|скоро/i);
  });

  it("вводит раздел двумя абзацами: что здесь лежит и чего цифры не обещают", () => {
    expect(CASES_PAGE_COPY.intro).toHaveLength(2);
    expect(CASES_PAGE_COPY.intro[0]).toContain("реализованные проекты QBit-Studio-Ai");
    expect(CASES_PAGE_COPY.intro[1]).toContain("не являются гарантией аналогичного эффекта");
  });

  it("имеет production-заголовок и описание без повтора бренда", () => {
    expect(CASES_PAGE_COPY.seoTitle).toBe("Кейсы автоматизации бизнес-процессов — QBit-Studio-Ai");
    expect(CASES_PAGE_COPY.seoDescription).toBe(
      "Реализованные проекты QBit-Studio-Ai: задачи, решения и измеримые результаты автоматизации " +
        "бизнес-процессов по данным конкретных внедрений.",
    );
    expect(CASES_PAGE_COPY.seoDescription.length).toBeLessThanOrEqual(200);
    // Бренд внутри строки ровно один раз — значит `withBrand` его не удвоит.
    expect(CASES_PAGE_COPY.seoTitle.split(SITE_NAME)).toHaveLength(2);
  });

  it("собирает ту же общесайтовую разметку, что и остальные разделы", () => {
    const nodes = casesIndexStructuredData({
      name: CASES_PAGE_COPY.seoTitle,
      description: CASES_PAGE_COPY.seoDescription,
    });

    expect(nodes.map((node) => node["@type"])).toEqual([
      "BreadcrumbList",
      "CollectionPage",
      "Organization",
    ]);
    expect(nodeIds(nodes)).toEqual([
      undefined,
      `${CASES_URL}#webpage`,
      `${SITE_URL}/#organization`,
    ]);
    expect(CASES_URL).toBe(`${SITE_URL}/cases`);
  });
});

describe("пункт меню «Кейсы»", () => {
  it("присутствует в шапке, ведёт на /cases и не дублируется", () => {
    const links = getHomepageCopy().heroLinks;
    const cases = links.filter((link) => link.href === CASES_PATH);

    expect(cases).toHaveLength(1);
    expect(cases[0].label).toBe("Кейсы");
    expect(CASES_LINK).toEqual({ label: "Кейсы", href: CASES_PATH });
  });

  it("стоит перед «Блогом» и не сдвигает остальные пункты", () => {
    const links = getHomepageCopy().heroLinks;
    const labels = links.map((link) => link.label);

    const casesIndex = links.findIndex((link) => link.href === CASES_PATH);
    const blogIndex = links.findIndex((link) => link.href === "/blog");

    expect(casesIndex).toBeGreaterThanOrEqual(0);
    expect(blogIndex).toBeGreaterThan(casesIndex);
    // Прежний порядок сохранён целиком — добавился ровно один пункт.
    expect(labels.filter((label) => label !== "Кейсы")).toEqual([
      "Главная",
      "Найти потери",
      "О нас",
      "Продукт и Стоимость",
      "Документы",
      "Блог",
      "FAQ",
      "Контакты",
      "Вход",
    ]);
  });

  it("ни один пункт меню не остался заглушкой", () => {
    expect(getHomepageCopy().heroLinks.filter((link) => link.href === "#")).toEqual([]);
  });
});
