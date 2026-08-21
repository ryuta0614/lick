import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { RunStrategyReviewButton } from "../../components/run-strategy-review-button";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const workspace = await getDefaultWorkspace();
  const strategy = await prisma.strategy.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Strategy</h1>
          <p className="text-sm text-muted-foreground">Weekly AI review of what is and isn&apos;t working.</p>
        </div>
        <RunStrategyReviewButton />
      </div>

      {!strategy ? (
        <p className="text-sm text-muted-foreground">
          No strategy review yet. Publish some posts, let analytics collect, then run a review.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Period: {strategy.periodStart.toLocaleDateString()} – {strategy.periodEnd.toLocaleDateString()}{" "}
                (confidence {((strategy.confidence ?? 0) * 100).toFixed(0)}%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(strategy.observations as string[] | null)?.map((obs, i) => <p key={i}>{obs}</p>) ?? (
                <p className="text-muted-foreground">No strong observations yet — not enough sample size.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Winning hooks</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <pre className="overflow-x-auto text-xs">{JSON.stringify(strategy.winningHooks, null, 2)}</pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Losing hooks</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <pre className="overflow-x-auto text-xs">{JSON.stringify(strategy.losingHooks, null, 2)}</pre>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
