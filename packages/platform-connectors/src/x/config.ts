/**
 * All X (Twitter) API base URL / OAuth endpoint values live here — nowhere
 * else in the codebase should hardcode an api.x.com/twitter.com URL
 * (mirrors packages/platform-connectors/src/threads/config.ts).
 */
export type XConfig = {
  /** e.g. https://api.x.com */
  apiBaseUrl: string;
  /** OAuth 2.0 client_id */
  clientId: string;
  /**
   * OAuth 2.0 client_secret — only present for a "confidential" X app.
   * A "public" app (mobile/desktop-style) has none and relies on PKCE
   * alone; both are supported since X allows either app type.
   */
  clientSecret?: string;
  /** Must exactly match the callback URL registered in the X Developer Portal */
  redirectUri: string;
  /** When true (the safe default), publishPost never calls the real X API */
  dryRun: boolean;
};

const DEFAULT_API_BASE_URL = "https://api.x.com";
/** The web authorization UI is served from twitter.com, not api.x.com. */
const DEFAULT_AUTHORIZE_BASE_URL = "https://twitter.com";

export function getXConfigFromEnv(env: NodeJS.ProcessEnv = process.env): XConfig {
  const clientId = env.X_CLIENT_ID;
  const redirectUri = env.X_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("X is not configured: X_CLIENT_ID and X_REDIRECT_URI must both be set");
  }

  return {
    apiBaseUrl: env.X_API_BASE_URL || DEFAULT_API_BASE_URL,
    clientId,
    clientSecret: env.X_CLIENT_SECRET || undefined,
    redirectUri,
    // Default TRUE: never publish for real unless an operator explicitly opts out (CLAUDE.md STEP 16 pattern).
    dryRun: (env.X_DRY_RUN ?? "true").trim().toLowerCase() !== "false",
  };
}

export function getXAuthorizeBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.X_AUTHORIZE_BASE_URL || DEFAULT_AUTHORIZE_BASE_URL;
}

/** "mock" (default, safe) or "real". Falls back from X_PLATFORM_MODE to the global PLATFORM_MODE. */
export function getXPlatformMode(env: NodeJS.ProcessEnv = process.env): "mock" | "real" {
  const raw = (env.X_PLATFORM_MODE ?? env.PLATFORM_MODE ?? "mock").trim().toLowerCase();
  return raw === "real" ? "real" : "mock";
}
