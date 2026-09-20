/**
 * Разовая пакетная отправка текущих адресов сайта в IndexNow.
 *
 * Запускается вручную на сервере, изнутри рабочего контейнера:
 *
 *     docker compose exec allqbit-site npm run indexnow:submit-current -- --dry-run
 *     docker compose exec allqbit-site npm run indexnow:submit-current
 *
 * Порядок проверок строго fail-closed: ни один запрос к endpoint IndexNow не выполняется, пока не
 * пройдены ВСЕ предварительные проверки. `--dry-run` выполняет их целиком и останавливается перед
 * отправкой.
 *
 * Скрипт импортирует `.ts`-модули напрямую: Node 24 стирает типы без флага, а `--no-warnings` в
 * npm-скрипте глушит служебное предупреждение. Все четыре импортируемых файла адресно копируются
 * в рабочий образ (см. `Dockerfile`) — без этого production-запуск упал бы с `ERR_MODULE_NOT_FOUND`.
 */
import { SOLUTION_PATH_BY_DEPARTMENT_ID } from "../src/content/solutionPaths.ts";
import { LEGACY_REDIRECTS } from "../src/lib/legacyRedirects.ts";
import { submitIndexNowCore } from "../src/server/indexnow/core.ts";
import {
  isXmlContentType,
  parseSitemapLocations,
  preflightIndexNow,
} from "../src/server/indexnow/preflight.ts";

const REQUEST_TIMEOUT_MS = 5_000;
const silentLogger = { info() {}, error() {} };

const dryRun = process.argv.slice(2).includes("--dry-run");
const mode = dryRun ? "dry-run" : "submit";

/**
 * Отказ. `details` попадают в вывод целиком: без них «unexpected-sitemap-size» прошлой редакции
 * не позволял понять, что именно сломалось, без ручного обхода карты сайта.
 *
 * Ключ сюда не попадает никогда — он не участвует ни в одном из сообщений.
 */
function safeFailure(reason, details = []) {
  console.error(
    JSON.stringify({ event: "indexnow.batch", mode, ok: false, submitted: false, reason, details }),
  );
  process.exitCode = 1;
}

async function fetchWithTimeout(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function main() {
  // ─── 1. Конфигурация ─────────────────────────────────────────────────────────────────────────
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  const host = process.env.INDEXNOW_HOST?.trim().toLowerCase() ?? "";
  const endpoint = process.env.INDEXNOW_ENDPOINT?.trim() ?? "";
  const origin = `https://${host}`;

  if (!key || !host || !endpoint) {
    safeFailure("not-configured", ["не заданы INDEXNOW_KEY, INDEXNOW_HOST или INDEXNOW_ENDPOINT"]);
    return;
  }

  // ─── 2. Файл подтверждения владения ──────────────────────────────────────────────────────────
  const keyResponse = await fetchWithTimeout(`${origin}/${key}.txt`);
  if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) {
    safeFailure("key-file-unavailable", [
      `файл подтверждения по ${origin} недоступен или не совпал`,
    ]);
    return;
  }

  // ─── 3. Карта сайта: код ответа ──────────────────────────────────────────────────────────────
  const sitemapResponse = await fetchWithTimeout(`${origin}/sitemap.xml`);
  if (!sitemapResponse.ok) {
    safeFailure("sitemap-unavailable", [`sitemap.xml ответил ${sitemapResponse.status}`]);
    return;
  }

  // ─── 4. Карта сайта: тип содержимого ─────────────────────────────────────────────────────────
  //
  // Без этой проверки HTML-страница ошибки, отданная с кодом 200, разобралась бы в пустой список.
  const contentType = sitemapResponse.headers.get("content-type");
  if (!isXmlContentType(contentType)) {
    safeFailure("sitemap-not-xml", [`content-type карты сайта: ${contentType ?? "отсутствует"}`]);
    return;
  }

  // ─── 5. Разбор ───────────────────────────────────────────────────────────────────────────────
  const locations = parseSitemapLocations(await sitemapResponse.text());

  // ─── 6. Семантическая проверка состава ───────────────────────────────────────────────────────
  //
  // Адреса отделов берутся из таблицы `SOLUTION_PATH_BY_DEPARTMENT_ID` — того же источника, что
  // проверяет схема контента. Второго списка адресов в проекте нет.
  const preflight = preflightIndexNow({
    locations,
    host,
    endpoint,
    solutionPaths: Object.values(SOLUTION_PATH_BY_DEPARTMENT_ID),
    legacySources: LEGACY_REDIRECTS.map(({ source }) => source),
  });
  if (!preflight.ok) {
    safeFailure(preflight.reason, preflight.details);
    return;
  }

  // ─── 7. Legacy-редиректы ─────────────────────────────────────────────────────────────────────
  //
  // Проверяются ПОСЛЕ состава карты: если карта сломана, ходить по шести адресам незачем.
  const legacyUrls = LEGACY_REDIRECTS.map(({ source }) => `${origin}${source}`);
  const redirectChecks = await Promise.all(
    legacyUrls.map((url) => fetchWithTimeout(url, { method: "HEAD", redirect: "manual" })),
  );
  const brokenRedirects = legacyUrls.filter((url, index) => {
    const status = redirectChecks[index].status;
    return status !== 301 && status !== 308;
  });
  if (brokenRedirects.length > 0) {
    safeFailure(
      "legacy-redirect-unavailable",
      brokenRedirects.map((url) => `не отвечает 301/308: ${url}`),
    );
    return;
  }

  // ─── 8. Пакет ────────────────────────────────────────────────────────────────────────────────
  const { urls, stats } = preflight;
  const report = { event: "indexnow.batch", mode, ...stats };

  // ─── 9. Отправка ─────────────────────────────────────────────────────────────────────────────
  //
  // Единственная точка, из которой выполняется запрос к IndexNow. Любой отказ выше сюда не доходит.
  if (dryRun) {
    console.info(JSON.stringify({ ...report, ok: true, submitted: false, urls }, null, 2));
    return;
  }

  const result = await submitIndexNowCore(urls, { logger: silentLogger });
  const submitted = {
    ...report,
    ok: result.ok,
    submitted: true,
    status: result.status,
    attempts: result.attempts,
  };

  if (result.ok) console.info(JSON.stringify(submitted));
  else {
    console.error(JSON.stringify(submitted));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  safeFailure("unexpected-error", [error instanceof Error ? error.name : "UnknownError"]);
});
