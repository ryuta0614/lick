import { logger, PlatformUnsupportedOperationError, PublishError } from "@social-growth-os/shared";
import { validateTextLength } from "../validation.js";
import type {
  NormalizedPost,
  NormalizedPostMetrics,
  PublishedPost,
  PublishPostInput,
  SocialPlatformAdapter,
} from "../types.js";
import { ThreadsApiClient, type FetchImpl } from "./client.js";
import { ThreadsNetworkError } from "./errors.js";

export type ThreadsAdapterOptions = {
  /** The connected account's Threads user id (SocialAccount.externalId). */
  threadsUserId: string;
  /** Decrypted access token — caller is responsible for decrypting `PlatformCredential.accessTokenEnc` first. */
  accessToken: string;
  apiBaseUrl: string;
  apiVersion: string;
  /** When true (the safe default), a container is created but /threads_publish is never called (CLAUDE.md STEP 16). */
  dryRun: boolean;
  fetchImpl?: FetchImpl;
};

/**
 * Real Threads adapter (CLAUDE.md STEP 3/4). Text posts only, via the
 * documented two-step container flow (create -> publish) rather than
 * `auto_publish_text=true`, so container failures and publish failures are
 * distinguishable and each step can be retried independently by BullMQ.
 */
export class ThreadsAdapter implements SocialPlatformAdapter {
  readonly platform = "THREADS" as const;

  private readonly client: ThreadsApiClient;
  private readonly threadsUserId: string;
  private readonly accessToken: string;
  private readonly dryRun: boolean;

  constructor(options: ThreadsAdapterOptions) {
    this.client = new ThreadsApiClient({ apiBaseUrl: options.apiBaseUrl, apiVersion: options.apiVersion }, options.fetchImpl);
    this.threadsUserId = options.threadsUserId;
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

    const container = await this.client.createTextContainer(this.threadsUserId, this.accessToken, text);

    if (this.dryRun) {
      logger.info("threads.publish.dry_run", { threadsUserId: this.threadsUserId, containerId: container.id });
      return { externalId: `dryrun_${container.id}`, publishedAt: new Date(), dryRun: true };
    }

    let published: { id: string };
    try {
      published = await this.client.publishContainer(this.threadsUserId, this.accessToken, container.id);
    } catch (error) {
      // A definitive rejection from Threads (4xx/401/429/5xx-with-body) means nothing was published —
      // safe to classify normally and let the caller decide whether to retry.
      if (error instanceof ThreadsNetworkError) {
        // No HTTP response was ever received for the *publish* call specifically: we cannot tell
        // whether Threads processed it before the connection dropped. Never guess at an
        // idempotency mechanism Threads doesn't document — surface this as ambiguous instead of
        // silently retrying a possible live duplicate post (CLAUDE.md STEP 9).
        throw new PublishError(
          `Network error while publishing Threads container ${container.id}; the post may or may not have been published. Manual verification on Threads is required before retrying.`,
          error,
        );
      }
      throw error;
    }

    return { externalId: published.id, publishedAt: new Date() };
  }

  /**
   * Not implemented: available third-party guides disagree on whether
   * Threads' API currently supports programmatic deletion (some describe a
   * DELETE endpoint, others say deletion is app-UI-only), and this could
   * not be verified against Meta's official docs from this environment.
   * Rather than guess, this throws until confirmed (CLAUDE.md section 35).
   */
  async deletePost(_accountId: string, _externalPostId: string): Promise<void> {
    throw new PlatformUnsupportedOperationError(
      "ThreadsAdapter.deletePost: Threads API delete/unpublish support is not verified against official docs — not implemented",
    );
  }

  /**
   * Not implemented: CLAUDE.md STEP 4 (Phase 2) only requires
   * validateContent/publishPost/getPostMetrics/deletePost. The exact fields
   * returned by a single-media GET were not verified against official docs,
   * so this throws rather than guessing at the response shape.
   */
  async getPost(_accountId: string, _externalPostId: string): Promise<NormalizedPost> {
    throw new PlatformUnsupportedOperationError(
      "ThreadsAdapter.getPost is not implemented yet — not part of the Phase 2 scope and not verified against official docs",
    );
  }

  async getPostMetrics(_accountId: string, externalPostId: string): Promise<NormalizedPostMetrics> {
    if (externalPostId.startsWith("dryrun_")) {
      throw new PlatformUnsupportedOperationError(
        `Post ${externalPostId} was published in THREADS_DRY_RUN mode and has no real Threads media id to fetch insights for`,
      );
    }

    const insights = await this.client.getInsights(externalPostId, this.accessToken);
    return {
      impressions: insights.views,
      likes: insights.likes,
      replies: insights.replies,
      // Threads' closest equivalent to a "share" is a repost; quotes have no slot in our normalized shape.
      shares: insights.reposts,
      // Not provided by the Threads insights API — must stay undefined, never 0 (CLAUDE.md section 19).
      saves: undefined,
      profileVisits: undefined,
      linkClicks: undefined,
    };
  }
}
