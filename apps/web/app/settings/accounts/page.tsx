import { prisma } from "../../../lib/db";
import { getDefaultWorkspace } from "../../../lib/workspace";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const workspace = await getDefaultWorkspace();
  const accounts = await prisma.socialAccount.findMany({ where: { workspaceId: workspace.id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Connections</h1>
        <p className="text-sm text-muted-foreground">
          MVP uses MockPlatformAdapter for every platform — no real SNS credentials are used yet
          (CLAUDE.md Phase 2-4).
        </p>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <div className="mb-1 flex gap-2">
                  <Badge tone="muted">{account.platform}</Badge>
                  <Badge tone={account.active ? "success" : "muted"}>{account.active ? "active" : "inactive"}</Badge>
                  <Badge tone="muted">{account.approvalMode}</Badge>
                </div>
                <p className="text-sm font-medium">{account.displayName ?? account.username}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
