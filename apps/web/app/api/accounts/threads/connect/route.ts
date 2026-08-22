import { NextResponse } from "next/server";
import { buildThreadsAuthorizeUrl, getThreadsConfigFromEnv } from "@social-growth-os/platform-connectors";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME } from "../../../../../lib/oauth-state";

// Must never be statically cached: every request mints a fresh CSRF state/cookie.
export const dynamic = "force-dynamic";

/** GET /api/accounts/threads/connect — starts the Threads OAuth flow (CLAUDE.md STEP 6). */
export async function GET() {
  let config;
  try {
    config = getThreadsConfigFromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Threads is not configured";
    return NextResponse.redirect(
      new URL(`/settings/accounts?error=${encodeURIComponent(message)}`, process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  const { state, maxAgeSeconds } = createOAuthState();
  const authorizeUrl = buildThreadsAuthorizeUrl(config, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  return response;
}
