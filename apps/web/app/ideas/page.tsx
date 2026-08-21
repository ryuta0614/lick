import { prisma } from "../../lib/db";
import { getDefaultWorkspace } from "../../lib/workspace";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const workspace = await getDefaultWorkspace();
  const ideas = await prisma.contentIdea.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { posts: { select: { id: true, status: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ideas</h1>
        <p className="text-sm text-muted-foreground">Generated idea board.</p>
      </div>

      {ideas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No ideas yet — generate a post from the Content page to populate this board.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <CardContent className="space-y-2 pt-6 text-sm">
                <div className="flex flex-wrap gap-1">
                  {idea.hookType && <Badge tone="muted">{idea.hookType}</Badge>}
                  {idea.emotion && <Badge tone="muted">{idea.emotion}</Badge>}
                  <Badge tone="muted">{idea.posts.length} post(s)</Badge>
                </div>
                <p className="font-medium">{idea.title}</p>
                <p className="text-muted-foreground">{idea.angle}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
