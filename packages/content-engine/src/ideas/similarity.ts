/**
 * Cheap, network-free similarity check (token-overlap Jaccard) used to keep
 * generated ideas/posts from being near-duplicates of previous account
 * posts, reference posts, or other candidates in the same batch
 * (CLAUDE.md section 12). This is a pragmatic MVP stand-in for a real
 * embedding-based semantic similarity check.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize++;
  }
  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

/**
 * Filters `candidates` down to ones sufficiently distinct from everything in
 * `existing` and from each other (checked in order, keeping the first of
 * any near-duplicate pair).
 */
export function filterNearDuplicates<T>(
  candidates: T[],
  getText: (item: T) => string,
  existingTexts: string[] = [],
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): T[] {
  const kept: T[] = [];
  const keptTexts = [...existingTexts];

  for (const candidate of candidates) {
    const text = getText(candidate);
    const isDuplicate = keptTexts.some((existing) => jaccardSimilarity(text, existing) >= threshold);
    if (!isDuplicate) {
      kept.push(candidate);
      keptTexts.push(text);
    }
  }

  return kept;
}
