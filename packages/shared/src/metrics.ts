/** Safe ratio helper: avoids division by zero per CLAUDE.md section 20. */
function safeRate(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

export type PostMetricsInput = {
  impressions?: number | null;
  likes?: number | null;
  replies?: number | null;
  shares?: number | null;
  linkClicks?: number | null;
  followersGained?: number | null;
  /** Sum of revenue attributed to this post. `null`/`undefined` means "not tracked", not "zero" (CLAUDE.md section 25). */
  revenue?: number | null;
};

export type PostMetricsResult = {
  engagementRate: number | null;
  likeRate: number | null;
  shareRate: number | null;
  replyRate: number | null;
  followerConversionRate: number | null;
  clickRate: number | null;
  revenuePer1kImpressions: number | null;
};

export function calculatePostMetrics(input: PostMetricsInput): PostMetricsResult {
  const { impressions, likes, replies, shares, linkClicks, followersGained, revenue } = input;
  const engagements = (likes ?? 0) + (replies ?? 0) + (shares ?? 0);

  return {
    engagementRate: safeRate(likes != null || replies != null || shares != null ? engagements : null, impressions),
    likeRate: safeRate(likes, impressions),
    shareRate: safeRate(shares, impressions),
    replyRate: safeRate(replies, impressions),
    followerConversionRate: safeRate(followersGained, impressions),
    clickRate: safeRate(linkClicks, impressions),
    revenuePer1kImpressions:
      revenue != null && impressions != null && impressions > 0 ? (revenue / impressions) * 1000 : null,
  };
}
