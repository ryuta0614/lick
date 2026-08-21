import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { assertPostTransition, InvalidPostTransitionError } from "@social-growth-os/shared";
import { enqueuePublishPost } from "../../../../../lib/queues";

const RequestSchema = z.object({ scheduledAt: z.coerce.date() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = RequestSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  try {
    assertPostTransition(post.status, "SCHEDULED");
  } catch (error) {
    if (error instanceof InvalidPostTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { status: "SCHEDULED", scheduledAt: body.data.scheduledAt },
  });

  const delayMs = Math.max(0, body.data.scheduledAt.getTime() - Date.now());
  await enqueuePublishPost({ postId: post.id }, delayMs);

  return NextResponse.json(updated);
}
