import type { ZodType } from "zod";
import { AIGenerationError } from "@social-growth-os/shared";

/**
 * Parses and validates a model's JSON response. Never trusts raw LLM JSON
 * (CLAUDE.md section 8) — an invalid shape throws AIGenerationError instead
 * of silently reaching application code.
 */
export function parseStructuredResponse<T>(rawText: string, schema: ZodType<T>): T {
  const jsonText = extractJsonBlock(rawText);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (error) {
    throw new AIGenerationError(`Model response was not valid JSON: ${(error as Error).message}`, error);
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    throw new AIGenerationError(`Model response failed schema validation: ${result.error.message}`, result.error);
  }
  return result.data;
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}
