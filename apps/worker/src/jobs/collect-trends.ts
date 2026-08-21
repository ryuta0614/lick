import { z } from "zod";
import { prisma } from "@social-growth-os/database";
import { ManualTrendCollector } from "@social-growth-os/content-engine";

export const CollectTrendsJobSchema = z.object({
  workspaceId: z.string(),
  topics: z.array(
    z.object({
      title: z.string().min(1),
      text: z.string().optional(),
      url: z.string().url().optional(),
      source: z.string().optional(),
    }),
  ),
});

/**
 * MVP trend collection is manual input only (CLAUDE.md STEP 1 / STEP 4) —
 * no scraping, no guessed third-party endpoints.
 */
export async function runCollectTrendsJob(rawData: unknown): Promise<{ trendIds: string[] }> {
  const data = CollectTrendsJobSchema.parse(rawData);
  const collector = new ManualTrendCollector(data.topics);
  const collected = await collector.collect();

  const trendIds: string[] = [];
  for (const trend of collected) {
    const created = await prisma.trend.create({
      data: {
        workspaceId: data.workspaceId,
        source: trend.source,
        title: trend.title,
        text: trend.text,
        url: trend.url,
        publishedAt: trend.publishedAt,
      },
    });
    trendIds.push(created.id);
  }

  return { trendIds };
}
