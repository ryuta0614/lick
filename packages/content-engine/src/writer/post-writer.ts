import type { AICallMetadata, AIProvider } from "@social-growth-os/ai";
import { PostDraftSchema, type ContentIdeaCandidate, type HookCandidate, type PostDraft } from "@social-growth-os/ai";
import type { Platform } from "@social-growth-os/shared";
import type { PersonaBrief } from "../ideas/idea-generator.js";

export type HistoricalPost = { text: string; qualityScore?: number };

/**
 * Compressed, plain-English performance context from the Learning Engine
 * (packages/analytics/src/learning) — never raw DB rows. `mode` nudges the
 * creative direction; `recentLearnings` are reference info, not commands
 * (CLAUDE.md Phase 2.5 STEP 9).
 */
export type WriterGenerationContext = {
  recentLearnings: string[];
  mode: "proven" | "adjacent" | "exploration";
};

export type WritePostInput = {
  idea: ContentIdeaCandidate;
  hook: HookCandidate;
  platform: Platform;
  persona: PersonaBrief;
  recentWinners?: HistoricalPost[];
  recentLosers?: HistoricalPost[];
  generationContext?: WriterGenerationContext;
  traceId: string;
  model?: string;
};

const DEFAULT_MODEL = "claude-sonnet-4-5";

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  X: "Prefer concise copy, a clear hook, and strong standalone value. No thread numbering unless needed.",
  THREADS: "Prefer conversational writing, a relatable observation, and a story or discussion format.",
  INSTAGRAM:
    "Prefer a strong first-slide hook, saveable educational content, an implied carousel structure, and a clear caption CTA.",
};

/** Writer: idea + hook + persona + platform -> full platform-specific copy (CLAUDE.md section 13). */
export class PostWriter {
  constructor(private readonly provider: AIProvider) {}

  async write(input: WritePostInput): Promise<{ draft: PostDraft; metadata: AICallMetadata }> {
    const result = await this.provider.generateStructured({
      model: input.model ?? DEFAULT_MODEL,
      traceId: input.traceId,
      operation: "write_post",
      promptVersion: "post-writer@1",
      temperature: 0.85,
      prompt: buildWriterPrompt(input),
      schema: PostDraftSchema,
    });
    const { data: _data, ...metadata } = result;
    return { draft: result.data, metadata };
  }
}

const MODE_GUIDANCE: Record<WriterGenerationContext["mode"], string> = {
  proven: "Today, lean into what has been working for this account.",
  adjacent: "Today, try a variation adjacent to what has worked — same general direction, a fresh angle.",
  exploration: "Today, deliberately explore a genuinely different angle. Don't just repeat winning patterns.",
};

function buildWriterPrompt(input: WritePostInput): string {
  const winners = input.recentWinners?.map((p) => `- "${p.text}"`).join("\n");
  const losers = input.recentLosers?.map((p) => `- "${p.text}"`).join("\n");
  const learnings = input.generationContext?.recentLearnings;

  return [
    `Platform: ${input.platform}. ${PLATFORM_GUIDANCE[input.platform]}`,
    `Brand niche: ${input.persona.niche}. Audience: ${input.persona.audience}. Tone: ${input.persona.tone.join(", ")}.`,
    input.persona.avoid?.length ? `Never include: ${input.persona.avoid.join(", ")}.` : undefined,
    `Idea: "${input.idea.title}" — angle: ${input.idea.angle}.`,
    `Use this hook as the opening line (you may lightly adapt it): "${input.hook.text}" (hookType: ${input.hook.hookType}).`,
    winners ? `Historical winners on this account (lean into what worked):\n${winners}` : undefined,
    losers ? `Historical losers on this account (avoid repeating these mistakes):\n${losers}` : undefined,
    learnings?.length
      ? `For reference only — not strict rules, use your judgement — recent performance learnings for this account:\n${learnings.map((l) => `- ${l}`).join("\n")}`
      : undefined,
    input.generationContext ? MODE_GUIDANCE[input.generationContext.mode] : undefined,
    "Write ONE original, complete post. Do not copy any real post; only reuse abstract patterns.",
    "Do not fabricate statistics, testimonials, or personal experience as fact.",
    'Return JSON: { "text", "hookType", "cta" }',
  ]
    .filter(Boolean)
    .join("\n");
}
