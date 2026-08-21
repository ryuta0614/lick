/** CLAUDE.md section 22: never conclude causality from small samples. */
export const MIN_SAMPLE_SIZE = 10;
export const PREFERRED_SAMPLE_SIZE = 30;

export type Confidence = "low" | "medium" | "high";

export type PerformanceSample = {
  dimensionValue: string;
  metricValue: number;
};

export type DimensionStats = {
  dimensionValue: string;
  sampleSize: number;
  average: number;
  median: number;
  confidence: Confidence;
};

/** Groups samples by dimension value (e.g. hookType) and computes summary stats. */
export function aggregateByDimension(samples: PerformanceSample[]): DimensionStats[] {
  const groups = new Map<string, number[]>();
  for (const sample of samples) {
    const values = groups.get(sample.dimensionValue) ?? [];
    values.push(sample.metricValue);
    groups.set(sample.dimensionValue, values);
  }

  return [...groups.entries()].map(([dimensionValue, values]) => {
    const sampleSize = values.length;
    return {
      dimensionValue,
      sampleSize,
      average: mean(values),
      median: median(values),
      confidence: confidenceFor(sampleSize),
    };
  });
}

function confidenceFor(sampleSize: number): Confidence {
  if (sampleSize >= PREFERRED_SAMPLE_SIZE) return "high";
  if (sampleSize >= MIN_SAMPLE_SIZE) return "medium";
  return "low";
}

/** Only "medium"/"high" confidence dimensions should drive strategy recommendations. */
export function isStrongEnoughForRecommendation(stats: DimensionStats): boolean {
  return stats.confidence !== "low";
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted[mid];
  const prevValue = sorted[mid - 1];
  if (midValue === undefined) return 0;
  return sorted.length % 2 !== 0 ? midValue : ((prevValue ?? midValue) + midValue) / 2;
}
