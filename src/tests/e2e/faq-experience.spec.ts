import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { faqItems } from "../../features/faq/faqData";
import { FAQ_PUBLISHED_AT } from "../../features/faq/faqSeo";

const CANONICAL = "https://allqbit.ru/faq";
const PAGE_TITLE = "FAQ об AI-автоматизации бизнеса — QBit-Studio-Ai";
const PAGE_DESCRIPTION =
  "Ответы QBit-Studio-Ai на вопросы об AI-автоматизации: выбор процессов, интеграции, пилот, сроки, стоимость, безопасность, размещение и поддержка.";

/** Все внутренние ссылки, объявленные в ответах. */
const internalLinks = faqItems.flatMap((item) =>
  item.answer.flatMap((paragraph) =>
    paragraph.flatMap((segment) => (typeof segment === "string" ? [] : [segment])),
  ),
);

test.describe("/faq — содержание раздела", () => {
  test("отдаёт 200, метаданные для индексации и весь текст в серверном HTML", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto("/faq");
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(PAGE_TITLE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      PAGE_DESCRIPTION,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", CANONICAL);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", CANONICAL);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", PAGE_TITLE);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[name="keywords"]')).toHaveCount(0);

    const html = await (await request.get("/faq")).text();

    // Индексация открыта: noindex/nofollow не осталось ни в meta, ни в заголовке ответа.
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][content*="nofollow"]')).toHaveCount(0);
    expect((await request.get("/faq")).headers()["x-robots-tag"] ?? "").not.toContain("noindex");

    // Один H1, и он же первый заголовок документа.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("h1, h2, h3, h4, h5, h6").first()).toHaveText(
      "Частые вопросы об AI-автоматизации бизнеса",
    );
    await expect(page.locator("main")).toHaveCount(1);

    // 14 вопросов и 14 полных ответов в серверном HTML.
    expect(faqItems).toHaveLength(14);
    await expect(page.locator("details")).toHaveCount(14);
    for (const item of faqItems) {
      expect(html, `вопрос ${item.id} отсутствует в HTML`).toContain(item.question);
      for (const paragraph of item.answer) {
        for (const segment of paragraph) {
          const fragment = typeof segment === "string" ? segment : segment.text;
          expect(html, `фрагмент ответа ${item.id} отсутствует в HTML`).toContain(fragment.trim());
        }
      }
    }

    // Черновых данных не осталось.
    expect(html).not.toContain("Вопрос 01");
    expect(html).not.toContain("Здесь будет размещён полный ответ");
    expect(html.toLowerCase()).not.toContain("draft");

    // Счётчик 01—14.
    await expect(page.getByText("01—14", { exact: true })).toHaveCount(1);

    /**
     * FAQ-разметка (аудит SEO/GEO 2026-07-28).
     *
     * Прежде здесь стояло `expect(html).not.toContain("FAQPage")` с пометкой «преждевременной
     * FAQ-разметки нет»: на момент написания раздел ещё не содержал утверждённых вопросов, и
     * разметка описывала бы несуществующее содержимое. Условие снято — проверки выше в этом же
     * тесте подтверждают, что все 14 вопросов и полных ответов приходят в серверном HTML.
     *
     * Поэтому запрет заменён на настоящее требование: разметка обязана СОВПАДАТЬ с видимым
     * содержимым. Ровно те же вопросы, в том же количестве, с непустыми ответами — и ни одного
     * вопроса, которого посетитель на странице не видит.
     */
    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) =>
        scripts.flatMap((script) => JSON.parse(script.textContent ?? "[]")),
      );
    const faqPage = schemas.find((schema) => schema["@type"] === "FAQPage");

    expect(
      faqPage,
      "на странице с вопросами и ответами должна быть разметка FAQPage",
    ).toBeDefined();
    expect(faqPage.mainEntity.map((entity: { name: string }) => entity.name)).toEqual(
      faqItems.map((item) => item.question),
    );
    for (const entity of faqPage.mainEntity) {
      expect(entity["@type"]).toBe("Question");
      expect(entity.acceptedAnswer.text.length).toBeGreaterThan(0);
      expect(html, "ответ из разметки должен быть виден на странице").toContain(
        entity.acceptedAnswer.text.split("\n\n")[0].slice(0, 60),
      );
    }

    // QAPage — другой тип (площадка вопросов пользователей). Здесь его быть не должно.
    expect(html).not.toContain("QAPage");

    // Пустых и заглушечных ссылок в разделе нет.
    await expect(page.locator('main a[href="#"]')).toHaveCount(0);
    await expect(page.locator('main a[href=""]')).toHaveCount(0);
    expect(
      await page
        .locator("main a")
        .evaluateAll(
          (nodes) => nodes.filter((node) => !(node.getAttribute("href") ?? "").trim()).length,
        ),
    ).toBe(0);
  });

  test("ответы содержат рабочие внутренние ссылки", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/faq");

    expect(internalLinks.length).toBeGreaterThan(0);
    expect(internalLinks.length).toBeLessThanOrEqual(6);

    for (const link of internalLinks) {
      // Ссылка есть в DOM до любого клика и не ведёт на саму себя.
      expect(link.href).not.toBe("/faq");
      // Локатор по href, а не getByRole: в закрытом <details> содержимое исключено из дерева
      // доступности, хотя в DOM и в серверном HTML оно присутствует — это и проверяется.
      const anchor = page.locator(`main a[href="${link.href}"]`);
      await expect(anchor).toHaveCount(1);
      await expect(anchor).toHaveText(link.text);

      const target = await request.get(link.href);
      expect(target.status(), `${link.href} не отдаёт 200`).toBe(200);
    }
  });

  /**
   * Первые абзацы ответов 04, 13 и 14 переписаны после SEO/GEO-аудита так, чтобы их можно было
   * извлечь и процитировать отдельно. Тест закрепляет именно ПЕРВЫЙ абзац каждого из них: если
   * ключевое условие снова уедет во второй абзац, проверка упадёт.
   */
  test("первые абзацы ответов 04, 13 и 14 самодостаточны и лежат в серверном HTML", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/faq")).text();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/faq");

    // textContent, а не innerText: вопросы закрыты, содержимое <details> не отрисовано, и
    // innerText у нерендеримого узла вернул бы пустую строку. Проверяется именно наличие текста
    // в DOM/серверном HTML, а не его отрисовка.
    const paragraphText = async (id: string, index: number) =>
      ((await page.locator(`#${id}-answer p`).nth(index).textContent()) ?? "")
        .replace(/\s+/g, " ")
        .trim();
    const firstParagraph = (id: string) => paragraphText(id, 0);

    // 04 — прямой ответ «Да» и сохранённое ограничение «в большинстве случаев».
    const p04 = await firstParagraph("faq-04");
    expect(p04.startsWith("Да,")).toBe(true);
    expect(p04).toContain("в большинстве случаев");
    expect(p04).toContain("без их замены");
    // Внутренняя ссылка осталась внутри этого же абзаца и ведёт на тот же адрес.
    await expect(
      page.locator("#faq-04-answer p").first().locator('a[href="/blog/sayt-crm-i-messendzhery"]'),
    ).toHaveText("Сайт, CRM, мессенджеры");

    // 13 — метод оценки понятен из первого абзаца: перечислены измеримые показатели.
    const p13 = await firstParagraph("faq-13");
    for (const metric of [
      "времени выполнения операции",
      "количеству ручных действий",
      "частоте ошибок",
      "числу необработанных заявок",
      "нагрузке на сотрудников",
    ]) {
      expect(p13, `показатель «${metric}» отсутствует в первом абзаце 13`).toContain(metric);
    }

    // 14 — все коммерческие условия поддержки уже в первом абзаце.
    const p14 = await firstParagraph("faq-14");
    expect(p14).toContain("по согласованию с заказчиком");
    expect(p14).toContain("оплачивается ежемесячно");
    expect(p14).toContain("может отказаться от неё и обслуживать решение самостоятельно");
    // Второй абзац сохраняет остальные условия и не делает поддержку обязательной.
    const second14 = await paragraphText("faq-14", 1);
    expect(second14).toContain("его объём и условия фиксируются отдельно");
    expect(second14).toContain("передаются согласованные материалы и доступы");

    // Все три абзаца пришли с сервера, а не собрались на клиенте.
    for (const fragment of [
      "Да, в большинстве случаев автоматизацию можно подключить",
      "Результат автоматизации оценивается по измеримым показателям",
      "Дальнейшее сопровождение QBit-Studio-Ai предоставляет по согласованию",
    ]) {
      expect(html, `«${fragment}» отсутствует в серверном HTML`).toContain(fragment);
    }

    // Формулировок, делающих ежемесячную поддержку обязательной, не появилось.
    for (const forbidden of ["обязательн", "необходимо оплачивать", "требуется оплачивать"]) {
      expect(p14.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("/faq присутствует в sitemap ровно один раз и без слэш-дубля", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap.split(`<loc>${CANONICAL}</loc>`).length - 1).toBe(1);
    expect(sitemap).not.toContain(`${CANONICAL}/`);
    // lastModified раздела совпадает с константой FAQ_PUBLISHED_AT и не находится в будущем.
    const faqEntry = sitemap.slice(sitemap.indexOf(`<loc>${CANONICAL}</loc>`));
    const lastmod = faqEntry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    expect(lastmod).toBe(FAQ_PUBLISHED_AT);
    // «Не в будущем» проверяется по НАЧАЛУ суток: конец сегодняшних суток законно больше `now`,
    // и сравнение с ним падало бы каждый день до 23:59 UTC.
    expect(new Date(`${lastmod}T00:00:00Z`).getTime()).toBeLessThanOrEqual(Date.now());

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Allow: /");
    expect(robots).not.toMatch(/Disallow:\s*\/faq/i);
    // Проверяется отсутствие ЗАПРЕТА для OAI-SearchBot, а не любого упоминания: явное разрешение
    // этому агенту допустимо и не должно валить тест.
    expect(robots).not.toMatch(/OAI-SearchBot[\s\S]*?Disallow:\s*\//i);
  });

  test("на desktop открыт максимум один вопрос и работает клавиатура", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/faq");

    const items = page.locator("details");
    await expect(page.locator("details[open]")).toHaveCount(0);

    await page.locator("summary").first().click();
    await expect(page.locator("details[open]")).toHaveCount(1);

    await page.locator("summary").nth(2).click();
    await expect(page.locator("details[open]")).toHaveCount(1);
    await expect(items.nth(2)).toHaveAttribute("open", "");

    // Клавиатура: summary фокусируется и раскрывается Enter/Space.
    await items.nth(4).locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(items.nth(4)).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(items.nth(4)).not.toHaveAttribute("open", "");

    // Каждый вопрос достижим через Tab.
    await page.locator("body").press("Tab");
    const reachable = await page.evaluate(() => {
      const summaries = Array.from(document.querySelectorAll("summary"));
      return summaries.every((summary) => summary.tabIndex >= 0);
    });
    expect(reachable).toBe(true);
  });

  test("повторное нажатие закрывает вопрос, а фокус остаётся на summary", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/faq");

    const first = page.locator("details").first();
    await page.locator("summary").first().click();
    await expect(first).toHaveAttribute("open", "");

    await page.locator("summary").first().click();
    await expect(first).not.toHaveAttribute("open", "");
    await expect(page.locator("details[open]")).toHaveCount(0);

    // Фокус после раскрытия остаётся на активном summary и не уезжает в текст ответа.
    await page.locator("summary").nth(5).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details").nth(5)).toHaveAttribute("open", "");
    const focused = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tag: active?.tagName.toLowerCase() ?? null,
        index: Array.from(document.querySelectorAll("summary")).indexOf(
          active as HTMLElement as HTMLElement,
        ),
      };
    });
    expect(focused.tag).toBe("summary");
    expect(focused.index).toBe(5);
  });

  test("эксклюзивность не зависит от атрибута details[name]", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/faq");

    // Атрибут снимается со всех элементов: дальше эксклюзивность может обеспечить только
    // клиентский контроллер, нативная группировка браузера здесь уже не работает.
    await page.evaluate(() => {
      for (const item of document.querySelectorAll("details")) item.removeAttribute("name");
    });
    expect(await page.locator("details[name]").count()).toBe(0);

    await page.locator("summary").nth(1).click();
    await expect(page.locator("details[open]")).toHaveCount(1);

    await page.locator("summary").nth(7).click();
    await expect(page.locator("details[open]")).toHaveCount(1);
    await expect(page.locator("details").nth(7)).toHaveAttribute("open", "");

    // И повторное нажатие по-прежнему закрывает.
    await page.locator("summary").nth(7).click();
    await expect(page.locator("details[open]")).toHaveCount(0);
  });

  test("нижний вопрос после раскрытия попадает в видимую область списка, верхний не двигает её", async ({
    page,
  }) => {
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/faq");

      const listState = () =>
        page.evaluate(() => {
          const list = document.querySelector("details")?.parentElement;
          return list ? { top: list.scrollTop, height: list.clientHeight } : null;
        });

      // Верхний вопрос уже виден — лишней прокрутки быть не должно.
      const before = await listState();
      await page.locator("summary").first().click();
      await page.waitForTimeout(600);
      const afterFirst = await listState();
      expect(afterFirst?.top, `лишняя прокрутка на ${size.width}`).toBe(before?.top);

      // Последний вопрос заведомо вне видимой области: после раскрытия он должен стать видимым.
      await page.locator("summary").last().click();
      await page.waitForTimeout(700);

      const visibility = await page.evaluate(() => {
        const items = document.querySelectorAll("details");
        const item = items[items.length - 1];
        const list = item.parentElement;
        if (!list) return null;
        const itemBox = item.getBoundingClientRect();
        const listBox = list.getBoundingClientRect();
        const summaryBox = item.querySelector("summary")!.getBoundingClientRect();
        return {
          summaryVisible:
            summaryBox.top >= listBox.top - 1 && summaryBox.bottom <= listBox.bottom + 1,
          answerStartsVisible: summaryBox.bottom < listBox.bottom - 1,
          itemTopVisible: itemBox.top >= listBox.top - 1,
          documentScrolled: window.scrollY,
        };
      });

      expect(visibility, `нет области списка на ${size.width}`).not.toBeNull();
      expect(visibility?.summaryVisible, `строка вопроса не видна на ${size.width}`).toBe(true);
      expect(visibility?.answerStartsVisible, `начало ответа не видно на ${size.width}`).toBe(true);
      expect(visibility?.itemTopVisible, `верх элемента срезан на ${size.width}`).toBe(true);
      // Прокручивается внутренний список, а не документ.
      expect(visibility?.documentScrolled, `документ прокрутился на ${size.width}`).toBe(0);
    }
  });

  test("на мобильном последний вопрос и CTA достижимы обычной прокруткой документа", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/faq");

    await page.locator("summary").last().click();
    await page.waitForTimeout(700);

    const state = await page.evaluate(() => {
      const items = document.querySelectorAll("details");
      const item = items[items.length - 1];
      const list = item.parentElement!;
      const box = item.getBoundingClientRect();
      return {
        listOverflow: getComputedStyle(list).overflowY,
        summaryVisible: box.top >= 0 && box.top < window.innerHeight,
        documentScrolled: window.scrollY > 0,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(state.listOverflow).toBe("visible");
    expect(state.summaryVisible).toBe(true);
    expect(state.documentScrolled).toBe(true);
    expect(state.overflowX).toBeLessThanOrEqual(0);

    const cta = page.getByRole("link", { name: "Обсудить задачу" });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
  });

  test("без JavaScript раздел работает как нативный FAQ", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    const response = await page.goto("/faq");
    expect(response?.status()).toBe(200);

    // Весь контент на месте и доступен без клиентского кода.
    await expect(page.locator("details")).toHaveCount(faqItems.length);
    for (const item of faqItems) {
      await expect(page.getByText(item.question, { exact: true })).toHaveCount(1);
    }

    // Нативное раскрытие продолжает работать.
    await page.locator("summary").nth(3).click();
    await expect(page.locator("details").nth(3)).toHaveAttribute("open", "");
    await page.locator("summary").nth(3).click();
    await expect(page.locator("details").nth(3)).not.toHaveAttribute("open", "");

    await context.close();
  });

  test("длинные ответы читаются целиком и не ломают экран", async ({ page }) => {
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/faq");

      // Самый длинный ответ: раскрывается и дочитывается внутри области доски.
      await page.locator("summary").nth(9).click();
      await page.waitForTimeout(400);

      const answer = page.locator("#faq-10-answer");
      await expect(answer).toBeVisible();

      // Критерий — «дочитывается прокруткой», а не «помещается целиком»: на невысоком десктопе
      // список намеренно прокручивается внутри доски. Проверяется, что текст нигде не обрезан и что
      // и первая, и последняя строка ответа реально доступны прокруткой списка.
      const readable = await answer.evaluate((node) => {
        const list = node.closest("details")?.parentElement;
        if (!list) return null;

        const reachable = (block: ScrollLogicalPosition) => {
          node.scrollIntoView({ block });
          const box = node.getBoundingClientRect();
          const listBox = list.getBoundingClientRect();
          return block === "end" ? box.bottom <= listBox.bottom + 1 : box.top >= listBox.top - 1;
        };

        return {
          clipped: node.scrollHeight > node.clientHeight + 1,
          startReachable: reachable("start"),
          endReachable: reachable("end"),
        };
      });
      expect(readable, `нет области списка на ${size.width}`).not.toBeNull();
      expect(readable?.clipped, `ответ обрезан на ${size.width}`).toBe(false);
      expect(readable?.startReachable, `начало ответа недостижимо на ${size.width}`).toBe(true);
      expect(readable?.endReachable, `конец ответа недостижим на ${size.width}`).toBe(true);

      // CTA остаётся достижимым, страница не скроллится и не даёт горизонтального overflow.
      await expect(page.getByRole("link", { name: "Обсудить задачу" })).toBeInViewport();
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(overflow.x, `горизонтальный overflow на ${size.width}`).toBeLessThanOrEqual(0);
      expect(overflow.y, `вертикальный скролл документа на ${size.width}`).toBeLessThanOrEqual(0);
    }
  });

  test("интерфейс лежит в границах стеклянной доски", async ({ page }) => {
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/faq");

      const box = await page.locator("main > div").nth(1).boundingBox();
      const photoBox = await page.locator("main > div").first().boundingBox();
      expect(box).not.toBeNull();
      expect(photoBox).not.toBeNull();
      if (!box || !photoBox) continue;

      // Ожидаемая рамка доски по cover-математике фотографии 1672×941 (доска x 359…1317, y 98…666).
      const k = Math.max(photoBox.width / 1672, photoBox.height / 941);
      expect(
        Math.abs(box.x - (photoBox.x + (photoBox.width - 1672 * k) / 2 + 359 * k)),
      ).toBeLessThan(2);
      expect(
        Math.abs(box.y - (photoBox.y + (photoBox.height - 941 * k) / 2 + 98 * k)),
      ).toBeLessThan(2);
      expect(Math.abs(box.width - 958 * k)).toBeLessThan(2);
      expect(Math.abs(box.height - 568 * k)).toBeLessThan(2);
    }
  });

  test("панель целиком помещается в экран на любых пропорциях, включая узко-высокие и сверхширокие", async ({
    page,
  }) => {
    for (const size of [
      { width: 901, height: 1200 },
      { width: 1024, height: 1366 },
      { width: 1100, height: 1200 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 2560, height: 800 },
      { width: 3440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/faq");

      const box = await page.locator("main > div").nth(1).boundingBox();
      expect(box, `нет рамки на ${size.width}×${size.height}`).not.toBeNull();
      if (!box) continue;

      expect(box.x, `левый край за экраном на ${size.width}×${size.height}`).toBeGreaterThanOrEqual(
        0,
      );
      expect(
        box.x + box.width,
        `правый край за экраном на ${size.width}×${size.height}`,
      ).toBeLessThanOrEqual(size.width + 1);

      const overflowX = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(
        overflowX,
        `горизонтальный overflow на ${size.width}×${size.height}`,
      ).toBeLessThanOrEqual(0);
    }
  });

  test("на мобильном страница прокручивается обычным образом, без вложенного scroll-контейнера", async ({
    page,
  }) => {
    for (const size of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/faq");

      const listOverflow = await page.evaluate(() => {
        const list = document.querySelector("details")?.parentElement;
        return list ? getComputedStyle(list).overflowY : null;
      });
      expect(listOverflow, `вложенный scroll на ${size.width}`).toBe("visible");

      const overflowX = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflowX).toBeLessThanOrEqual(0);

      // Документ прокручивается сам, а CTA доступен после списка.
      const cta = page.getByRole("link", { name: "Обсудить задачу" });
      await cta.scrollIntoViewIfNeeded();
      await expect(cta).toBeVisible();
    }
  });

  test("prefers-reduced-motion раскрывает ответ без анимации", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/faq");

    await page.locator("summary").nth(1).click();
    const answer = page.locator("#faq-02-answer");
    await expect(answer).toBeVisible();

    const motion = await answer.evaluate((node) => {
      const style = getComputedStyle(node);
      return { animation: style.animationDuration, transition: style.transitionDuration };
    });
    expect(Number.parseFloat(motion.animation)).toBeLessThan(0.01);
    expect(Number.parseFloat(motion.transition)).toBeLessThan(0.01);
  });

  for (const size of [
    { width: 360, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`нет serious/critical нарушений axe на ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/faq");
      await page.locator("summary").first().click();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const blocking = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(blocking.map((violation) => violation.id)).toEqual([]);
    });
  }
});
