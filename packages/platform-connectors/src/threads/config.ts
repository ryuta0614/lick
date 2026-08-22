/**
 * All Threads API base URL / version / OAuth endpoint values live here —
 * nowhere else in the codebase should hardcode a graph.threads.net URL
 * (CLAUDE.md STEP 2: "API versionやbase URLをコード中に散在させないでください").
 */
export type ThreadsConfig = {
  /** e.g. https://graph.threads.net */
  apiBaseUrl: string;
  /** e.g. v1.0 */
  apiVersion: string;
  /** Meta App ID (OAuth client_id) */
  clientId: string;
  /** Meta App Secret (OAuth client_secret) — never logged, never sent to the client */
  clientSecret: string;
  /** Must exactly match the callback URL registered in the Meta App dashboard */
  redirectUri: string;
  /** If true, the final threads_publish call is never made (STEP 16 dry-run mode) */
  dryRun: boolean;
};

const DEFAULT_API_BASE_URL = "https://graph.threads.net";
const DEFAULT_API_VERSION = "v1.0";
/** The web authorization UI lives on threads.net, not graph.threads.net. */
const DEFAULT_AUTHORIZE_BASE_URL = "https://threads.net";

export function getThreadsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ThreadsConfig {
  const clientId = env.META_APP_ID;
  const clientSecret = env.META_APP_SECRET;
  const redirectUri = env.THREADS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Threads is not configured: META_APP_ID, META_APP_SECRET and THREADS_REDIRECT_URI must all be set",
    );
  }

  return {
    apiBaseUrl: env.THREADS_API_BASE_URL || DEFAULT_API_BASE_URL,
    apiVersion: env.THREADS_API_VERSION || DEFAULT_API_VERSION,
    clientId,
    clientSecret,
    redirectUri,
    // Default TRUE: never publish for real unless an operator explicitly opts out (CLAUDE.md STEP 16).
    dryRun: (env.THREADS_DRY_RUN ?? "true").trim().toLowerCase() !== "false",
  };
}

export function getThreadsAuthorizeBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.THREADS_AUTHORIZE_BASE_URL || DEFAULT_AUTHORIZE_BASE_URL;
}

/** "mock" (default, safe) or "real". Falls back from THREADS_PLATFORM_MODE to the global PLATFORM_MODE. */
export function getThreadsPlatformMode(env: NodeJS.ProcessEnv = process.env): "mock" | "real" {
  const raw = (env.THREADS_PLATFORM_MODE ?? env.PLATFORM_MODE ?? "mock").trim().toLowerCase();
  return raw === "real" ? "real" : "mock";
}
