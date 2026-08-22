import type { ZodType } from "zod";
import { logger, PlatformServerError } from "@social-growth-os/shared";
import { classifyThreadsErrorResponse, wrapNetworkError } from "./errors.js";
import {
  ThreadsContainerResponseSchema,
  ThreadsInsightsResponseSchema,
  ThreadsPublishResponseSchema,
  ThreadsUserResponseSchema,
  type ThreadsInsightsResponse,
} from "./schemas.js";
import type { ThreadsPostInsights, ThreadsPublishedPost, ThreadsTextContainer, ThreadsUserIdentity } from "./types.js";

export type FetchImpl = typeof fetch;

const DEFAULT_TIMEOUT_MS = 15_000;

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  accessToken?: string;
  searchParams?: Record<string, string | undefined>;
  formBody?: Record<string, string | undefined>;
  /** Overrides `${apiBaseUrl}/${apiVersion}` entirely — used for the OAuth endpoints, which are unversioned. */
  baseUrlOverride?: string;
};

/**
 * Single low-level entry point for every Threads HTTP call. Centralizes URL
 * construction, auth header, timeout, error classification, and
 * Zod-validated parsing (never trust unvalidated JSON — CLAUDE.md section 8
 * applied to third-party responses too).
 *
 * The access token is always sent via the `Authorization: Bearer` header,
 * never as a query parameter, so it can never leak into URL-based logs
 * (CLAUDE.md STEP 5).
 */
export async function threadsApiRequest<T>(
  config: { apiBaseUrl: string; apiVersion: string },
  options: RequestOptions,
  schema: ZodType<T>,
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const base = options.baseUrlOverride ? stripTrailingSlash(options.baseUrlOverride) : buildVersionedBase(config);
  const url = new URL(`${base}${options.path}`);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {};
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let body: string | undefined;
  if (options.formBody) {
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
    response = await fetchImpl(url, {
      method: options.method,
      headers,
      body,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn("threads.request.network_error", {
      path: options.path,
      method: options.method,
      durationMs: Date.now() - startedAt,
    });
    throw wrapNetworkError(error, `${options.method} ${options.path}`);
  }

  logger.info("threads.request", {
    provider: "threads",
    path: options.path,
    method: options.method,
    statusCode: response.status,
    durationMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    throw await classifyThreadsErrorResponse(response);
  }

  const rawJson: unknown = await response.json().catch((error: unknown) => {
    throw new PlatformServerError(`Threads API returned a non-JSON response for ${options.method} ${options.path}`, error);
  });

  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    throw new PlatformServerError(
      `Threads API response for ${options.method} ${options.path} did not match the expected shape: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * Stateless wrapper over the Threads publishing/identity/insights
 * endpoints. Access tokens are passed per-call rather than baked into the
 * client, so one client instance is safe to reuse across accounts.
 */
export class ThreadsApiClient {
  constructor(
    private readonly config: { apiBaseUrl: string; apiVersion: string },
    private readonly fetchImpl: FetchImpl = fetch,
  ) {}

  /** POST /{threads-user-id}/threads — step 1 of 2 of the publish flow (TEXT only for now). */
  async createTextContainer(threadsUserId: string, accessToken: string, text: string): Promise<ThreadsTextContainer> {
    return threadsApiRequest(
      this.config,
      { method: "POST", path: `/${threadsUserId}/threads`, accessToken, formBody: { media_type: "TEXT", text } },
      ThreadsContainerResponseSchema,
      this.fetchImpl,
    );
  }

  /** POST /{threads-user-id}/threads_publish — step 2 of 2. Deliberately separate from container creation (CLAUDE.md STEP 3). */
  async publishContainer(threadsUserId: string, accessToken: string, creationId: string): Promise<ThreadsPublishedPost> {
    return threadsApiRequest(
      this.config,
      { method: "POST", path: `/${threadsUserId}/threads_publish`, accessToken, formBody: { creation_id: creationId } },
      ThreadsPublishResponseSchema,
      this.fetchImpl,
    );
  }

  /** GET /me — identifies which Threads user a token belongs to (used right after OAuth). */
  async getUser(accessToken: string): Promise<ThreadsUserIdentity> {
    return threadsApiRequest(
      this.config,
      { method: "GET", path: "/me", accessToken, searchParams: { fields: "id,username" } },
      ThreadsUserResponseSchema,
      this.fetchImpl,
    );
  }

  /** GET /{media-id}/insights — post-level metrics, normalized (CLAUDE.md STEP 11). */
  async getInsights(mediaId: string, accessToken: string): Promise<ThreadsPostInsights> {
    const response = await threadsApiRequest(
      this.config,
      {
        method: "GET",
        path: `/${mediaId}/insights`,
        accessToken,
        searchParams: { metric: "views,likes,replies,reposts,quotes" },
      },
      ThreadsInsightsResponseSchema,
      this.fetchImpl,
    );
    return normalizeInsightsResponse(response);
  }
}

function normalizeInsightsResponse(response: ThreadsInsightsResponse): ThreadsPostInsights {
  const byName = new Map(response.data.map((row) => [row.name, row.values?.[0]?.value ?? row.total_value?.value]));
  return {
    views: byName.get("views"),
    likes: byName.get("likes"),
    replies: byName.get("replies"),
    reposts: byName.get("reposts"),
    quotes: byName.get("quotes"),
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** `${apiBaseUrl}/${apiVersion}`, tolerant of an empty apiVersion (used by the unversioned OAuth endpoints). */
function buildVersionedBase(config: { apiBaseUrl: string; apiVersion: string }): string {
  const base = stripTrailingSlash(config.apiBaseUrl);
  const version = config.apiVersion.replace(/^\/+|\/+$/g, "");
  return version ? `${base}/${version}` : base;
}
