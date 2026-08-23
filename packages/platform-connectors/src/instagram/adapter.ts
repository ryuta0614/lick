import { ContentValidationError, logger, PlatformUnsupportedOperationError, PublishError } from "@social-growth-os/shared";
import { validateTextLength } from "../validation.js";
import type {
  NormalizedPost,
  NormalizedPostMetrics,
  PublishedPost,
  PublishPostInput,
  SocialPlatformAdapter,
} from "../types.js";
import { InstagramApiClient, type InstagramFetchImpl } from "./client.js";
import { InstagramNetworkError } from "./errors.js";

export type InstagramAdapterOptions = {
  /** The connected account's Instagram Business Account id (SocialAccount.externalId). */
  igUserId: string;
  /** Decrypted Page access token — caller is responsible for decrypting `PlatformCredential.accessTokenEnc` first. */
  accessToken: string;
  apiBaseUrl: string;
  apiVersion: string;
  /** When true (the safe default), a container is created but /media_publish is never called (CLAUDE.md STEP 16). */
  dryRun: boolean;
  fetchImpl?: InstagramFetchImpl;
};

const MAX_CAROUSEL_ITEMS = 10;

/**
 * Real Instagram adapter. Unlike Threads/X, Instagram's Content Publishing
 * API has no text-only post type — every feed post requires at least one
 * image, referenced by a publicly reachable URL (S3/R2, CLAUDE.md section
 * 5). The content-generation pipeline in this repo is currently text-only
 * (no image generation/hosting wired up yet), so `input.mediaUrls` will
 * always be empty in practice today — validateContent surfaces that as a
 * clear, actionable error rather than the adapter silently doing nothing
 * or guessing at a text-only workaround Instagram doesn't support.
 */
export class InstagramAdapter implements SocialPlatformAdapter {
  readonly platform = "INSTAGRAM" as const;

  private readonly client: InstagramApiClient;
  private readonly igUserId: string;
  private readonly accessToken: string;
  private readonly dryRun: boolean;

  constructor(options: InstagramAdapterOptions) {
    this.client = new InstagramApiClient({ apiBaseUrl: options.apiBaseUrl, apiVersion: options.apiVersion }, options.fetchImpl);
    this.igUserId = options.igUserId;
    this.accessToken = options.accessToken;
    this.dryRun = options.dryRun;
  }

  async validateContent(input: PublishPostInput): Promise<void> {
    if (input.text) {
      validateTextLength(this.platform, input);
    }
    if (!input.mediaUrls || input.mediaUrls.length === 0) {
      throw new ContentValidationError(
        "Instagram requires at least one image (mediaUrls) — text-only posts aren't supported by Instagram's Content Publishing API. " +
          "This account's content pipeline doesn't generate/host images yet.",
      );
    }
    if (input.mediaUrls.length > MAX_CAROUSEL_ITEMS) {
      throw new ContentValidationError(`Instagram carousels support at most ${MAX_CAROUSEL_ITEMS} images (got ${input.mediaUrls.length})`);
    }
  }

  async publishPost(_accountId: string, input: PublishPostInput): Promise<PublishedPost> {
    await this.validateContent(input);
    const mediaUrls = input.mediaUrls as string[];

    // A network failure while creating the container is a safe, definitive non-publish —
    // nothing has gone live yet at this step, so it's fine to let it propagate as-is (retryable).
    const container =
      mediaUrls.length === 1
        ? await this.client.createImageContainer(this.igUserId, this.accessToken, mediaUrls[0] as string, input.text)
        : await this.createCarousel(mediaUrls, input.text);

    if (this.dryRun) {
      logger.info("instagram.publish.dry_run", { igUserId: this.igUserId, containerId: container.id });
      return { externalId: `dryrun_${container.id}`, publishedAt: new Date(), dryRun: true };
    }

    let published: { id: string };
    try {
      published = await this.client.publishContainer(this.igUserId, this.accessToken, container.id);
    } catch (error) {
      if (error instanceof InstagramNetworkError) {
        // No HTTP response was ever received for the *publish* call specifically: we cannot tell
        // whether Instagram processed it before the connection dropped. Surface this as ambiguous
        // rather than silently retrying a possible live duplicate post (CLAUDE.md STEP 9, same
        // reasoning as ThreadsAdapter/XAdapter).
        throw new PublishError(
          `Network error while publishing Instagram container ${container.id}; the post may or may not have been published. Manual verification on Instagram is required before retrying.`,
          error,
        );
      }
      throw error;
    }

    return { externalId: published.id, publishedAt: new Date() };
  }

  private async createCarousel(mediaUrls: string[], caption: string | undefined) {
    const children = [];
    for (const url of mediaUrls) {
      children.push(await this.client.createCarouselItemContainer(this.igUserId, this.accessToken, url));
    }
    return this.client.createCarouselContainer(
      this.igUserId,
      this.accessToken,
      children.map((c) => c.id),
      caption,
    );
  }

  /**
   * Not implemented: Meta's Instagram Content Publishing API does not
   * document a general delete-media endpoint for arbitrary published
   * content. Rather than guess at an unsupported call, this throws
   * (CLAUDE.md section 35 — same posture as ThreadsAdapter.deletePost).
   */
  async deletePost(_accountId: string, _externalPostId: string): Promise<void> {
    throw new PlatformUnsupportedOperationError(
      "InstagramAdapter.deletePost: the Instagram Content Publishing API does not offer a documented delete-media endpoint — not implemented",
    );
  }

  async getPost(_accountId: string, externalPostId: string): Promise<NormalizedPost> {
    if (externalPostId.startsWith("dryrun_")) {
      throw new PlatformUnsupportedOperationError(
        `Post ${externalPostId} was published in INSTAGRAM_DRY_RUN mode and has no real Instagram media id to fetch`,
      );
    }
    const media = await this.client.getMedia(externalPostId, this.accessToken);
    if (!media.publishedAt) {
      throw new PlatformUnsupportedOperationError(
        `Instagram did not return a timestamp for media ${externalPostId} — cannot build a NormalizedPost without a real publish timestamp`,
      );
    }
    return { externalId: media.id, text: media.caption, publishedAt: media.publishedAt, url: media.permalink };
  }

  async getPostMetrics(_accountId: string, externalPostId: string): Promise<NormalizedPostMetrics> {
    if (externalPostId.startsWith("dryrun_")) {
      throw new PlatformUnsupportedOperationError(
        `Post ${externalPostId} was published in INSTAGRAM_DRY_RUN mode and has no real Instagram media id to fetch insights for`,
      );
    }

    const insights = await this.client.getInsights(externalPostId, this.accessToken);
    return {
      impressions: insights.impressions,
      likes: insights.likes,
      replies: insights.comments,
      shares: insights.shares,
      saves: insights.saved,
      // Not provided by media-level insights — must stay undefined, never 0 (CLAUDE.md section 19).
      profileVisits: undefined,
      linkClicks: undefined,
    };
  }
}
