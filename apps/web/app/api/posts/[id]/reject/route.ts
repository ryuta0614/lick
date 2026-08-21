import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { assertPostTransition, InvalidPostTransitionError } from "@social-growth-os/shared";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  try {
    assertPostTransition(post.status, "REJECTED");
  } catch (error) {
    if (error instanceof InvalidPostTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const updated = await prisma.post.update({ where: { id: post.id }, data: { status: "REJECTED" } });
  return NextResponse.json(updated);
}
