import { logger, PlatformUnsupportedOperationError, PublishError } from "@social-growth-os/shared";
import { validateTextLength } from "../validation.js";
import type {
  NormalizedPost,
  NormalizedPostMetrics,
  PublishedPost,
  PublishPostInput,
  SocialPlatformAdapter,
} from "../types.js";
import { XApiClient, type XFetchImpl } from "./client.js";
import { XNetworkError } from "./errors.js";

export type XAdapterOptions = {
  /** Decrypted access token — caller is responsible for decrypting `PlatformCredential.accessTokenEnc` first. */
  accessToken: string;
  apiBaseUrl: string;
  /** When true (the safe default), publishPost never calls the real X API (CLAUDE.md STEP 16 dry-run pattern). */
  dryRun: boolean;
  fetchImpl?: XFetchImpl;
};

/**
 * Real X (Twitter) adapter (Phase 3, CLAUDE.md section 36). Unlike Threads,
 * X's Tweets API is a single POST call (no separate container/publish
 * step), and DELETE/GET are officially documented, so this adapter
 * implements the full SocialPlatformAdapter surface.
 */
export class XAdapter implements SocialPlatformAdapter {
  readonly platform = "X" as const;

  private readonly client: XApiClient;
  private readonly accessToken: string;
  private readonly dryRun: boolean;

  constructor(options: XAdapterOptions) {
    this.client = new XApiClient({ apiBaseUrl: options.apiBaseUrl }, options.fetchImpl);
    this.accessToken = options.accessToken;
    this.dryRun = options.dryRun;
  }

  async validateContent(input: PublishPostInput): Promise<void> {
    validateTextLength(this.platform, input);
  }

  async publishPost(_accountId: string, input: PublishPostInput): Promise<PublishedPost> {
    await this.validateContent(input);
    // `text` is guaranteed present after validateContent (throws otherwise).
    const text = input.text as string;

    if (this.dryRun) {
      // X has no "create a draft, don't publish" step the way Threads does — the whole call is one
      // POST that goes live immediately — so dry-run here means never calling the API at all.
      const fakeId = `dryrun_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      logger.info("x.publish.dry_run", { textLength: text.length });
      return { externalId: fakeId, publishedAt: new Date(), dryRun: true };
    }

    let tweet;
    try {
      tweet = await this.client.createTweet(this.accessToken, text);
    } catch (error) {
      if (error instanceof XNetworkError) {
        // No HTTP response was ever received: we cannot tell whether X processed the tweet before
        // the connection dropped. Surface this as ambiguous rather than silently retrying a
        // possible live duplicate post (CLAUDE.md STEP 9, same reasoning as ThreadsAdapter).
        throw new PublishError(
          `Network error while posting to X; the tweet may or may not have been published. Manual verification on X is required before retrying.`,
          error,
        );
      }
      throw error;
    }

    return { externalId: tweet.id, publishedAt: new Date() };
  }

  /** DELETE /2/tweets/:id is officially documented, unlike Threads' unverified delete support. */
  async deletePost(_accountId: string, externalPostId: string): Promise<void> {
    if (externalPostId.startsWith("dryrun_")) return;
    await this.client.deleteTweet(this.accessToken, externalPostId);
  }

  async getPost(_accountId: string, externalPostId: string): Promise<NormalizedPost> {
    if (externalPostId.startsWith("dryrun_")) {
      throw new PlatformUnsupportedOperationError(
        `Post ${externalPostId} was published in X_DRY_RUN mode and has no real tweet to fetch`,
      );
    }
    const tweet = await this.client.getTweet(this.accessToken, externalPostId);
    if (!tweet.createdAt) {
      throw new PlatformUnsupportedOperationError(
        `X did not return created_at for tweet ${externalPostId} — cannot build a NormalizedPost without a real publish timestamp`,
      );
    }
    return { externalId: tweet.id, text: tweet.text, publishedAt: tweet.createdAt };
  }

  async getPostMetrics(_accountId: string, externalPostId: string): Promise<NormalizedPostMetrics> {
    if (externalPostId.startsWith("dryrun_")) {
      throw new PlatformUnsupportedOperationError(
        `Post ${externalPostId} was published in X_DRY_RUN mode and has no real tweet to fetch metrics for`,
      );
    }

    const tweet = await this.client.getTweet(this.accessToken, externalPostId);
    const metrics = tweet.publicMetrics;
    return {
      impressions: metrics?.impression_count,
      likes: metrics?.like_count,
      replies: metrics?.reply_count,
      shares: metrics?.retweet_count,
      saves: metrics?.bookmark_count,
      // Not exposed by X's public_metrics — must stay undefined, never 0 (CLAUDE.md section 19).
      profileVisits: undefined,
      linkClicks: undefined,
    };
  }
}
