import type { Platform } from "@social-growth-os/shared";
import { createMockPlatformAdapters, type SocialPlatformAdapter } from "@social-growth-os/platform-connectors";

/**
 * Phase 1 of the build order (CLAUDE.md section 36): every platform is
 * backed by MockPlatformAdapter until a real adapter (Threads first) is
 * wired in behind this same registry.
 */
let adapters: Record<Platform, SocialPlatformAdapter> | undefined;

export function getPlatformAdapters(): Record<Platform, SocialPlatformAdapter> {
  if (!adapters) {
    adapters = createMockPlatformAdapters();
  }
  return adapters;
}
