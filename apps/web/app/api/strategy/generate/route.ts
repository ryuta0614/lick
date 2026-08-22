import { NextResponse } from "next/server";
import { getDefaultWorkspace } from "../../../../lib/workspace";
import { enqueueWeeklyStrategyReview } from "../../../../lib/queues";

export async function POST(request: Request) {
  const workspace = await getDefaultWorkspace();
  const body = await request.json().catch(() => ({}));
  const socialAccountId = typeof body?.socialAccountId === "string" ? body.socialAccountId : undefined;
  await enqueueWeeklyStrategyReview({ workspaceId: workspace.id, socialAccountId });
  return NextResponse.json({ queued: true }, { status: 202 });
}
