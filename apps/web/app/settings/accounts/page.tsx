import { prisma } from "../../../lib/db";
import { getDefaultWorkspace } from "../../../lib/workspace";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { DisconnectAccountButton } from "../../../components/account-actions";
import { getThreadsPlatformMode, getXPlatformMode } from "@social-growth-os/platform-connectors";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  threads_denied: "Threads authorization was cancelled or denied.",
  threads_invalid_callback: "Threads callback was missing required parameters.",
  threads_invalid_state: "OAuth state validation failed (possible CSRF attempt or expired session) — please try connecting again.",
  threads_not_configured: "Threads is not configured: set META_APP_ID, META_APP_SECRET and THREADS_REDIRECT_URI.",
  threads_connect_failed: "Failed to complete the Threads connection. Check server logs for details.",
  x_denied: "X authorization was cancelled or denied.",
  x_invalid_callback: "X callback was missing required parameters.",
  x_invalid_state: "OAuth state validation failed (possible CSRF attempt or expired session) — please try connecting again.",
  x_not_configured: "X is not configured: set X_CLIENT_ID and X_REDIRECT_URI (X_CLIENT_SECRET only if using a confidential app).",
  x_connect_failed: "Failed to complete the X connection. Check server logs for details.",
};

const CONNECTABLE_PLATFORMS = ["THREADS", "X"] as const;

const CONNECT_URLS: Record<(typeof CONNECTABLE_PLATFORMS)[number], string> = {
  THREADS: "/api/accounts/threads/connect",
  X: "/api/accounts/x/connect",
};

const PLATFORM_LABELS: Record<(typeof CONNECTABLE_PLATFORMS)[number], string> = {
  THREADS: "Threads",
  X: "X",
};

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const workspace = await getDefaultWorkspace();
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: workspace.id },
    include: { credential: true },
    orderBy: { createdAt: "asc" },
  });

  const platformModes: Record<(typeof CONNECTABLE_PLATFORMS)[number], "mock" | "real"> = {
    THREADS: getThreadsPlatformMode(),
    X: getXPlatformMode(),
  };
  const dryRunEnvVars: Record<(typeof CONNECTABLE_PLATFORMS)[number], string> = {
    THREADS: "THREADS_DRY_RUN",
    X: "X_DRY_RUN",
  };

  const connectedLabel = connectedPlatformLabel(searchParams.connected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Connections</h1>
        <p className="text-sm text-muted-foreground">
          Instagram still uses MockPlatformAdapter (Phase 4). Threads and X can be connected for real publishing.
        </p>
      </div>

      {connectedLabel && (
        <Card>
          <CardContent className="pt-6 text-sm text-emerald-700">{connectedLabel} account connected successfully.</CardContent>
        </Card>
      )}
      {searchParams.error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {ERROR_MESSAGES[searchParams.error] ?? searchParams.error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6 text-sm">
          {CONNECTABLE_PLATFORMS.map((platform) => {
            const mode = platformModes[platform];
            const dryRun = (process.env[dryRunEnvVars[platform]] ?? "true").trim().toLowerCase() !== "false";
            return (
              <div key={platform} className="flex items-center gap-2">
                <span className="text-muted-foreground">{PLATFORM_LABELS[platform]} publishing mode:</span>
                <Badge tone={mode === "real" ? "warning" : "muted"}>{mode === "real" ? "REAL" : "MOCK"}</Badge>
                {mode === "real" && <Badge tone={dryRun ? "muted" : "destructive"}>{dryRun ? "DRY RUN" : "LIVE PUBLISHING"}</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {accounts.map((account) => {
          const connectablePlatform = isConnectablePlatform(account.platform) ? account.platform : undefined;
          return (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <div className="mb-1 flex flex-wrap gap-2">
                    <Badge tone="muted">{account.platform}</Badge>
                    <Badge tone={account.active ? "success" : "muted"}>{account.active ? "active" : "inactive"}</Badge>
                    <Badge tone="muted">{account.approvalMode}</Badge>
                    {connectablePlatform && account.credential && !account.credential.needsReconnect && (
                      <Badge tone="success">Connected</Badge>
                    )}
                    {connectablePlatform && account.credential?.needsReconnect && (
                      <Badge tone="destructive">Needs reconnect</Badge>
                    )}
                    {connectablePlatform && !account.credential && <Badge tone="muted">Not connected (mock)</Badge>}
                  </div>
                  <p className="text-sm font-medium">
                    {account.username ? `@${account.username}` : (account.displayName ?? account.id)}
                  </p>
                </div>

                {connectablePlatform && (
                  <div className="flex gap-2">
                    {account.credential ? (
                      <>
                        {account.credential.needsReconnect && (
                          <a href={CONNECT_URLS[connectablePlatform]}>
                            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                              Reconnect
                            </button>
                          </a>
                        )}
                        <DisconnectAccountButton accountId={account.id} />
                      </>
                    ) : (
                      <a href={CONNECT_URLS[connectablePlatform]}>
                        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                          Connect {PLATFORM_LABELS[connectablePlatform]}
                        </button>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        {CONNECTABLE_PLATFORMS.filter(
          (platform) => !accounts.some((a) => a.platform === platform && a.active && a.credential),
        ).map((platform) => (
          <Card key={platform} className="flex-1">
            <CardContent className="pt-6">
              <a href={CONNECT_URLS[platform]}>
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  Connect {PLATFORM_LABELS[platform]}
                </button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function isConnectablePlatform(platform: string): platform is (typeof CONNECTABLE_PLATFORMS)[number] {
  return (CONNECTABLE_PLATFORMS as readonly string[]).includes(platform);
}

function connectedPlatformLabel(connected: string | undefined): string | undefined {
  const platform = connected?.toUpperCase();
  return platform && isConnectablePlatform(platform) ? PLATFORM_LABELS[platform] : undefined;
}
