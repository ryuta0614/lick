import { NextResponse } from "next/server";
import { z } from "zod";
import { runGenerateContentJob } from "@social-growth-os/worker/jobs";
import { getDefaultPersona, getDefaultSocialAccount, getDefaultWorkspace } from "../../../../lib/workspace";
import { prisma } from "../../../../lib/db";

const RequestSchema = z.object({ topic: z.string().min(1), socialAccountId: z.string().optional() });

/**
 * POST /api/posts/generate — Topic -> IdeaGenerator -> tournament -> DB (REVIEW).
 * Invoked synchronously (not via the content-generation queue) so the
 * "Generate" button in the UI gets an immediate response; the same queue +
 * worker path (apps/worker) exists for programmatic/scheduled generation.
 */
export async function POST(request: Request) {
  const body = RequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }

  const workspace = await getDefaultWorkspace();
  const [persona, socialAccount] = await Promise.all([
    getDefaultPersona(workspace.id),
    body.data.socialAccountId
      ? prisma.socialAccount.findUniqueOrThrow({ where: { id: body.data.socialAccountId } })
      : getDefaultSocialAccount(workspace.id),
  ]);

  if (socialAccount.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "socialAccountId does not belong to this workspace" }, { status: 400 });
  }

  try {
    const result = await runGenerateContentJob({
      workspaceId: workspace.id,
      socialAccountId: socialAccount.id,
      personaId: persona.id,
      topic: body.data.topic,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Content generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
