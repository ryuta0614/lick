import type { PostMetricsResult } from "@social-growth-os/shared";
import type { AccountPerformanceAnalysis, WinningPattern } from "./engine.js";

export type GenerationMix = {
  proven: number;
  adjacent: number;
  exploration: number;
};

/** Defaults per CLAUDE.md Phase 2.5 STEP 10: 70% proven / 20% adjacent / 10% exploration. */
export const DEFAULT_GENERATION_MIX: GenerationMix = { proven: 0.7, adjacent: 0.2, exploration: 0.1 };

/** Used when there's data, but nothing has reached MEDIUM+ confidence yet — lean toward exploring. */
const LOW_CONFIDENCE_MIX: GenerationMix = { proven: 0.3, adjacent: 0.3, exploration: 0.4 };

/** Used when there isn't even enough data to call it "low confidence" (CLAUDE.md STEP 16 cold start). */
const COLD_START_MIX: GenerationMix = { proven: 0, adjacent: 0, exploration: 1 };

export type GenerationMode = "proven" | "adjacent" | "exploration";

/** Picks one mode per generation call, weighted by `mix`. Never a hard rule — see buildGenerationContext. */
export function pickGenerationMode(mix: GenerationMix, random: () => number = Math.random): GenerationMode {
  const r = random();
  if (r < mix.proven) return "proven";
  if (r < mix.proven + mix.adjacent) return "adjacent";
  return "exploration";
}

/**
 * Raises the exploration share when the account doesn't have reliable
 * signal yet (CLAUDE.md Phase 2.5 STEP 10: "データ不足時はexploration比率を高めてください").
 * Never converges to 100% proven-pattern reuse even with lots of data —
 * `baseMix` always keeps a floor of adjacent/exploration.
 */
export function resolveGenerationMix(
  analysis: Pick<AccountPerformanceAnalysis, "coldStart" | "winningPatterns">,
  baseMix: GenerationMix = DEFAULT_GENERATION_MIX,
): GenerationMix {
  if (analysis.coldStart) return COLD_START_MIX;
  const hasReliableSignal = analysis.winningPatterns.some((p) => p.confidence === "MEDIUM" || p.confidence === "HIGH");
  return hasReliableSignal ? baseMix : LOW_CONFIDENCE_MIX;
}

export type GenerationContext = {
  /** Reference info for the Writer — deliberately plain sentences, never a rigid schema the AI is told to obey (CLAUDE.md STEP 9). */
  recentLearnings: string[];
  mode: GenerationMode;
};

export type BuildGenerationContextOptions = {
  /** Strategy.observations from the latest weekly review, if one exists — folded in alongside live pattern analysis. */
  strategyObservations?: string[] | null;
  maxLearnings?: number;
  mix?: GenerationMix;
  random?: () => number;
};

/**
 * Compresses an AccountPerformanceAnalysis into a short list of plain-English
 * learnings for the Writer, plus which generation mode to lean into this
 * call. Works fine with no Strategy row at all (CLAUDE.md STEP 13).
 */
export function buildGenerationContext(
  analysis: AccountPerformanceAnalysis,
  options: BuildGenerationContextOptions = {},
): GenerationContext {
  const maxLearnings = options.maxLearnings ?? 5;
  const mix = resolveGenerationMix(analysis, options.mix ?? DEFAULT_GENERATION_MIX);
  const mode = pickGenerationMode(mix, options.random);

  if (analysis.coldStart) {
    return { recentLearnings: [], mode };
  }

  const winning = analysis.winningPatterns.slice(0, maxLearnings).map(explainWinningPattern);
  const losing = analysis.losingPatterns.slice(0, Math.max(0, maxLearnings - winning.length)).map(explainLosingPattern);
  const strategyNotes = (options.strategyObservations ?? []).slice(0, Math.max(0, maxLearnings - winning.length - losing.length));

  return { recentLearnings: [...winning, ...losing, ...strategyNotes].slice(0, maxLearnings), mode };
}

/**
 * Plain-English, sample-size-citing sentence for a winning pattern. Reused
 * by the weekly Strategy job so its `observations` guarantee the
 * evidence-based phrasing CLAUDE.md section 23 requires, by construction
 * rather than by hoping the AI phrases it correctly.
 */
export function explainWinningPattern(pattern: WinningPattern): string {
  return explainPattern(pattern, "has outperformed", "higher");
}

/** Same as {@link explainWinningPattern}, for underperforming patterns. */
export function explainLosingPattern(pattern: WinningPattern): string {
  return explainPattern(pattern, "has underperformed", "lower");
}

function explainPattern(pattern: WinningPattern, verb: string, fallbackAdjective: string): string {
  const label = describeDimensionValue(pattern.dimension, pattern.value);
  const metric = metricLabel(pattern.metric);
  const confidenceNote = pattern.confidence === "LOW" ? ", though confidence is still low" : "";

  if (pattern.relativeLift == null) {
    return `${label} shows ${fallbackAdjective} ${metric} than the account baseline over ${pattern.sampleSize} posts${confidenceNote}.`;
  }
  const pct = Math.round(Math.abs(pattern.relativeLift) * 100);
  return `${label} ${verb} the account median ${metric} by ${pct}% over ${pattern.sampleSize} posts${confidenceNote}.`;
}

function describeDimensionValue(dimension: string, value: string): string {
  switch (dimension) {
    case "hookType":
      return `"${value}" hooks`;
    case "topic":
      return `Posts about "${value}"`;
    case "contentType":
      return `"${value}" content`;
    case "emotion":
      return `Posts evoking "${value}"`;
    case "cta":
      return `Posts with a "${value}" CTA`;
    case "lengthBucket":
      return `Posts in the ${value}-character range`;
    case "weekday":
      return `Posts published on ${titleCase(value)}`;
    case "postingHour":
      return `Posts published around ${value}:00`;
    case "platform":
      return `${value} posts`;
    default:
      return `${dimension}="${value}"`;
  }
}

function metricLabel(metric: keyof PostMetricsResult): string {
  switch (metric) {
    case "engagementRate":
      return "engagement rate";
    case "likeRate":
      return "like rate";
    case "replyRate":
      return "reply rate";
    case "shareRate":
      return "share rate";
    case "followerConversionRate":
      return "follower conversion rate";
    case "clickRate":
      return "click rate";
    case "revenuePer1kImpressions":
      return "revenue per 1K impressions";
  }
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
