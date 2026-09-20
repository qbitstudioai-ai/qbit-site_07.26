/**
 * Подмена `fetch` для тестов реального скрипта `scripts/indexnow-submit-current.mjs`.
 *
 * Подключается как `node --import <этот файл> scripts/indexnow-submit-current.mjs` и выполняется
 * ДО главного модуля, поэтому скрипт запускается без единой правки ради тестируемости.
 *
 * Зачем именно так. Ключевое требование к скрипту — «ни одного запроса к endpoint IndexNow, пока
 * не пройдены все проверки». Доказать это можно только запуском НАСТОЯЩЕГО скрипта со счётчиком
 * обращений к endpoint; проверка того же на уровне чистых функций доказывала бы лишь то, что
 * функции возвращают `ok: false`, но не то, что вызывающая сторона их слушает.
 *
 * Сценарий приходит JSON-строкой в `INDEXNOW_TEST_SCENARIO`, журнал обращений пишется в файл из
 * `INDEXNOW_TEST_RECORD`. Сеть не используется: любой не описанный сценарием адрес — это ошибка
 * теста, и стаб падает, а не «молча отвечает 200».
 */
import { writeFileSync } from "node:fs";

const scenario = JSON.parse(process.env.INDEXNOW_TEST_SCENARIO ?? "{}");
const recordPath = process.env.INDEXNOW_TEST_RECORD;
const calls = [];

function flush() {
  if (recordPath) writeFileSync(recordPath, JSON.stringify(calls), "utf8");
}

function xmlResponse(urls, contentType) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset>${urls
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join("")}</urlset>`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType ?? "application/xml" },
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = init.method ?? "GET";
  calls.push({ url, method });
  flush();

  if (url === scenario.endpoint) {
    return new Response(null, { status: scenario.endpointStatus ?? 200 });
  }

  if (url.endsWith(".txt")) {
    if (scenario.keyFileStatus && scenario.keyFileStatus !== 200) {
      return new Response("", { status: scenario.keyFileStatus });
    }
    return new Response(scenario.keyFileBody ?? scenario.key ?? "", { status: 200 });
  }

  if (url.endsWith("/sitemap.xml")) {
    if (scenario.sitemapStatus && scenario.sitemapStatus !== 200) {
      return new Response("", { status: scenario.sitemapStatus });
    }
    return xmlResponse(scenario.sitemapUrls ?? [], scenario.sitemapContentType);
  }

  if (method === "HEAD") {
    const status = scenario.redirectStatusByUrl?.[url] ?? scenario.redirectStatus ?? 308;
    return new Response(null, { status });
  }

  throw new Error(`indexnowFetchStub: незапланированный запрос ${method} ${url}`);
};
