export type UtmParams = {
  source: string;
  medium?: string;
  campaign: string;
  content?: string;
};

/** Builds `utm_*` query params per CLAUDE.md section 25 (revenue attribution). */
export function buildUtmParams(params: UtmParams): URLSearchParams {
  const query = new URLSearchParams({
    utm_source: params.source,
    utm_medium: params.medium ?? "social",
    utm_campaign: params.campaign,
  });
  if (params.content) {
    query.set("utm_content", params.content);
  }
  return query;
}

export function appendUtmParams(url: string, params: UtmParams): string {
  const target = new URL(url);
  const utm = buildUtmParams(params);
  utm.forEach((value, key) => target.searchParams.set(key, value));
  return target.toString();
}
