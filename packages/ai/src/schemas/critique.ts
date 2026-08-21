import { z } from "zod";

export const PostCritiqueSchema = z.object({
  hook: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
  usefulness: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  shareability: z.number().min(0).max(10),
  audienceFit: z.number().min(0).max(10),
  specificity: z.number().min(0).max(10),
  conversionPotential: z.number().min(0).max(10),
  brandFit: z.number().min(0).max(10),
  risk: z.number().min(0).max(10),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestedChanges: z.array(z.string()),
  qualityScore: z.number().min(0).max(100),
});

export type PostCritique = z.infer<typeof PostCritiqueSchema>;
