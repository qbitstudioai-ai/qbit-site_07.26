import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS } from "@/lib/legacyRedirects";
import { absolute, productionSitemapUrls } from "@/tests/fixtures/sitemapSnapshot";

/**
 * Проверка НАСТОЯЩЕГО скрипта `scripts/indexnow-submit-current.mjs`, а не его логики по частям.
 *
 * Два требования нельзя доказать unit-тестом чистых функций:
 *
 * 1. «Ни одного запроса к endpoint IndexNow, пока не пройдены все проверки» — это свойство
 *    вызывающей стороны, а не предполётного модуля;
 * 2. `--dry-run` действительно ничего не отправляет.
 *
 * Поэтому скрипт запускается обычным Node 24 (без Vite и без трансформации Vitest) с подменённым
 * `fetch`. Побочно это доказывает третье: импорт четырёх `.ts`-модулей из `.mjs` работает на том же
 * рантайме, что и в рабочем образе, — то есть production-запуск не упадёт с `ERR_MODULE_NOT_FOUND`.
 */

const KEY = "a".repeat(32);
const ENDPOINT = "https://api.indexnow.org/indexnow";
// `process.cwd()`, а не `import.meta.url`: тесты идут в окружении jsdom, где `import.meta.url` не
// файловый адрес. Vitest запускается из корня проекта — это зафиксировано проверкой ниже.
const projectRoot = process.cwd();
const scriptPath = path.join(projectRoot, "scripts", "indexnow-submit-current.mjs");
const stubPath = path.join(projectRoot, "src", "tests", "fixtures", "indexnowFetchStub.mjs");
// `--import` принимает URL, а не путь: на Windows абсолютный `C:\...` Node читает как схему `c:`
// и падает с `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
const stubUrl = pathToFileURL(stubPath).href;
const workDir = mkdtempSync(path.join(tmpdir(), "indexnow-script-"));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

interface RunOutcome {
  status: number;
  stdout: string;
  stderr: string;
  report: Record<string, unknown>;
  /** Сколько раз скрипт обратился к endpoint IndexNow. Ключевая величина этого файла. */
  endpointCalls: number;
}

let runCounter = 0;

function runScript(scenario: Record<string, unknown>, args: string[] = []): RunOutcome {
  runCounter += 1;
  const recordPath = path.join(workDir, `calls-${runCounter}.json`);
  const merged = {
    key: KEY,
    endpoint: ENDPOINT,
    sitemapUrls: productionSitemapUrls(),
    ...scenario,
  };

  let status = 0;
  let stdout = "";
  let stderr = "";
  try {
    stdout = execFileSync(
      process.execPath,
      ["--no-warnings", "--import", stubUrl, scriptPath, ...args],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          INDEXNOW_KEY: KEY,
          INDEXNOW_HOST: "allqbit.ru",
          INDEXNOW_ENDPOINT: ENDPOINT,
          INDEXNOW_TEST_SCENARIO: JSON.stringify(merged),
          INDEXNOW_TEST_RECORD: recordPath,
        },
      },
    );
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    status = failure.status ?? 1;
    stdout = failure.stdout ?? "";
    stderr = failure.stderr ?? "";
  }

  let calls: { url: string; method: string }[] = [];
  try {
    calls = JSON.parse(readFileSync(recordPath, "utf8")) as typeof calls;
  } catch {
    calls = [];
  }

  const output = (stdout + stderr).trim();
  const jsonStart = output.indexOf("{");
  const report =
    jsonStart === -1 ? {} : (JSON.parse(output.slice(jsonStart)) as Record<string, unknown>);

  return {
    status,
    stdout,
    stderr,
    report,
    endpointCalls: calls.filter((call) => call.url === ENDPOINT).length,
  };
}

describe("scripts/indexnow-submit-current.mjs — отправка", () => {
  it("запускается из корня проекта", () => {
    // Сторож для `projectRoot`: если рабочий каталог окажется другим, упадёт этот тест с внятной
    // причиной, а не десять следующих с «файл не найден».
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(stubPath)).toBe(true);
  });

  it("отправляет пакет, когда все проверки пройдены", () => {
    const outcome = runScript({});

    expect(outcome.status).toBe(0);
    expect(outcome.endpointCalls).toBe(1);
    expect(outcome.report).toMatchObject({
      event: "indexnow.batch",
      mode: "submit",
      ok: true,
      submitted: true,
      canonicalCount: 39,
      legacyCount: LEGACY_REDIRECTS.length,
      urlCount: 39 + LEGACY_REDIRECTS.length,
      status: 200,
    });
  });

  it("сообщает отказ endpoint ненулевым кодом возврата", () => {
    const outcome = runScript({ endpointStatus: 403 });

    expect(outcome.status).toBe(1);
    expect(outcome.endpointCalls).toBe(1);
    expect(outcome.report).toMatchObject({ ok: false, submitted: true, status: 403 });
  });
});

