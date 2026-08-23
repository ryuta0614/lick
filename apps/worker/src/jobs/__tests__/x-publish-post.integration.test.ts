import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@social-growth-os/database";
import { encryptSecret } from "@social-growth-os/shared";
import { runPublishPostJob } from "../publish-post.js";
import { runCollectPostAnalyticsJob } from "../collect-post-analytics.js";

/**
 * Full E2E-ish integration test against the real local Postgres (mirrors
 * publish-post.integration.test.ts for Threads): Post(APPROVED) ->
 * runPublishPostJob -> real XAdapter code path with a mocked `fetch` ->
 * externalId saved -> PUBLISHED -> runCollectPostAnalyticsJob ->
 * PostAnalyticsSnapshot. Nothing here ever calls the real X API.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ORIGINAL_ENV = { ...process.env };

describe("publish-post + collect-post-analytics integration for X (real DB, mocked X HTTP)", () => {
  let workspaceId: string;
  let postId: string;

  beforeAll(() => {
    process.env.PLATFORM_MODE = "real";
    process.env.X_DRY_RUN = "false";
    process.env.X_CLIENT_ID = "test_x_client_id";
    process.env.X_REDIRECT_URI = "https://example.com/callback";
    process.env.ENCRYPTION_KEY = "integration-test-encryption-key-not-shared";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(async () => {
    const workspace = await prisma.workspace.create({ data: { name: `x-integration-test-${randomUUID()}` } });
    workspaceId = workspace.id;

    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: "X",
        externalId: `x_user_${randomUUID()}`,
        username: "integration_test_user",
        approvalMode: "MANUAL",
        active: true,
        credential: {
          create: {
            accessTokenEnc: encryptSecret("fake-access-token-for-tests"),
            scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    const post = await prisma.post.create({
      data: {
        workspaceId,
        socialAccountId: account.id,
        platform: "X",
        status: "APPROVED",
        text: "Integration test post — never sent to the real X API",
        contentHash: `hash_${randomUUID()}`,
      },
    });
    postId = post.id;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  it("publishes through the real XAdapter (mocked HTTP) and records externalId + PUBLISHED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: { id: "tweet_int_1" } })));

    const result = await runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 });
    expect(result.status).toBe("PUBLISHED");

    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("PUBLISHED");
    expect(post.externalId).toBe("tweet_int_1");
    expect(post.publishedAt).not.toBeNull();
  });

  it("collects analytics into a PostAnalyticsSnapshot after publish, leaving unavailable metrics null (not 0)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: { id: "tweet_int_2" } })));
    await runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 });
    vi.unstubAllGlobals();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(200, {
          data: { id: "tweet_int_2", public_metrics: { impression_count: 200, like_count: 10 } },
        }),
      ),
    );

    const result = await runCollectPostAnalyticsJob({ postId });
    const snapshot = await prisma.postAnalyticsSnapshot.findUniqueOrThrow({ where: { id: result.snapshotId } });
    expect(snapshot.impressions).toBe(200);
    expect(snapshot.likes).toBe(10);
    expect(snapshot.saves).toBeNull();
    expect(snapshot.profileVisits).toBeNull();
  });

  it("never publishes for real when X_DRY_RUN=true (X has no partial-step equivalent to Threads' container)", async () => {
    process.env.X_DRY_RUN = "true";
    try {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 });

      expect(result.status).toBe("PUBLISHED");
      expect(fetchMock).not.toHaveBeenCalled();

      const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
      expect(post.externalId).toMatch(/^dryrun_/);
    } finally {
      process.env.X_DRY_RUN = "false";
    }
  });
});
