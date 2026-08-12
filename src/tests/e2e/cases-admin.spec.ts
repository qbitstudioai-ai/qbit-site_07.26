import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Раздел «Кейсы» в админ-панели: публикация, правка, удаление — и то, что после каждого действия
 * происходит с ПУБЛИЧНЫМ сайтом.
 *
 * Проверяется не форма, а путь целиком: нажатие «Опубликовать» обязано превратиться в настоящую
 * страницу с canonical, разметкой и строкой в карте сайта, «Сохранить изменения» — обновить текст
 * по прежнему адресу, «Удалить» — убрать и страницу, и строку карты. Всё это в одном сценарии
 * намеренно: по отдельности каждое действие может «работать», а вместе разъезжаться.
 *
 * ── Учётные данные ──────────────────────────────────────────────────────────────────────────────
 *
 * Спека требует ОТДЕЛЬНОГО тестового администратора: `E2E_ADMIN_LOGIN` и `E2E_ADMIN_PASSWORD`.
 * Настоящий пароль владельца сайта здесь не нужен и не используется — сервер для приёмки
 * поднимается со своими переменными окружения и своей временной базой. Без этих переменных спека
 * пропускается, а не падает: на машине без тестового администратора ей нечего проверять.
 *
 * ── База ────────────────────────────────────────────────────────────────────────────────────────
 *
 * Тест создаёт кейс и в конце удаляет его сам. Адрес и номер дела заведомо служебные, чтобы даже
 * при обрыве на середине в архиве нельзя было спутать его с настоящим делом.
 */

const LOGIN = process.env.E2E_ADMIN_LOGIN;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.skip(
  !LOGIN || !PASSWORD,
  "Нужны E2E_ADMIN_LOGIN и E2E_ADMIN_PASSWORD — тестовый администратор для приёмки админ-панели",
);

