/** CLAUDE.md section 22 / Phase 2.5 STEP 7: never conclude causality from small samples. */
export type ConfidenceLevel = "INSUFFICIENT_DATA" | "LOW" | "MEDIUM" | "HIGH";

export type ConfidenceThresholds = {
  /** sampleSize >= this -> at least LOW */
  low: number;
  /** sampleSize >= this -> at least MEDIUM */
  medium: number;
  /** sampleSize >= this -> HIGH */
  high: number;
};

/** Defaults per CLAUDE.md Phase 2.5 STEP 7: <5 INSUFFICIENT_DATA, 5-9 LOW, 10-29 MEDIUM, 30+ HIGH. */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = { low: 5, medium: 10, high: 30 };

export function classifyConfidence(
  sampleSize: number,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
): ConfidenceLevel {
  if (sampleSize >= thresholds.high) return "HIGH";
  if (sampleSize >= thresholds.medium) return "MEDIUM";
  if (sampleSize >= thresholds.low) return "LOW";
  return "INSUFFICIENT_DATA";
}

export type PerformanceSample = {
  dimensionValue: string;
  metricValue: number;
};

export type DimensionStats = {
  dimensionValue: string;
  sampleSize: number;
  average: number;
  median: number;
  p25: number;
  p75: number;
  confidence: ConfidenceLevel;
};

/** Groups samples by dimension value (e.g. hookType) and computes summary stats. */
export function aggregateByDimension(
  samples: PerformanceSample[],
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
): DimensionStats[] {
  const groups = new Map<string, number[]>();
  for (const sample of samples) {
    const values = groups.get(sample.dimensionValue) ?? [];
    values.push(sample.metricValue);
    groups.set(sample.dimensionValue, values);
  }

  return [...groups.entries()].map(([dimensionValue, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      dimensionValue,
      sampleSize: values.length,
      average: mean(values),
      median: median(values),
      p25: percentile(sorted, 25),
      p75: percentile(sorted, 75),
      confidence: classifyConfidence(values.length, thresholds),
    };
  });
}

/** Only INSUFFICIENT_DATA dimensions are excluded from any reporting — even LOW confidence is shown, clearly labeled. */
export function isStrongEnoughForRecommendation(stats: { confidence: ConfidenceLevel }): boolean {
  return stats.confidence !== "INSUFFICIENT_DATA";
}

export type DimensionStatsWithBaseline = DimensionStats & {
  /** The account-wide median for this metric, across all samples (not just this dimension value). */
  baselineMedian: number;
  /** (median - baselineMedian) / baselineMedian. `null` when the baseline is 0 (division by zero). */
  relativeLift: number | null;
};

/**
 * Compares each dimension bucket's median against the account-wide median
 * for the same metric (CLAUDE.md Phase 2.5 STEP 6 — baseline comparison).
 */
export function compareToBaseline(stats: DimensionStats[], allValues: number[]): DimensionStatsWithBaseline[] {
  const baselineMedian = median(allValues);
  return stats.map((s) => ({
    ...s,
    baselineMedian,
    relativeLift: baselineMedian !== 0 ? (s.median - baselineMedian) / baselineMedian : null,
  }));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Standard median: for an even count, the average of the two middle values. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted[mid];
  const prevValue = sorted[mid - 1];
  if (midValue === undefined) return 0;
  return sorted.length % 2 !== 0 ? midValue : ((prevValue ?? midValue) + midValue) / 2;
}

/**
 * Nearest-rank percentile (1-indexed, `rank = ceil(p/100 * n)`) over an
 * already-sorted-ascending array. `p` in [0, 100]. Used for p25/p75 —
 * `median()` above is the authoritative median (interpolated for even n).
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedValues.length);
  const index = clamp(rank - 1, 0, sortedValues.length - 1);
  return sortedValues[index] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
