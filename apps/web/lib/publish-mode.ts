import { getThreadsPlatformMode } from "@social-growth-os/platform-connectors";
import type { ApprovalMode, Platform } from "@social-growth-os/shared";

export type PublishMode = "MOCK" | "REAL" | "REAL_DRY_RUN" | "REAL_BLOCKED";

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
  if (account.platform !== "THREADS") return "MOCK";
  if (getThreadsPlatformMode() !== "real") return "MOCK";

  const credential = account.credential;
  const expired = credential?.expiresAt != null && credential.expiresAt.getTime() <= Date.now();
  if (!credential || credential.needsReconnect || expired || account.approvalMode !== "MANUAL") {
    return "REAL_BLOCKED";
  }

  const dryRun = (process.env.THREADS_DRY_RUN ?? "true").trim().toLowerCase() !== "false";
  return dryRun ? "REAL_DRY_RUN" : "REAL";
}
