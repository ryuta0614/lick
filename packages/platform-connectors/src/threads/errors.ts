import {
  PlatformAuthError,
  PlatformRateLimitError,
  PlatformServerError,
  PlatformValidationError,
} from "@social-growth-os/shared";
import { ThreadsApiErrorBodySchema } from "./schemas.js";

/**
 * Well-known Meta Graph API error codes (shared across the whole Graph API
 * family, including Threads). Not guessed — these are the standard codes
 * documented across Meta's Graph API error handling guidance:
 *   190              = invalid/expired OAuth access token
 *   4, 17, 32, 613   = various application/user rate-limit conditions
 */
const GRAPH_API_AUTH_ERROR_CODE = 190;
const GRAPH_API_RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/**
 * Converts a non-2xx Threads API response into the app's standard error
 * taxonomy (CLAUDE.md STEP 10 / section 32). Never retries here — this only
 * classifies; the caller decides what to do.
 */
export async function classifyThreadsErrorResponse(response: Response): Promise<Error> {
  const rawBody: unknown = await response.json().catch(() => undefined);
  const parsed = ThreadsApiErrorBodySchema.safeParse(rawBody);
  const graphError = parsed.success ? parsed.data.error : undefined;

  const message =
    graphError?.message ?? `Threads API request failed with HTTP ${response.status} ${response.statusText}`;

  if (graphError?.code === GRAPH_API_AUTH_ERROR_CODE || response.status === 401) {
    return new PlatformAuthError(message);
  }

  if ((graphError?.code && GRAPH_API_RATE_LIMIT_CODES.has(graphError.code)) || response.status === 429) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    return new PlatformRateLimitError(message, Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
  }

  if (response.status >= 500) {
    return new PlatformServerError(message);
  }

  if (response.status >= 400) {
    return new PlatformValidationError(message);
  }

  // Non-2xx but not a recognized 4xx/5xx range — treat conservatively as a server-side issue (retryable).
  return new PlatformServerError(message);
}

/**
 * Distinguishes a fetch()-level failure (network error, timeout, DNS —  no
 * HTTP response was ever received) from a definitive HTTP error response.
 * Callers use `instanceof` to detect this case, e.g. to avoid blindly
 * retrying a publish call whose outcome is unknown (CLAUDE.md STEP 9).
 */
export class ThreadsNetworkError extends PlatformServerError {}

/** Wraps a fetch()-level failure (network error, timeout, DNS, etc.) — no HTTP response was ever received. */
export function wrapNetworkError(cause: unknown, context: string): ThreadsNetworkError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new ThreadsNetworkError(`Network error calling Threads API (${context}): ${message}`, cause);
}
