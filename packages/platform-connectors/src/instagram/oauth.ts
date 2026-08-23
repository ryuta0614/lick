import { instagramApiRequest, type InstagramFetchImpl } from "./client.js";
import { getInstagramAuthorizeBaseUrl, type InstagramConfig } from "./config.js";
import { InstagramTokenResponseSchema } from "./schemas.js";
import type { InstagramTokenExchangeResult } from "./types.js";

/**
 * Scopes for Facebook Login for Business, requested for the MVP: list the
 * user's Pages, read basic Instagram info, and publish Instagram content.
 * `pages_read_engagement` is required by Meta to read `instagram_business_account`
 * off a Page via /me/accounts.
 */
const OAUTH_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"] as const;

/**
 * Builds the Facebook Login for Business authorization URL. `state` must be
 * a random, unguessable, short-lived value the caller verifies on callback
 * for CSRF protection (same pattern as Threads' OAuth).
 */
export function buildInstagramAuthorizeUrl(
  config: Pick<InstagramConfig, "clientId" | "redirectUri">,
  state: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = new URL("/dialog/oauth", getInstagramAuthorizeBaseUrl(env));
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

/** GET https://graph.facebook.com/{version}/oauth/access_token — exchanges the authorization code for a short-lived user token. */
export async function exchangeInstagramCodeForToken(
  config: Pick<InstagramConfig, "apiBaseUrl" | "apiVersion" | "clientId" | "clientSecret" | "redirectUri">,
  code: string,
  fetchImpl: InstagramFetchImpl = fetch,
): Promise<InstagramTokenExchangeResult> {
  const result = await instagramApiRequest(
    { apiBaseUrl: config.apiBaseUrl, apiVersion: config.apiVersion },
    {
      method: "GET",
      path: "/oauth/access_token",
      searchParams: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      },
    },
    InstagramTokenResponseSchema,
    fetchImpl,
  );
  return toExchangeResult(result.access_token, result.expires_in);
}

/** GET https://graph.facebook.com/{version}/oauth/access_token?grant_type=fb_exchange_token — exchanges for a long-lived (~60d) user token. */
export async function exchangeForLongLivedInstagramToken(
  config: Pick<InstagramConfig, "apiBaseUrl" | "apiVersion" | "clientId" | "clientSecret">,
  shortLivedAccessToken: string,
  fetchImpl: InstagramFetchImpl = fetch,
): Promise<InstagramTokenExchangeResult> {
  const result = await instagramApiRequest(
    { apiBaseUrl: config.apiBaseUrl, apiVersion: config.apiVersion },
    {
      method: "GET",
      path: "/oauth/access_token",
      searchParams: {
        grant_type: "fb_exchange_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        fb_exchange_token: shortLivedAccessToken,
      },
    },
    InstagramTokenResponseSchema,
    fetchImpl,
  );
  return toExchangeResult(result.access_token, result.expires_in);
}

function toExchangeResult(accessToken: string, expiresInSeconds: number | undefined): InstagramTokenExchangeResult {
  // Meta Page access tokens obtained via a long-lived user token effectively don't expire; fall back to a
  // generous 60-day window (matching the user-token exchange it derives from) when expires_in is absent.
  const seconds = expiresInSeconds ?? 60 * 24 * 60 * 60;
  return { accessToken, expiresAt: new Date(Date.now() + seconds * 1000) };
}
