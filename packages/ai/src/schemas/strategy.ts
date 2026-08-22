import { z } from "zod";

/**
 * One row of already-aggregated Learning Engine output, as fed into the
 * Strategy-generation prompt. Documents the shape of the *input* the AI
 * sees — dimension/value/sampleSize/lift/confidence only, never raw post
 * text (CLAUDE.md Phase 2.5 STEP 11/12).
 */
export const StrategyPatternInputSchema = z.object({
  dimension: z.string(),
  value: z.string(),
  metric: z.string(),
  sampleSize: z.number().int().nonnegative(),
  relativeLift: z.number().nullable(),
  confidence: z.enum(["INSUFFICIENT_DATA", "LOW", "MEDIUM", "HIGH"]),
});
export type StrategyPatternInput = z.infer<typeof StrategyPatternInputSchema>;

/**
 * The only part of the weekly Strategy that is genuinely AI-generated.
 * winningTopics/losingTopics/winningHooks/winningFormats/observations are
 * computed deterministically from the Learning Engine elsewhere, so their
 * evidence-based phrasing (CLAUDE.md section 23) is guaranteed by
 * construction rather than left to the model.
 */
export const StrategyRecommendationSchema = z.object({
  recommendedMix: z
    .array(
      z.object({
        label: z.string().min(1),
        weight: z.number().min(0).max(1),
        rationale: z.string().min(1),
      }),
    )
    .min(1)
    .max(6),
  recommendedTimes: z
    .array(
      z.object({
        window: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
  experiments: z
    .array(
      z.object({
        hypothesis: z.string().min(1),
        variable: z.string().min(1),
        control: z.string().min(1),
        variant: z.string().min(1),
      }),
    )
    .max(3),
});
export type StrategyRecommendation = z.infer<typeof StrategyRecommendationSchema>;
