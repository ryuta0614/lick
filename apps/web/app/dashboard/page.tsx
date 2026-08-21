import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export const dynamic = "force-dynamic";

type WindowStats = {
  impressions: number;
  followersGained: number;
  engagement: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

async function getStatsForWindow(workspaceId: string, days: number): Promise<WindowStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.postAnalyticsSnapshot.findMany({
    where: { post: { workspaceId }, capturedAt: { gte: since } },
  });

  const conversions = await prisma.conversion.findMany({
    where: { post: { workspaceId }, occurredAt: { gte: since } },
  });

  const stats = snapshots.reduce<WindowStats>(
    (acc, s) => {
      acc.impressions += s.impressions ?? 0;
      acc.followersGained += s.followersGained ?? 0;
      acc.engagement += (s.likes ?? 0) + (s.replies ?? 0) + (s.shares ?? 0);
      acc.clicks += s.linkClicks ?? 0;
      return acc;
    },
    { impressions: 0, followersGained: 0, engagement: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  stats.conversions = conversions.length;
  stats.revenue = conversions.reduce((sum, c) => sum + Number(c.value ?? 0), 0);

  return stats;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export default async function DashboardPage() {
  const workspace = await getDefaultWorkspace();
  const [d7, d30, d90] = await Promise.all([
    getStatsForWindow(workspace.id, 7),
    getStatsForWindow(workspace.id, 30),
    getStatsForWindow(workspace.id, 90),
  ]);

  const revenuePer1k = d7.impressions > 0 ? (d7.revenue / d7.impressions) * 1000 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{workspace.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Impressions" value={d7.impressions.toLocaleString()} />
        <StatCard label="Followers Gained" value={`+${d7.followersGained.toLocaleString()}`} />
        <StatCard label="Engagement" value={d7.engagement.toLocaleString()} />
        <StatCard label="Clicks" value={d7.clicks.toLocaleString()} />
        <StatCard label="Conversions" value={d7.conversions.toLocaleString()} />
        <StatCard label="Revenue / 1K Impressions" value={formatCurrency(revenuePer1k)} highlight />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <WindowCard title="Last 7 days" stats={d7} />
        <WindowCard title="Last 30 days" stats={d30} />
        <WindowCard title="Last 90 days" stats={d90} />
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={highlight ? "text-2xl font-bold text-primary" : "text-2xl font-bold"}>{value}</div>
      </CardContent>
    </Card>
  );
}

function WindowCard({ title, stats }: { title: string; stats: WindowStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Impressions" value={stats.impressions.toLocaleString()} />
        <Row label="Followers gained" value={`+${stats.followersGained.toLocaleString()}`} />
        <Row label="Engagement" value={stats.engagement.toLocaleString()} />
        <Row label="Clicks" value={stats.clicks.toLocaleString()} />
        <Row label="Conversions" value={stats.conversions.toLocaleString()} />
        <Row label="Revenue" value={formatCurrency(stats.revenue)} />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
