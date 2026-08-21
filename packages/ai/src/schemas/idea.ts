import { z } from "zod";
import { CTA_TYPES, EMOTIONS, HOOK_TYPES } from "@social-growth-os/shared";

export const ContentIdeaSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  angle: z.string().min(1),
  audience: z.string().optional(),
  hookType: z.enum(HOOK_TYPES),
  emotion: z.enum(EMOTIONS),
  contentType: z.string().optional(),
  whyNow: z.string().optional(),
  conversionIntent: z.string().optional(),
  originalityNotes: z.string().optional(),
});
export type ContentIdeaCandidate = z.infer<typeof ContentIdeaSchema>;

export const IdeaListSchema = z.object({
  ideas: z.array(ContentIdeaSchema).min(1).max(20),
});

export const HookCandidateSchema = z.object({
  text: z.string().min(1),
  hookType: z.enum(HOOK_TYPES),
});
export type HookCandidate = z.infer<typeof HookCandidateSchema>;

export const HookListSchema = z.object({
  hooks: z.array(HookCandidateSchema).min(1),
});

export const PostDraftSchema = z.object({
  text: z.string().min(1),
  hookType: z.enum(HOOK_TYPES),
  cta: z.enum(CTA_TYPES),
});
export type PostDraft = z.infer<typeof PostDraftSchema>;
