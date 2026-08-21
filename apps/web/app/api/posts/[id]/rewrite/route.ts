import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { computeContentHash } from "@social-growth-os/shared";
import { runContentTournament, type PersonaBrief } from "@social-growth-os/content-engine";
import { createAIProviderFromEnv, type ContentIdeaCandidate } from "@social-growth-os/ai";
import { createDefaultMockGenerators } from "@social-growth-os/content-engine";

/** AI rewrite: re-runs a small tournament against the same idea and swaps in the new winner (CLAUDE.md STEP 7). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({ where: { id: params.id }, include: { idea: true } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "REVIEW") {
    return NextResponse.json({ error: `Cannot rewrite a post in status ${post.status}` }, { status: 409 });
  }
  if (!post.idea) {
    return NextResponse.json({ error: "Post has no associated idea to rewrite from" }, { status: 422 });
  }

  const persona = await prisma.brandPersona.findFirstOrThrow({ where: { workspaceId: post.workspaceId } });
  const personaBrief: PersonaBrief = {
    niche: persona.niche,
    audience: persona.audience,
    tone: Array.isArray(persona.tone) ? (persona.tone as string[]) : [],
    avoid: Array.isArray(persona.avoid) ? (persona.avoid as string[]) : undefined,
  };

  const idea: ContentIdeaCandidate = {
    title: post.idea.title,
    topic: post.idea.topic,
    angle: post.idea.angle,
    audience: post.idea.audience ?? undefined,
    hookType: (post.idea.hookType as ContentIdeaCandidate["hookType"]) ?? "curiosity",
    emotion: (post.idea.emotion as ContentIdeaCandidate["emotion"]) ?? "curiosity",
    contentType: post.idea.contentType ?? undefined,
    whyNow: post.idea.whyNow ?? undefined,
    conversionIntent: post.idea.conversionIntent ?? undefined,
    originalityNotes: post.idea.originalityNotes ?? undefined,
  };

  const provider = createAIProviderFromEnv({ mockGenerators: createDefaultMockGenerators() });
  const { winners } = await runContentTournament(provider, {
    idea,
    platform: post.platform,
    persona: personaBrief,
    traceId: randomUUID(),
    config: { hookCount: 3, fullCandidateCount: 2, winnerCount: 1 },
  });

  const winner = winners[0];
  if (!winner) return NextResponse.json({ error: "Rewrite produced no candidate" }, { status: 500 });

  const [updatedPost] = await prisma.$transaction([
    prisma.post.update({
      where: { id: post.id },
      data: { text: winner.draft.text, contentHash: computeContentHash(post.socialAccountId, winner.draft.text) },
    }),
    prisma.postVariant.create({
      data: { postId: post.id, text: winner.draft.text, hookType: winner.hook.hookType, selected: true },
    }),
    prisma.postScore.create({
      data: {
        postId: post.id,
        hook: winner.critique.hook,
        originality: winner.critique.originality,
        usefulness: winner.critique.usefulness,
        clarity: winner.critique.clarity,
        shareability: winner.critique.shareability,
        audienceFit: winner.critique.audienceFit,
        specificity: winner.critique.specificity,
        conversionPotential: winner.critique.conversionPotential,
        brandFit: winner.critique.brandFit,
        risk: winner.critique.risk,
        qualityScore: winner.qualityScore,
        reasoning: {
          strengths: winner.critique.strengths,
          weaknesses: winner.critique.weaknesses,
          suggestedChanges: winner.critique.suggestedChanges,
        },
      },
    }),
  ]);

  return NextResponse.json(updatedPost);
}
