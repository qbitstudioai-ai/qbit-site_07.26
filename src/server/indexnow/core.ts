export const INDEXNOW_TIMEOUT_MS = 5_000;
export const INDEXNOW_MAX_RETRIES = 2;

const KEY_PATTERN = /^[A-Za-z0-9-]{32,64}$/;
const DEFAULT_RETRY_DELAY_MS = 250;

export interface IndexNowConfig {
  key: string;
  host: string;
  endpoint: string;
}

export interface IndexNowResult {
  ok: boolean;
  status: number | null;
  attempts: number;
  urlCount: number;
  reason?: "not-configured" | "invalid-url" | "request-failed";
}

interface IndexNowDependencies {
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, "info" | "error">;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

function loadConfig(): IndexNowConfig | null {
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  const host = process.env.INDEXNOW_HOST?.trim().toLowerCase() ?? "";
  const endpoint = process.env.INDEXNOW_ENDPOINT?.trim() ?? "";

  if (!KEY_PATTERN.test(key) || !host || !endpoint) return null;
  return { key, host, endpoint };
}

function prepareUrls(urls: readonly string[], host: string): string[] | null {
  const unique = new Set<string>();

  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== host || url.port) return null;
      url.hash = "";
      unique.add(url.href);
    } catch {
      return null;
    }
  }

  return [...unique];
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function submitIndexNowCore(
  urls: readonly string[],
  dependencies: IndexNowDependencies = {},
): Promise<IndexNowResult> {
  const logger = dependencies.logger ?? console;
  const config = loadConfig();

  if (!config) {
    logger.error(JSON.stringify({ event: "indexnow.submit", ok: false, reason: "not-configured" }));
    return { ok: false, status: null, attempts: 0, urlCount: 0, reason: "not-configured" };
  }

  const urlList = prepareUrls(urls, config.host);
  if (!urlList) {
    logger.error(JSON.stringify({ event: "indexnow.submit", ok: false, reason: "invalid-url" }));
    return { ok: false, status: null, attempts: 0, urlCount: 0, reason: "invalid-url" };
  }

  if (urlList.length === 0) return { ok: true, status: null, attempts: 0, urlCount: 0 };

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep = dependencies.sleep ?? defaultSleep;
  const now = dependencies.now ?? Date.now;
  const payload = {
    host: config.host,
    key: config.key,
    keyLocation: `https://${config.host}/${config.key}.txt`,
    urlList,
  };

  for (let attempt = 1; attempt <= INDEXNOW_MAX_RETRIES + 1; attempt += 1) {
    const startedAt = now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INDEXNOW_TIMEOUT_MS);

    try {
      const response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const ok = response.status === 200 || response.status === 202;
      logger.info(
        JSON.stringify({
          event: "indexnow.submit",
          urlCount: urlList.length,
          status: response.status,
          attempt,
          durationMs: now() - startedAt,
          ok,
        }),
      );

      if (ok)
        return { ok: true, status: response.status, attempts: attempt, urlCount: urlList.length };
      if (!isRetryable(response.status) || attempt > INDEXNOW_MAX_RETRIES) {
        return {
          ok: false,
          status: response.status,
          attempts: attempt,
          urlCount: urlList.length,
          reason: "request-failed",
        };
      }
    } catch (error) {
      logger.error(
        JSON.stringify({
          event: "indexnow.submit",
          urlCount: urlList.length,
          status: null,
          attempt,
          durationMs: now() - startedAt,
          ok: false,
          error: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      if (attempt > INDEXNOW_MAX_RETRIES) {
        return {
          ok: false,
          status: null,
          attempts: attempt,
          urlCount: urlList.length,
          reason: "request-failed",
        };
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
  }

  return {
    ok: false,
    status: null,
    attempts: 0,
    urlCount: urlList.length,
    reason: "request-failed",
  };
}
