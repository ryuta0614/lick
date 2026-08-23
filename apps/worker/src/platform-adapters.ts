import type { PlatformCredential, SocialAccount } from "@social-growth-os/database";
import { prisma } from "@social-growth-os/database";
import { decryptSecret, PlatformAuthError } from "@social-growth-os/shared";
import {
  createMockPlatformAdapters,
  getThreadsConfigFromEnv,
  getThreadsPlatformMode,
  getXConfigFromEnv,
  getXPlatformMode,
  ThreadsAdapter,
  XAdapter,
  type FetchImpl,
  type SocialPlatformAdapter,
} from "@social-growth-os/platform-connectors";

export type SocialAccountWithCredential = SocialAccount & { credential: PlatformCredential | null };

const mockAdapters = createMockPlatformAdapters();

/**
 * Resolves which adapter a publish/analytics job should use for a given
 * account (CLAUDE.md STEP 8):
 *   - INSTAGRAM: always MockPlatformAdapter (Phase 4, not built yet).
 *   - THREADS / X: MockPlatformAdapter unless that platform's own
 *     *_PLATFORM_MODE (falling back to the global PLATFORM_MODE) is "real"
 *     AND the account has a usable, non-expired credential AND its
 *     approvalMode is MANUAL (CLAUDE.md STEP 15 — no real publishing for
 *     SEMI_AUTO/AUTO accounts yet).
 *
 * Throws PlatformAuthError (never silently falls back to Mock) when "real"
 * mode is requested but the account isn't actually usable — a human
 * approved a real publish and a silent mock fallback would be misleading.
 */
export function getPlatformAdapter(
  account: SocialAccountWithCredential,
  options: { fetchImpl?: FetchImpl } = {},
): SocialPlatformAdapter {
  if (account.platform === "THREADS") {
    return resolveThreadsAdapter(account, options);
  }
  if (account.platform === "X") {
    return resolveXAdapter(account, options);
  }
  return mockAdapters[account.platform];
}

function resolveThreadsAdapter(
  account: SocialAccountWithCredential,
  options: { fetchImpl?: FetchImpl },
): SocialPlatformAdapter {
  if (getThreadsPlatformMode() !== "real") {
    return mockAdapters.THREADS;
  }

  const credential = requireUsableCredential(account, "Threads");
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

function resolveXAdapter(account: SocialAccountWithCredential, options: { fetchImpl?: FetchImpl }): SocialPlatformAdapter {
  if (getXPlatformMode() !== "real") {
    return mockAdapters.X;
  }

  const credential = requireUsableCredential(account, "X");
  const config = getXConfigFromEnv();
  return new XAdapter({
    accessToken: decryptSecret(credential.accessTokenEnc),
    apiBaseUrl: config.apiBaseUrl,
    dryRun: config.dryRun,
    fetchImpl: options.fetchImpl,
  });
}

/** Shared MANUAL-approvalMode + valid-credential gate for any platform's real adapter (CLAUDE.md STEP 15). */
function requireUsableCredential(account: SocialAccountWithCredential, platformLabel: string): PlatformCredential {
  if (account.approvalMode !== "MANUAL") {
    throw new PlatformAuthError(
      `Real ${platformLabel} publishing is only allowed for MANUAL approvalMode accounts in this phase (account ${account.id} is ${account.approvalMode})`,
    );
  }

  const credential = account.credential;
  if (!credential || credential.needsReconnect) {
    throw new PlatformAuthError(
      `SocialAccount ${account.id} has no valid ${platformLabel} credential — connect/reconnect required before publishing in real mode`,
    );
  }
  if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
    throw new PlatformAuthError(`${platformLabel} credential for account ${account.id} has expired — reconnect required`);
  }
  return credential;
}

/** Flags a credential as needing reconnection after a definitive auth failure, so /settings/accounts can surface it. */
export async function markCredentialNeedsReconnect(socialAccountId: string): Promise<void> {
  await prisma.platformCredential.updateMany({
    where: { socialAccountId },
    data: { needsReconnect: true },
  });
}
