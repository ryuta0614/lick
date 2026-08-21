import type { AICallMetadata, AIProvider } from "@social-growth-os/ai";
import type { ContentIdeaCandidate, HookCandidate, PostCritique, PostDraft } from "@social-growth-os/ai";
import type { Platform } from "@social-growth-os/shared";
import type { PersonaBrief } from "../ideas/idea-generator.js";
import { HookGenerator } from "../writer/hook-generator.js";
import { PostWriter } from "../writer/post-writer.js";
import type { HistoricalPost } from "../writer/post-writer.js";
import { PostCritic } from "../critic/post-critic.js";
import type { CriticDecision, CriticWeights } from "../critic/scoring.js";

export type TournamentConfig = {
  hookCount: number;
  fullCandidateCount: number;
  winnerCount: number;
};

/** Defaults per CLAUDE.md section 15: kept small on purpose to bound AI cost. */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  hookCount: 5,
  fullCandidateCount: 3,
  winnerCount: 1,
};

export type RunTournamentInput = {
  idea: ContentIdeaCandidate;
  platform: Platform;
  persona: PersonaBrief;
  traceId: string;
  recentWinners?: HistoricalPost[];
  recentLosers?: HistoricalPost[];
  config?: Partial<TournamentConfig>;
  criticWeights?: CriticWeights;
  model?: string;
};

export type TournamentCandidate = {
  hook: HookCandidate;
  draft: PostDraft;
  critique: PostCritique;
  qualityScore: number;
  decision: CriticDecision;
};

export type TournamentResult = {
  winners: TournamentCandidate[];
  losers: TournamentCandidate[];
  /** Every AI call made during this tournament, for AIExecution logging (CLAUDE.md section 8/31). */
  aiCalls: AICallMetadata[];
};

/**
 * idea -> N hooks -> top K hooks -> K full posts -> critique -> winner(s)
 * (CLAUDE.md section 15). Hook candidates already come back best-first from
 * the HookGenerator, so "top K" is simply the first K.
 */
export async function runContentTournament(
  provider: AIProvider,
  input: RunTournamentInput,
): Promise<TournamentResult> {
  const config = { ...DEFAULT_TOURNAMENT_CONFIG, ...input.config };

  const hookGenerator = new HookGenerator(provider);
  const writer = new PostWriter(provider);
  const critic = new PostCritic(provider);
  const aiCalls: AICallMetadata[] = [];

  const { hooks, metadata: hooksMetadata } = await hookGenerator.generate({
    idea: input.idea,
    platform: input.platform,
    count: config.hookCount,
    traceId: input.traceId,
    model: input.model,
  });
  aiCalls.push(hooksMetadata);

  const topHooks = hooks.slice(0, config.fullCandidateCount);

  const candidates: TournamentCandidate[] = [];
  for (const hook of topHooks) {
    const { draft, metadata: writerMetadata } = await writer.write({
      idea: input.idea,
      hook,
      platform: input.platform,
      persona: input.persona,
      recentWinners: input.recentWinners,
      recentLosers: input.recentLosers,
      traceId: input.traceId,
      model: input.model,
    });
    aiCalls.push(writerMetadata);

    const { critique, qualityScore, decision, metadata: criticMetadata } = await critic.critique({
      text: draft.text,
      platform: input.platform,
      persona: input.persona,
      traceId: input.traceId,
      model: input.model,
      weights: input.criticWeights,
    });
    aiCalls.push(criticMetadata);

    candidates.push({ hook, draft, critique, qualityScore, decision });
  }

  const ranked = [...candidates].sort((a, b) => b.qualityScore - a.qualityScore);
  const winners = ranked.slice(0, config.winnerCount);
  const losers = ranked.slice(config.winnerCount);

  return { winners, losers, aiCalls };
}
