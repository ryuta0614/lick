import type { AICallMetadata, AIProvider } from "@social-growth-os/ai";
import { IdeaListSchema, type ContentIdeaCandidate } from "@social-growth-os/ai";
import { filterNearDuplicates } from "./similarity.js";

export type PersonaBrief = {
  niche: string;
  audience: string;
  tone: string[];
  avoid?: string[];
};

export type GenerateIdeasInput = {
  topic: string;
  persona: PersonaBrief;
  count?: number;
  traceId: string;
  model?: string;
  /** Titles of existing ideas/posts to avoid near-duplicating. */
  existingTitles?: string[];
};

const DEFAULT_MODEL = "claude-sonnet-4-5";

export class IdeaGenerator {
  constructor(private readonly provider: AIProvider) {}

  async generate(input: GenerateIdeasInput): Promise<{ ideas: ContentIdeaCandidate[]; metadata: AICallMetadata }> {
    const count = input.count ?? 8;
    const prompt = buildIdeaPrompt(input, count);

    const result = await this.provider.generateStructured({
      model: input.model ?? DEFAULT_MODEL,
      traceId: input.traceId,
      operation: "generate_ideas",
      promptVersion: "idea-generator@1",
      temperature: 0.9,
      prompt,
      schema: IdeaListSchema,
    });

    const ideas = filterNearDuplicates(result.data.ideas, (idea) => idea.title, input.existingTitles ?? []);
    const { data: _data, ...metadata } = result;

    return { ideas, metadata };
  }
}

function buildIdeaPrompt(input: GenerateIdeasInput, count: number): string {
  return [
    `You are an original-content strategist for a brand in the "${input.persona.niche}" niche.`,
    `Audience: ${input.persona.audience}. Tone: ${input.persona.tone.join(", ")}.`,
    input.persona.avoid?.length ? `Avoid: ${input.persona.avoid.join(", ")}.` : undefined,
    `Topic to explore: "${input.topic}".`,
    `Generate ${count} original content ideas. Each idea must be a distinct angle — do not restate the topic.`,
    "Never copy or lightly paraphrase any specific existing post; only reuse abstract patterns like hook type, emotion, and structure.",
    'Return JSON: { "ideas": [{ "title", "topic", "angle", "audience", "hookType", "emotion", "contentType", "whyNow", "conversionIntent", "originalityNotes" }] }',
  ]
    .filter(Boolean)
    .join("\n");
}
