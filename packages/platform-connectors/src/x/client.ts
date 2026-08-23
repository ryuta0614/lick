import type { ZodType } from "zod";
import { logger, PlatformServerError } from "@social-growth-os/shared";
import { classifyXErrorResponse, wrapXNetworkError } from "./errors.js";
import {
  XDeleteResponseSchema,
  XTweetCreateResponseSchema,
  XTweetGetResponseSchema,
  XUserResponseSchema,
  type XTweetGetResponse,
} from "./schemas.js";
import type { XTweet, XUserIdentity } from "./types.js";

/** Named distinctly from threads/client.ts's XFetchImpl so both can be re-exported from the package root without collision. */
export type XFetchImpl = typeof fetch;

const DEFAULT_TIMEOUT_MS = 15_000;

type RequestOptions = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  accessToken?: string;
  searchParams?: Record<string, string | undefined>;
  jsonBody?: unknown;
  formBody?: Record<string, string | undefined>;
  /** HTTP Basic auth for the OAuth token endpoint (confidential clients only). */
  basicAuth?: { username: string; password: string };
};

/**
 * Single low-level entry point for every X HTTP call. Centralizes URL
 * construction, auth, timeout, error classification, and Zod-validated
 * parsing (mirrors packages/platform-connectors/src/threads/client.ts).
 *
 * The access token is always sent via the `Authorization: Bearer` header,
 * never as a query parameter, so it can never leak into URL-based logs.
 */
export async function xApiRequest<T>(
  config: { apiBaseUrl: string },
  options: RequestOptions,
  schema: ZodType<T>,
  fetchImpl: XFetchImpl = fetch,
): Promise<T> {
  const url = new URL(`${stripTrailingSlash(config.apiBaseUrl)}${options.path}`);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {};
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.basicAuth) {
    const credentials = Buffer.from(`${options.basicAuth.username}:${options.basicAuth.password}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }

  let body: string | undefined;
  if (options.jsonBody !== undefined) {
    body = JSON.stringify(options.jsonBody);
    headers["Content-Type"] = "application/json";
  } else if (options.formBody) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(options.formBody)) {
      if (value !== undefined) form.set(key, value);
    }
    body = form.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(url, { method: options.method, headers, body, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
  } catch (error) {
    logger.warn("x.request.network_error", { path: options.path, method: options.method, durationMs: Date.now() - startedAt });
    throw wrapXNetworkError(error, `${options.method} ${options.path}`);
  }

  logger.info("x.request", {
    provider: "x",
    path: options.path,
    method: options.method,
    statusCode: response.status,
    durationMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    throw await classifyXErrorResponse(response);
  }

  const rawJson: unknown = await response.json().catch((error: unknown) => {
    throw new PlatformServerError(`X API returned a non-JSON response for ${options.method} ${options.path}`, error);
  });

  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    throw new PlatformServerError(
      `X API response for ${options.method} ${options.path} did not match the expected shape: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * Stateless wrapper over the X Tweets/Users v2 endpoints. Access tokens are
 * passed per-call rather than baked into the client, so one client
 * instance is safe to reuse across accounts.
 */
export class XApiClient {
  constructor(
    private readonly config: { apiBaseUrl: string },
    private readonly fetchImpl: XFetchImpl = fetch,
  ) {}

  /** POST /2/tweets — creates a tweet in one call (no separate container step, unlike Threads). */
  async createTweet(accessToken: string, text: string): Promise<XTweet> {
    const result = await xApiRequest(
      this.config,
      { method: "POST", path: "/2/tweets", accessToken, jsonBody: { text } },
      XTweetCreateResponseSchema,
      this.fetchImpl,
    );
    return result.data;
  }

  /** DELETE /2/tweets/:id — officially documented, unlike Threads' undocumented delete support. */
  async deleteTweet(accessToken: string, tweetId: string): Promise<void> {
    await xApiRequest(
      this.config,
      { method: "DELETE", path: `/2/tweets/${tweetId}`, accessToken },
      XDeleteResponseSchema,
      this.fetchImpl,
    );
  }

  /** GET /2/tweets/:id — with public_metrics + created_at requested explicitly. */
  async getTweet(
    accessToken: string,
    tweetId: string,
  ): Promise<XTweet & { publicMetrics?: XTweetGetResponse["data"]["public_metrics"] }> {
    const result = await xApiRequest(
      this.config,
      { method: "GET", path: `/2/tweets/${tweetId}`, accessToken, searchParams: { "tweet.fields": "public_metrics,created_at" } },
      XTweetGetResponseSchema,
      this.fetchImpl,
    );
    return {
      id: result.data.id,
      text: result.data.text,
      createdAt: result.data.created_at ? new Date(result.data.created_at) : undefined,
      publicMetrics: result.data.public_metrics,
    };
  }

  /** GET /2/users/me — identifies which X user a token belongs to (used right after OAuth). */
  async getUser(accessToken: string): Promise<XUserIdentity> {
    const result = await xApiRequest(
      this.config,
      { method: "GET", path: "/2/users/me", accessToken },
      XUserResponseSchema,
      this.fetchImpl,
    );
    return result.data;
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
