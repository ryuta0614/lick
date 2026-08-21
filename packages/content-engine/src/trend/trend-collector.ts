export type ManualTrendInput = {
  source?: string;
  title: string;
  text?: string;
  url?: string;
};

export type CollectedTrend = {
  source: string;
  externalId?: string;
  title: string;
  text?: string;
  url?: string;
  publishedAt?: Date;
  score?: number;
  velocity?: number;
  rawData?: unknown;
};

/**
 * MVP trend "collection" is manual/mock input only (CLAUDE.md STEP 1 / STEP
 * 4): no unauthorized scraping, no guessed third-party endpoints. Real
 * sources (RSS, Reddit, YouTube, Google Trends-compatible APIs) plug in
 * later behind this same interface.
 */
export interface TrendCollector {
  collect(): Promise<CollectedTrend[]>;
}

export class ManualTrendCollector implements TrendCollector {
  constructor(private readonly inputs: ManualTrendInput[]) {}

  async collect(): Promise<CollectedTrend[]> {
    return this.inputs.map((input) => ({
      source: input.source ?? "manual",
      title: input.title,
      text: input.text,
      url: input.url,
      publishedAt: new Date(),
    }));
  }
}