describe("scripts/indexnow-submit-current.mjs — fail-closed", () => {
  const failures: [string, Record<string, unknown>, string][] = [
    ["файл подтверждения отвечает 404", { keyFileStatus: 404 }, "key-file-unavailable"],
    [
      "файл подтверждения содержит чужой ключ",
      { keyFileBody: "wrong-key" },
      "key-file-unavailable",
    ],
    ["карта сайта недоступна", { sitemapStatus: 500 }, "sitemap-unavailable"],
    [
      "карта сайта отдана как HTML",
      { sitemapContentType: "text/html; charset=utf-8" },
      "sitemap-not-xml",
    ],
    ["карта сайта пуста", { sitemapUrls: [] }, "sitemap-empty"],
    [
      "в карте чужой host",
      { sitemapUrls: [...productionSitemapUrls(), "https://example.com/x"] },
      "url-foreign-host",
    ],
    [
      "в карте служебный адрес",
      { sitemapUrls: [...productionSitemapUrls(), absolute("/admin")] },
      "url-forbidden-path",
    ],
    [
      "в карте нет обязательного отдела",
      {
        sitemapUrls: productionSitemapUrls().filter(
          (url) => url !== absolute("/solutions/logistics"),
        ),
      },
      "missing-required-url",
    ],
    [
      "раздел кейсов пуст",
      {
        sitemapUrls: productionSitemapUrls().filter(
          (url) => !new URL(url).pathname.startsWith("/cases/"),
        ),
      },
      "section-empty",
    ],
    [
      "legacy-редирект перестал редиректить",
      { redirectStatus: 200 },
      "legacy-redirect-unavailable",
    ],
  ];

  it.each(failures)("не обращается к endpoint, если %s", (_label, scenario, reason) => {
    const outcome = runScript(scenario);

    expect(outcome.status).toBe(1);
    expect(outcome.report).toMatchObject({ ok: false, submitted: false, reason });
    // Главное утверждение всего файла.
    expect(outcome.endpointCalls).toBe(0);
  });

  it("не обращается к endpoint при non-https endpoint", () => {
    const badEndpoint = "http://api.indexnow.org/indexnow";
    const recordPath = path.join(workDir, "calls-bad-endpoint.json");

    let status = 0;
    let stderr = "";
    try {
      execFileSync(process.execPath, ["--no-warnings", "--import", stubUrl, scriptPath], {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          INDEXNOW_KEY: KEY,
          INDEXNOW_HOST: "allqbit.ru",
          INDEXNOW_ENDPOINT: badEndpoint,
          INDEXNOW_TEST_SCENARIO: JSON.stringify({
            key: KEY,
            endpoint: badEndpoint,
            sitemapUrls: productionSitemapUrls(),
          }),
          INDEXNOW_TEST_RECORD: recordPath,
        },
      });
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      status = failure.status ?? 1;
      stderr = failure.stderr ?? "";
    }

    const calls = JSON.parse(readFileSync(recordPath, "utf8")) as { url: string }[];

    expect(status).toBe(1);
    expect(stderr).toContain("endpoint-not-https");
    expect(calls.filter((call) => call.url === badEndpoint)).toHaveLength(0);
  });

  it("никогда не печатает ключ", () => {
    const outcome = runScript({ keyFileStatus: 404 });

    expect(outcome.stdout + outcome.stderr).not.toContain(KEY);
  });
});

describe("scripts/indexnow-submit-current.mjs — dry-run", () => {
  it("выполняет все проверки и не отправляет ничего", () => {
    const outcome = runScript({}, ["--dry-run"]);

    expect(outcome.status).toBe(0);
    expect(outcome.endpointCalls).toBe(0);
    expect(outcome.report).toMatchObject({
      mode: "dry-run",
      ok: true,
      submitted: false,
      canonicalCount: 39,
      duplicatesDropped: 0,
      legacyCount: LEGACY_REDIRECTS.length,
      urlCount: 39 + LEGACY_REDIRECTS.length,
    });
    expect((outcome.report.urls as string[]).length).toBe(39 + LEGACY_REDIRECTS.length);
  });

  it("проверяет legacy-редиректы и в dry-run", () => {
    const outcome = runScript({ redirectStatus: 200 }, ["--dry-run"]);

    expect(outcome.status).toBe(1);
    expect(outcome.report).toMatchObject({
      mode: "dry-run",
      ok: false,
      reason: "legacy-redirect-unavailable",
    });
    expect(outcome.endpointCalls).toBe(0);
  });
});
