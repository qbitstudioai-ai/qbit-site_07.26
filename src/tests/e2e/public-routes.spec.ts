import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getHomepageCopy } from "../../content/homepage-copy";

const copy = getHomepageCopy();
/**
 * `/login` — рабочая страница входа в админ-панель (раньше была заглушкой). Здесь проверяется её
 * публичная часть: общий Header, тексты, метаданные и noindex. Сам вход проверяется отдельно —
 * серверной проверкой сессии, а не браузером.
 *
 * Страница /contacts оформлена полностью (переговорная, прямые контакты, форма заявки) и
 * проверяется файлом `contacts-experience.spec.ts`; здесь она участвует лишь там, где проверяется
 * ОБЩИЙ Header на всех маршрутах.
 */
const routes = [
  {
    path: "/login",
    heading: "Вход",
    title: "Вход — QBit-Studio-Ai",
    text: "Панель управления содержимым сайта: тексты отделов, продукты, статьи, контакты и документы.",
  },
];

test.describe("public routes", () => {
  for (const route of routes) {
    test(`${route.path} uses the shared header, exact copy, metadata and noindex`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toHaveCount(1);
      await expect(page.getByText(route.text, { exact: true })).toBeVisible();
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

      const navigation = page.getByRole("navigation", { name: "Основная навигация" });
      expect(await navigation.locator("a").allTextContents()).toEqual(
        copy.heroLinks.map((link) => link.label),
      );
      await expect(page.getByText("Админ", { exact: true })).toHaveCount(0);
      const headerPhone = page.locator("[data-header-phone]");
      await expect(headerPhone).toHaveAccessibleName(copy.headerPhoneAccessibleLabel);
      await expect(headerPhone).toHaveAttribute("href", copy.headerPhoneHref);
      await expect(page.getByRole("link", { name: "← На главную" })).toHaveAttribute("href", "/");

      const pageGeometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth);
    });
  }

  /**
   * «Контакты» в общем Header раньше вели на href="#", хотя маршрут /contacts существует.
   * Проверяется на КАЖДОЙ странице, где отрисовывается общий Header, а не только на одной.
   *
   * /blog раньше был из этого списка исключён: его layout передавал
   * `inactiveLinkLabels={["Контакты"]}`, и пункт отрисовывался как span[aria-disabled]. Обход
   * остался с тех времён, когда маршрута /contacts ещё не было, но исключение из проверки не дало
   * это заметить — владелец сайта нашёл вручную 29.07.2026. Обход и сам механизм убраны, /blog
   * проверяется наравне со всеми: исключение страницы из проверки означает, что именно на ней
   * дефект и поселится.
   */
  test('общий Header ведёт «Контакты» на /contacts и не содержит href="#"', async ({
    page,
    request,
  }) => {
    expect((await request.get("/contacts")).status()).toBe(200);

    for (const route of [
      "/",
      "/blog",
      "/faq",
      "/products",
      "/documents",
      "/how-we-work",
      "/contacts",
      "/login",
    ]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);

      const navigation = page.getByRole("navigation", { name: "Основная навигация" });
      const contacts = navigation.getByRole("link", { name: "Контакты" });
      await expect(contacts, `«Контакты» не ссылка на ${route}`).toHaveCount(1);
      await expect(contacts, `неверный href на ${route}`).toHaveAttribute("href", "/contacts");

      // Ни одной заглушечной или пустой ссылки во всём документе.
      await expect(page.locator('a[href="#"]'), `href="#" остался на ${route}`).toHaveCount(0);
      await expect(page.locator('a[href=""]'), `пустой href на ${route}`).toHaveCount(0);

      // Клавиатурная доступность: пункт получает фокус и активируется Enter.
      await contacts.focus();
      expect(
        await contacts.evaluate((node) => node === document.activeElement),
        `«Контакты» не фокусируется на ${route}`,
      ).toBe(true);
    }

    // Переход по ссылке действительно приводит на страницу контактов.
    await page.goto("/faq");
    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Контакты" })
      .press("Enter");
    await page.waitForURL("**/contacts");
    await expect(page.getByRole("heading", { level: 1, name: "Обсудим вашу задачу" })).toHaveCount(
      1,
    );
  });

  /**
   * logo.svg — обёртка над встроенным растром. После оптимизации он остаётся тем же изображением,
   * но заметно легче. Верхняя граница фиксирует результат, чтобы прежний вес не вернулся.
   */
  test("логотип отдаёт 200 и остаётся легче исходных 162 445 байт", async ({ request }) => {
    const response = await request.get("/logo.svg");
    expect(response.status()).toBe(200);

    const body = await response.body();
    expect(body.byteLength).toBeLessThan(162_445);
    expect(body.byteLength).toBeLessThanOrEqual(90_000);

    const svg = body.toString("utf8");
    // Геометрия логотипа не изменилась: тот же viewBox и тот же масштаб встроенного растра.
    expect(svg).toContain('viewBox="0 0 597.6 426.96"');
    expect(svg).toContain('transform="scale(.24)"');
    expect(svg).toContain('width="2490" height="1779"');

    /**
     * Одного веса недостаточно: лоссовая перекодировка или уменьшение растра тоже сделали бы файл
     * легче и прошли бы проверку выше. Поэтому разбирается IHDR встроенного PNG — так фиксируется,
     * что картинка осталась в полном разрешении (резкость не потеряна) и в индексном формате,
     * которым и достигнута экономия без потерь.
     */
    const png = Buffer.from(svg.match(/base64,([A-Za-z0-9+/=]+)/)![1], "base64");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const ihdr = png.indexOf("IHDR");
    expect(png.readUInt32BE(ihdr + 4)).toBe(2490); // ширина растра не уменьшена
    expect(png.readUInt32BE(ihdr + 8)).toBe(1779); // высота растра не уменьшена
    expect(png[ihdr + 12]).toBe(8); // bit depth
    expect(png[ihdr + 13]).toBe(3); // colour type 3 — индексный PNG с палитрой
    expect(svg).toContain("data:image/png;base64,");
  });

  /**
   * Форма входа не должна ни регистрировать, ни восстанавливать пароль: администратор один, его
   * учётные данные задаются переменными окружения. И ни один секрет не должен оказаться в разметке.
   */
  test("страница входа содержит только логин, пароль и кнопку «Войти»", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.getByLabel("Логин")).toBeVisible();
    await expect(page.getByLabel("Пароль")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();

    // Ни регистрации, ни восстановления пароля.
    await expect(page.getByText(/регистрац|восстанов|забыл/i)).toHaveCount(0);

    // В разметке нет ни хеша пароля, ни секрета сессии, ни логина администратора.
    const html = await page.content();
    expect(html).not.toContain("scrypt$");
    expect(html).not.toMatch(/SESSION_SECRET|ADMIN_PASSWORD_HASH|ADMIN_LOGIN/);
  });

  test("неверные данные дают одинаковую ошибку и не создают сессию", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Логин").fill("nonexistent-user");
    await page.getByLabel("Пароль").fill("wrong-password-value");
    await page.getByRole("button", { name: "Войти" }).click();

    // Область сообщения ищется внутри формы: Next.js держит собственный role="alert" для объявления
    // смены маршрута, и без уточнения локатор совпал бы с двумя элементами.
    await expect(page.locator("form [role='alert']")).toContainText(
      /Неверный логин или пароль|Вход не настроен/,
    );
    await expect(page).toHaveURL(/\/login/);
    expect(await page.context().cookies()).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: "qbit_admin_session" })]),
    );
  });

  test("закрытые маршруты /admin разворачивают гостя на страницу входа", async ({ page }) => {
    for (const path of ["/admin", "/admin/blog", "/admin/documents"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    }
  });

  test("mobile shared header keeps phone and both working routes available", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contacts");

    const phone = page.getByRole("link", { name: copy.headerPhoneAccessibleLabel }).first();
    await expect(phone).toBeVisible();
    const menuButton = page.locator('button[aria-controls="site-navigation"]');
    await menuButton.click();

    const navigation = page.getByRole("navigation", { name: "Основная навигация" });
    for (const label of ["Контакты", "Вход"]) {
      const link = navigation.getByRole("link", { name: label });
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await navigation.getByRole("link", { name: "Вход" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Вход" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });

  for (const route of routes) {
    test(`${route.path} has no serious or critical axe violations on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
    });
  }
});
