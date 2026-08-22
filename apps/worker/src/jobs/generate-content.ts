import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@social-growth-os/database";
import { calculatePostMetrics, computeContentHash, ContentValidationError } from "@social-growth-os/shared";
import { IdeaGenerator, runContentTournament, type PersonaBrief } from "@social-growth-os/content-engine";
import {
  analyzeAccountPerformance,
  buildGenerationContext,
  extractPostFeatures,
  type PublishedPostRecord,
} from "@social-growth-os/analytics";
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
 *
 * The Writer also receives a compressed generation context — Persona + Idea
 * + current Strategy + Performance Learnings (CLAUDE.md Phase 2.5 STEP 13) —
 * built live from this account's published-post performance. Never raw DB
 * rows: only the Learning Engine's already-aggregated output crosses into
 * the prompt (STEP 9/11).
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

  const [recentWinnerPosts, recentLoserPosts, generationContext] = await Promise.all([
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
    buildAccountGenerationContext(data.workspaceId, data.socialAccountId),
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
    generationContext,
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
      cta: winner.draft.cta,
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

/**
 * Fetches this account's published posts + latest analytics snapshot,
 * extracts features, runs the Learning Engine, and folds in the latest
 * Strategy's observations if one exists. Never throws for "no data yet" —
 * buildGenerationContext degrades gracefully (CLAUDE.md STEP 13/16).
 */
async function buildAccountGenerationContext(workspaceId: string, socialAccountId: string) {
  const [publishedPosts, latestStrategy] = await Promise.all([
    prisma.post.findMany({
      where: { socialAccountId, status: "PUBLISHED" },
      include: {
        idea: { select: { topic: true, hookType: true, emotion: true, contentType: true } },
        variants: { select: { selected: true, hookType: true } },
        analytics: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
    }),
    prisma.strategy.findFirst({ where: { workspaceId }, orderBy: { createdAt: "desc" } }),
  ]);

  const records: PublishedPostRecord[] = publishedPosts.map((post) => {
    const snapshot = post.analytics[0];
    const features = extractPostFeatures({
      id: post.id,
      platform: post.platform,
      text: post.text,
      cta: post.cta,
      publishedAt: post.publishedAt,
      idea: post.idea,
      variants: post.variants,
    });
    const metrics = calculatePostMetrics({
      impressions: snapshot?.impressions,
      likes: snapshot?.likes,
      replies: snapshot?.replies,
      shares: snapshot?.shares,
      linkClicks: snapshot?.linkClicks,
      followersGained: snapshot?.followersGained,
    });
    return { ...features, metrics };
  });

  const analysis = analyzeAccountPerformance(records);
  const strategyObservations = Array.isArray(latestStrategy?.observations)
    ? (latestStrategy.observations as unknown[]).filter((o): o is string => typeof o === "string")
    : undefined;

  return buildGenerationContext(analysis, { strategyObservations });
}
