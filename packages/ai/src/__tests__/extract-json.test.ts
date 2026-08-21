import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AIGenerationError } from "@social-growth-os/shared";
import { parseStructuredResponse } from "../providers/extract-json.js";

const schema = z.object({ ok: z.boolean() });

describe("parseStructuredResponse", () => {
  it("parses a raw JSON object", () => {
    expect(parseStructuredResponse('{"ok": true}', schema)).toEqual({ ok: true });
  });

  it("extracts JSON from a fenced code block", () => {
    const text = 'Sure, here you go:\n```json\n{"ok": true}\n```';
    expect(parseStructuredResponse(text, schema)).toEqual({ ok: true });
  });

  it("extracts the JSON object even with surrounding prose", () => {
    const text = 'Here is the result: {"ok": true} — hope that helps!';
    expect(parseStructuredResponse(text, schema)).toEqual({ ok: true });
  });

  it("throws AIGenerationError on invalid JSON", () => {
    expect(() => parseStructuredResponse("not json at all", schema)).toThrow(AIGenerationError);
  });

  it("throws AIGenerationError when JSON does not match the schema", () => {
    expect(() => parseStructuredResponse('{"ok": "yes"}', schema)).toThrow(AIGenerationError);
  });
});
