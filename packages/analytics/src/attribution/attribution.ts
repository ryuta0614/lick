import { z } from "zod";

/** External input boundary for the conversion webhook (CLAUDE.md section 25). */
export const ConversionWebhookSchema = z.object({
  type: z.enum(["link_click", "lead", "purchase", "subscription", "manual_revenue"]),
  value: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  externalId: z.string().optional(),
  occurredAt: z.coerce.date(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ConversionWebhookPayload = z.infer<typeof ConversionWebhookSchema>;

export type ResolvedAttribution = {
  postId?: string;
  campaignSlug?: string;
};

/**
 * Resolves which Post/Campaign a conversion belongs to from its UTM
 * parameters. Convention (CLAUDE.md section 25): utm_content={postId},
 * utm_campaign={campaignSlug}.
 */
export function resolveAttribution(payload: Pick<ConversionWebhookPayload, "utmCampaign" | "utmContent">): ResolvedAttribution {
  return {
    postId: payload.utmContent,
    campaignSlug: payload.utmCampaign,
  };
}
