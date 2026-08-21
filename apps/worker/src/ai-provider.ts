import type { AIProvider } from "@social-growth-os/ai";
import { createAIProviderFromEnv } from "@social-growth-os/ai";
import { createDefaultMockGenerators } from "@social-growth-os/content-engine";

let provider: AIProvider | undefined;

/** Real Anthropic/OpenAI provider when a key is configured, otherwise the network-free mock. */
export function getAIProvider(): AIProvider {
  if (!provider) {
    provider = createAIProviderFromEnv({ mockGenerators: createDefaultMockGenerators() });
  }
  return provider;
}
