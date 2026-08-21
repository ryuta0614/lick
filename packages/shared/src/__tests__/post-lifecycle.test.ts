import { describe, expect, it } from "vitest";
import {
  assertPostTransition,
  canTransitionPost,
  InvalidPostTransitionError,
} from "../post-lifecycle.js";

describe("post lifecycle", () => {
  it("allows the happy path from draft to published", () => {
    const path = [
      "DRAFT",
      "REVIEW",
      "APPROVED",
      "SCHEDULED",
      "QUEUED",
      "PUBLISHING",
      "PUBLISHED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionPost(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("allows publishing failure and retry via QUEUED", () => {
    expect(canTransitionPost("PUBLISHING", "FAILED")).toBe(true);
    expect(canTransitionPost("FAILED", "QUEUED")).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(canTransitionPost("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransitionPost("DRAFT", "SCHEDULED")).toBe(false);
  });

  it("rejects transitions out of terminal states", () => {
    expect(canTransitionPost("PUBLISHED", "DRAFT")).toBe(false);
    expect(canTransitionPost("REJECTED", "DRAFT")).toBe(false);
  });

  it("throws InvalidPostTransitionError for illegal transitions", () => {
    expect(() => assertPostTransition("DRAFT", "PUBLISHED")).toThrow(InvalidPostTransitionError);
  });

  it("does not throw for legal transitions", () => {
    expect(() => assertPostTransition("DRAFT", "REVIEW")).not.toThrow();
  });
});
