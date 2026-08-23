import type { ZodType } from "zod";
import { logger, PlatformServerError } from "@social-growth-os/shared";
import { classifyInstagramErrorResponse, wrapInstagramNetworkError } from "./errors.js";
import {
  InstagramContainerResponseSchema,
  InstagramInsightsResponseSchema,
  InstagramMediaResponseSchema,
  InstagramPagesResponseSchema,
  InstagramPublishResponseSchema,
  InstagramUserResponseSchema,
  type InstagramInsightsResponse,
} from "./schemas.js";
import type {
  InstagramContainer,
  InstagramFacebookPage,
  InstagramMedia,
  InstagramPostInsights,
  InstagramPublishedMedia,
  InstagramUserIdentity,
} from "./types.js";

export type InstagramFetchImpl = typeof fetch;

const DEFAULT_TIMEOUT_MS = 15_000;

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  accessToken?: string;
  searchParams?: Record<string, string | undefined>;
  formBody?: Record<string, string | undefined>;
  /** Overrides `${apiBaseUrl}/${apiVersion}` entirely — used for the unversioned OAuth endpoints. */
  baseUrlOverride?: string;
};

/**
 * Single low-level entry point for every Instagram (Graph API) HTTP call.
 * Mirrors packages/platform-connectors/src/threads/client.ts exactly, since
 * Instagram Content Publishing runs on the same Graph API family.
 *
 * The access token is always sent via the `Authorization: Bearer` header,
 * never as a query parameter, so it can never leak into URL-based logs.
 */
