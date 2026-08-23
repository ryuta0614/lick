/**
 * All Instagram (Meta Graph API) base URL / version / OAuth endpoint values
 * live here — nowhere else in the codebase should hardcode a
 * graph.facebook.com URL (mirrors threads/config.ts).
 *
 * Instagram Content Publishing runs on the same Graph API as Threads, under
 * the same Meta Developer App, so this reuses META_APP_ID/META_APP_SECRET
 * rather than introducing separate credentials — only the redirect URI and
 * OAuth scopes differ.
 */
export type InstagramConfig = {
  /** e.g. https://graph.facebook.com */
  apiBaseUrl: string;
  /** e.g. v21.0 — Meta revises this periodically; verify against current docs before relying on it. */
  apiVersion: string;
  /** Meta App ID (OAuth client_id) — shared with Threads */
  clientId: string;
  /** Meta App Secret — never logged, never sent to the client */
  clientSecret: string;
  /** Must exactly match the callback URL registered in the Meta App dashboard for this product */
  redirectUri: string;
  /** If true, the final media_publish call is never made (STEP 16 dry-run mode) */
  dryRun: boolean;
};

const DEFAULT_API_BASE_URL = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v21.0";
/** The Facebook Login for Business authorization UI lives on facebook.com, not graph.facebook.com. */
const DEFAULT_AUTHORIZE_BASE_URL = "https://www.facebook.com";

export function getInstagramConfigFromEnv(env: NodeJS.ProcessEnv = process.env): InstagramConfig {
  const clientId = env.META_APP_ID;
  const clientSecret = env.META_APP_SECRET;
  const redirectUri = env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Instagram is not configured: META_APP_ID, META_APP_SECRET and INSTAGRAM_REDIRECT_URI must all be set",
    );
  }

  return {
    apiBaseUrl: env.INSTAGRAM_API_BASE_URL || DEFAULT_API_BASE_URL,
    apiVersion: env.INSTAGRAM_API_VERSION || DEFAULT_API_VERSION,
    clientId,
    clientSecret,
    redirectUri,
    // Default TRUE: never publish for real unless an operator explicitly opts out (CLAUDE.md STEP 16 pattern).
    dryRun: (env.INSTAGRAM_DRY_RUN ?? "true").trim().toLowerCase() !== "false",
  };
}

export function getInstagramAuthorizeBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.INSTAGRAM_AUTHORIZE_BASE_URL || DEFAULT_AUTHORIZE_BASE_URL;
}

/** "mock" (default, safe) or "real". Falls back from INSTAGRAM_PLATFORM_MODE to the global PLATFORM_MODE. */
export function getInstagramPlatformMode(env: NodeJS.ProcessEnv = process.env): "mock" | "real" {
  const raw = (env.INSTAGRAM_PLATFORM_MODE ?? env.PLATFORM_MODE ?? "mock").trim().toLowerCase();
  return raw === "real" ? "real" : "mock";
}
