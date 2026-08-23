import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeXCodeForToken, getXConfigFromEnv, XApiClient } from "@social-growth-os/platform-connectors";
import { encryptSecret, logger } from "@social-growth-os/shared";
import { prisma } from "../../../../../lib/db";
import { getDefaultWorkspace } from "../../../../../lib/workspace";
import { X_OAUTH_STATE_COOKIE_NAME, X_PKCE_VERIFIER_COOKIE_NAME, verifyOAuthState } from "../../../../../lib/oauth-state";

const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

function redirectAndClearState(path: string): NextResponse {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const response = NextResponse.redirect(new URL(path, appUrl));
  response.cookies.delete(X_OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(X_PKCE_VERIFIER_COOKIE_NAME);
  return response;
}

/** GET /api/accounts/x/callback — completes the X OAuth 2.0 + PKCE flow. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectAndClearState(`/settings/accounts?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectAndClearState("/settings/accounts?error=x_invalid_callback");
  }

  const cookieState = cookies().get(X_OAUTH_STATE_COOKIE_NAME)?.value;
  const codeVerifier = cookies().get(X_PKCE_VERIFIER_COOKIE_NAME)?.value;
  if (!verifyOAuthState(cookieState, state) || !codeVerifier) {
    return redirectAndClearState("/settings/accounts?error=x_invalid_state");
  }

  let config;
  try {
    config = getXConfigFromEnv();
  } catch {
    return redirectAndClearState("/settings/accounts?error=x_not_configured");
  }

  try {
    const token = await exchangeXCodeForToken(config, code, codeVerifier);

    const client = new XApiClient({ apiBaseUrl: config.apiBaseUrl });
    const xUser = await client.getUser(token.accessToken);

    const workspace = await getDefaultWorkspace();

    // @@unique([platform, externalId]) on SocialAccount — never creates a duplicate row for a re-connect.
    const account = await prisma.socialAccount.upsert({
      where: { platform_externalId: { platform: "X", externalId: xUser.id } },
      update: { username: xUser.username, displayName: xUser.name ?? xUser.username, active: true },
      create: {
        workspaceId: workspace.id,
        platform: "X",
        externalId: xUser.id,
        username: xUser.username,
        displayName: xUser.name ?? xUser.username,
        approvalMode: "MANUAL",
        active: true,
      },
    });

    const encryptedAccessToken = encryptSecret(token.accessToken);
    await prisma.platformCredential.upsert({
      where: { socialAccountId: account.id },
      update: {
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: token.refreshToken ? encryptSecret(token.refreshToken) : null,
        expiresAt: token.expiresAt,
        scopes: X_SCOPES,
        needsReconnect: false,
      },
      create: {
        socialAccountId: account.id,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: token.refreshToken ? encryptSecret(token.refreshToken) : null,
        expiresAt: token.expiresAt,
        scopes: X_SCOPES,
        needsReconnect: false,
      },
    });

    logger.info("x.oauth.connected", { socialAccountId: account.id });
    return redirectAndClearState("/settings/accounts?connected=x");
  } catch (error) {
    // Never log the error object directly if it might carry a token; log only a message.
    logger.error("x.oauth.callback_failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return redirectAndClearState("/settings/accounts?error=x_connect_failed");
  }
}
