import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AIGenerationError } from "@social-growth-os/shared";
import { MockAIProvider } from "../providers/mock-provider.js";

const schema = z.object({ greeting: z.string() });

describe("MockAIProvider", () => {
  it("returns schema-validated structured data from a registered generator", async () => {
    const provider = new MockAIProvider({
      say_hello: () => ({ greeting: "hi" }),
    });

    const result = await provider.generateStructured({
      model: "mock-model",
      traceId: "trace_1",
      operation: "say_hello",
      prompt: "say hello",
      schema,
    });

    expect(result.data).toEqual({ greeting: "hi" });
    expect(result.provider).toBe("mock");
    expect(result.estimatedCostUsd).toBe(0);
  });

  it("throws AIGenerationError when no generator is registered for the operation", async () => {
    const provider = new MockAIProvider({});
    await expect(
      provider.generateStructured({
        model: "mock-model",
        traceId: "trace_1",
        operation: "unknown_op",
        prompt: "x",
        schema,
      }),
    ).rejects.toThrow(AIGenerationError);
  });

  it("throws AIGenerationError when the mock data fails schema validation", async () => {
    const provider = new MockAIProvider({
      say_hello: () => ({ greeting: 123 }),
    });
    await expect(
      provider.generateStructured({
        model: "mock-model",
        traceId: "trace_1",
        operation: "say_hello",
        prompt: "x",
        schema,
      }),
    ).rejects.toThrow(AIGenerationError);
  });
});
