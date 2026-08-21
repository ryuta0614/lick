import { describe, expect, it } from "vitest";
import { GenerateContentJobSchema } from "../jobs/generate-content.js";
import { PublishPostJobSchema } from "../jobs/publish-post.js";
import { CollectPostAnalyticsJobSchema } from "../jobs/collect-post-analytics.js";
import { CollectTrendsJobSchema } from "../jobs/collect-trends.js";
import { WeeklyStrategyReviewJobSchema } from "../jobs/weekly-strategy-review.js";

describe("job payload validation (Zod at the queue boundary)", () => {
  it("accepts a valid generate-content payload", () => {
    const result = GenerateContentJobSchema.safeParse({
      workspaceId: "workspace_1",
      socialAccountId: "account_1",
      personaId: "persona_1",
      topic: "AI side hustle",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a generate-content payload missing required fields", () => {
    expect(GenerateContentJobSchema.safeParse({ workspaceId: "workspace_1" }).success).toBe(false);
    expect(GenerateContentJobSchema.safeParse({ ...validGenerateContent(), topic: "" }).success).toBe(false);
  });

  it("validates publish-post and collect-post-analytics payloads", () => {
    expect(PublishPostJobSchema.safeParse({ postId: "post_1" }).success).toBe(true);
    expect(PublishPostJobSchema.safeParse({}).success).toBe(false);
    expect(CollectPostAnalyticsJobSchema.safeParse({ postId: "post_1" }).success).toBe(true);
  });

  it("validates collect-trends payload shape", () => {
    const result = CollectTrendsJobSchema.safeParse({
      workspaceId: "workspace_1",
      topics: [{ title: "AI news this week" }],
    });
    expect(result.success).toBe(true);
    expect(CollectTrendsJobSchema.safeParse({ workspaceId: "workspace_1", topics: [{}] }).success).toBe(false);
  });

  it("defaults periodDays on weekly-strategy-review when omitted", () => {
    const result = WeeklyStrategyReviewJobSchema.parse({ workspaceId: "workspace_1" });
    expect(result.periodDays).toBe(30);
  });
});

function validGenerateContent() {
  return {
    workspaceId: "workspace_1",
    socialAccountId: "account_1",
    personaId: "persona_1",
    topic: "AI side hustle",
  };
}
