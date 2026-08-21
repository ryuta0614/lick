import type { Platform } from "@social-growth-os/shared";

export type PublishPostInput = {
  text?: string;
  mediaUrls?: string[];
};

export type PublishedPost = {
  externalId: string;
  url?: string;
  publishedAt: Date;
};

export type NormalizedPost = PublishedPost & {
  text?: string;
};

/**
 * Every field is optional: not every platform exposes every metric, and a
 * missing metric must be represented as `undefined`, never `0`
 * (CLAUDE.md section 19).
 */
export type NormalizedPostMetrics = {
  impressions?: number;
  likes?: number;
  replies?: number;
  shares?: number;
  saves?: number;
  profileVisits?: number;
  linkClicks?: number;
};

/**
 * One adapter per platform. Application code never touches a raw
 * third-party API response — everything crossing this boundary is
 * normalized first (CLAUDE.md section 7).
 */
export interface SocialPlatformAdapter {
  readonly platform: Platform;
  validateContent(input: PublishPostInput): Promise<void>;
  publishPost(accountId: string, input: PublishPostInput): Promise<PublishedPost>;
  deletePost(accountId: string, externalPostId: string): Promise<void>;
  getPost(accountId: string, externalPostId: string): Promise<NormalizedPost>;
  getPostMetrics(accountId: string, externalPostId: string): Promise<NormalizedPostMetrics>;
}
