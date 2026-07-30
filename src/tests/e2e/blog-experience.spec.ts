import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { BLOG_URL, blogPostUrl } from "../../features/blog/blogSeo";
import { seedBlogPosts as blogPosts } from "../fixtures/seedContent";

const blogPaths = ["/blog", ...blogPosts.map((post) => `/blog/${post.slug}`)];
const crmDescription =
  "Как объединить сайт, CRM и мессенджеры: передача заявок, нормализация данных, дедупликация, уведомления и контроль ошибок.";

test.describe("published blog experience", () => {
  test("publishes seven semantic pages without broken placeholder links", async ({ page }) => {
    for (const path of blogPaths) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('a[href="#"]')).toHaveCount(0);
      await expect(page.locator('a:not([href]), a[href=""]')).toHaveCount(0);
      await expect(page.locator('a[href="/examples"]')).toHaveCount(0);
      await expect(page.locator('a[href="/ai-assistant-for-business"]')).toHaveCount(0);

      const headings = page.locator("h1, h2, h3");
      await expect(headings.first(), path).toHaveJSProperty("tagName", "H1");
      await expect(page.locator("h1"), path).toHaveCount(1);

      const h2Ids = await page.locator("h2").evaluateAll((nodes) => nodes.map((node) => node.id));
      expect(h2Ids.every(Boolean), path).toBe(true);
      expect(new Set(h2Ids).size, path).toBe(h2Ids.length);

      for (const href of await page
        .getByRole("navigation", { name: "Оглавление" })
        .locator('a[href^="#"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) {
        await expect(page.locator(href), `${path} ${href}`).toHaveCount(1);
        await expect(page.locator(href), `${path} ${href}`).toHaveJSProperty("tagName", "H2");
      }

      const staticHtml = await (await page.request.get(path)).text();
      const h1Text = (await page.locator("h1").textContent())?.trim();
      expect(h1Text, `${path} H1 text`).toBeTruthy();
      expect(staticHtml, `${path} SSG H1`).toContain(h1Text ?? "");
      if (path !== "/blog") {
        expect(staticHtml, `${path} SSG sources`).toContain("Источники");
        expect(staticHtml, `${path} SSG related material`).toContain("Материалы по теме");
      }
    }
  });

  test("keeps the index, article URL and browser history in sync", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Блог QBit-Studio-Ai");

    const indexLinks = page
      .locator("article")
      .getByRole("link")
      .filter({ has: page.locator("strong") });
    for (const post of blogPosts) {
      await expect(page.locator(`article a[href="/blog/${post.slug}"]`).first()).toBeVisible();
    }

    const articleNavigation = page.getByRole("navigation", { name: "Статьи блога" });
    await expect(articleNavigation.getByRole("link")).toHaveCount(blogPosts.length);
    await expect(articleNavigation.locator('[aria-current="page"]')).toHaveCount(0);

    await indexLinks.first().click();
    await expect(page).toHaveURL(`/blog/${blogPosts[0].slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(blogPosts[0].title);
    await expect(articleNavigation.getByRole("link").first()).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(blogPosts[0].title);

    await page.goBack();
    await expect(page).toHaveURL("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Блог QBit-Studio-Ai");

    await page.goForward();
    await expect(page).toHaveURL(`/blog/${blogPosts[0].slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(blogPosts[0].title);
    expect(consoleErrors).toEqual([]);
  });

  test("renders full article navigation and responsive scrolling", async ({ page }) => {
    const post = blogPosts[3];
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/blog/${post.slug}`);

    await expect(page.getByText("Черновой материал")).toHaveCount(0);
    await expect(page.getByText(/Временный текст/)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Источники" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Связанные статьи" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Получить бесплатный разбор" })).toBeVisible();

    const toc = page.getByRole("navigation", { name: "Оглавление" });
    const firstTocLink = toc.getByRole("link").first();
    const target = await firstTocLink.getAttribute("href");
    expect(target).toMatch(/^#[\p{L}\p{N}-]+$/u);
    await firstTocLink.click();
    await expect(page.locator(target!)).toBeVisible();

    const desktopState = await page.locator("[data-blog-scroller]").evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(desktopState.overflowY).toBe("auto");
    expect(desktopState.scrollHeight).toBeGreaterThan(desktopState.clientHeight);
    expect(desktopState.documentOverflow).toBe(0);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.reload();
    const articleNavigation = page.getByRole("navigation", { name: "Статьи блога" });
    await expect(page.getByRole("button", { name: /Все статьи/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);

    await page.getByRole("button", { name: /Все статьи/ }).click();
    await expect(
      articleNavigation.getByRole("link", { name: new RegExp(post.title) }),
    ).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Все статьи/ })).toBeFocused();
  });

  test("publishes canonical metadata and matching structured data", async ({ page }) => {
    const post = blogPosts[1];
    await page.goto(`/blog/${post.slug}`);

    /**
     * Аудит SEO/GEO 2026-07-28: раньше здесь проверялось ОТСУТСТВИЕ `meta robots` — расчёт на то,
     * что без тега страница индексируется по умолчанию. Теперь правило задано явно, вместе с
     * `max-image-preview: large` и `max-snippet: -1`, снимающими ограничение на размер сниппета.
     * Существенное требование то же: запрета индексации на опубликованной статье быть не должно.
     */
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", blogPostUrl(post));
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );

    /**
     * Один заголовок на `<title>`, `og:title` и `twitter:title` (2026-07-30).
     *
     * Раньше здесь ожидался `post.title` — видимое название статьи, — и это закрепляло расхождение:
     * `<title>` брал SEO-заголовок, а соцсети и мессенджеры показывали другой текст. Видимый H1
     * проверяется отдельно и по-прежнему равен `post.title`.
     */
    const seoTitle = post.seoTitle ?? `${post.title} — QBit-Studio-Ai`;
    await expect(page).toHaveTitle(seoTitle);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", seoTitle);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", seoTitle);
    await expect(page.locator("h1")).toHaveText(post.title);

    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) =>
        scripts.flatMap((script) => JSON.parse(script.textContent ?? "[]")),
      );
    const posting = schemas.find((schema) => schema["@type"] === "BlogPosting");
    const breadcrumbs = schemas.find((schema) => schema["@type"] === "BreadcrumbList");

    expect(posting).toMatchObject({
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt,
      url: blogPostUrl(post),
    });
    expect(posting.author.name).toBe(post.author);
    /**
     * Издатель указан ССЫЛКОЙ на общий узел организации (`@id`), а не повторной копией: одна и та
     * же компания описывается на сайте один раз, иначе поисковая система видит несколько
     * однофамильцев. Проверяется, что ссылка ведёт на существующий узел с нужным названием.
     */
    const organization = schemas.find((schema) => schema["@type"] === "Organization");
    expect(posting.publisher["@id"]).toBe(organization["@id"]);
    expect(organization.name).toBe("QBit-Studio-Ai");
    expect(breadcrumbs.itemListElement.at(-1).name).toBe(post.title);
  });

  test("keeps dates and descriptions consistent across UI, metadata and BlogPosting", async ({
    page,
  }) => {
    for (const post of blogPosts) {
      await page.goto(`/blog/${post.slug}`);
      const schemas = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((scripts) =>
          scripts.flatMap((script) => JSON.parse(script.textContent ?? "[]")),
        );
      const posting = schemas.find((schema) => schema["@type"] === "BlogPosting");
      const organization = schemas.find((schema) => schema["@type"] === "Organization");

      await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute(
        "content",
        post.publishedAt,
      );
      await expect(page.locator('meta[property="article:modified_time"]')).toHaveAttribute(
        "content",
        post.modifiedAt,
      );
      expect(posting.datePublished).toBe(post.publishedAt);
      expect(posting.dateModified).toBe(post.modifiedAt);
      expect(posting.author.name).toBe("QBit-Studio-Ai");
      expect(posting.publisher["@id"]).toBe(organization["@id"]);
      expect(organization.name).toBe("QBit-Studio-Ai");

      if (post.modifiedAt > post.publishedAt) {
        await expect(
          page.getByText(`Обновлено: ${post.modifiedLabel.toLowerCase()}`),
        ).toBeVisible();
      }
    }

    await page.goto("/blog/sayt-crm-i-messendzhery");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      crmDescription,
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      crmDescription,
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      crmDescription,
    );

    await page.goto("/blog");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      "Рабочий стол с открытым блокнотом",
    );
  });

  test("publishes all six articles in sitemap and keeps /blog canonical", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", BLOG_URL);

    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`<loc>${BLOG_URL}</loc>`);
    for (const post of blogPosts) {
      expect(sitemap).toContain(`<loc>${blogPostUrl(post)}</loc>`);
      expect(sitemap).toContain(`<lastmod>${post.modifiedAt}`);
    }
  });

  test("publishes robots and keeps every internal blog link reachable", async ({ page }) => {
    const robots = await page.request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap: https://allqbit.ru/sitemap.xml");

    const hrefs = new Set<string>();
    for (const path of blogPaths) {
      await page.goto(path);
      for (const href of await page
        .locator('a[href^="/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) {
        hrefs.add(href);
      }
    }
    for (const href of hrefs) {
      expect((await page.request.get(href)).status(), href).toBe(200);
    }
  });

  test("makes horizontally scrollable diagrams keyboard accessible", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    let diagramCount = 0;
    for (const post of blogPosts) {
      await page.goto(`/blog/${post.slug}`);
      for (const scroller of await page.locator("[data-code-scroller]").all()) {
        diagramCount += 1;
        await expect(scroller).toHaveAttribute("tabindex", "0");
        await expect(scroller).toHaveAttribute("role", "region");
        await expect(scroller).toHaveAttribute("aria-label", /Прокручиваем/);
        await scroller.focus();
        await expect(scroller).toBeFocused();
        const before = await scroller.evaluate((element) => element.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => scroller.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(before);
      }
    }
    expect(diagramCount).toBeGreaterThan(0);
  });

  test("has no serious or critical accessibility violations at 360 and 1440", async ({ page }) => {
    test.setTimeout(180_000);
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of blogPaths) {
        await page.goto(path);

        const results = await new AxeBuilder({ page }).analyze();
        const blockingViolations = results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        );

        expect(
          blockingViolations,
          `${width}px ${path}\n${JSON.stringify(blockingViolations, null, 2)}`,
        ).toEqual([]);
      }
    }
  });
});
