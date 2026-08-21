/** USD per 1M tokens, [input, output]. Update as pricing changes. */
const PRICING_PER_1M_TOKENS: Record<string, [number, number]> = {
  "claude-sonnet-4-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
  "claude-opus-4-1": [15, 75],
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_1M_TOKENS[model];
  if (!pricing) return 0;
  const [inputPrice, outputPrice] = pricing;
  return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
}
