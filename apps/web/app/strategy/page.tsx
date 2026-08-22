import Link from "next/link";
import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { RunStrategyReviewButton } from "../../components/run-strategy-review-button";
import { AccountFilterBar } from "../../components/account-filter-bar";

export const dynamic = "force-dynamic";

const NOT_ENOUGH_DATA_OBSERVATION = "Not enough performance data yet.";

type RecommendedMixEntry = { label: string; weight: number; rationale: string };
type RecommendedTimeEntry = { window: string; rationale: string };
type ExperimentEntry = { hypothesis: string; variable: string; control: string; variant: string };

export default async function StrategyPage({ searchParams }: { searchParams: { accountId?: string } }) {
  const workspace = await getDefaultWorkspace();
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });
  const accountId = accounts.some((a) => a.id === searchParams.accountId) ? searchParams.accountId : undefined;

  // "All accounts" shows workspace-wide reviews (socialAccountId: null) — not just
  // whichever account's review happens to be newest — so the shown data always
  // matches the selected scope.
  const strategy = await prisma.strategy.findFirst({
    where: { workspaceId: workspace.id, socialAccountId: accountId ?? null },
    orderBy: { createdAt: "desc" },
  });

  const observations = (strategy?.observations as string[] | null) ?? [];
  const coldStart = !strategy || (observations.length === 1 && observations[0] === NOT_ENOUGH_DATA_OBSERVATION);

  const winningTopics = (strategy?.winningTopics as string[] | null) ?? [];
  const losingTopics = (strategy?.losingTopics as string[] | null) ?? [];
  const winningHooks = (strategy?.winningHooks as string[] | null) ?? [];
  const losingHooks = (strategy?.losingHooks as string[] | null) ?? [];
  const winningFormats = (strategy?.winningFormats as string[] | null) ?? [];
  const recommendedMix = (strategy?.recommendedMix as RecommendedMixEntry[] | null) ?? [];
  const recommendedTimes = (strategy?.recommendedTimes as RecommendedTimeEntry[] | null) ?? [];
  const experiments = (strategy?.experiments as ExperimentEntry[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Strategy</h1>
          <p className="text-sm text-muted-foreground">Weekly AI review of what is and isn&apos;t working.</p>
        </div>
        <RunStrategyReviewButton socialAccountId={accountId} />
      </div>

      <AccountFilterBar accounts={accounts} basePath="/strategy" selectedAccountId={accountId} />

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
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Current Learnings</h3>
              {coldStart ? (
                <p className="text-muted-foreground">{NOT_ENOUGH_DATA_OBSERVATION}</p>
              ) : observations.length > 0 ? (
                observations.map((obs, i) => <p key={i}>{obs}</p>)
              ) : (
                <p className="text-muted-foreground">No strong observations yet — not enough sample size.</p>
              )}
            </CardContent>
          </Card>

          {!coldStart && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <PatternListCard title="Winning Patterns" groups={[
                  { label: "Topics", values: winningTopics },
                  { label: "Hooks", values: winningHooks },
                  { label: "Formats", values: winningFormats },
                ]} tone="success" />
                <PatternListCard title="Losing Patterns" groups={[
                  { label: "Topics", values: losingTopics },
                  { label: "Hooks", values: losingHooks },
                ]} tone="destructive" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recommended Content Mix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {recommendedMix.length === 0 ? (
                    <p className="text-muted-foreground">No recommendation yet.</p>
                  ) : (
                    recommendedMix.map((entry, i) => (
                      <div key={i} className="border-b border-border pb-2 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{entry.label}</span>
                          <span className="text-muted-foreground">{Math.round(entry.weight * 100)}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.rationale}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recommended Posting Times</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {recommendedTimes.length === 0 ? (
                      <p className="text-muted-foreground">No recommendation yet.</p>
                    ) : (
                      recommendedTimes.map((entry, i) => (
                        <div key={i} className="border-b border-border pb-2 last:border-0">
                          <span className="font-medium">{entry.window}</span>
                          <p className="text-xs text-muted-foreground">{entry.rationale}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Experiments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {experiments.length === 0 ? (
                      <p className="text-muted-foreground">No experiments proposed this period.</p>
                    ) : (
                      experiments.map((entry, i) => (
                        <div key={i} className="border-b border-border pb-2 last:border-0">
                          <p className="font-medium">{entry.hypothesis}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.variable}: {entry.control} vs {entry.variant}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PatternListCard({
  title,
  groups,
  tone,
}: {
  title: string;
  groups: { label: string; values: string[] }[];
  tone: "success" | "destructive";
}) {
  const hasAny = groups.some((g) => g.values.length > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!hasAny ? (
          <p className="text-muted-foreground">Not enough performance data yet for this breakdown.</p>
        ) : (
          groups
            .filter((g) => g.values.length > 0)
            .map((group) => (
              <div key={group.label}>
                <span className="text-xs font-semibold uppercase text-muted-foreground">{group.label}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {group.values.map((value) => (
                    <Badge key={value} tone={tone}>
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
        )}
      </CardContent>
    </Card>
  );
}
