import { PlatformAuthError, PlatformRateLimitError, PlatformServerError, PlatformValidationError } from "@social-growth-os/shared";
import { XApiErrorBodySchema } from "./schemas.js";

/**
 * Converts a non-2xx X API response into the app's standard error taxonomy
 * (CLAUDE.md section 32), mirroring threads/errors.ts. X mostly relies on
 * the HTTP status code itself (401/429/4xx/5xx) rather than an in-body
 * error code the way Meta's Graph API does, so classification here leans
 * on `response.status`; the response body is only used for the message.
 */
export async function classifyXErrorResponse(response: Response): Promise<Error> {
  const rawBody: unknown = await response.json().catch(() => undefined);
  const parsed = XApiErrorBodySchema.safeParse(rawBody);
  const body = parsed.success ? parsed.data : undefined;

  const message =
    body?.detail ?? body?.errors?.[0]?.message ?? body?.title ?? `X API request failed with HTTP ${response.status} ${response.statusText}`;

  if (response.status === 401) {
    return new PlatformAuthError(message);
  }

  if (response.status === 429) {
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
 * Distinguishes a fetch()-level failure (network error, timeout, DNS — no
 * HTTP response was ever received) from a definitive HTTP error response.
 * Callers use `instanceof` to detect this case, e.g. to avoid blindly
 * retrying a publish call whose outcome is unknown (CLAUDE.md STEP 9).
 */
export class XNetworkError extends PlatformServerError {}

/** Wraps a fetch()-level failure (network error, timeout, DNS, etc.) — no HTTP response was ever received. */
export function wrapXNetworkError(cause: unknown, context: string): XNetworkError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new XNetworkError(`Network error calling X API (${context}): ${message}`, cause);
}
