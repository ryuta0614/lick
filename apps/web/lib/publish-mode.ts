import { getThreadsPlatformMode, getXPlatformMode } from "@social-growth-os/platform-connectors";
import type { ApprovalMode, Platform } from "@social-growth-os/shared";

export type PublishMode = "MOCK" | "REAL" | "REAL_DRY_RUN" | "REAL_BLOCKED";

const REAL_CAPABLE_PLATFORMS = ["THREADS", "X"] as const;

const PLATFORM_MODE_RESOLVERS: Record<(typeof REAL_CAPABLE_PLATFORMS)[number], () => "mock" | "real"> = {
  THREADS: getThreadsPlatformMode,
  X: getXPlatformMode,
};

const DRY_RUN_ENV_VARS: Record<(typeof REAL_CAPABLE_PLATFORMS)[number], string> = {
  THREADS: "THREADS_DRY_RUN",
  X: "X_DRY_RUN",
};

/**
 * Mirrors apps/worker's getPlatformAdapter() resolution logic so the UI can
 * show, before anyone clicks Approve/Publish, whether a post targets a real
 * account or the mock adapter (CLAUDE.md STEP 14 — "誤操作防止").
 */
export function resolvePublishMode(account: {
  platform: Platform;
  approvalMode: ApprovalMode;
  credential: { needsReconnect: boolean; expiresAt: Date | null } | null;
}): PublishMode {
  if (!isRealCapablePlatform(account.platform)) return "MOCK";
  if (PLATFORM_MODE_RESOLVERS[account.platform]() !== "real") return "MOCK";

  const credential = account.credential;
  const expired = credential?.expiresAt != null && credential.expiresAt.getTime() <= Date.now();
  if (!credential || credential.needsReconnect || expired || account.approvalMode !== "MANUAL") {
    return "REAL_BLOCKED";
  }

  const dryRun = (process.env[DRY_RUN_ENV_VARS[account.platform]] ?? "true").trim().toLowerCase() !== "false";
  return dryRun ? "REAL_DRY_RUN" : "REAL";
}

function isRealCapablePlatform(platform: Platform): platform is (typeof REAL_CAPABLE_PLATFORMS)[number] {
  return (REAL_CAPABLE_PLATFORMS as readonly string[]).includes(platform);
}