export async function instagramApiRequest<T>(
  config: { apiBaseUrl: string; apiVersion: string },
  options: RequestOptions,
  schema: ZodType<T>,
  fetchImpl: InstagramFetchImpl = fetch,
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
    logger.warn("instagram.request.network_error", {
      path: options.path,
      method: options.method,
      durationMs: Date.now() - startedAt,
    });
    throw wrapInstagramNetworkError(error, `${options.method} ${options.path}`);
  }

  logger.info("instagram.request", {
    provider: "instagram",
    path: options.path,
    method: options.method,
    statusCode: response.status,
    durationMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    throw await classifyInstagramErrorResponse(response);
  }

  const rawJson: unknown = await response.json().catch((error: unknown) => {
    throw new PlatformServerError(`Instagram API returned a non-JSON response for ${options.method} ${options.path}`, error);
  });

  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    throw new PlatformServerError(
      `Instagram API response for ${options.method} ${options.path} did not match the expected shape: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * Stateless wrapper over the Instagram Content Publishing / identity /
 * insights endpoints. Access tokens are passed per-call rather than baked
 * into the client, so one client instance is safe to reuse across accounts.
 */
export class InstagramApiClient {
  constructor(
    private readonly config: { apiBaseUrl: string; apiVersion: string },
    private readonly fetchImpl: InstagramFetchImpl = fetch,
  ) {}

  /** POST /{ig-user-id}/media — creates a single-image container (step 1 of 2 of the publish flow). */
  async createImageContainer(igUserId: string, accessToken: string, imageUrl: string, caption?: string): Promise<InstagramContainer> {
    return instagramApiRequest(
      this.config,
      { method: "POST", path: `/${igUserId}/media`, accessToken, formBody: { image_url: imageUrl, caption } },
      InstagramContainerResponseSchema,
      this.fetchImpl,
    );
  }

  /** POST /{ig-user-id}/media with is_carousel_item=true — one child of a carousel; no caption on children. */
  async createCarouselItemContainer(igUserId: string, accessToken: string, imageUrl: string): Promise<InstagramContainer> {
    return instagramApiRequest(
      this.config,
      {
        method: "POST",
        path: `/${igUserId}/media`,
        accessToken,
        formBody: { image_url: imageUrl, is_carousel_item: "true" },
      },
      InstagramContainerResponseSchema,
      this.fetchImpl,
    );
  }

  /** POST /{ig-user-id}/media with media_type=CAROUSEL — the parent container referencing already-created children. */
  async createCarouselContainer(
    igUserId: string,
    accessToken: string,
    childContainerIds: string[],
    caption?: string,
  ): Promise<InstagramContainer> {
    return instagramApiRequest(
      this.config,
      {
        method: "POST",
        path: `/${igUserId}/media`,
        accessToken,
        formBody: { media_type: "CAROUSEL", children: childContainerIds.join(","), caption },
      },
      InstagramContainerResponseSchema,
      this.fetchImpl,
    );
  }

  /** POST /{ig-user-id}/media_publish — step 2 of 2. Deliberately separate from container creation (CLAUDE.md STEP 3 pattern). */
  async publishContainer(igUserId: string, accessToken: string, creationId: string): Promise<InstagramPublishedMedia> {
    return instagramApiRequest(
      this.config,
      { method: "POST", path: `/${igUserId}/media_publish`, accessToken, formBody: { creation_id: creationId } },
      InstagramPublishResponseSchema,
      this.fetchImpl,
    );
  }

  /** GET /{ig-user-id}?fields=id,username — identifies which Instagram Business Account a token can publish as. */
  async getUser(igUserId: string, accessToken: string): Promise<InstagramUserIdentity> {
    return instagramApiRequest(
      this.config,
      { method: "GET", path: `/${igUserId}`, accessToken, searchParams: { fields: "id,username" } },
      InstagramUserResponseSchema,
      this.fetchImpl,
    );
  }

  /** GET /{media-id}?fields=... — post-level metadata (caption, timestamp, permalink). */
  async getMedia(mediaId: string, accessToken: string): Promise<InstagramMedia> {
    const result = await instagramApiRequest(
      this.config,
      { method: "GET", path: `/${mediaId}`, accessToken, searchParams: { fields: "id,caption,timestamp,permalink,media_type" } },
      InstagramMediaResponseSchema,
      this.fetchImpl,
    );
    return {
      id: result.id,
      caption: result.caption,
      publishedAt: result.timestamp ? new Date(result.timestamp) : undefined,
      permalink: result.permalink,
    };
  }

  /**
   * GET /{media-id}/insights — post-level metrics, normalized (CLAUDE.md
   * STEP 11). Requested metrics are the stable, broadly-documented set;
   * exact availability varies by media type and API version — verify
   * against current docs before relying on this for production insights.
   */
  async getInsights(mediaId: string, accessToken: string): Promise<InstagramPostInsights> {
    const response = await instagramApiRequest(
      this.config,
      {
        method: "GET",
        path: `/${mediaId}/insights`,
        accessToken,
        searchParams: { metric: "impressions,reach,likes,comments,saved,shares" },
      },
      InstagramInsightsResponseSchema,
      this.fetchImpl,
    );
    return normalizeInsightsResponse(response);
  }

  /** GET /me/accounts?fields=... — the Facebook Pages this token's user manages, with each Page's linked IG Business Account. */
  async getFacebookPages(userAccessToken: string): Promise<InstagramFacebookPage[]> {
    const result = await instagramApiRequest(
      this.config,
      {
        method: "GET",
        path: "/me/accounts",
        accessToken: userAccessToken,
        searchParams: { fields: "id,name,access_token,instagram_business_account" },
      },
      InstagramPagesResponseSchema,
      this.fetchImpl,
    );
    return result.data.map((page) => ({
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      instagramBusinessAccountId: page.instagram_business_account?.id,
    }));
  }
}

function normalizeInsightsResponse(response: InstagramInsightsResponse): InstagramPostInsights {
  const byName = new Map(response.data.map((row) => [row.name, row.values?.[0]?.value ?? row.total_value?.value]));
  return {
    impressions: byName.get("impressions"),
    reach: byName.get("reach"),
    likes: byName.get("likes"),
    comments: byName.get("comments"),
    saved: byName.get("saved"),
    shares: byName.get("shares"),
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
