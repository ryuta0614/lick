import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePublishMode } from "../publish-mode";

const ORIGINAL_ENV = { ...process.env };

describe("resolvePublishMode", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  for (const platform of ["THREADS", "X", "INSTAGRAM"] as const) {
    describe(`${platform}`, () => {
      beforeEach(() => {
        process.env[`${platform}_PLATFORM_MODE`] = "real";
      });

      it("is MOCK when the platform mode isn't real", () => {
        process.env[`${platform}_PLATFORM_MODE`] = "mock";
        const mode = resolvePublishMode({ platform, approvalMode: "MANUAL", credential: null });
        expect(mode).toBe("MOCK");
      });

      it("is REAL_BLOCKED when real mode is on but there's no credential", () => {
        const mode = resolvePublishMode({ platform, approvalMode: "MANUAL", credential: null });
        expect(mode).toBe("REAL_BLOCKED");
      });

      it("is REAL_BLOCKED when the credential needs reconnect", () => {
        const mode = resolvePublishMode({
          platform,
          approvalMode: "MANUAL",
          credential: { needsReconnect: true, expiresAt: null },
        });
        expect(mode).toBe("REAL_BLOCKED");
      });

      it("is REAL_BLOCKED when the credential is expired", () => {
        const mode = resolvePublishMode({
          platform,
          approvalMode: "MANUAL",
          credential: { needsReconnect: false, expiresAt: new Date(Date.now() - 1000) },
        });
        expect(mode).toBe("REAL_BLOCKED");
      });

      it("is REAL_BLOCKED when approvalMode isn't MANUAL, even with a valid credential", () => {
        const mode = resolvePublishMode({
          platform,
          approvalMode: "SEMI_AUTO",
          credential: { needsReconnect: false, expiresAt: null },
        });
        expect(mode).toBe("REAL_BLOCKED");
      });

      it("is REAL_DRY_RUN when everything checks out but dry-run is on (the default)", () => {
        const mode = resolvePublishMode({
          platform,
          approvalMode: "MANUAL",
          credential: { needsReconnect: false, expiresAt: null },
        });
        expect(mode).toBe("REAL_DRY_RUN");
      });

      it("is REAL when everything checks out and dry-run is explicitly off", () => {
        process.env[`${platform}_DRY_RUN`] = "false";
        const mode = resolvePublishMode({
          platform,
          approvalMode: "MANUAL",
          credential: { needsReconnect: false, expiresAt: null },
        });
        expect(mode).toBe("REAL");
      });
    });
  }
});
