import { LEGACY_REDIRECTS } from "../src/lib/legacyRedirects.ts";
import { submitIndexNowCore } from "../src/server/indexnow/core.ts";

const EXPECTED_CANONICAL_URLS = 23;
const REQUEST_TIMEOUT_MS = 5_000;
const silentLogger = { info() {}, error() {} };

function safeFailure(reason) {
  console.error(JSON.stringify({ event: "indexnow.batch", ok: false, reason }));
  process.exitCode = 1;
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    match[1].replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").trim(),
  );
}

async function fetchWithTimeout(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function main() {
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  const host = process.env.INDEXNOW_HOST?.trim().toLowerCase() ?? "";
  const origin = `https://${host}`;

  if (!key || !host || !process.env.INDEXNOW_ENDPOINT) {
    safeFailure("not-configured");
    return;
  }

  const keyResponse = await fetchWithTimeout(`${origin}/${key}.txt`);
  if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) {
    safeFailure("key-file-unavailable");
    return;
  }

  const sitemapResponse = await fetchWithTimeout(`${origin}/sitemap.xml`);
  if (!sitemapResponse.ok) {
    safeFailure("sitemap-unavailable");
    return;
  }

  const canonicalUrls = [...new Set(sitemapLocations(await sitemapResponse.text()))];
  if (canonicalUrls.length !== EXPECTED_CANONICAL_URLS) {
    safeFailure("unexpected-sitemap-size");
    return;
  }

  const legacyUrls = LEGACY_REDIRECTS.map(({ source }) => `${origin}${source}`);
  const redirectChecks = await Promise.all(
    legacyUrls.map((url) => fetchWithTimeout(url, { method: "HEAD", redirect: "manual" })),
  );
  if (redirectChecks.some((response) => response.status !== 301 && response.status !== 308)) {
    safeFailure("legacy-redirect-unavailable");
    return;
  }

  const urlList = [...new Set([...canonicalUrls, ...legacyUrls])];
  const result = await submitIndexNowCore(urlList, { logger: silentLogger });
  const report = {
    event: "indexnow.batch",
    ok: result.ok,
    canonicalCount: canonicalUrls.length,
    legacyCount: legacyUrls.length,
    urlCount: urlList.length,
    status: result.status,
    attempts: result.attempts,
  };

  if (result.ok) console.info(JSON.stringify(report));
  else {
    console.error(JSON.stringify(report));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  safeFailure(error instanceof Error ? error.name : "unexpected-error");
});
