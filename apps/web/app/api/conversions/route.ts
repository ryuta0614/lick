import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/db";
import { ConversionWebhookSchema, resolveAttribution } from "@social-growth-os/analytics";

/** Revenue attribution webhook (CLAUDE.md section 25). External input, so it's Zod-validated at the boundary. */
export async function POST(request: Request) {
  const body = ConversionWebhookSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { postId, campaignSlug } = resolveAttribution(body.data);

  let campaignId: string | undefined;
  if (campaignSlug) {
    const post = postId ? await prisma.post.findUnique({ where: { id: postId } }) : null;
    if (post) {
      const campaign = await prisma.campaign.upsert({
        where: { workspaceId_slug: { workspaceId: post.workspaceId, slug: campaignSlug } },
        update: {},
        create: { workspaceId: post.workspaceId, name: campaignSlug, slug: campaignSlug },
      });
      campaignId = campaign.id;
    }
  }

  const conversion = await prisma.conversion.create({
    data: {
      postId: postId ?? undefined,
      campaignId,
      type: body.data.type,
      value: body.data.value,
      currency: body.data.currency ?? "JPY",
      externalId: body.data.externalId,
      occurredAt: body.data.occurredAt,
      metadata: body.data.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json(conversion, { status: 201 });
}
