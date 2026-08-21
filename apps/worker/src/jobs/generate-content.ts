import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@social-growth-os/database";
import { computeContentHash, ContentValidationError } from "@social-growth-os/shared";
import { IdeaGenerator, runContentTournament, type PersonaBrief } from "@social-growth-os/content-engine";
import { getAIProvider } from "../ai-provider.js";
import { recordAIExecution } from "../record-ai-execution.js";

export const GenerateContentJobSchema = z.object({
  workspaceId: z.string(),
  socialAccountId: z.string(),
  personaId: z.string(),
  topic: z.string().min(1),
});
export type GenerateContentJobData = z.infer<typeof GenerateContentJobSchema>;

/**
 * Topic -> IdeaGenerator -> tournament (hooks -> writer -> critic) -> DB.
 * Persists the winning candidate as a Post in REVIEW, all candidates as
 * PostVariant rows, and every critique as a PostScore row
 * (CLAUDE.md STEP 7 / sections 12-15).
 */
export async function runGenerateContentJob(rawData: unknown): Promise<{ postId: string }> {
  const data = GenerateContentJobSchema.parse(rawData);
  const traceId = randomUUID();

  const [persona, socialAccount] = await Promise.all([
    prisma.brandPersona.findUniqueOrThrow({ where: { id: data.personaId } }),
    prisma.socialAccount.findUniqueOrThrow({ where: { id: data.socialAccountId } }),
  ]);

  const personaBrief: PersonaBrief = {
    niche: persona.niche,
    audience: persona.audience,
    tone: Array.isArray(persona.tone) ? (persona.tone as string[]) : [],
    avoid: Array.isArray(persona.avoid) ? (persona.avoid as string[]) : undefined,
  };

  const existingTitles = (
    await prisma.contentIdea.findMany({
      where: { workspaceId: data.workspaceId },
      select: { title: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    })
  ).map((i) => i.title);

  const [recentWinnerPosts, recentLoserPosts] = await Promise.all([
    prisma.post.findMany({
      where: { socialAccountId: data.socialAccountId, status: "PUBLISHED" },
      include: { scores: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    prisma.post.findMany({
      where: { socialAccountId: data.socialAccountId, status: "REJECTED" },
      include: { scores: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const provider = getAIProvider();
  const ideaGenerator = new IdeaGenerator(provider);

  const { ideas, metadata: ideaMetadata } = await ideaGenerator.generate({
    topic: data.topic,
    persona: personaBrief,
    traceId,
    existingTitles,
  });
  await recordAIExecution(ideaMetadata, { success: true });

  const bestIdea = ideas[0];
  if (!bestIdea) {
    throw new ContentValidationError(`No ideas generated for topic "${data.topic}"`);
  }

  const savedIdea = await prisma.contentIdea.create({
    data: {
      workspaceId: data.workspaceId,
      title: bestIdea.title,
      topic: bestIdea.topic,
      angle: bestIdea.angle,
      audience: bestIdea.audience,
      hookType: bestIdea.hookType,
      emotion: bestIdea.emotion,
      contentType: bestIdea.contentType,
      whyNow: bestIdea.whyNow,
      conversionIntent: bestIdea.conversionIntent,
      originalityNotes: bestIdea.originalityNotes,
    },
  });

  const { winners, losers, aiCalls } = await runContentTournament(provider, {
    idea: bestIdea,
    platform: socialAccount.platform,
    persona: personaBrief,
    traceId,
    recentWinners: recentWinnerPosts.map((p) => ({ text: p.text ?? "", qualityScore: p.scores[0]?.qualityScore })),
    recentLosers: recentLoserPosts.map((p) => ({ text: p.text ?? "", qualityScore: p.scores[0]?.qualityScore })),
  });
  await Promise.all(aiCalls.map((metadata) => recordAIExecution(metadata, { success: true })));

  const winner = winners[0];
  if (!winner) {
    throw new ContentValidationError("Content tournament produced no winning candidate");
  }

  const post = await prisma.post.create({
    data: {
      workspaceId: data.workspaceId,
      socialAccountId: data.socialAccountId,
      ideaId: savedIdea.id,
      platform: socialAccount.platform,
      status: "REVIEW",
      text: winner.draft.text,
      contentHash: computeContentHash(data.socialAccountId, winner.draft.text),
      generationPromptVersion: "post-writer@1",
    },
  });

  for (const candidate of [...winners, ...losers]) {
    const variant = await prisma.postVariant.create({
      data: {
        postId: post.id,
        text: candidate.draft.text,
        hookType: candidate.hook.hookType,
        selected: candidate === winner,
      },
    });
    await prisma.postScore.create({
      data: {
        postId: post.id,
        hook: candidate.critique.hook,
        originality: candidate.critique.originality,
        usefulness: candidate.critique.usefulness,
        clarity: candidate.critique.clarity,
        shareability: candidate.critique.shareability,
        audienceFit: candidate.critique.audienceFit,
        specificity: candidate.critique.specificity,
        conversionPotential: candidate.critique.conversionPotential,
        brandFit: candidate.critique.brandFit,
        risk: candidate.critique.risk,
        qualityScore: candidate.qualityScore,
        reasoning: {
          strengths: candidate.critique.strengths,
          weaknesses: candidate.critique.weaknesses,
          suggestedChanges: candidate.critique.suggestedChanges,
          variantId: variant.id,
        },
      },
    });
  }

  return { postId: post.id };
}
