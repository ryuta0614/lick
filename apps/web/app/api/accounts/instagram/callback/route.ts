import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeForLongLivedInstagramToken,
  exchangeInstagramCodeForToken,
  getInstagramConfigFromEnv,
  InstagramApiClient,
} from "@social-growth-os/platform-connectors";
import { encryptSecret, logger } from "@social-growth-os/shared";
import { prisma } from "../../../../../lib/db";
import { getDefaultWorkspace } from "../../../../../lib/workspace";
import { INSTAGRAM_OAUTH_STATE_COOKIE_NAME, verifyOAuthState } from "../../../../../lib/oauth-state";

const INSTAGRAM_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"];

function redirectAndClearState(path: string): NextResponse {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const response = NextResponse.redirect(new URL(path, appUrl));
  response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE_NAME);
  return response;
}

/**
 * GET /api/accounts/instagram/callback — completes Facebook Login for
 * Business, then discovers which of the user's Facebook Pages has a linked
 * Instagram Business Account (Instagram Content Publishing requires
 * publishing through a Page-scoped access token, not the user token).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectAndClearState(`/settings/accounts?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectAndClearState("/settings/accounts?error=instagram_invalid_callback");
  }

  const cookieState = cookies().get(INSTAGRAM_OAUTH_STATE_COOKIE_NAME)?.value;
  if (!verifyOAuthState(cookieState, state)) {
    return redirectAndClearState("/settings/accounts?error=instagram_invalid_state");
  }

  let config;
  try {
    config = getInstagramConfigFromEnv();
  } catch {
    return redirectAndClearState("/settings/accounts?error=instagram_not_configured");
  }

  try {
    const shortLived = await exchangeInstagramCodeForToken(config, code);
    const longLived = await exchangeForLongLivedInstagramToken(config, shortLived.accessToken);

    const client = new InstagramApiClient({ apiBaseUrl: config.apiBaseUrl, apiVersion: config.apiVersion });
    const pages = await client.getFacebookPages(longLived.accessToken);
    const pageWithInstagram = pages.find((p) => p.instagramBusinessAccountId);

    if (!pageWithInstagram?.instagramBusinessAccountId) {
      return redirectAndClearState("/settings/accounts?error=instagram_no_linked_account");
    }

    const igUserId = pageWithInstagram.instagramBusinessAccountId;
    const igUser = await client.getUser(igUserId, pageWithInstagram.pageAccessToken);

    const workspace = await getDefaultWorkspace();

    // @@unique([platform, externalId]) on SocialAccount — never creates a duplicate row for a re-connect.
    const account = await prisma.socialAccount.upsert({
      where: { platform_externalId: { platform: "INSTAGRAM", externalId: igUser.id } },
      update: { username: igUser.username, displayName: igUser.username, active: true },
      create: {
        workspaceId: workspace.id,
        platform: "INSTAGRAM",
        externalId: igUser.id,
        username: igUser.username,
        displayName: igUser.username,
        approvalMode: "MANUAL",
        active: true,
      },
    });

    // The Page access token (not the user token) is what Instagram Content Publishing calls require.
    const encryptedAccessToken = encryptSecret(pageWithInstagram.pageAccessToken);
    await prisma.platformCredential.upsert({
      where: { socialAccountId: account.id },
      update: {
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: null,
        expiresAt: longLived.expiresAt,
        scopes: INSTAGRAM_SCOPES,
        needsReconnect: false,
      },
      create: {
        socialAccountId: account.id,
        accessTokenEnc: encryptedAccessToken,
        expiresAt: longLived.expiresAt,
        scopes: INSTAGRAM_SCOPES,
        needsReconnect: false,
      },
    });

    logger.info("instagram.oauth.connected", { socialAccountId: account.id });
    return redirectAndClearState("/settings/accounts?connected=instagram");
  } catch (error) {
    // Never log the error object directly if it might carry a token; log only a message.
    logger.error("instagram.oauth.callback_failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return redirectAndClearState("/settings/accounts?error=instagram_connect_failed");
  }
}
