import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultWorkspace } from "../../../../lib/workspace";
import { enqueueCollectTrends } from "../../../../lib/queues";

const RequestSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().optional(),
        url: z.string().url().optional(),
        source: z.string().optional(),
      }),
    )
    .min(1),
});

/** Manual/mock trend input only (CLAUDE.md STEP 1: no unauthorized scraping). */
export async function POST(request: Request) {
  const body = RequestSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const workspace = await getDefaultWorkspace();
  await enqueueCollectTrends({ workspaceId: workspace.id, topics: body.data.topics });

  return NextResponse.json({ queued: true }, { status: 202 });
}
