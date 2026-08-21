import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { enqueuePublishPost } from "../../../../../lib/queues";

/** "Publish now": enqueues an immediate publish-post job. The state transition itself happens inside the job (CLAUDE.md section 17). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (post.status !== "APPROVED" && post.status !== "SCHEDULED" && post.status !== "QUEUED") {
    return NextResponse.json({ error: `Cannot publish a post in status ${post.status}` }, { status: 409 });
  }

  await enqueuePublishPost({ postId: post.id }, 0);
  return NextResponse.json({ queued: true });
}
