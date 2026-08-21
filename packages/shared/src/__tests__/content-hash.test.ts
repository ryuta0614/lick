import { describe, expect, it } from "vitest";
import { computeContentHash } from "../content-hash.js";

describe("computeContentHash", () => {
  it("is deterministic for the same account and text", () => {
    const a = computeContentHash("account_1", "Hello world");
    const b = computeContentHash("account_1", "Hello world");
    expect(a).toBe(b);
  });

  it("is insensitive to surrounding whitespace and case", () => {
    const a = computeContentHash("account_1", "Hello World");
    const b = computeContentHash("account_1", "  hello   world  ");
    expect(a).toBe(b);
  });

  it("differs across accounts to allow the same text on different accounts", () => {
    const a = computeContentHash("account_1", "Hello world");
    const b = computeContentHash("account_2", "Hello world");
    expect(a).not.toBe(b);
  });

  it("differs for different text on the same account", () => {
    const a = computeContentHash("account_1", "Hello world");
    const b = computeContentHash("account_1", "Goodbye world");
    expect(a).not.toBe(b);
  });
});
