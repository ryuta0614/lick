export type RevenueConversion = { value: number | null };

/**
 * Sums Conversion.value across a set of conversions, distinguishing
 * "unmeasurable" from a genuine zero (CLAUDE.md Phase 2.5 STEP 17): `null`
 * when there isn't a single conversion with a recorded monetary value (no
 * conversions at all, or only non-monetary ones like a lead/click with no
 * `value`) — never coerced to 0. A conversion with `value: null` inside a
 * set that has at least one measured value is simply excluded from the sum,
 * not treated as a $0 contribution.
 */
export function aggregateRevenue(conversions: RevenueConversion[]): number | null {
  const measured = conversions.filter((c): c is { value: number } => c.value != null);
  if (measured.length === 0) return null;
  return measured.reduce((sum, c) => sum + c.value, 0);
}

/** revenue / impressions * 1000. `null` when revenue is unmeasurable or impressions is 0/null (CLAUDE.md section 20). */
export function revenuePer1kImpressions(revenue: number | null, impressions: number | null): number | null {
  if (revenue == null || impressions == null || impressions <= 0) return null;
  return (revenue / impressions) * 1000;
}
