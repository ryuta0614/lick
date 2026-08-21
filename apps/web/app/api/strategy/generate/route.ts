import { NextResponse } from "next/server";
import { getDefaultWorkspace } from "../../../../lib/workspace";
import { enqueueWeeklyStrategyReview } from "../../../../lib/queues";

export async function POST() {
  const workspace = await getDefaultWorkspace();
  await enqueueWeeklyStrategyReview({ workspaceId: workspace.id });
  return NextResponse.json({ queued: true }, { status: 202 });
}
