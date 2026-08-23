import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@social-growth-os/database";
import { encryptSecret } from "@social-growth-os/shared";
import { runPublishPostJob } from "../publish-post.js";
import { runCollectPostAnalyticsJob } from "../collect-post-analytics.js";

/**
 * Real-DB integration test (mirrors publish-post.integration.test.ts /
 * x-publish-post.integration.test.ts) for Instagram. Instagram's Content
 * Publishing API has no text-only post type, and this repo's content
 * pipeline is currently text-only (no image generation/hosting wired up
 * yet — CLAUDE.md section 5), so the realistic behavior today is that a
 * real-mode Instagram publish always fails validation, loudly and
 * immediately, rather than silently succeeding or guessing at a
 * workaround. This test locks in that behavior; the single-image and
 * carousel-publish HTTP mechanics themselves are covered with mocked
 * fetch in packages/platform-connectors/src/instagram/__tests__/adapter.test.ts.
 */

const ORIGINAL_ENV = { ...process.env };

describe("publish-post integration for Instagram (real DB)", () => {
  let workspaceId: string;
  let postId: string;

  beforeAll(() => {
    process.env.PLATFORM_MODE = "real";
    process.env.INSTAGRAM_DRY_RUN = "false";
    process.env.META_APP_ID = "test_meta_app_id";
    process.env.META_APP_SECRET = "test_meta_app_secret";
    process.env.INSTAGRAM_REDIRECT_URI = "https://example.com/callback";
    process.env.ENCRYPTION_KEY = "integration-test-encryption-key-not-shared";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(async () => {
    const workspace = await prisma.workspace.create({ data: { name: `instagram-integration-test-${randomUUID()}` } });
    workspaceId = workspace.id;

    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: "INSTAGRAM",
        externalId: `ig_user_${randomUUID()}`,
        username: "integration_test_user",
        approvalMode: "MANUAL",
        active: true,
        credential: {
          create: {
            accessTokenEnc: encryptSecret("fake-page-access-token-for-tests"),
            scopes: ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"],
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    const post = await prisma.post.create({
      data: {
        workspaceId,
        socialAccountId: account.id,
        platform: "INSTAGRAM",
        status: "APPROVED",
        text: "Integration test post — never sent to the real Instagram API",
        contentHash: `hash_${randomUUID()}`,
      },
    });
    postId = post.id;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  it("fails loudly with a clear validation error for a text-only post, without calling the real API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // ContentValidationError isn't retryable, so publish-post.ts marks the post FAILED and throws
    // BullMQ's UnrecoverableError rather than silently swallowing it (CLAUDE.md section 32).
    await expect(runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();

    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("FAILED");
    expect(post.errorMessage).toContain("mediaUrls");
  });

  it("never schedules analytics collection for a post that failed to publish", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 })).rejects.toThrow();

    await expect(runCollectPostAnalyticsJob({ postId })).rejects.toThrow();
  });
});
