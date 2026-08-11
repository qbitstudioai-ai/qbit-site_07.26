import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CASES_CONTENT } from "../../features/cases/casesContent";
import { CASE_SALES_CALL_ANALYSIS } from "../../features/cases/casesRealData";

/**
 * Раздел «Кейсы» ПОСЛЕ публикации: первый реальный кейс открыт, раздел индексируется.
 *
 * Что здесь проверяется и почему именно так:
 *
 * — адреса. Каждый опубликованный кейс обязан быть настоящей страницей: 200 по прямой ссылке, тот
 *   же кейс после перезагрузки, рабочие Back/Forward. Это условие SEO/GEO, и сломать его легче
 *   всего — достаточно однажды заменить ссылки на состояние в React;
 * — сервер. Весь текст кейса, ссылка в конце документа, canonical, Open Graph и разметка должны
 *   быть в ПЕРВОМ ответе сервера, до всякого JS. Проверяется запросом без браузера, а не через DOM:
 *   в DOM всё это окажется и в случае подгрузки после монтирования;
 * — черновики. Дела 02–07 не опубликованы, и снаружи их не существует: ни папки, ни ссылки, ни
 *   строки в карте сайта, а адрес отвечает 404. Проверяется отдельно и по каждому адресу;
 * — индексируемость. Обратная прежней проверка: на страницах раздела не должно остаться ни одного
 *   `noindex`, а оба адреса обязаны быть в карте сайта;
 * — таймеры печати. Самая дорогая ошибка раздела — печать прошлого документа на новом или
 *   несколько печатей сразу. Проверяется сменой документов внутри окна ожидания.
 *
 * Список кейсов берётся из источника данных, а не переписывается сюда: набор сменится на данные
 * админ-панели, и тест не должен этого заметить.
 *
 * ── Почему переходы проверяются на паре «обложка ↔ кейс» ──────────────────────────────────────────
 *
 * До публикации в разделе было семь видимых дел, и перелистывание проверялось между двумя из них.
 * Опубликованный кейс сейчас один, поэтому вторым документом стола стала обложка архива `/cases` —
 * это ровно такой же лист в той же стопке, с собственным H1 и собственной геометрией, и переход
 * между ним и кейсом идёт тем же кодом. Механика перелистывания от этого не ослабевает: снимок
 * прежнего листа, его габариты, прокрутка, `inert`, Back/Forward и наложение переходов проверяются
 * теми же замерами, что и раньше.
 */

const STAMP_DELAY_MS = 2000;

/** Видимые посетителю дела — только опубликованные, ровно то же правило, что в источнике данных. */
const CASES = CASES_CONTENT.filter((study) => study.status === "published").sort(
  (a, b) => a.sortOrder - b.sortOrder,
);
/** Черновики: их адреса обязаны отвечать 404, а сами дела — не появляться нигде. */
const DRAFTS = CASES_CONTENT.filter((study) => study.status === "draft");
const FIRST = CASES[0];
const REAL = CASE_SALES_CALL_ANALYSIS;

/**
 * Два листа стола: обложка архива и досье кейса. Оба лежат в одной стопке и перелистываются
 * одинаково, поэтому все проверки перехода написаны через эту пару.
 */
const ARCHIVE = {
  path: "/cases",
  title: "Архив реализованных проектов",
  link: 'nav[aria-label="Кейсы"] a[href="/cases"]',
};
const CASE = {
  path: `/cases/${REAL.slug}`,
  title: REAL.title,
  link: `[data-case-folder="${REAL.slug}"]`,
};

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

function stamp(page: Page) {
  return page.locator("[data-case-stamp]");
}

/**
 * Один замер перехода: что лежало в уходящем и в текущем слое, пока уходящий лист существовал.
 *
 * Замеры снимает MutationObserver, а не покадровый опрос: уходящий слой живёт 380 мс, и покадровый
 * цикл в принципе не может доказать, ЧТО было в нём в момент появления — он видит только те кадры,
 * до которых успел. Наблюдатель же срабатывает на самой вставке слоя, поэтому в первом же замере
 * оказывается ровно то состояние DOM, которое увидит пользователь. И он одинаково работает при
 * клике, при Back и при Forward — считывать результат можно уже после конца анимации.
 */
interface TurnFrame {
  /** Порядковый номер уходящего СЛОЯ. Нужен там, где переходы идут вплотную друг за другом. */
  layer: number;
  /** Заголовок H1 внутри уходящего слоя — он обязан быть ПРЕЖНИМ кейсом. */
  leavingTitle: string;
  /** Заголовок H1 внутри текущего слоя — он обязан быть НОВЫМ кейсом. */
  currentTitle: string;
  hidden: boolean;
  inert: boolean;
  /** Число слоёв и число документов на столе: во время перехода и того и другого ровно два. */
  sheets: number;
  articles: number;
  /** Идентификаторы внутри копии: их не должно остаться ни одного, иначе в документе дубли `id`. */
  idsInside: number;
  /** Удалось ли увести фокус внутрь копии. */
  focusEntered: boolean;
  leavingScrollTop: number;
  currentScrollTop: number;
  /**
   * На сколько пикселей содержимое копии вылезло НИЖЕ её собственной бумаги.
   *
   * Замер написан по находке skeptic-ревью. Уходящий слой лежит `position: absolute; inset: 0`, то
   * есть его коробку задаёт новый документ, а на мобильном высота листа приходит от текста и у
   * разных кейсов различается в разы. Копия длинного кейса в коробке короткого сжималась вместе с
   * бумагой, и текст печатался прямо по фотографии стола.
   */
  leavingOverflow: number;
  /** Габариты копии: на мобильном они обязаны совпасть с габаритами ПРЕЖНЕГО листа. */
  leavingWidth: number;
  leavingHeight: number;
  /** Момент замера. По нему видно, наложились ли переходы друг на друга. */
  at: number;
}

declare global {
  interface Window {
    __caseTurns: TurnFrame[];
  }
}

/** Ставит наблюдателя во ВСЕ документы страницы, поэтому он переживает и перезагрузку, и Back. */
async function watchTurns(page: Page) {
  await page.addInitScript(() => {
    window.__caseTurns = [];

    // Каждый переход получает СВОЙ узел уходящего слоя, поэтому слои нумеруются по узлу: так замеры
    // соседних переходов не смешиваются, когда второй начат до конца первого.
    const layers = new WeakMap<Element, number>();
    let layerCount = 0;

    const record = () => {
      const leaving = document.querySelector('[data-case-sheet="leaving"]');
      if (!leaving) return;

      if (!layers.has(leaving)) {
        layerCount += 1;
        layers.set(leaving, layerCount);
      }

      const current = document.querySelector('[data-case-sheet="current"]');
      // Попытка увести фокус внутрь копии. При работающем `inert` вызов — пустышка.
      leaving.querySelector<HTMLElement>("[tabindex], a[href], button")?.focus();

      /**
       * Бумага копии и её последний элемент: подвал с печатью стоит в самом низу документа, поэтому
       * именно он показывает, вылезло ли содержимое за край бумаги.
       *
       * Замер идёт в координатах ВЁРСТКИ (`offsetTop`/`clientHeight`), а не через
       * `getBoundingClientRect()`: уходящий слой в этот момент повёрнут анимацией, и экранный
       * прямоугольник говорил бы о кадре анимации, а не о геометрии листа.
       */
      const paper = leaving.querySelector("article > div");
      const foot = leaving.querySelector<HTMLElement>("article footer");
      const overflow = paper && foot ? foot.offsetTop + foot.offsetHeight - paper.clientHeight : 0;

      window.__caseTurns.push({
        layer: layers.get(leaving)!,
        leavingTitle: leaving.querySelector("h1")?.textContent?.trim() ?? "",
        currentTitle: current?.querySelector("h1")?.textContent?.trim() ?? "",
        hidden: leaving.getAttribute("aria-hidden") === "true",
        inert: leaving.hasAttribute("inert"),
        sheets: document.querySelectorAll("[data-case-sheet]").length,
        articles: document.querySelectorAll("article").length,
        idsInside: leaving.querySelectorAll("[id]").length,
        focusEntered: leaving.contains(document.activeElement),
        leavingScrollTop: Math.round(
          leaving.querySelector<HTMLElement>('[role="region"]')?.scrollTop ?? -1,
        ),
        currentScrollTop: Math.round(
          current?.querySelector<HTMLElement>('[role="region"]')?.scrollTop ?? -1,
        ),
        leavingOverflow: Math.round(overflow),
        leavingWidth: (leaving as HTMLElement).offsetWidth,
        leavingHeight: (leaving as HTMLElement).offsetHeight,
        at: Math.round(performance.now()),
      });
    };

    const start = () =>
      new MutationObserver(record).observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });

    if (document.documentElement) start();
    else document.addEventListener("readystatechange", start, { once: true });
  });
}

