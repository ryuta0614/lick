import { NextResponse } from "next/server";
import { buildInstagramAuthorizeUrl, getInstagramConfigFromEnv } from "@social-growth-os/platform-connectors";
import { createOAuthState, INSTAGRAM_OAUTH_STATE_COOKIE_NAME } from "../../../../../lib/oauth-state";

// Must never be statically cached: every request mints a fresh CSRF state/cookie.
export const dynamic = "force-dynamic";

/** GET /api/accounts/instagram/connect — starts the Facebook Login for Business flow used to connect Instagram. */
export async function GET() {
  let config;
  try {
    config = getInstagramConfigFromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram is not configured";
    return NextResponse.redirect(
      new URL(`/settings/accounts?error=${encodeURIComponent(message)}`, process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  const { state, maxAgeSeconds } = createOAuthState();
  const authorizeUrl = buildInstagramAuthorizeUrl(config, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  return response;
}
