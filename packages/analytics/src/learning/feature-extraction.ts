/**
 * Feature extraction for the Learning Engine (CLAUDE.md Phase 2.5 STEP 3).
 * Pure functions only — no Prisma/DB access here (packages/analytics stays
 * testable without external APIs); callers pass in already-fetched plain
 * data shaped like `PostForFeatureExtraction`.
 */

const WEEKDAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;
export type Weekday = (typeof WEEKDAY_NAMES)[number];

export type LengthBucket = "0-99" | "100-199" | "200-299" | "300-499" | "500+";

export type PostForFeatureExtraction = {
  id: string;
  platform: string;
  text: string | null;
  cta: string | null;
  publishedAt: Date | null;
  idea: {
    topic: string;
    hookType: string | null;
    emotion: string | null;
    contentType: string | null;
  } | null;
  /** All generated variants for this post; the selected one is what actually got published. */
  variants: { selected: boolean; hookType: string | null }[];
};

export type PublishedPostFeatures = {
  postId: string;
  platform: string;
  topic: string | null;
  hookType: string | null;
  emotion: string | null;
  contentType: string | null;
  cta: string | null;
  textLength: number | null;
  lengthBucket: LengthBucket | null;
  weekday: Weekday | null;
  postingHour: number | null;
};

/** Bucket boundaries are intentionally coarse — five buckets, not per-character granularity. */
export function bucketTextLength(length: number): LengthBucket {
  if (length < 100) return "0-99";
  if (length < 200) return "100-199";
  if (length < 300) return "200-299";
  if (length < 500) return "300-499";
  return "500+";
}

export function extractPostFeatures(post: PostForFeatureExtraction): PublishedPostFeatures {
  const selectedVariant = post.variants.find((v) => v.selected);
  const textLength = post.text != null ? post.text.length : null;

  return {
    postId: post.id,
    platform: post.platform,
    topic: post.idea?.topic ?? null,
    // The winning variant's hook (what was actually published) takes priority over the idea's suggested hook.
    hookType: selectedVariant?.hookType ?? post.idea?.hookType ?? null,
    emotion: post.idea?.emotion ?? null,
    contentType: post.idea?.contentType ?? null,
    cta: post.cta,
    textLength,
    lengthBucket: textLength != null ? bucketTextLength(textLength) : null,
    weekday: post.publishedAt ? WEEKDAY_NAMES[post.publishedAt.getDay()]! : null,
    postingHour: post.publishedAt ? post.publishedAt.getHours() : null,
  };
}