/** Забирает накопленные замеры и очищает журнал перед следующим переходом. */
async function readTurns(page: Page): Promise<TurnFrame[]> {
  return page.evaluate(() => {
    const frames = window.__caseTurns;
    window.__caseTurns = [];
    return frames;
  });
}

/** Общий разбор одного перехода: уходит прежний кейс, приходит новый, копия никому не мешает. */
function expectTurn(frames: TurnFrame[], expected: { leaving: string; current: string }) {
  expect(frames.length, "уходящего листа не было ни в один момент перехода").toBeGreaterThan(0);

  for (const frame of frames) {
    expect(frame.leavingTitle, "в уходящем слое не прежний кейс").toBe(expected.leaving);
    expect(frame.currentTitle, "в текущем слое не новый кейс").toBe(expected.current);
    expect(frame.leavingTitle, "на столе две копии одного документа").not.toBe(frame.currentTitle);

    expect(frame.sheets, "слоёв во время перехода не два").toBe(2);
    expect(frame.articles, "документов во время перехода не два").toBe(2);

    expect(frame.hidden, "уходящий лист не скрыт от скринридера").toBe(true);
    expect(frame.inert, "уходящий лист остаётся в порядке обхода").toBe(true);
    expect(frame.focusEntered, "фокус удалось увести внутрь копии").toBe(false);
    expect(frame.idsInside, "копия принесла в документ дубли идентификаторов").toBe(0);

    expect(frame.currentScrollTop, "новый документ открылся не сверху").toBe(0);
    expect(frame.leavingOverflow, "текст копии вышел за край её бумаги").toBeLessThanOrEqual(1);
  }
}

