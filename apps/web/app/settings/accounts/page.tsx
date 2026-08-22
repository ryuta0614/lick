import { prisma } from "../../../lib/db";
import { getDefaultWorkspace } from "../../../lib/workspace";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { DisconnectAccountButton } from "../../../components/account-actions";
import { getThreadsPlatformMode } from "@social-growth-os/platform-connectors";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  threads_denied: "Threads authorization was cancelled or denied.",
  threads_invalid_callback: "Threads callback was missing required parameters.",
  threads_invalid_state: "OAuth state validation failed (possible CSRF attempt or expired session) — please try connecting again.",
  threads_not_configured: "Threads is not configured: set META_APP_ID, META_APP_SECRET and THREADS_REDIRECT_URI.",
  threads_connect_failed: "Failed to complete the Threads connection. Check server logs for details.",
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

  const threadsMode = getThreadsPlatformMode();
  const dryRun = (process.env.THREADS_DRY_RUN ?? "true").trim().toLowerCase() !== "false";
  const hasActiveThreadsAccount = accounts.some((a) => a.platform === "THREADS" && a.active && a.credential);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Connections</h1>
        <p className="text-sm text-muted-foreground">
          X and Instagram still use MockPlatformAdapter (Phase 3/4). Threads can be connected for real publishing.
        </p>
      </div>

      {searchParams.connected === "threads" && (
        <Card>
          <CardContent className="pt-6 text-sm text-emerald-700">Threads account connected successfully.</CardContent>
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
        <CardContent className="flex flex-wrap items-center gap-2 pt-6 text-sm">
          <span className="text-muted-foreground">Threads publishing mode:</span>
          <Badge tone={threadsMode === "real" ? "warning" : "muted"}>{threadsMode === "real" ? "REAL" : "MOCK"}</Badge>
          {threadsMode === "real" && (
            <Badge tone={dryRun ? "muted" : "destructive"}>{dryRun ? "DRY RUN" : "LIVE PUBLISHING"}</Badge>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <div className="mb-1 flex flex-wrap gap-2">
                  <Badge tone="muted">{account.platform}</Badge>
                  <Badge tone={account.active ? "success" : "muted"}>{account.active ? "active" : "inactive"}</Badge>
                  <Badge tone="muted">{account.approvalMode}</Badge>
                  {account.platform === "THREADS" && account.credential && !account.credential.needsReconnect && (
                    <Badge tone="success">Connected</Badge>
                  )}
                  {account.platform === "THREADS" && account.credential?.needsReconnect && (
                    <Badge tone="destructive">Needs reconnect</Badge>
                  )}
                  {account.platform === "THREADS" && !account.credential && <Badge tone="muted">Not connected (mock)</Badge>}
                </div>
                <p className="text-sm font-medium">
                  {account.username ? `@${account.username}` : (account.displayName ?? account.id)}
                </p>
              </div>

              {account.platform === "THREADS" && (
                <div className="flex gap-2">
                  {account.credential ? (
                    <>
                      {account.credential.needsReconnect && (
                        <a href="/api/accounts/threads/connect">
                          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                            Reconnect
                          </button>
                        </a>
                      )}
                      <DisconnectAccountButton accountId={account.id} />
                    </>
                  ) : (
                    <a href="/api/accounts/threads/connect">
                      <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                        Connect Threads
                      </button>
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasActiveThreadsAccount && (
        <Card>
          <CardContent className="pt-6">
            <a href="/api/accounts/threads/connect">
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Connect Threads
              </button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
