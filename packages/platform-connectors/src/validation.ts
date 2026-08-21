import { ContentValidationError } from "@social-growth-os/shared";
import type { PublishPostInput } from "./types.js";

/** Publicly documented text length limits per platform. */
export const PLATFORM_TEXT_LIMITS = {
  X: 280,
  THREADS: 500,
  INSTAGRAM: 2200,
} as const;

export function validateTextLength(platform: keyof typeof PLATFORM_TEXT_LIMITS, input: PublishPostInput): void {
  const limit = PLATFORM_TEXT_LIMITS[platform];
  if (!input.text || input.text.trim().length === 0) {
    throw new ContentValidationError(`${platform} post text must not be empty`);
  }
  if (input.text.length > limit) {
    throw new ContentValidationError(
      `${platform} post text exceeds ${limit} characters (got ${input.text.length})`,
    );
  }
}
