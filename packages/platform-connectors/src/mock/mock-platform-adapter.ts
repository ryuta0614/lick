import { randomUUID } from "node:crypto";
import type { Platform } from "@social-growth-os/shared";
import { PlatformValidationError } from "@social-growth-os/shared";
import { PLATFORM_TEXT_LIMITS, validateTextLength } from "../validation.js";
import type {
  NormalizedPost,
  NormalizedPostMetrics,
  PublishedPost,
  PublishPostInput,
  SocialPlatformAdapter,
} from "../types.js";

type MockPost = {
  externalId: string;
  accountId: string;
  text?: string;
  publishedAt: Date;
  deleted: boolean;
};

/**
 * In-memory stand-in for a real platform. Used for the whole MVP backbone
 * (STEP 8/9) so nothing is ever posted to a real SNS during development or
 * tests (CLAUDE.md sections 17, 33).
 */
export class MockPlatformAdapter implements SocialPlatformAdapter {
  private readonly posts = new Map<string, MockPost>();

  constructor(public readonly platform: Platform) {}

  async validateContent(input: PublishPostInput): Promise<void> {
    validateTextLength(this.platform, input);
  }

  async publishPost(accountId: string, input: PublishPostInput): Promise<PublishedPost> {
    await this.validateContent(input);

    const externalId = `mock_${this.platform.toLowerCase()}_${randomUUID()}`;
    const publishedAt = new Date();
    this.posts.set(externalId, { externalId, accountId, text: input.text, publishedAt, deleted: false });

    return {
      externalId,
      url: `https://mock.local/${this.platform.toLowerCase()}/${externalId}`,
      publishedAt,
    };
  }

  async deletePost(_accountId: string, externalPostId: string): Promise<void> {
    const post = this.posts.get(externalPostId);
    if (!post) {
      throw new PlatformValidationError(`Mock post ${externalPostId} not found`);
    }
    post.deleted = true;
  }

  async getPost(_accountId: string, externalPostId: string): Promise<NormalizedPost> {
    const post = this.requirePost(externalPostId);
    return { externalId: post.externalId, publishedAt: post.publishedAt, text: post.text };
  }

  async getPostMetrics(_accountId: string, externalPostId: string): Promise<NormalizedPostMetrics> {
    const post = this.requirePost(externalPostId);
    return generateMockMetrics(post.externalId, post.publishedAt);
  }

  private requirePost(externalPostId: string): MockPost {
    const post = this.posts.get(externalPostId);
    if (!post || post.deleted) {
      throw new PlatformValidationError(`Mock post ${externalPostId} not found`);
    }
    return post;
  }
}

/**
 * Deterministic, seeded "growth curve" so repeated analytics-collection
 * jobs against the same post see plausible increasing numbers instead of
 * random noise, without needing real network calls.
 */
function generateMockMetrics(externalId: string, publishedAt: Date): NormalizedPostMetrics {
  const hoursSincePublish = Math.max(0, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60));
  const seed = hashToUnitInterval(externalId);
  const growth = 1 - Math.exp(-hoursSincePublish / 12);

  const impressions = Math.round(500 + seed * 20_000 * growth);
  const likes = Math.round(impressions * (0.02 + seed * 0.06));
  const replies = Math.round(impressions * (0.002 + seed * 0.01));
  const shares = Math.round(impressions * (0.001 + seed * 0.008));
  const saves = Math.round(impressions * (0.001 + seed * 0.005));
  const profileVisits = Math.round(impressions * (0.005 + seed * 0.015));
  const linkClicks = Math.round(impressions * (0.001 + seed * 0.01));

  return { impressions, likes, replies, shares, saves, profileVisits, linkClicks };
}

function hashToUnitInterval(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash / 0xffffffff;
}

export function createMockPlatformAdapters(): Record<Platform, SocialPlatformAdapter> {
  return {
    X: new MockPlatformAdapter("X"),
    THREADS: new MockPlatformAdapter("THREADS"),
    INSTAGRAM: new MockPlatformAdapter("INSTAGRAM"),
  };
}

export { PLATFORM_TEXT_LIMITS };