/** Временный кейс приёмки. Номер дела и адрес не пересекаются с настоящим архивом. */
const DRAFT = {
  title: "Проверка админ-панели: временный кейс приёмки",
  shortTitle: "Временный кейс приёмки",
  slug: "vremennyy-keys-priemki",
  fileNumber: "99",
  summary: "Первый абзац краткого итога.\n\nВторой абзац краткого итога.",
  task: "Описание задачи для проверки.",
  implementation: "Вводный абзац реализации.\n\nПояснение после цепочки.",
  result: "Абзац результата.\n\nОговорка рядом с цифрами.",
  metricLabel: "Время на проверку",
  metricBefore: "3 часа в неделю",
  metricAfter: "20 минут в неделю",
  metricSource: "По данным заказчика",
  humanControl: "Окончательное решение принимает человек.",
  limitations: "Результат относится к конкретному внедрению.",
  seoTitle: "Временный кейс приёмки: проверка админ-панели",
  seoDescription: "Служебный кейс, созданный приёмкой админ-панели. Удаляется тем же тестом.",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(LOGIN as string);
  await page.getByLabel("Пароль").fill(PASSWORD as string);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

/** Заполняет форму создания кейса. Поля ищутся по видимым подписям — так же, как их видит человек. */
async function fillForm(page: Page) {
  await page.getByLabel("Название кейса").fill(DRAFT.title);
  await page.getByLabel("Короткое название").fill(DRAFT.shortTitle);
  await page.getByLabel("Адрес кейса (URL)").fill(DRAFT.slug);
  await page.getByLabel("Номер дела").fill(DRAFT.fileNumber);
  await page.getByLabel("Краткий итог").fill(DRAFT.summary);
  await page.getByLabel("Задача").fill(DRAFT.task);
  await page.getByLabel("Что реализовали").fill(DRAFT.implementation);
  // Регулярное выражение, а не `exact`: у обязательного поля в подписи стоит звёздочка, и точное
  // совпадение с «Результат» её не находит, а подстрока задела бы «Ограничение результата».
  await page.getByLabel(/^Результат\*?$/).fill(DRAFT.result);
  await page.getByLabel("Название показателя").fill(DRAFT.metricLabel);
  await page.getByLabel("До", { exact: true }).fill(DRAFT.metricBefore);
  await page.getByLabel("После", { exact: true }).fill(DRAFT.metricAfter);
  await page.getByLabel("Источник").fill(DRAFT.metricSource);
  await page.getByLabel("Что остаётся под контролем человека").fill(DRAFT.humanControl);
  await page.getByLabel("Ограничение результата").fill(DRAFT.limitations);
  await page.getByLabel("SEO title").fill(DRAFT.seoTitle);
  await page.getByLabel("Meta description").fill(DRAFT.seoDescription);

  // Цепочка процесса — редактируемый список: добавить шаг, заполнить, добавить ещё один.
  await page.getByRole("button", { name: "Добавить шаг" }).click();
  await page.getByLabel("Шаг 1").fill("первый шаг");
  await page.getByRole("button", { name: "Добавить шаг" }).click();
  await page.getByLabel("Шаг 2").fill("второй шаг");
}

test.describe("админ-панель: кейсы", () => {
  test("защищена входом", async ({ page }) => {
    await page.goto("/admin/cases");
    // Неавторизованного разворачивает middleware — до отрисовки раздела.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Кейсы");
  });

  /**
   * Доступность списка и формы. Порог тот же, что у публичных страниц: ни одного нарушения уровня
   * serious или critical. Форма кейса длинная и целиком состоит из подписанных полей — именно здесь
   * потерянная подпись или поле без имени стоят дороже всего.
   */
  test("список и форма кейса проходят проверку доступности", async ({ page }) => {
    await login(page);

    for (const step of ["список", "форма"] as const) {
      await page.goto("/admin/cases");
      if (step === "форма") await page.getByRole("button", { name: "Добавить кейс" }).click();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
        step,
      ).toEqual([]);
    }
  });

  test("публикует кейс, правит его и удаляет — со всеми следствиями на сайте", async ({
    page,
    request,
  }) => {
    await login(page);
    await page.goto("/admin/cases");

    // ── Список ────────────────────────────────────────────────────────────────────────────────
    // Первый кейс на месте и виден в списке: раздел читает базу, а не файл.
    await expect(page.getByRole("cell", { name: "AI-анализ звонков отдела продаж" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Добавить кейс" })).toBeVisible();

    // ── Проверка перед публикацией ────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Добавить кейс" }).click();
    // Черновиков в разделе нет: единственное конечное действие формы — публикация.
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Предпросмотр" })).toHaveCount(0);
    // Панель действия стоит и над формой, и под ней — длинную форму не нужно мотать вверх.
    await expect(page.getByRole("button", { name: "Опубликовать" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Опубликовать" }).first()).toBeVisible();

    await page.getByLabel("Название кейса").fill(DRAFT.title);
    await page.getByRole("button", { name: "Опубликовать" }).first().click();
    // Незаполненные поля названы поимённо, а введённое — не потеряно.
    await expect(page.getByText("Проверьте заполнение полей").first()).toBeVisible();
    await expect(page.getByLabel("Название кейса")).toHaveValue(DRAFT.title);
    // Адрес предложен по названию — и его ещё можно поменять.
    await expect(page.getByLabel("Адрес кейса (URL)")).not.toHaveValue("");

    // ── Публикация ────────────────────────────────────────────────────────────────────────────
    await fillForm(page);
    await page.getByRole("button", { name: "Опубликовать" }).first().click();

    await expect(page.getByText("Кейс опубликован")).toBeVisible();
    const openLink = page.getByRole("link", { name: /Открыть на сайте/ });
    await expect(openLink).toHaveAttribute("href", `/cases/${DRAFT.slug}`);

    // ── Публичная страница ────────────────────────────────────────────────────────────────────
    const published = await request.get(`/cases/${DRAFT.slug}`);
    expect(published.status()).toBe(200);
    const html = await published.text();

    // Весь текст — в ПЕРВОМ ответе сервера, без JS.
    expect(html).toContain(DRAFT.title);
    expect(html).toContain("Первый абзац краткого итога.");
    expect(html).toContain(DRAFT.metricBefore);
    expect(html).toContain(DRAFT.metricSource);
    expect(html).toContain(DRAFT.limitations);
    // Служебная обвязка собирается сама: canonical, индексирование, разметка, печать и ссылка.
    expect(html).toContain(`<link rel="canonical" href="https://allqbit.ru/cases/${DRAFT.slug}"`);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"WebPage"');
    expect(html).toContain('"@type":"Organization"');
    expect(html).not.toContain('"@type":"Article"');
    expect(html).toContain("data-case-stamp");
    expect(html).toContain('href="/contacts"');
    expect(html).not.toMatch(/<meta name="robots"[^>]*noindex/);

    // Цепочка процесса стала нумерованным списком, а не строкой со стрелками.
    await page.goto(`/cases/${DRAFT.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: DRAFT.title })).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "первый шаг" }).first(),
    ).toBeVisible();
    // Шесть разделов документа — та же структура, что у первого кейса.
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(6);

    // Картотека показывает новую папку — она в layout, общем для всего раздела.
    await expect(page.locator(`[data-case-folder="${DRAFT.slug}"]`)).toBeVisible();

    // Карта сайта обновилась сразу, без ожидания пяти минут.
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`<loc>https://allqbit.ru/cases/${DRAFT.slug}</loc>`);

    // ── Правка ────────────────────────────────────────────────────────────────────────────────
    await page.goto("/admin/cases");
    await page
      .getByRole("row", { name: new RegExp(DRAFT.shortTitle) })
      .getByRole("button", { name: "Редактировать" })
      .click();

    // Адрес опубликованного кейса не редактируется: поля ввода для него нет вовсе.
    await expect(page.getByLabel("Адрес кейса (URL)")).toHaveCount(0);
    await expect(page.getByText(`/cases/${DRAFT.slug}`).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить изменения" }).first()).toBeVisible();

    await page.getByLabel("Короткое название").fill("Изменённое короткое название");
    await page.getByLabel("Задача").fill("Изменённый текст задачи.");
    await page.getByRole("button", { name: "Сохранить изменения" }).first().click();
    await expect(page.getByText("Изменения сохранены и уже видны на сайте.").first()).toBeVisible();

    const edited = await (await request.get(`/cases/${DRAFT.slug}`)).text();
    expect(edited).toContain("Изменённый текст задачи.");
    expect(edited).not.toContain(DRAFT.task);
    // Адрес прежний, и карта сайта его не потеряла.
    expect(await (await request.get("/sitemap.xml")).text()).toContain(
      `<loc>https://allqbit.ru/cases/${DRAFT.slug}</loc>`,
    );

    // ── Удаление ──────────────────────────────────────────────────────────────────────────────
    await page.goto("/admin/cases");
    const row = page.getByRole("row", { name: /Изменённое короткое название/ });
    await row.getByRole("button", { name: "Удалить" }).click();

    // Отмена ничего не удаляет.
    await expect(page.getByRole("alertdialog")).toContainText(
      "Удалить кейс «Изменённое короткое название»?",
    );
    await expect(page.getByRole("alertdialog")).toContainText("из карты сайта");
    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect((await request.get(`/cases/${DRAFT.slug}`)).status()).toBe(200);

    // Подтверждение удаляет.
    await row.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByRole("row", { name: /Изменённое короткое название/ })).toHaveCount(0);

    expect((await request.get(`/cases/${DRAFT.slug}`)).status()).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(`/cases/${DRAFT.slug}`);

    // ── Первое дело архива не пострадало ──────────────────────────────────────────────────────
    const first = await request.get("/cases/analiz-zvonkov-otdela-prodazh");
    expect(first.status()).toBe(200);
    expect(await first.text()).toContain(
      "AI-анализ звонков отдела продаж: от нескольких часов проверки к 10–15 минутам",
    );
  });
});
