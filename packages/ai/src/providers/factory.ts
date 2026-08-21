import { AnthropicProvider } from "./anthropic-provider.js";
import { MockAIProvider, type MockStructuredGenerator } from "./mock-provider.js";
import { OpenAIProvider } from "./openai-provider.js";
import type { AIProvider } from "./types.js";

export type CreateProviderOptions = {
  /** Force a specific provider regardless of env vars. Defaults to env-based auto-detection. */
  provider?: "anthropic" | "openai" | "mock";
  mockGenerators?: Record<string, MockStructuredGenerator>;
  env?: Pick<NodeJS.ProcessEnv, "ANTHROPIC_API_KEY" | "OPENAI_API_KEY">;
};

/**
 * Picks a real provider when credentials are configured, otherwise falls
 * back to the network-free MockAIProvider so the rest of the app (and this
 * repo's CI) never depends on a live API key being present.
 */
export function createAIProviderFromEnv(options: CreateProviderOptions = {}): AIProvider {
  const env = options.env ?? process.env;
  const requested = options.provider;

  if (requested === "anthropic" || (!requested && env.ANTHROPIC_API_KEY)) {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    return new AnthropicProvider(env.ANTHROPIC_API_KEY);
  }

  if (requested === "openai" || (!requested && env.OPENAI_API_KEY)) {
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
    return new OpenAIProvider(env.OPENAI_API_KEY);
  }

  return new MockAIProvider(options.mockGenerators);
}
