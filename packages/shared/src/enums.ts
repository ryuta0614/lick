export const PLATFORMS = ["X", "THREADS", "INSTAGRAM"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const POST_STATUSES = [
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "SCHEDULED",
  "QUEUED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const APPROVAL_MODES = ["MANUAL", "SEMI_AUTO", "AUTO"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export const HOOK_TYPES = [
  "contrarian",
  "curiosity",
  "confession",
  "warning",
  "question",
  "number",
  "prediction",
  "story",
  "result",
  "authority",
] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const EMOTIONS = [
  "curiosity",
  "surprise",
  "fear",
  "aspiration",
  "empathy",
  "humor",
  "urgency",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const CONTENT_STRUCTURES = [
  "hook-value-cta",
  "problem-solution",
  "story-lesson",
  "list",
  "before-after",
  "myth-reality",
  "mistake-fix",
  "prediction-reason",
] as const;
export type ContentStructure = (typeof CONTENT_STRUCTURES)[number];

export const CTA_TYPES = [
  "none",
  "reply",
  "follow",
  "save",
  "share",
  "click",
  "comment",
  "DM",
] as const;
export type CtaType = (typeof CTA_TYPES)[number];
