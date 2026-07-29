import "server-only";

import { submitIndexNowCore, type IndexNowResult } from "./core";

/** Server-only, best-effort IndexNow notification. It never throws into an admin API response. */
export async function submitIndexNow(urls: readonly string[]): Promise<IndexNowResult> {
  try {
    return await submitIndexNowCore(urls);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "indexnow.submit",
        ok: false,
        reason: "unexpected-error",
        error: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return { ok: false, status: null, attempts: 0, urlCount: 0, reason: "request-failed" };
  }
}
