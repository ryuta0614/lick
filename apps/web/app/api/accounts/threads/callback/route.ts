import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getThreadsConfigFromEnv,
  ThreadsApiClient,
} from "@social-growth-os/platform-connectors";
import { encryptSecret, logger } from "@social-growth-os/shared";
import { prisma } from "../../../../../lib/db";
import { getDefaultWorkspace } from "../../../../../lib/workspace";
import { OAUTH_STATE_COOKIE_NAME, verifyOAuthState } from "../../../../../lib/oauth-state";

const THREADS_SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights"];

function redirectAndClearState(path: string): NextResponse {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const response = NextResponse.redirect(new URL(path, appUrl));
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  return response;
}

/** GET /api/accounts/threads/callback — completes the Threads OAuth flow (CLAUDE.md STEP 6/7). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectAndClearState(`/settings/accounts?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectAndClearState("/settings/accounts?error=threads_invalid_callback");
  }

  const cookieState = cookies().get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!verifyOAuthState(cookieState, state)) {
    return redirectAndClearState("/settings/accounts?error=threads_invalid_state");
  }

  let config;
  try {
    config = getThreadsConfigFromEnv();
  } catch {
    return redirectAndClearState("/settings/accounts?error=threads_not_configured");
  }

  try {
    const shortLived = await exchangeCodeForToken(config, code);
    const longLived = await exchangeForLongLivedToken(config, shortLived.accessToken);

    const client = new ThreadsApiClient({ apiBaseUrl: config.apiBaseUrl, apiVersion: config.apiVersion });
    const threadsUser = await client.getUser(longLived.accessToken);

    const workspace = await getDefaultWorkspace();

    // @@unique([platform, externalId]) on SocialAccount — never creates a duplicate row for a re-connect.
    const account = await prisma.socialAccount.upsert({
      where: { platform_externalId: { platform: "THREADS", externalId: threadsUser.id } },
      update: { username: threadsUser.username, displayName: threadsUser.username, active: true },
      create: {
        workspaceId: workspace.id,
        platform: "THREADS",
        externalId: threadsUser.id,
        username: threadsUser.username,
        displayName: threadsUser.username,
        approvalMode: "MANUAL",
        active: true,
      },
    });

    const encryptedAccessToken = encryptSecret(longLived.accessToken);
    await prisma.platformCredential.upsert({
      where: { socialAccountId: account.id },
      update: {
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: null,
        expiresAt: longLived.expiresAt,
        scopes: THREADS_SCOPES,
        needsReconnect: false,
      },
      create: {
        socialAccountId: account.id,
        accessTokenEnc: encryptedAccessToken,
        expiresAt: longLived.expiresAt,
        scopes: THREADS_SCOPES,
        needsReconnect: false,
      },
    });

    logger.info("threads.oauth.connected", { socialAccountId: account.id });
    return redirectAndClearState("/settings/accounts?connected=threads");
  } catch (error) {
    // Never log the error object directly if it might carry a token; log only a message.
    logger.error("threads.oauth.callback_failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return redirectAndClearState("/settings/accounts?error=threads_connect_failed");
  }
}
