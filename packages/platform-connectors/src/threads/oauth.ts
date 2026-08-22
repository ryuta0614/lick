import { threadsApiRequest, type FetchImpl } from "./client.js";
import { getThreadsAuthorizeBaseUrl, type ThreadsConfig } from "./config.js";
import {
  ThreadsLongLivedTokenResponseSchema,
  ThreadsShortLivedTokenResponseSchema,
} from "./schemas.js";
import type { ThreadsLongLivedToken, ThreadsTokenExchangeResult } from "./types.js";

/** Scopes requested for the MVP: read the account's own identity, publish posts, read insights. */
const OAUTH_SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights"] as const;

/**
 * Builds the Meta authorization URL the user is redirected to. `state` must
 * be a random, unguessable, short-lived value the caller verifies on
 * callback for CSRF protection (CLAUDE.md STEP 6).
 */
export function buildThreadsAuthorizeUrl(
  config: Pick<ThreadsConfig, "clientId" | "redirectUri">,
  state: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = new URL("/oauth/authorize", getThreadsAuthorizeBaseUrl(env));
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

/** POST https://graph.threads.net/oauth/access_token — exchanges the authorization code for a short-lived (~1h) token. */
export async function exchangeCodeForToken(
  config: Pick<ThreadsConfig, "apiBaseUrl" | "clientId" | "clientSecret" | "redirectUri">,
  code: string,
  fetchImpl: FetchImpl = fetch,
): Promise<ThreadsTokenExchangeResult> {
  const result = await threadsApiRequest(
    { apiBaseUrl: config.apiBaseUrl, apiVersion: "" },
    {
      method: "POST",
      path: "/oauth/access_token",
      formBody: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
        code,
      },
    },
    ThreadsShortLivedTokenResponseSchema,
    fetchImpl,
  );

  return { accessToken: result.access_token, userId: result.user_id != null ? String(result.user_id) : undefined };
}

/** GET https://graph.threads.net/access_token?grant_type=th_exchange_token — exchanges for a long-lived (~60d) token. */
export async function exchangeForLongLivedToken(
  config: Pick<ThreadsConfig, "apiBaseUrl" | "clientSecret">,
  shortLivedAccessToken: string,
  fetchImpl: FetchImpl = fetch,
): Promise<ThreadsLongLivedToken> {
  const result = await threadsApiRequest(
    { apiBaseUrl: config.apiBaseUrl, apiVersion: "" },
    {
      method: "GET",
      path: "/access_token",
      searchParams: {
        grant_type: "th_exchange_token",
        client_secret: config.clientSecret,
        access_token: shortLivedAccessToken,
      },
    },
    ThreadsLongLivedTokenResponseSchema,
    fetchImpl,
  );

  return { accessToken: result.access_token, expiresAt: new Date(Date.now() + result.expires_in * 1000) };
}

/**
 * GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token — refreshes a long-lived token.
 * Meta requires this to happen between 24h and 60d after issuance; outside
 * that window the user must re-authorize from scratch.
 */
export async function refreshLongLivedToken(
  config: Pick<ThreadsConfig, "apiBaseUrl">,
  longLivedAccessToken: string,
  fetchImpl: FetchImpl = fetch,
): Promise<ThreadsLongLivedToken> {
  const result = await threadsApiRequest(
    { apiBaseUrl: config.apiBaseUrl, apiVersion: "" },
    {
      method: "GET",
      path: "/refresh_access_token",
      searchParams: { grant_type: "th_refresh_token", access_token: longLivedAccessToken },
    },
    ThreadsLongLivedTokenResponseSchema,
    fetchImpl,
  );

  return { accessToken: result.access_token, expiresAt: new Date(Date.now() + result.expires_in * 1000) };
}
