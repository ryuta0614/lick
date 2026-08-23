import { NextResponse } from "next/server";
import { buildXAuthorizeUrl, getXConfigFromEnv } from "@social-growth-os/platform-connectors";
import { createOAuthState, X_OAUTH_STATE_COOKIE_NAME, X_PKCE_VERIFIER_COOKIE_NAME } from "../../../../../lib/oauth-state";
import { generatePkcePair } from "../../../../../lib/pkce";

// Must never be statically cached: every request mints a fresh CSRF state/PKCE verifier.
export const dynamic = "force-dynamic";

/** GET /api/accounts/x/connect — starts the X OAuth 2.0 + PKCE flow. */
export async function GET() {
  let config;
  try {
    config = getXConfigFromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "X is not configured";
    return NextResponse.redirect(
      new URL(`/settings/accounts?error=${encodeURIComponent(message)}`, process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  const { state, maxAgeSeconds } = createOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const authorizeUrl = buildXAuthorizeUrl(config, state, codeChallenge);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(X_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  response.cookies.set(X_PKCE_VERIFIER_COOKIE_NAME, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  return response;
}
