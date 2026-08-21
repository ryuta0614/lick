import Link from "next/link";
import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { calculatePostMetrics } from "@social-growth-os/shared";
import { aggregateByDimension } from "@social-growth-os/analytics";
import { Card, CardContent } from "../../components/ui/card";

export const dynamic = "force-dynamic";

const DIMENSIONS = [
  { key: "platform", label: "Platform" },
  { key: "topic", label: "Topic" },
  { key: "hookType", label: "Hook" },
  { key: "cta", label: "CTA" },
] as const;
type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export default async function AnalyticsPage({ searchParams }: { searchParams: { by?: string } }) {
  const workspace = await getDefaultWorkspace();
  const by = (DIMENSIONS.some((d) => d.key === searchParams.by) ? searchParams.by : "hookType") as DimensionKey;

  const posts = await prisma.post.findMany({
    where: { workspaceId: workspace.id, status: "PUBLISHED" },
    include: { idea: true, analytics: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  const samples = posts.flatMap((post) => {
    const snapshot = post.analytics[0];
    if (!snapshot) return [];
    const metrics = calculatePostMetrics({
      impressions: snapshot.impressions,
      likes: snapshot.likes,
      replies: snapshot.replies,
      shares: snapshot.shares,
    });
    if (metrics.engagementRate == null) return [];

    const dimensionValue = by === "platform" ? post.platform : by === "topic" ? post.idea?.topic : post.idea?.hookType;
    if (!dimensionValue) return [];

    return [{ dimensionValue, metricValue: metrics.engagementRate }];
  });

  const stats = aggregateByDimension(samples).sort((a, b) => b.average - a.average);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Engagement rate broken down by dimension.</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {DIMENSIONS.map((d) => (
          <Link
            key={d.key}
            href={`/analytics?by=${d.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              d.key === by ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {d.label}
          </Link>
        ))}
      </div>

      {stats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published posts with analytics yet. Publish a post and wait for the analytics-collection jobs to run.
        </p>
      ) : (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            {stats.map((stat) => (
              <div key={stat.dimensionValue} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <div>
                  <span className="font-medium">{stat.dimensionValue}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    n={stat.sampleSize} · {stat.confidence} confidence
                  </span>
                </div>
                <span>{(stat.average * 100).toFixed(2)}% engagement</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
