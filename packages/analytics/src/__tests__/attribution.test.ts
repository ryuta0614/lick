import { describe, expect, it } from "vitest";
import { ConversionWebhookSchema, resolveAttribution } from "../attribution/attribution.js";

describe("ConversionWebhookSchema", () => {
  it("accepts a valid payload", () => {
    const result = ConversionWebhookSchema.safeParse({
      type: "purchase",
      value: 1000,
      occurredAt: "2026-08-21T10:00:00Z",
      utmContent: "post_123",
      utmCampaign: "ai_productivity",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown conversion type", () => {
    const result = ConversionWebhookSchema.safeParse({ type: "not_a_type", occurredAt: "2026-08-21T10:00:00Z" });
    expect(result.success).toBe(false);
  });
});

describe("resolveAttribution", () => {
  it("maps utm_content to postId and utm_campaign to campaignSlug", () => {
    expect(resolveAttribution({ utmContent: "post_123", utmCampaign: "launch" })).toEqual({
      postId: "post_123",
      campaignSlug: "launch",
    });
  });
});
