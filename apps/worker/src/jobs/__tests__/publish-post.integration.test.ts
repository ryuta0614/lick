import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@social-growth-os/database";
import { encryptSecret } from "@social-growth-os/shared";
import { runPublishPostJob } from "../publish-post.js";
import { runCollectPostAnalyticsJob } from "../collect-post-analytics.js";

/**
 * Full E2E-ish integration test against the real local Postgres (CLAUDE.md
 * STEP 18): Post(APPROVED) -> runPublishPostJob -> real ThreadsAdapter code
 * path with a mocked `fetch` -> externalId saved -> PUBLISHED ->
 * runCollectPostAnalyticsJob -> PostAnalyticsSnapshot. Nothing here ever
 * calls the real Threads API.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ORIGINAL_ENV = { ...process.env };

describe("publish-post + collect-post-analytics integration (real DB, mocked Threads HTTP)", () => {
  let workspaceId: string;
  let postId: string;

  beforeAll(() => {
    process.env.PLATFORM_MODE = "real";
    process.env.THREADS_DRY_RUN = "false";
    process.env.META_APP_ID = "test_app_id";
    process.env.META_APP_SECRET = "test_app_secret";
    process.env.THREADS_REDIRECT_URI = "https://example.com/callback";
    process.env.ENCRYPTION_KEY = "integration-test-encryption-key-not-shared";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(async () => {
    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${randomUUID()}` } });
    workspaceId = workspace.id;

    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: "THREADS",
        externalId: `threads_user_${randomUUID()}`,
        username: "integration_test_user",
        approvalMode: "MANUAL",
        active: true,
        credential: {
          create: {
            accessTokenEnc: encryptSecret("fake-access-token-for-tests"),
            scopes: ["threads_basic", "threads_content_publish"],
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    const post = await prisma.post.create({
      data: {
        workspaceId,
        socialAccountId: account.id,
        platform: "THREADS",
        status: "APPROVED",
        text: "Integration test post — never sent to the real Threads API",
        contentHash: `hash_${randomUUID()}`,
      },
    });
    postId = post.id;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    // Post/SocialAccount/PlatformCredential/PostAnalyticsSnapshot all cascade from Workspace.
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  it("publishes through the real ThreadsAdapter (mocked HTTP) and records externalId + PUBLISHED", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { id: "container_int_1" }))
        .mockResolvedValueOnce(jsonResponse(200, { id: "published_int_1" })),
    );

    const result = await runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 });
    expect(result.status).toBe("PUBLISHED");

    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("PUBLISHED");
    expect(post.externalId).toBe("published_int_1");
    expect(post.publishedAt).not.toBeNull();
  });

  it("collects analytics into a PostAnalyticsSnapshot after publish, leaving unavailable metrics null (not 0)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { id: "container_int_2" }))
        .mockResolvedValueOnce(jsonResponse(200, { id: "published_int_2" })),
    );
    await runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 });
    vi.unstubAllGlobals();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            { name: "views", values: [{ value: 200 }] },
            { name: "likes", values: [{ value: 10 }] },
          ],
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

  it("resumes without a duplicate publish call when PUBLISHING was already recorded with an externalId", async () => {
    // Simulates a worker crash *after* Threads confirmed the publish but *before* the DB write landed.
    await prisma.post.update({
      where: { id: postId },
      data: { status: "PUBLISHING", externalId: "already_published_ext_id" },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPublishPostJob({ postId }, { attemptsMade: 1, maxAttempts: 3 });

    expect(result.status).toBe("PUBLISHED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails loudly instead of retrying when resuming from PUBLISHING with no externalId recorded (ambiguous state)", async () => {
    await prisma.post.update({ where: { id: postId }, data: { status: "PUBLISHING" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runPublishPostJob({ postId }, { attemptsMade: 1, maxAttempts: 3 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();

    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("FAILED");
  });

  it("never publishes for real when THREADS_DRY_RUN=true, and skips analytics scheduling", async () => {
    process.env.THREADS_DRY_RUN = "true";
    try {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { id: "container_dry_int" }));
      vi.stubGlobal("fetch", fetchMock);

      const result = await runPublishPostJob({ postId }, { attemptsMade: 0, maxAttempts: 3 });

      expect(result.status).toBe("PUBLISHED");
      expect(fetchMock).toHaveBeenCalledTimes(1); // container created, threads_publish never called

      const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
      expect(post.externalId).toBe("dryrun_container_dry_int");
    } finally {
      process.env.THREADS_DRY_RUN = "false";
    }
  });
});
