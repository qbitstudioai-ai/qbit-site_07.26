import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Сквозная проверка рекламной атрибуции: реклама → cookie → форма → то, что РЕАЛЬНО уходит в n8n.
 *
 * Зачем отдельный спек со своим сервером. Основной e2e-сервер намеренно поднят БЕЗ
 * `N8N_CONTACT_WEBHOOK_URL`: `contacts-experience.spec.ts` проверяет, что без настроенного webhook
 * роут честно отвечает 503. Поэтому исходящий запрос в n8n там наблюдать негде, и до появления
 * этого файла последнее звено цепочки — сборка payload с полем `attribution` — проверялось только
 * unit-тестом на искусственно собранном заголовке `Cookie`.
 *
 * Здесь поднимается вторая копия ТОЙ ЖЕ production-сборки, у которой webhook указывает на локальный
 * приёмник. Приёмник живёт прямо в процессе теста, поэтому payload проверяется тем же кодом, что и
 * ассерты. Настоящий n8n при этом не вызывается ни разу.
 *
 * Сервер запускается напрямую из `.next/standalone/server.js`, а не через `scripts/start-standalone.mjs`:
 * копирование `.next/static` и `public` уже сделал основной e2e-сервер, а прямой запуск даёт
 * процесс, который надёжно убивается в `afterAll` на всех платформах.
 */

test.describe.configure({ mode: "serial" });

const PROCESS_TEXT = "Менеджеры вручную переносят заявки из Telegram в CRM и теряют часть из них.";

/** Заявки, дошедшие до «n8n». Очищается перед каждым сценарием. */
let received: Record<string, unknown>[] = [];
let sink: Server;
let app: ChildProcess;
let appUrl: string;

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("нет порта у приёмника");
  return address.port;
}

/** Ждём, пока вторая копия сайта поднимется. Порт свободный, поэтому чужой сервер поймать нельзя. */
async function waitForApp(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // Сервер ещё не слушает — это ожидаемо в первые секунды.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`сайт с настроенным webhook не поднялся: ${url}`);
}

test.beforeAll(async () => {
  sink = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      received.push(JSON.parse(body));
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });
  });
  const sinkPort = await listen(sink);

  const appServer = createServer();
  const appPort = await listen(appServer);
  await new Promise<void>((resolve) => appServer.close(() => resolve()));
  appUrl = `http://127.0.0.1:${appPort}`;

  app = spawn(process.execPath, [path.join(".next", "standalone", "server.js")], {
    cwd: process.cwd(),
    stdio: "ignore",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(appPort),
      HOSTNAME: "127.0.0.1",
      QBIT_DATA_DIR: path.join(process.cwd(), "var"),
      N8N_CONTACT_WEBHOOK_URL: `http://127.0.0.1:${sinkPort}/webhook/webhook-telegram-notification`,
      N8N_CONTACT_WEBHOOK_SECRET: "e2e-secret-not-real",
    },
  });

  await waitForApp(appUrl);
});

test.afterAll(async () => {
  app?.kill();
  await new Promise<void>((resolve) => sink.close(() => resolve()));
});

test.beforeEach(() => {
  received = [];
});

/** Заполняет и отправляет форму, дожидаясь подтверждения на странице. */
async function submitForm(page: import("@playwright/test").Page) {
  await page.getByLabel("Ваше имя").fill("Павел");
  await page.getByLabel("Телефон").fill("+7 937 534-65-75");
  await page.getByLabel("Какой процесс хотите автоматизировать").fill(PROCESS_TEXT);

  // Форма отбрасывает отправку быстрее человеческого минимума (CONTACT_MIN_FILL_MS = 3000).
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Спасибо! Заявка отправлена.")).toBeVisible();
}

test("реклама → cookie → форма → payload в n8n содержит исходные метки", async ({
  page,
  context,
}) => {
  // 1. Переход по рекламной ссылке на страницу, которая пререндерится статически.
  await page.goto(
    `${appUrl}/products?utm_source=yandex&utm_medium=cpc&utm_campaign=avtomatizaciya` +
      `&utm_content=obyavlenie-1&utm_term=avtomatizaciya+zayavok&yclid=98765`,
  );

  // 2. Cookie действительно сохранена браузером.
  const cookie = (await context.cookies()).find((item) => item.name === "qbit_attr");
  expect(cookie, "браузер не сохранил qbit_attr").toBeTruthy();
  expect(cookie?.httpOnly).toBe(true);

  // 3. Обычная навигация до страницы контактов — источник обязан её пережить.
  await page.goto(`${appUrl}/contacts`);

  // 4. Настоящая отправка через настоящий /api/contact (без единого page.route).
  await submitForm(page);

  // 5. То, что реально ушло в n8n.
  expect(received).toHaveLength(1);
  const payload = received[0];

  expect(payload.attribution, "attribution не должен быть null").not.toBeNull();
  expect(payload.attribution).toMatchObject({
    yclid: "98765",
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "avtomatizaciya",
    utm_content: "obyavlenie-1",
    utm_term: "avtomatizaciya zayavok",
    landing_path: "/products",
  });
  expect(Date.parse((payload.attribution as { captured_at: string }).captured_at)).not.toBeNaN();

  // Остальной контракт заявки не пострадал.
  expect(payload.page).toBe("/contacts");
  expect(payload.name).toBe("Павел");
  expect(payload.phone).toBe("+79375346575");
  expect(payload.message).toContain("Заявка с сайта QBit-Studio-Ai — страница «Контакты»");
  expect(payload.message).not.toContain("yandex");
});

test("заявка из раздела «Ваша задача» на главной несёт тот же источник и page: /", async ({
  page,
}) => {
  await page.goto(`${appUrl}/?yclid=555000&utm_source=yandex-direct`);
  await page.goto(`${appUrl}/?section=task`);

  await submitForm(page);

  expect(received).toHaveLength(1);
  expect(received[0].page).toBe("/");
  expect(received[0].attribution).toMatchObject({ yclid: "555000", utm_source: "yandex-direct" });
  expect(received[0].message).toContain(
    "Заявка с сайта QBit-Studio-Ai — главная страница, раздел «Ваша задача»",
  );
});

test("посетитель без рекламного перехода даёт attribution: null", async ({ page }) => {
  await page.goto(`${appUrl}/contacts`);

  await submitForm(page);

  expect(received).toHaveLength(1);
  expect(received[0].attribution).toBeNull();
  // Это штатный случай, а не сбой: заявка доходит полностью.
  expect(received[0].page).toBe("/contacts");
  expect(received[0].name).toBe("Павел");
});
