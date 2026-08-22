import { notFound } from "next/navigation";
import { prisma } from "../../../lib/db";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { PostActions } from "../../../components/post-actions";
import { PublishModeBadge } from "../../../components/publish-mode-badge";
import { resolvePublishMode } from "../../../lib/publish-mode";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      idea: true,
      scores: { orderBy: { createdAt: "desc" } },
      variants: { orderBy: { createdAt: "desc" } },
      analytics: { orderBy: { capturedAt: "desc" }, take: 5 },
      socialAccount: { include: { credential: true } },
    },
  });

  if (!post) notFound();

  const latestScore = post.scores[0];
  const publishMode = resolvePublishMode(post.socialAccount);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge tone="muted">{post.platform}</Badge>
        <Badge>{post.status}</Badge>
        <PublishModeBadge mode={publishMode} />
      </div>

      <Card>
        <CardContent className="pt-6 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Platform</span>
              <p className="font-medium">{post.platform}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Account</span>
              <p className="font-medium">
                {post.socialAccount.username ? `@${post.socialAccount.username}` : post.socialAccount.id}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Mode</span>
              <p className="font-medium">{publishMode.replace("_", " ")}</p>
            </div>
          </div>
          {publishMode === "REAL" && (
            <p className="mt-3 rounded-md bg-red-50 p-2 text-xs font-semibold text-destructive">
              ⚠ REAL THREADS POST @{post.socialAccount.username ?? post.socialAccount.id} — publishing/approving this
              post will post to a REAL Threads account. This is not reversible via this app.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Copy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{post.text}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <PostActions
            postId={post.id}
            status={post.status}
            isRealPublish={publishMode === "REAL"}
            username={post.socialAccount.username ?? post.socialAccount.id}
          />
        </CardContent>
      </Card>

      {post.idea && (
        <Card>
          <CardHeader>
            <CardTitle>Idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Title:</span> {post.idea.title}
            </p>
            <p>
              <span className="text-muted-foreground">Angle:</span> {post.idea.angle}
            </p>
            <p>
              <span className="text-muted-foreground">Hook type:</span> {post.idea.hookType}
            </p>
            <p>
              <span className="text-muted-foreground">Emotion:</span> {post.idea.emotion}
            </p>
          </CardContent>
        </Card>
      )}

      {latestScore && (
        <Card>
          <CardHeader>
            <CardTitle>AI Score — {latestScore.qualityScore}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <ScoreRow label="Hook" value={latestScore.hook} />
            <ScoreRow label="Originality" value={latestScore.originality} />
            <ScoreRow label="Usefulness" value={latestScore.usefulness} />
            <ScoreRow label="Clarity" value={latestScore.clarity} />
            <ScoreRow label="Shareability" value={latestScore.shareability} />
            <ScoreRow label="Audience fit" value={latestScore.audienceFit} />
            <ScoreRow label="Specificity" value={latestScore.specificity} />
            <ScoreRow label="Conversion" value={latestScore.conversionPotential} />
            <ScoreRow label="Brand fit" value={latestScore.brandFit} />
            <ScoreRow label="Risk" value={latestScore.risk} />
          </CardContent>
        </Card>
      )}

      {post.variants.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Variants ({post.variants.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {post.variants.map((variant) => (
              <div key={variant.id} className="rounded-md border border-border p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  {variant.selected && <Badge tone="success">selected</Badge>}
                  {variant.hookType && <Badge tone="muted">{variant.hookType}</Badge>}
                </div>
                <p className="line-clamp-3">{variant.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {post.analytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {post.analytics.map((snapshot) => (
              <div key={snapshot.id} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span className="text-muted-foreground">{snapshot.capturedAt.toLocaleString()}</span>
                <span>
                  {snapshot.impressions ?? "-"} impr · {snapshot.likes ?? "-"} likes · {snapshot.replies ?? "-"}{" "}
                  replies · {snapshot.shares ?? "-"} shares
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
