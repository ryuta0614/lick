export type InstagramContainer = {
  id: string;
};

export type InstagramPublishedMedia = {
  id: string;
};

export type InstagramUserIdentity = {
  id: string;
  username?: string;
};

export type InstagramMedia = {
  id: string;
  caption?: string;
  publishedAt?: Date;
  permalink?: string;
};

/**
 * Normalized subset of Instagram's media insights this app understands.
 * Fields Instagram doesn't return (varies by media type/API version) are
 * simply absent — callers must not coerce a missing metric to 0
 * (CLAUDE.md section 19).
 */
export type InstagramPostInsights = {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
};

export type InstagramTokenExchangeResult = {
  accessToken: string;
  expiresAt: Date;
};

/** One Facebook Page the OAuth user manages, with its linked Instagram Business Account (if any) and Page access token. */
export type InstagramFacebookPage = {
  pageId: string;
  pageName?: string;
  /** Required to publish to this page's linked Instagram Business Account — distinct from the user access token. */
  pageAccessToken: string;
  instagramBusinessAccountId?: string;
};
