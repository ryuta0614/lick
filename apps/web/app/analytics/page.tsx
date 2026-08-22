import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { calculatePostMetrics } from "@social-growth-os/shared";
import {
  analyzeAccountPerformance,
  extractPostFeatures,
  type AccountPerformanceAnalysis,
  type LearningDimension,
  type PublishedPostRecord,
} from "@social-growth-os/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge, type BadgeTone } from "../../components/ui/badge";

export const dynamic = "force-dynamic";

const TOP_SECTIONS: { dimension: LearningDimension; title: string; describeValue?: (value: string) => string }[] = [
  { dimension: "topic", title: "Top Topics" },
  { dimension: "hookType", title: "Top Hooks" },
  { dimension: "postingHour", title: "Top Posting Times", describeValue: (v) => `${v}:00` },
  { dimension: "contentType", title: "Top Content Types" },
];

export default async function AnalyticsPage() {
  const workspace = await getDefaultWorkspace();

  const posts = await prisma.post.findMany({
    where: { workspaceId: workspace.id, status: "PUBLISHED" },
    include: {
      idea: { select: { topic: true, hookType: true, emotion: true, contentType: true } },
      variants: { select: { selected: true, hookType: true } },
      analytics: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });

  const records: PublishedPostRecord[] = posts.map((post) => {
    const snapshot = post.analytics[0];
    const features = extractPostFeatures({
      id: post.id,
      platform: post.platform,
      text: post.text,
      cta: post.cta,
      publishedAt: post.publishedAt,
      idea: post.idea,
      variants: post.variants,
    });
    const metrics = calculatePostMetrics({
      impressions: snapshot?.impressions,
      likes: snapshot?.likes,
      replies: snapshot?.replies,
      shares: snapshot?.shares,
      linkClicks: snapshot?.linkClicks,
      followersGained: snapshot?.followersGained,
    });
    return { ...features, metrics };
  });

  const analysis = analyzeAccountPerformance(records);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Engagement rate by dimension, compared against this account&apos;s own baseline.
        </p>
      </div>

      {analysis.coldStart ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Not enough performance data yet. Publish more posts and let analytics collect — breakdowns need a few
            measured posts before they mean anything.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {TOP_SECTIONS.map((section) => (
            <DimensionCard key={section.dimension} section={section} analysis={analysis} />
          ))}
        </div>
      )}
    </div>
  );
}

function DimensionCard({
  section,
  analysis,
}: {
  section: (typeof TOP_SECTIONS)[number];
  analysis: AccountPerformanceAnalysis;
}) {
  const stats = analysis.dimensions[section.dimension] ?? [];
  const ranked = [...stats].sort((a, b) => (b.relativeLift ?? -Infinity) - (a.relativeLift ?? -Infinity)).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {ranked.length === 0 ? (
          <p className="text-muted-foreground">Not enough performance data yet for this breakdown.</p>
        ) : (
          ranked.map((stat) => (
            <div key={stat.dimensionValue} className="flex items-center justify-between border-b border-border py-2 last:border-0">
              <div>
                <span className="font-medium">
                  {section.describeValue ? section.describeValue(stat.dimensionValue) : stat.dimensionValue}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  n={stat.sampleSize} · {(stat.median * 100).toFixed(1)}% engagement
                </span>
              </div>
              <div className="flex items-center gap-2">
                {stat.relativeLift != null && (
                  <span className={stat.relativeLift >= 0 ? "text-emerald-700" : "text-red-700"}>
                    {stat.relativeLift >= 0 ? "+" : ""}
                    {Math.round(stat.relativeLift * 100)}%
                  </span>
                )}
                <ConfidenceBadge confidence={stat.confidence} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const CONFIDENCE_TONE: Record<string, BadgeTone> = {
  INSUFFICIENT_DATA: "muted",
  LOW: "warning",
  MEDIUM: "default",
  HIGH: "success",
};

function ConfidenceBadge({ confidence }: { confidence: string }) {
  return <Badge tone={CONFIDENCE_TONE[confidence] ?? "muted"}>{confidence}</Badge>;
}
