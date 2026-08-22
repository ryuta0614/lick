import type { PlatformCredential, SocialAccount } from "@social-growth-os/database";
import { prisma } from "@social-growth-os/database";
import { decryptSecret, PlatformAuthError } from "@social-growth-os/shared";
import {
  createMockPlatformAdapters,
  getThreadsConfigFromEnv,
  getThreadsPlatformMode,
  ThreadsAdapter,
  type FetchImpl,
  type SocialPlatformAdapter,
} from "@social-growth-os/platform-connectors";

export type SocialAccountWithCredential = SocialAccount & { credential: PlatformCredential | null };

const mockAdapters = createMockPlatformAdapters();

/**
 * Resolves which adapter a publish/analytics job should use for a given
 * account (CLAUDE.md STEP 8):
 *   - X / INSTAGRAM: always MockPlatformAdapter in Phase 2 (untouched this phase).
 *   - THREADS: MockPlatformAdapter unless THREADS_PLATFORM_MODE (falling back to
 *     PLATFORM_MODE) is "real" AND the account has a usable, non-expired
 *     credential AND its approvalMode is MANUAL (CLAUDE.md STEP 15 — no real
 *     publishing for SEMI_AUTO/AUTO accounts yet).
 *
 * Throws PlatformAuthError (never silently falls back to Mock) when "real"
 * mode is requested but the account isn't actually usable — a human
 * approved a real publish and a silent mock fallback would be misleading.
 */
export function getPlatformAdapter(
  account: SocialAccountWithCredential,
  options: { fetchImpl?: FetchImpl } = {},
): SocialPlatformAdapter {
  if (account.platform !== "THREADS") {
    return mockAdapters[account.platform];
  }

  if (getThreadsPlatformMode() !== "real") {
    return mockAdapters.THREADS;
  }

  if (account.approvalMode !== "MANUAL") {
    throw new PlatformAuthError(
      `Real Threads publishing is only allowed for MANUAL approvalMode accounts in this phase (account ${account.id} is ${account.approvalMode})`,
    );
  }

  const credential = account.credential;
  if (!credential || credential.needsReconnect) {
    throw new PlatformAuthError(
      `SocialAccount ${account.id} has no valid Threads credential — connect/reconnect required before publishing in real mode`,
    );
  }
  if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
    throw new PlatformAuthError(`Threads credential for account ${account.id} has expired — reconnect required`);
  }

  const config = getThreadsConfigFromEnv();
  return new ThreadsAdapter({
    threadsUserId: account.externalId,
    accessToken: decryptSecret(credential.accessTokenEnc),
    apiBaseUrl: config.apiBaseUrl,
    apiVersion: config.apiVersion,
    dryRun: config.dryRun,
    fetchImpl: options.fetchImpl,
  });
}

/** Flags a credential as needing reconnection after a definitive auth failure, so /settings/accounts can surface it. */
export async function markCredentialNeedsReconnect(socialAccountId: string): Promise<void> {
  await prisma.platformCredential.updateMany({
    where: { socialAccountId },
    data: { needsReconnect: true },
  });
}