test.describe("cases experience", () => {
  test("раздел и каждый опубликованный кейс отвечают 200 и отдают серверный HTML", async ({
    request,
  }) => {
    const index = await request.get("/cases");
    expect(index.status()).toBe(200);

    const indexHtml = await index.text();
    expect(indexHtml).toContain("Архив реализованных проектов");
    // Вводный текст раздела — настоящий, а не «раздел готовится».
    expect(indexHtml).toContain("Здесь собраны реализованные проекты QBit-Studio-Ai");
    expect(indexHtml).toContain("не являются гарантией аналогичного эффекта в другом проекте");
    expect(indexHtml, "на обложке осталась preview-фраза").not.toContain("Раздел готовится");

    for (const study of CASES) {
      const response = await request.get(`/cases/${study.slug}`);
      expect(response.status(), `${study.slug} отвечает не 200`).toBe(200);

      const html = await response.text();
      // Текст кейса — в первом ответе сервера, а не после монтирования.
      expect(html, `${study.slug}: заголовок не серверный`).toContain(study.title);
      expect(html, `${study.slug}: метка не серверная`).toContain(study.label);
      for (const section of study.sections) {
        expect(html, `${study.slug}: раздел «${section.heading}» не серверный`).toContain(
          section.heading,
        );
      }
    }

    // Несуществующий кейс — обычная 404, а не пустой документ.
    expect((await request.get("/cases/case-99")).status()).toBe(404);
    // И прежний временный адрес первого дела: дубля реального кейса в разделе не осталось.
    expect((await request.get("/cases/case-01")).status()).toBe(404);
  });

  /**
   * Черновики 02–07. После публикации раздела их снаружи не существует: отбор «только published»
   * живёт в источнике данных, поэтому недостаточно проверить, что ссылок нет, — обязателен и
   * прямой запрос по адресу.
   */
  test("черновики недоступны: ни в HTML, ни по прямому адресу", async ({ request }) => {
    expect(DRAFTS.length, "черновиков в источнике нет — проверять нечего").toBeGreaterThan(0);

    const indexHtml = await (await request.get("/cases")).text();
    const caseHtml = await (await request.get(`/cases/${REAL.slug}`)).text();

    for (const draft of DRAFTS) {
      const response = await request.get(`/cases/${draft.slug}`);
      expect(response.status(), `${draft.slug} отвечает не 404`).toBe(404);

      for (const [name, html] of [
        ["обложке", indexHtml],
        ["кейсе", caseHtml],
      ] as const) {
        expect(html, `${draft.slug} попал в HTML на ${name}`).not.toContain(`/cases/${draft.slug}`);
        expect(html, `название «${draft.shortTitle}» попало в HTML на ${name}`).not.toContain(
          draft.shortTitle,
        );
      }
    }
  });

  /**
   * Первый РЕАЛЬНЫЙ кейс. Проверяется не вёрстка, а то, ради чего раздел существует: весь
   * утверждённый материал — включая цифры результата и обе оговорки — приходит в ПЕРВОМ ответе
   * сервера, до всякого JS, и ничего не подгружается после клика.
   */
  test("реальный кейс целиком приходит серверным HTML", async ({ request }) => {
    const response = await request.get(`/cases/${REAL.slug}`);
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Ровно один H1, и это заголовок кейса.
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    expect(html).toContain(REAL.title);

    // Ровно шесть H2 — по числу смысловых разделов сокращённого досье, без единого лишнего.
    expect(html.match(/<h2[\s>]/g) ?? []).toHaveLength(6);
    for (const section of REAL.sections) {
      expect(html, `раздел «${section.heading}» не серверный`).toContain(section.heading);
    }
    for (const removed of ["Как было раньше", "Как работает решение"]) {
      expect(html, `снятый раздел «${removed}» вернулся`).not.toContain(removed);
    }

    // Оба абзаца «Краткого итога», цифры результата, цепочка процесса, источник данных, обе
    // оговорки и GEO-мостик под метрикой.
    for (const fragment of [
      "Компания вручную контролировала звонки менеджеров",
      "После автоматизации звонки анализируются системой",
      "4–5 часов в неделю",
      "10–15 минут в неделю",
      "Время руководителя на контроль звонков",
      "По данным заказчика",
      "автоматическая обработка",
      "Регулярный контроль сохранился",
      "не гарантирует такой же экономии времени в другой компании",
      "Окончательную оценку работы менеджеров и любые управленческие решения принимает человек",
      "Полученный результат не является гарантией аналогичной экономии времени для другой компании",
    ]) {
      expect(html, `«${fragment}» нет в серверном HTML`).toContain(fragment);
    }

    // GEO-мостик стоит ПОСЛЕ цифр результата и ДО последнего раздела — то есть рядом с метрикой.
    expect(html.indexOf("Регулярный контроль сохранился")).toBeGreaterThan(
      html.indexOf("10–15 минут в неделю"),
    );
    expect(html.indexOf("Регулярный контроль сохранился")).toBeLessThan(
      html.indexOf("Об измеримом результате"),
    );

    // Ссылка в конце документа — обычная ссылка в серверном HTML, а не кнопка, собранная скриптом.
    expect(html).toMatch(/<a[^>]+href="\/contacts"[^>]*>Обсудить похожую задачу<\/a>/);

    // Название дела в картотеке — реальное и не обрезанное.
    expect(html).toContain(REAL.shortTitle);
    expect(html).not.toContain(">Кейс 01<");
  });

  /**
   * Метаданные кейса в серверном HTML: заголовок выдачи, описание, canonical, Open Graph, Twitter.
   *
   * Проверяется именно ответ сервера, а не DOM: поисковая система читает первый ответ, и метаданные,
   * дописанные скриптом, для неё не существуют.
   */
  test("метаданные кейса — production-ready и в первом ответе сервера", async ({ request }) => {
    const html = await (await request.get(`/cases/${REAL.slug}`)).text();
    const meta = (name: string) =>
      html.match(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`))?.[1] ??
      "";

    const title = "AI-анализ звонков отдела продаж: с 4–5 часов до 10–15 минут";
    const description =
      "Кейс: AI-анализ звонков сократил время руководителя на контроль отдела продаж " +
      "с 4–5 часов до 10–15 минут в неделю. По данным заказчика.";

    expect(html).toContain(`<title>${title}</title>`);
    // Автоматической приписки бренда к заголовку нет — иначе строка в выдаче стала бы длиннее.
    expect(html).not.toContain(`<title>${title} — QBit-Studio-Ai</title>`);
    expect(meta("description")).toBe(description);

    expect(html).toContain(
      '<link rel="canonical" href="https://allqbit.ru/cases/analiz-zvonkov-otdela-prodazh"/>',
    );

    expect(meta("og:title")).toBe(title);
    expect(meta("og:description")).toBe(
      "Кейс QBit-Studio-Ai: анализ звонков автоматизирован, руководитель получает готовый " +
        "AI-отчёт. По данным заказчика.",
    );
    expect(meta("og:type")).toBe("article");
    expect(meta("og:url")).toBe("https://allqbit.ru/cases/analiz-zvonkov-otdela-prodazh");
    expect(meta("og:image")).toBe("https://allqbit.ru/og/qbit-og-1200x630.png");
    expect(meta("og:image:alt")).toBe("Логотип QBit-Studio-Ai");
    expect(meta("twitter:card")).toBe("summary_large_image");
    expect(meta("twitter:title")).toBe(title);
  });

  /**
   * Разметка страницы кейса. Проверяется не только то, ЧТО есть, но и то, чего быть НЕ должно:
   * `Article` без подтверждённой даты публикации — заявление о выдуманном факте.
   */
  test("JSON-LD кейса: Breadcrumb, WebPage, Organization — и ничего сверх", async ({ request }) => {
    const html = await (await request.get(`/cases/${REAL.slug}`)).text();
    const block = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    ) as RegExpMatchArray;

    expect(block, "на странице кейса нет JSON-LD").not.toBeNull();
    const nodes = JSON.parse(block[1]) as Record<string, unknown>[];

    expect(nodes.map((node) => node["@type"])).toEqual([
      "BreadcrumbList",
      "WebPage",
      "Organization",
    ]);

    const serialized = JSON.stringify(nodes);
    for (const forbidden of [
      "Article",
      "BlogPosting",
      "CaseStudy",
      "FAQPage",
      "Review",
      "AggregateRating",
      "Offer",
      "datePublished",
    ]) {
      expect(serialized, `в разметке появился ${forbidden}`).not.toContain(forbidden);
    }

    expect(nodes[0].itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Главная", item: "https://allqbit.ru" },
      { "@type": "ListItem", position: 2, name: "Кейсы", item: "https://allqbit.ru/cases" },
      {
        "@type": "ListItem",
        position: 3,
        name: "AI-анализ звонков отдела продаж",
        item: "https://allqbit.ru/cases/analiz-zvonkov-otdela-prodazh",
      },
    ]);
    expect(nodes[2]["@id"]).toBe("https://allqbit.ru/#organization");
  });

  test("метаданные и разметка обложки архива", async ({ request }) => {
    const html = await (await request.get("/cases")).text();
    const title = "Кейсы автоматизации бизнес-процессов — QBit-Studio-Ai";

    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://allqbit.ru/cases"/>');
    expect(html).toContain(
      "Реализованные проекты QBit-Studio-Ai: задачи, решения и измеримые результаты",
    );
    expect(html).toContain('content="https://allqbit.ru/cases"');
    expect(html).toContain('content="summary_large_image"');
    expect(html).toContain("https://allqbit.ru/og/qbit-og-1200x630.png");

    const block = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    ) as RegExpMatchArray;
    const nodes = JSON.parse(block[1]) as Record<string, unknown>[];

    expect(nodes.map((node) => node["@type"])).toEqual([
      "BreadcrumbList",
      "CollectionPage",
      "Organization",
    ]);
    expect(JSON.stringify(nodes)).not.toContain("Article");
  });

  /**
   * Рекламные метки не создают второго документа: canonical у адреса с параметрами обязан указывать
   * на тот же чистый адрес. Проверка написана потому, что дубли из-за `utm_*` и `fbclid` —
   * типовая причина расщепления страницы в индексе.
   */
  test("параметры запроса не меняют canonical", async ({ request }) => {
    for (const [path, canonical] of [
      ["/cases", "https://allqbit.ru/cases"],
      [`/cases/${REAL.slug}`, `https://allqbit.ru/cases/${REAL.slug}`],
    ] as const) {
      for (const query of ["?utm_source=test", "?utm_medium=test", "?fbclid=test"]) {
        const response = await request.get(`${path}${query}`);
        expect(response.status(), `${path}${query} отвечает не 200`).toBe(200);
        expect(await response.text(), `canonical сбился на ${path}${query}`).toContain(
          `<link rel="canonical" href="${canonical}"/>`,
        );
      }
    }
  });

  test("пункт «Кейсы» есть в общей шапке, ведёт на /cases и активен в разделе", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);

    for (const route of ["/", "/faq", "/cases", `/cases/${FIRST.slug}`]) {
      await page.goto(route);
      const navigation = page.getByRole("navigation", { name: "Основная навигация" });
      const cases = navigation.getByRole("link", { name: "Кейсы", exact: true });

      await expect(cases, `пункт «Кейсы» отсутствует на ${route}`).toHaveCount(1);
      await expect(cases, `неверный href на ${route}`).toHaveAttribute("href", "/cases");

      // Ни одной заглушечной ссылки во всём документе.
      await expect(page.locator('a[href="#"]'), `href="#" на ${route}`).toHaveCount(0);

      if (route.startsWith("/cases")) {
        await expect(cases, `нет active-state на ${route}`).toHaveAttribute("aria-current", "page");
      } else {
        await expect(cases, `лишний active-state на ${route}`).not.toHaveAttribute(
          "aria-current",
          "page",
        );
      }
    }
  });

  test("на каждой странице раздела ровно один H1", async ({ page }) => {
    /**
     * Тест обходит ВСЕ дела архива, то есть делает столько же навигаций, сколько в разделе кейсов.
     * С ростом архива с трёх заготовок до семи бюджет по умолчанию (30 с) перестал вмещать их под
     * полной параллельностью: `page.goto` на только что поднятом сервере конкурирует с шестью
     * воркерами и занимает секунды — ровно та причина, что описана в `playwright.config.ts`.
     * `test.slow()` утраивает бюджет; он растёт вместе с числом кейсов, а не маскирует зависание.
     */
    test.slow();

    await page.setViewportSize(DESKTOP);

    await page.goto("/cases");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    for (const study of CASES) {
      await page.goto(`/cases/${study.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name: study.title })).toBeVisible();
    }
  });

  test("папки — ссылки: клавиатура, смена адреса, перезагрузка и Back", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/cases");

    // Все папки достижимы с клавиатуры и активируются Enter.
    for (const study of CASES) {
      const folder = page.locator(`[data-case-folder="${study.slug}"]`);
      await expect(folder).toHaveAttribute("href", `/cases/${study.slug}`);
      await folder.focus();
      await expect(folder).toBeFocused();
    }

    await page.locator(CASE.link).press("Enter");
    await expect(page).toHaveURL(CASE.path);
    await expect(page.getByRole("heading", { level: 1, name: CASE.title })).toBeVisible();
    await expect(page.locator(CASE.link)).toHaveAttribute("aria-current", "page");

    // Возврат к обложке архива меняет адрес и документ.
    await page.locator(ARCHIVE.link).click();
    await expect(page).toHaveURL(ARCHIVE.path);
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();

    // Перезагрузка сохраняет выбранный документ.
    await page.reload();
    await expect(page).toHaveURL(ARCHIVE.path);
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();

    // Back возвращает к кейсу вместе с активной папкой.
    await page.goBack();
    await expect(page).toHaveURL(CASE.path);
    await expect(page.getByRole("heading", { level: 1, name: CASE.title })).toBeVisible();
    await expect(page.locator(CASE.link)).toHaveAttribute("aria-current", "page");

    await page.goForward();
    await expect(page).toHaveURL(ARCHIVE.path);
    await expect(page.locator(CASE.link)).not.toHaveAttribute("aria-current", "page");
  });

  test("перелистывание запускается при смене документа и оставляет DOM в покое", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(CASE.path);

    const stack = page.locator("[data-case-transition]");
    await expect(stack).toHaveAttribute("data-case-transition", "idle");
    await expect(page.locator("[data-case-sheet]")).toHaveCount(1);

    await page.locator(ARCHIVE.link).click();

    /**
     * Переход длится 380 мс, поэтому наблюдение ведётся покадрово прямо в странице, а не серией
     * `expect`: обычные проверки успевали бы попасть и до начала, и после конца анимации, и тест
     * мигал бы без всякой регрессии.
     */
    const observed = await page.evaluate(async () => {
      const seen = { turning: false, maxSheets: 0, leavingHidden: true, leavingInert: true };

      for (let frame = 0; frame < 60; frame += 1) {
        const stack = document.querySelector("[data-case-transition]");
        if (stack?.getAttribute("data-case-transition") === "turning") seen.turning = true;
        seen.maxSheets = Math.max(
          seen.maxSheets,
          document.querySelectorAll("[data-case-sheet]").length,
        );

        const leaving = document.querySelector('[data-case-sheet="leaving"]');
        if (leaving) {
          seen.leavingHidden &&= leaving.getAttribute("aria-hidden") === "true";
          seen.leavingInert &&= leaving.hasAttribute("inert");
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      return seen;
    });

    // Во время перехода на экране два листа: уходящий и новый.
    expect(observed.turning, "перелистывание не запустилось").toBe(true);
    expect(observed.maxSheets, "уходящий лист не появился").toBe(2);
    // Уходящая копия скрыта от скринридера и не ловит фокус.
    expect(observed.leavingHidden, "уходящий лист не скрыт от скринридера").toBe(true);
    expect(observed.leavingInert, "уходящий лист остаётся в порядке обхода").toBe(true);

    // После завершения — ровно один лист и стабильное состояние.
    await expect(stack).toHaveAttribute("data-case-transition", "idle", { timeout: 3000 });
    await expect(page.locator("[data-case-sheet]")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
  });

  /**
   * Главная проверка перелистывания: уходящий лист — это ПРЕЖНИЙ документ.
   *
   * Написана по настоящему дефекту. Уходящий слой хранил элемент `children`, пришедший в layout от
   * App Router, а это не готовое дерево, а слот маршрутизатора: отрисованный заново уже после
   * навигации, он показывал новый документ. Внешне анимация работала — на экране действительно
   * уходил лист, — но уходила вторая копия НОВОГО кейса, и все 380 мс пользователь видел один и тот
   * же текст дважды. Ни одна прежняя проверка этого не ловила: они считали слои и атрибуты, а не
   * содержимое слоёв.
   *
   * Поэтому здесь сравниваются именно тексты: заголовок в уходящем слое, заголовок в текущем и их
   * несовпадение. Направление проверяется в обе стороны — обложка → кейс и обратно.
   */
  test("уходящий лист показывает прежний документ, а не вторую копию нового", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await watchTurns(page);

    const noise: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        noise.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => noise.push(`pageerror: ${error.message}`));

    await page.goto(ARCHIVE.path);
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
    await readTurns(page);

    // Обложка архива → реальный кейс.
    await page.locator(CASE.link).click();
    await expect(page.getByRole("heading", { level: 1, name: CASE.title })).toBeVisible();
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );

    expectTurn(await readTurns(page), { leaving: ARCHIVE.title, current: CASE.title });

    // После перехода копия снята: на столе ровно один лист, один документ и один H1.
    await expect(page.locator('[data-case-sheet="leaving"]')).toHaveCount(0);
    await expect(page.locator("[data-case-sheet]")).toHaveCount(1);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    // Печать нового кейса начинается заново: сразу её нет, к исходу задержки она есть и одна.
    await expect(stamp(page)).toHaveCount(1);
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "pending");
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "struck", {
      timeout: STAMP_DELAY_MS * 2,
    });
    await expect(page.locator('[data-case-stamp="struck"]')).toHaveCount(1);

    // Реальный кейс → обложка архива.
    await readTurns(page);
    await page.locator(ARCHIVE.link).click();
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );

    expectTurn(await readTurns(page), { leaving: CASE.title, current: ARCHIVE.title });

    await expect(page.locator('[data-case-sheet="leaving"]')).toHaveCount(0);
    await expect(page.locator("article")).toHaveCount(1);

    // Ни ошибок страницы, ни предупреждений о расхождении гидратации.
    expect(noise, "консоль раздела не пуста").toEqual([]);
  });

  /**
   * Back/Forward и прокрутка. Уходящий лист обязан быть настоящим снимком: он уходит в том виде, в
   * каком документ читали, — с той же позицией прокрутки, — а новый документ при этом открывается
   * сверху и своей прокруткой на уходящий слой не влияет.
   */
  test("Back/Forward перелистываются тем же листом, а снимок хранит прокрутку прежнего кейса", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await watchTurns(page);

    await page.goto(`/cases/${REAL.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: REAL.title })).toBeVisible();

    // Длинный кейс дочитан до конца.
    const scrolled = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(
        '[data-case-sheet="current"] [role="region"]',
      )!;
      scroller.scrollTop = scroller.scrollHeight;
      return Math.round(scroller.scrollTop);
    });
    expect(scrolled, "реальный кейс не прокрутился — проверять нечего").toBeGreaterThan(0);

    await readTurns(page);
    await page.locator(ARCHIVE.link).click();
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );

    const turned = await readTurns(page);
    expectTurn(turned, { leaving: CASE.title, current: ARCHIVE.title });
    expect(turned[0].leavingScrollTop, "снимок потерял позицию прокрутки прежнего кейса").toBe(
      scrolled,
    );

    // Back — то же перелистывание, только прежним документом становится обложка.
    await page.goBack();
    await expect(page).toHaveURL(CASE.path);
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );
    expectTurn(await readTurns(page), { leaving: ARCHIVE.title, current: CASE.title });

    // Forward — и обратно.
    await page.goForward();
    await expect(page).toHaveURL(ARCHIVE.path);
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );
    expectTurn(await readTurns(page), { leaving: CASE.title, current: ARCHIVE.title });

    await expect(page.locator('[data-case-sheet="leaving"]')).toHaveCount(0);
    await expect(page.locator("article")).toHaveCount(1);
  });

  /**
   * Быстрая очередь A → B → C. Опасность механизма со снимком в том, что при втором переходе,
   * начатом ДО конца первого, в уходящем слое может остаться снимок позапрошлого документа.
   *
   * Клики идут подряд, без ожидания конца анимации, а потом разбираются все накопленные замеры:
   * каждый уходящий лист обязан быть ровно тем документом, с которого ушли. Наложение переходов
   * проверяется отдельно — по времени появления слоёв: если оно уложилось в 380 мс, второй переход
   * действительно начался поверх первого, и проверка не выродилась в два последовательных перехода.
   *
   * Очередь идёт «кейс → обложка → кейс»: опубликованный кейс сейчас один, а проверяется здесь
   * ИМЕННО наложение переходов, а не разнообразие документов. Позапрошлый снимок при этом отличим
   * от прошлого — заголовки соседних звеньев разные.
   */
  test("быстрая очередь переходов не оставляет чужой снимок", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await watchTurns(page);

    const queue = [ARCHIVE, CASE];

    await page.goto(CASE.path);
    await expect(page.getByRole("heading", { level: 1, name: CASE.title })).toBeVisible();
    await readTurns(page);

    /**
     * Клики отдаются ИЗ СТРАНИЦЫ, а не через Playwright.
     *
     * Второй клик должен попасть внутрь 380 мс первого перехода — иначе проверять нечего. Через
     * протокол это недостижимо: один цикл «клик → дождаться слоя → клик» стоит около 540 мс
     * (замерено), и переходы получаются последовательными. А без ожидания слоя второй клик, наоборот,
     * успевает до фиксации первой навигации, промежуточный кейс не отрисовывается вовсе, и очередь
     * вырождается в ОДИН переход (тоже замерено: слой оказывался один).
     *
     * Поэтому ожидание живёт в самой странице: следующая папка нажимается на первом же кадре, в
     * котором появился уходящий слой предыдущего перехода.
     */
    await page.evaluate(
      async (selectors) => {
        const untilLayer = () =>
          new Promise<void>((resolve, reject) => {
            let frames = 0;
            const tick = () => {
              if (document.querySelector('[data-case-sheet="leaving"]')) return resolve();
              if ((frames += 1) > 600) return reject(new Error("уходящий слой так и не появился"));
              requestAnimationFrame(tick);
            };
            tick();
          });

        for (const selector of selectors) {
          document.querySelector<HTMLElement>(selector)!.click();
          await untilLayer();
        }
      },
      queue.map((target) => target.link),
    );

    await expect(
      page.getByRole("heading", { level: 1, name: queue[queue.length - 1].title }),
      "последний документ очереди не открылся",
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );

    const frames = await readTurns(page);
    const layers = [...new Set(frames.map((frame) => frame.layer))].sort((a, b) => a - b);
    expect(layers.length, "переходов было меньше двух — очередь не сложилась").toBe(queue.length);

    // Каждый слой очереди: уходит тот документ, с которого ушли.
    const chain = [CASE, ...queue];
    layers.forEach((layer, index) => {
      expectTurn(
        frames.filter((frame) => frame.layer === layer),
        { leaving: chain[index].title, current: chain[index + 1].title },
      );
    });

    // Переходы действительно наложились: второй начался, пока первый ещё шёл.
    const startOf = (layer: number) =>
      Math.min(...frames.filter((frame) => frame.layer === layer).map((frame) => frame.at));
    expect(
      startOf(layers[1]) - startOf(layers[0]),
      "переходы не наложились — проверка выродилась в два последовательных",
    ).toBeLessThan(380);

    await expect(page.locator('[data-case-sheet="leaving"]')).toHaveCount(0);
    await expect(page.locator("[data-case-sheet]")).toHaveCount(1);
    await expect(page.locator("article")).toHaveCount(1);
  });

  /**
   * Перелистывание на мобильной ширине. Проверка написана по находке skeptic-ревью: там документ
   * прокручивает страница, высоту листа задаёт его собственный текст, и у разных кейсов она
   * различается в разы. Копия обязана уходить в СВОИХ габаритах — иначе она сжимается до размеров
   * нового листа, а текст печатается по фотографии стола.
   *
   * Проверяется инвариант, а не конкретные числа: габариты копии равны габаритам листа, измеренным
   * ДО перехода, и содержимое не выходит за край собственной бумаги.
   */
  for (const viewport of [MOBILE, { width: 768, height: 1024 }]) {
    test(`копия уходит в габаритах прежнего листа на ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await watchTurns(page);

      // Длинный реальный кейс → короткая обложка архива: разница высот здесь максимальная.
      await page.goto(CASE.path);
      await expect(page.getByRole("heading", { level: 1, name: CASE.title })).toBeVisible();

      const before = await page.evaluate(() => {
        const sheet = document.querySelector<HTMLElement>('[data-case-sheet="current"]')!;
        return { width: sheet.offsetWidth, height: sheet.offsetHeight };
      });

      await readTurns(page);
      await page.locator(ARCHIVE.link).click();
      await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
      await expect(page.locator("[data-case-transition]")).toHaveAttribute(
        "data-case-transition",
        "idle",
        { timeout: 3000 },
      );

      const frames = await readTurns(page);
      expectTurn(frames, { leaving: CASE.title, current: ARCHIVE.title });

      for (const frame of frames) {
        expect(frame.leavingHeight, "копия ушла не в высоту прежнего листа").toBe(before.height);
        expect(frame.leavingWidth, "копия ушла не в ширину прежнего листа").toBe(before.width);
      }

      // И новый лист действительно короче — иначе проверка ничего не доказывает.
      const after = await page.evaluate(
        () => document.querySelector<HTMLElement>('[data-case-sheet="current"]')!.offsetHeight,
      );
      expect(after, "листы одинаковой высоты — проверять нечего").toBeLessThan(before.height);
    });
  }

  test("печать ставится примерно через две секунды и ровно одна", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/cases/${FIRST.slug}`);

    // Сразу после открытия печати нет.
    await expect(stamp(page)).toHaveCount(1);
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "pending");
    await page.waitForTimeout(STAMP_DELAY_MS * 0.6);
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "pending");

    // И появляется к исходу задержки.
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "struck", { timeout: 3000 });
    await expect(stamp(page)).toHaveCount(1);

    // Печать декоративна: скрыта от дерева доступности и не участвует в заголовках.
    await expect(stamp(page)).toHaveAttribute("aria-hidden", "true");
    await expect(stamp(page).locator("img")).toHaveAttribute("alt", "");

    /**
     * Место оттиска на листе. Проверяется именно НИЖНЯЯ ЗОНА документа, а не отсутствие наложения
     * на текст: частичное наложение — принятое решение этапа, бумагу штампуют поверх написанного.
     * Инвариант же в том, что печать всегда стоит в левом нижнем углу самого листа и не зависит
     * ни от длины кейса, ни от того, докручен ли текст.
     *
     * Замер только ПОСЛЕ удара: во время анимации оттиск смещён вверх и увеличен, и габаритный
     * прямоугольник в этот момент говорит не о вёрстке, а о кадре анимации.
     */
    await page.waitForTimeout(700);
    const box = await stamp(page).boundingBox();
    const sheet = await page.locator("article > div").boundingBox();
    expect(box).not.toBeNull();
    expect(sheet).not.toBeNull();

    // Целиком внутри листа.
    expect(box!.y).toBeGreaterThanOrEqual(sheet!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(sheet!.y + sheet!.height + 1);
    expect(box!.x).toBeGreaterThanOrEqual(sheet!.x);

    // В нижней трети и в левой половине — то есть в левом нижнем углу документа.
    expect(box!.y).toBeGreaterThan(sheet!.y + sheet!.height * 0.66);
    expect(box!.x + box!.width).toBeLessThan(sheet!.x + sheet!.width * 0.5);
  });

  /**
   * Одинаковый размер листа у всех документов раздела — требование, которое легко потерять при
   * первой же правке вёрстки и невозможно заметить на глаз: разница проявляется только при
   * переключении. Высота листа обязана приходить от сцены, а не от объёма текста, иначе композиция
   * прыгает, а печать переезжает вслед за концом содержимого.
   *
   * Сравниваются длинное досье и короткая обложка архива — то есть крайние случаи по объёму текста.
   */
  test("лист одинакового размера на всех документах раздела", async ({ page }) => {
    await page.setViewportSize(DESKTOP);

    const sizes: { path: string; width: number; height: number }[] = [];

    for (const target of [CASE, ARCHIVE]) {
      await page.goto(target.path);
      await expect(page.getByRole("heading", { level: 1, name: target.title })).toBeVisible();

      const measured = await page.evaluate(() => {
        const sheet = document.querySelector("article > div")!.getBoundingClientRect();
        return { width: Math.round(sheet.width), height: Math.round(sheet.height) };
      });

      sizes.push({ path: target.path, ...measured });
    }

    const first = sizes[0];
    for (const size of sizes) {
      expect(size.height, `${size.path}: высота листа отличается`).toBe(first.height);
      expect(size.width, `${size.path}: ширина листа отличается`).toBe(first.width);
    }

    // И лист действительно крупный: он занимает рабочую зону, а не лежит полоской внизу экрана.
    expect(first.height).toBeGreaterThan(DESKTOP.height * 0.7);
  });

  /**
   * Композиция прижата к верху рабочей зоны. Проверка написана по прямому требованию правки:
   * и картотека, и документ должны начинаться сразу под шапкой, а не лежать у нижнего края.
   */
  test("картотека и документ прижаты к верху рабочей зоны", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/cases/${FIRST.slug}`);

    const geometry = await page.evaluate(() => {
      const header = document.querySelector("header")!.getBoundingClientRect();
      const cabinet = document.querySelector('nav[aria-label="Кейсы"]')!.getBoundingClientRect();
      const sheet = document.querySelector("article > div")!.getBoundingClientRect();
      return {
        headerBottom: header.bottom,
        cabinetTop: cabinet.top,
        sheetTop: sheet.top,
        viewportHeight: window.innerHeight,
      };
    });

    // Обе колонки начинаются в пределах 60 px под шапкой.
    expect(geometry.cabinetTop - geometry.headerBottom).toBeLessThanOrEqual(60);
    expect(geometry.sheetTop - geometry.headerBottom).toBeLessThanOrEqual(60);
    // И обе — в верхней четверти экрана.
    expect(geometry.cabinetTop).toBeLessThan(geometry.viewportHeight * 0.25);
    expect(geometry.sheetTop).toBeLessThan(geometry.viewportHeight * 0.25);
  });

  test("быстрая смена документов отменяет прежний таймер и не плодит печати", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(CASE.path);

    /**
     * Смена документов ВНУТРИ окна ожидания печати: ни один из отменённых таймеров не должен
     * сработать. Обложка архива печати не имеет вовсе — поэтому после возврата к кейсу оттиск
     * обязан начать отсчёт заново, а не оказаться уже поставленным.
     */
    for (const target of [ARCHIVE, CASE]) {
      await page.waitForTimeout(300);
      await page.locator(target.link).click();
      await expect(
        page.getByRole("heading", { level: 1, name: target.title }),
        `${target.path} не открылся`,
      ).toBeVisible({ timeout: 15_000 });

      if (target === CASE) {
        await expect(stamp(page)).toHaveCount(1);
        await expect(stamp(page)).toHaveAttribute("data-case-stamp", "pending");
      } else {
        await expect(stamp(page)).toHaveCount(0);
      }
    }

    // Печать прошлого документа не переезжает на новый лист: в кадрах перехода поставленной печати
    // нет, и одновременно видимых оттисков никогда не больше одного.
    await page.goto(CASE.path);
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "struck", { timeout: 4000 });
    await page.locator(ARCHIVE.link).click();

    const duringTurn = await page.evaluate(async () => {
      let sawTurning = false;
      let maxVisible = 0;

      /**
       * Считаются только кадры САМОГО перелистывания. До его начала печать текущего кейса на экране
       * законно стоит — это ещё прежний документ, роутер до него просто не дошёл. Требование
       * относится к моменту, когда лист пошёл: старая печать обязана исчезнуть вместе с ним.
       *
       * И считаются ВИДИМЫЕ оттиски, а не узлы DOM: копия документа в уходящем слое печать
       * содержит, но CSS её гасит — пользователь видит ровно один лист с одной печатью.
       */
      for (let frame = 0; frame < 60; frame += 1) {
        const state = document
          .querySelector("[data-case-transition]")
          ?.getAttribute("data-case-transition");

        if (state === "turning") {
          sawTurning = true;
          maxVisible = Math.max(
            maxVisible,
            [...document.querySelectorAll("[data-case-stamp]")].filter(
              (node) => Number(getComputedStyle(node).opacity) > 0.01,
            ).length,
          );
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      return { sawTurning, maxVisible };
    });

    expect(duringTurn.sawTurning, "перелистывание не запустилось").toBe(true);
    expect(duringTurn.maxVisible, "во время перелистывания на экране видна печать").toBe(0);

    // Пришли на обложку — печати нет вовсе; вернулись к кейсу — оттиск ровно один и ставится заново.
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
    await expect(stamp(page)).toHaveCount(0);

    await page.locator(CASE.link).click();
    await expect(stamp(page)).toHaveAttribute("data-case-stamp", "struck", { timeout: 4000 });
    await expect(page.locator('[data-case-stamp="struck"]')).toHaveCount(1);
  });

  test("prefers-reduced-motion: печать сразу на документе, сложного движения нет", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: DESKTOP,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    try {
      await page.goto(CASE.path);
      // Ни задержки, ни удара: печать на месте с самого начала.
      await expect(stamp(page)).toHaveAttribute("data-case-stamp", "struck", { timeout: 1500 });

      // Смена документа меняет содержимое сразу, уходящего листа не появляется.
      await page.locator(ARCHIVE.link).click();
      await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
      await expect(page.locator("[data-case-sheet]")).toHaveCount(1);
      await expect(page.locator("[data-case-transition]")).toHaveAttribute(
        "data-case-transition",
        "idle",
      );
    } finally {
      await context.close();
    }
  });

  /**
   * Обратная прежней проверка. До 2026-08-11 тест требовал `noindex` на каждой странице раздела и
   * отсутствия раздела в карте сайта; с публикацией первого реального кейса требование сменилось на
   * противоположное — и проверка не удалена, а переписана под новое состояние.
   */
  test("страницы раздела индексируются и присутствуют в карте сайта", async ({ page, request }) => {
    // Обход по ВСЕМ опубликованным страницам обязателен: индексируемость — свойство каждой
    // страницы, и пропущенная страница означает пропущенную ошибку.
    test.slow();

    for (const route of ["/cases", ...CASES.map((study) => `/cases/${study.slug}`)]) {
      await page.goto(route);

      const robots = page.locator('meta[name="robots"]');
      await expect(robots, `robots на ${route}`).toHaveCount(1);
      await expect(robots, `на ${route} остался noindex`).not.toHaveAttribute("content", /noindex/);
      await expect(robots, `на ${route} нет index`).toHaveAttribute("content", /index/);
      // Ни одного запрещающего указания и в googlebot-варианте.
      await expect(
        page.locator('meta[name="googlebot"][content*="noindex"]'),
        `googlebot noindex на ${route}`,
      ).toHaveCount(0);
    }

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap, "раздела нет в карте сайта").toContain("<loc>https://allqbit.ru/cases</loc>");
    expect(sitemap, "кейса нет в карте сайта").toContain(
      `<loc>https://allqbit.ru/cases/${REAL.slug}</loc>`,
    );

    // Черновиков в карте сайта нет — ни одного.
    for (const draft of DRAFTS) {
      expect(sitemap, `${draft.slug} попал в карту сайта`).not.toContain(`/cases/${draft.slug}`);
    }

    // robots.txt не менялся: раздел был закрыт метаданными страниц, а не общим файлом.
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).not.toContain("Disallow: /cases");
  });

  test("фон и печать раздаются локально и существуют", async ({ request }) => {
    for (const asset of [
      "/cases/cases-background.png",
      "/cases/cases-background-960.avif",
      "/cases/cases-background-1600.webp",
      "/cases/case-stamp-512.png",
      "/cases/case-stamp-512.webp",
      "/cases/case-stamp-512.avif",
    ]) {
      const response = await request.get(asset);
      expect(response.status(), `${asset} недоступен`).toBe(200);
    }
  });

  test("desktop помещается в экран, mobile использует прокрутку страницы", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/cases/${FIRST.slug}`);

    const desktop = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(desktop.scrollWidth).toBeLessThanOrEqual(desktop.clientWidth);
    expect(desktop.scrollHeight).toBeLessThanOrEqual(desktop.clientHeight + 1);

    await page.setViewportSize(MOBILE);
    await page.goto(`/cases/${FIRST.slug}`);

    const mobile = await page.evaluate(() => {
      const article = document.querySelector("article");
      const scrollers = [...document.querySelectorAll("article, article *")].filter((node) => {
        const style = getComputedStyle(node);
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight + 1
        );
      });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        nestedScrollers: scrollers.length,
        articleWidth: article ? Math.round(article.getBoundingClientRect().width) : 0,
      };
    });

    // Ни горизонтальной прокрутки страницы, ни вложенной вертикальной прокрутки в документе.
    expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.clientWidth);
    expect(mobile.nestedScrollers).toBe(0);
    expect(mobile.articleWidth).toBeLessThanOrEqual(MOBILE.width);

    // Папки остаются нажимаемыми пальцем.
    for (const study of CASES) {
      const box = await page.locator(`[data-case-folder="${study.slug}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height, `${study.slug}: цель нажатия меньше 44 px`).toBeGreaterThanOrEqual(44);
    }
  });

  /**
   * Длинный кейс. Проверка написана по НАСТОЯЩЕЙ находке skeptic-ревью: у временных заготовок текст
   * короткий, и раздел выглядел исправным, хотя цепочка ограничений высоты была разорвана —
   * документ длиннее экрана вырастал за пределы сцены вместе с печатью и последними разделами, и
   * добраться до них было нельзя ни прокруткой страницы, ни прокруткой внутри документа.
   *
   * Дефект проявился бы на ПЕРВОМ реальном кейсе из админ-панели, то есть на боевых данных.
   * Поэтому длина имитируется здесь: разделы размножаются в уже отрисованном документе, и
   * проверяется инвариант, а не конкретная вёрстка — до конца досье можно добраться, а печать
   * остаётся видимой на desktop.
   */
  test("длинный кейс прокручивается и не теряет содержимое", async ({ page }) => {
    for (const viewport of [{ width: 1280, height: 600 }, DESKTOP, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`/cases/${FIRST.slug}`);

      const measured = await page.evaluate(() => {
        const sections = document.querySelector("article section")!.parentElement!;
        for (let copy = 0; copy < 16; copy += 1) {
          sections.appendChild(sections.firstElementChild!.cloneNode(true));
        }

        const scroller = document.querySelector<HTMLElement>('article [role="region"]')!;
        const footer = document.querySelector("article footer")!.getBoundingClientRect();

        const sheet = document.querySelector("article > div")!.getBoundingClientRect();
        const mark = document.querySelector("[data-case-stamp]")!.getBoundingClientRect();

        return {
          innerScroll: scroller.scrollHeight - scroller.clientHeight,
          focusable: scroller.tabIndex,
          hasAccessibleName: Boolean(scroller.getAttribute("aria-label")),
          pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          footerBottom: Math.round(footer.bottom),
          viewportHeight: window.innerHeight,
          stampInsideSheet: mark.top >= sheet.top && mark.bottom <= sheet.bottom + 1,
        };
      });

      // Досье прокручивается внутри себя, и прокрутка доступна с клавиатуры.
      expect(measured.innerScroll, `${viewport.width}: документ не прокручивается`).toBeGreaterThan(
        0,
      );
      expect(measured.focusable, `${viewport.width}: скроллер не получает фокус`).toBe(0);
      expect(measured.hasAccessibleName, `${viewport.width}: у скроллера нет имени`).toBe(true);

      // Страница при этом остаётся на одном экране, а подвал с печатью виден.
      expect(measured.pageScroll, `${viewport.width}: страница уехала в прокрутку`).toBe(0);
      expect(
        measured.footerBottom,
        `${viewport.width}: подвал документа за пределами экрана`,
      ).toBeLessThanOrEqual(measured.viewportHeight);

      // Печать не уезжает вслед за содержимым: она привязана к листу, а не к концу текста.
      expect(measured.stampInsideSheet, `${viewport.width}: печать вышла за пределы листа`).toBe(
        true,
      );
    }

    // На мобильном всё наоборот: прокручивает страница, вложенной прокрутки нет.
    await page.setViewportSize(MOBILE);
    await page.goto(`/cases/${FIRST.slug}`);

    const mobile = await page.evaluate(() => {
      const sections = document.querySelector("article section")!.parentElement!;
      for (let copy = 0; copy < 16; copy += 1) {
        sections.appendChild(sections.firstElementChild!.cloneNode(true));
      }

      const scroller = document.querySelector<HTMLElement>('article [role="region"]')!;
      return {
        innerScroll: scroller.scrollHeight - scroller.clientHeight,
        pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      };
    });

    expect(mobile.pageScroll, "mobile: страница не прокручивается").toBeGreaterThan(0);
    expect(mobile.innerScroll, "mobile: появилась вложенная прокрутка").toBe(0);
  });

  /**
   * Настоящее имя дела в картотеке. Проверка написана потому, что название реального кейса длиннее
   * «Кейс 01» ровно в четыре раза: его нельзя ни обрезать после первого слова, ни распустить на
   * столько строк, что папка перестанет быть папкой.
   */
  test("папка первого дела показывает реальное название и укладывается в две строки", async ({
    page,
  }) => {
    for (const viewport of [DESKTOP, { width: 1024, height: 768 }, MOBILE]) {
      await page.setViewportSize(viewport);
      await page.goto(`/cases/${REAL.slug}`);

      const folder = page.locator(`[data-case-folder="${REAL.slug}"]`);
      await expect(folder).toHaveAttribute("aria-current", "page");

      const measured = await page.evaluate((slug) => {
        const link = document.querySelector(`[data-case-folder="${slug}"]`)!;
        const title = link.querySelector("span > span:nth-child(2)") as HTMLElement;
        const style = getComputedStyle(title);
        return {
          text: title.textContent ?? "",
          lines: Math.round(title.getBoundingClientRect().height / parseFloat(style.lineHeight)),
          clipped: title.scrollWidth > title.clientWidth + 1,
          insideCard: title.getBoundingClientRect().right <= link.getBoundingClientRect().right + 1,
        };
      }, REAL.slug);

      expect(measured.text, `${viewport.width}: в папке не реальное название`).toBe(
        REAL.shortTitle,
      );
      expect(
        measured.lines,
        `${viewport.width}: название заняло больше двух строк`,
      ).toBeLessThanOrEqual(2);
      expect(measured.lines, `${viewport.width}: название схлопнулось`).toBeGreaterThanOrEqual(1);
      expect(measured.clipped, `${viewport.width}: название обрезано по ширине`).toBe(false);
      expect(measured.insideCard, `${viewport.width}: название вышло за корпус папки`).toBe(true);
    }
  });

  /**
   * Метрика «до/после» — служебная строка документа, а не дашборд: она стоит ВНУТРИ раздела
   * «Результат», содержит оба значения и подпись об источнике.
   */
  test("метрика «до/после» отрисована внутри раздела «Результат»", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/cases/${REAL.slug}`);

    // Раздел ищется по якорю заголовка, а не по тексту: слово «результат» встречается и в соседних
    // разделах досье, и поиск по тексту нашёл бы не тот раздел.
    const result = page.locator("article section").filter({ has: page.locator("#case-01-result") });
    const metric = result.locator("dl");

    await expect(metric).toHaveCount(1);
    await expect(metric.locator("dt")).toHaveText(["До", "После"]);
    await expect(metric.locator("dd")).toHaveText(["4–5 часов в неделю", "10–15 минут в неделю"]);
    await expect(result.getByText("По данным заказчика")).toBeVisible();
    await expect(result.getByText("Время руководителя на контроль звонков")).toBeVisible();
  });

  /**
   * Длина реального кейса — на настоящих данных, без имитации. Лист обязан остаться того же
   * размера, прокрутка — начаться внутри содержательной области, а последний раздел досье
   * («Об измеримом результате») — дочитываться до конца.
   */
  test("реальный кейс прокручивается внутри листа и дочитывается до конца", async ({ page }) => {
    for (const viewport of [{ width: 1366, height: 768 }, DESKTOP, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`/cases/${REAL.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: REAL.title })).toBeVisible();

      const measured = await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>('article [role="region"]')!;
        const last = document.querySelector("#case-01-limitations")!;

        // Документ открывается с начала.
        const openedAtTop = scroller.scrollTop === 0;

        scroller.scrollTop = scroller.scrollHeight;
        const view = scroller.getBoundingClientRect();
        const tail = last.parentElement!.getBoundingClientRect();

        return {
          openedAtTop,
          innerScroll: scroller.scrollHeight - scroller.clientHeight,
          pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          lastSectionVisible: tail.bottom <= view.bottom + 2 && tail.top < view.bottom,
          horizontalOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      expect(measured.openedAtTop, `${viewport.width}: документ открылся не сверху`).toBe(true);
      expect(measured.pageScroll, `${viewport.width}: страница уехала в прокрутку`).toBe(0);
      expect(
        measured.lastSectionVisible,
        `${viewport.width}: последний раздел не дочитывается`,
      ).toBe(true);
      expect(measured.horizontalOverflow, `${viewport.width}: горизонтальная прокрутка`).toBe(
        false,
      );
    }
  });

  /**
   * Прокрутка не переезжает с документа на документ. Ошибка тем опаснее, что появляется только на
   * длинном документе: пользователь дочитывает реальное дело, открывает соседний лист — и попадает
   * в его середину, а не в начало.
   */
  test("новый документ открывается сверху, а не с прежней позиции прокрутки", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(CASE.path);

    const scrolled = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>('article [role="region"]')!;
      scroller.scrollTop = scroller.scrollHeight;
      return scroller.scrollTop;
    });
    expect(scrolled, "реальный кейс не прокрутился — проверять нечего").toBeGreaterThan(0);

    await page.locator(ARCHIVE.link).click();
    await expect(page.getByRole("heading", { level: 1, name: ARCHIVE.title })).toBeVisible();
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );

    const afterForward = await page.evaluate(
      () =>
        document.querySelector<HTMLElement>(
          'article [data-case-sheet="current"] [role="region"], article [role="region"]',
        )!.scrollTop,
    );
    expect(afterForward, "прокрутка прошлого кейса перенеслась на новый").toBe(0);

    // И обратно: возврат к длинному кейсу тоже открывает его с начала.
    await page.locator(`[data-case-folder="${REAL.slug}"]`).click();
    await expect(page.getByRole("heading", { level: 1, name: REAL.title })).toBeVisible();
    await expect(page.locator("[data-case-transition]")).toHaveAttribute(
      "data-case-transition",
      "idle",
      { timeout: 3000 },
    );
    const afterBack = await page.evaluate(
      () => document.querySelector<HTMLElement>('article [role="region"]')!.scrollTop,
    );
    expect(afterBack, "возврат к длинному кейсу открыл его не сверху").toBe(0);
  });

  /**
   * Ссылка в конце досье: она дочитывается вместе с последним разделом, доступна с клавиатуры и
   * ведёт на «Контакты». Проверяется на обеих раскладках — на desktop до неё доводит внутренняя
   * прокрутка документа, на мобильном прокрутка страницы.
   */
  for (const viewport of [DESKTOP, MOBILE]) {
    test(`ссылка «Обсудить похожую задачу» достижима и работает на ${viewport.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(CASE.path);

      const cta = page.getByRole("link", { name: "Обсудить похожую задачу" });
      await expect(cta).toHaveCount(1);
      await expect(cta).toHaveAttribute("href", "/contacts");

      // Доводим документ до конца тем способом, который на этой раскладке и работает.
      await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>('article [role="region"]')!;
        if (scroller.scrollHeight > scroller.clientHeight + 1) {
          scroller.scrollTop = scroller.scrollHeight;
          return;
        }
        window.scrollTo(0, document.documentElement.scrollHeight);
      });

      await expect(cta, "ссылка не видна в конце документа").toBeInViewport();

      // Клавиатура: ссылка получает фокус и активируется Enter.
      await cta.focus();
      await expect(cta).toBeFocused();
      await cta.press("Enter");
      await expect(page).toHaveURL("/contacts");
    });
  }

  /**
   * Порядок обхода с клавиатуры внутри раздела. Проверка написана потому, что документ лежит в
   * фокусируемой области прокрутки (`role="region"`, `tabindex="0"`), и ссылка в конце досье не
   * должна из этого порядка выпадать — иначе до неё нельзя добраться без мыши.
   */
  test("Tab доводит от картотеки до области досье и ссылки в его конце", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(CASE.path);

    await page.locator(CASE.link).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.locator('article [role="region"]'),
      "после картотеки фокус не попал в область досье",
    ).toBeFocused();

    // Область прокрутки управляется клавиатурой — ради этого она и фокусируема.
    const scrolled = await page.evaluate(async () => {
      const scroller = document.querySelector<HTMLElement>('article [role="region"]')!;
      const before = scroller.scrollTop;
      scroller.scrollTop = scroller.scrollHeight;
      return { before, after: scroller.scrollTop };
    });
    expect(scrolled.before).toBe(0);
    expect(scrolled.after).toBeGreaterThan(0);

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Обсудить похожую задачу" }),
      "следующим после области досье не оказалась ссылка в его конце",
    ).toBeFocused();

    // И обратный обход возвращает в область досье.
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator('article [role="region"]')).toBeFocused();
  });

  for (const viewport of [MOBILE, DESKTOP]) {
    test(`axe без serious и critical на ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);

      for (const route of ["/cases", `/cases/${FIRST.slug}`]) {
        await page.goto(route);
        // Печать ставится через 2 с и создаёт новое состояние DOM — проверять надо и его.
        // На обложке архива печати нет вовсе, поэтому ожидание не обязательное.
        await page
          .locator('[data-case-stamp="struck"]')
          .waitFor({ timeout: 4000 })
          .catch(() => undefined);

        const results = await new AxeBuilder({ page }).analyze();
        expect(
          results.violations.filter((violation) =>
            ["serious", "critical"].includes(violation.impact ?? ""),
          ),
          `axe на ${route} @ ${viewport.width}`,
        ).toEqual([]);
      }
    });
  }
});
