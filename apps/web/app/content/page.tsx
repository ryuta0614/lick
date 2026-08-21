import Link from "next/link";
import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { GeneratePostForm } from "../../components/generate-post-form";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import type { PostStatus } from "@social-growth-os/shared";

export const dynamic = "force-dynamic";

const TABS: PostStatus[] = ["DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"];

const STATUS_TONE: Record<PostStatus, BadgeTone> = {
  DRAFT: "muted",
  REVIEW: "warning",
  APPROVED: "default",
  SCHEDULED: "default",
  QUEUED: "default",
  PUBLISHING: "default",
  PUBLISHED: "success",
  FAILED: "destructive",
  REJECTED: "destructive",
};

export default async function ContentPage({ searchParams }: { searchParams: { status?: string } }) {
  const workspace = await getDefaultWorkspace();
  const activeStatus = (TABS.includes(searchParams.status as PostStatus) ? searchParams.status : "REVIEW") as PostStatus;

  const posts = await prisma.post.findMany({
    where: { workspaceId: workspace.id, status: activeStatus },
    include: { scores: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="text-sm text-muted-foreground">Generate, review, and publish AI-written posts.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <GeneratePostForm />
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/content?status=${tab}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === activeStatus ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts in {activeStatus}.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const score = post.scores[0];
            return (
              <Link key={post.id} href={`/content/${post.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-start justify-between gap-4 pt-6">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge tone="muted">{post.platform}</Badge>
                        <Badge tone={STATUS_TONE[post.status]}>{post.status}</Badge>
                        {score && <span className="text-xs text-muted-foreground">Score: {score.qualityScore}</span>}
                      </div>
                      <p className="line-clamp-2 text-sm">{post.text}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
