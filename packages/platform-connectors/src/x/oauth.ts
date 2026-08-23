import { xApiRequest, type XFetchImpl } from "./client.js";
import { getXAuthorizeBaseUrl, type XConfig } from "./config.js";
import { XTokenResponseSchema, type XTokenResponse } from "./schemas.js";
import type { XTokenExchangeResult } from "./types.js";

/** Scopes requested for the MVP: read own identity, read/write tweets, and offline.access for a refresh token. */
const OAUTH_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"] as const;

/**
 * Builds the X authorization URL the user is redirected to. `state` must be
 * a random, unguessable, short-lived value the caller verifies on callback
 * for CSRF protection; `codeChallenge` is the PKCE S256 challenge derived
 * from a `codeVerifier` the caller generates and holds onto until the
 * token exchange (X requires OAuth 2.0 Authorization Code + PKCE for all
 * apps, confidential or public).
 */
export function buildXAuthorizeUrl(
  config: Pick<XConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = new URL("/i/oauth2/authorize", getXAuthorizeBaseUrl(env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * POST https://api.x.com/2/oauth2/token (authorization_code grant).
 * `client_id` always goes in the body per X's docs; a confidential client
 * (one with a `clientSecret`) additionally authenticates via HTTP Basic —
 * a public/PKCE-only client relies on the code_verifier alone.
 */
export async function exchangeXCodeForToken(
  config: Pick<XConfig, "apiBaseUrl" | "clientId" | "clientSecret" | "redirectUri">,
  code: string,
  codeVerifier: string,
  fetchImpl: XFetchImpl = fetch,
): Promise<XTokenExchangeResult> {
  const result = await xApiRequest(
    { apiBaseUrl: config.apiBaseUrl },
    {
      method: "POST",
      path: "/2/oauth2/token",
      basicAuth: config.clientSecret ? { username: config.clientId, password: config.clientSecret } : undefined,
      formBody: {
        code,
        grant_type: "authorization_code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      },
    },
    XTokenResponseSchema,
    fetchImpl,
  );
  return toExchangeResult(result);
}

/** POST https://api.x.com/2/oauth2/token (refresh_token grant) — only possible when `offline.access` was granted. */
export async function refreshXAccessToken(
  config: Pick<XConfig, "apiBaseUrl" | "clientId" | "clientSecret">,
  refreshToken: string,
  fetchImpl: XFetchImpl = fetch,
): Promise<XTokenExchangeResult> {
  const result = await xApiRequest(
    { apiBaseUrl: config.apiBaseUrl },
    {
      method: "POST",
      path: "/2/oauth2/token",
      basicAuth: config.clientSecret ? { username: config.clientId, password: config.clientSecret } : undefined,
      formBody: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
      },
    },
    XTokenResponseSchema,
    fetchImpl,
  );
  return toExchangeResult(result);
}

function toExchangeResult(result: XTokenResponse): XTokenExchangeResult {
  const expiresInSeconds = result.expires_in ?? 7200;
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}
