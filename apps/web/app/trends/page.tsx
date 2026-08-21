import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { TrendCollectForm } from "../../components/trend-collect-form";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const workspace = await getDefaultWorkspace();
  const trends = await prisma.trend.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trends</h1>
        <p className="text-sm text-muted-foreground">Manual/mock trend input for MVP (CLAUDE.md STEP 1: no scraping).</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <TrendCollectForm />
        </CardContent>
      </Card>

      {trends.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trends yet.</p>
      ) : (
        <div className="space-y-3">
          {trends.map((trend) => {
            const analysis = trend.analyses[0];
            return (
              <Card key={trend.id}>
                <CardContent className="flex items-start justify-between gap-4 pt-6">
                  <div>
                    <div className="mb-1 flex gap-2">
                      <Badge tone="muted">{trend.source}</Badge>
                      {analysis && <Badge>opportunity {analysis.opportunityScore}</Badge>}
                    </div>
                    <p className="text-sm font-medium">{trend.title}</p>
                    {trend.text && <p className="text-sm text-muted-foreground">{trend.text}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
