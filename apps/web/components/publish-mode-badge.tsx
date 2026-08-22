import { Badge } from "./ui/badge";
import type { PublishMode } from "../lib/publish-mode";

const LABELS: Record<PublishMode, string> = {
  MOCK: "MOCK",
  REAL: "REAL",
  REAL_DRY_RUN: "REAL (DRY RUN)",
  REAL_BLOCKED: "REAL — RECONNECT NEEDED",
};

export function PublishModeBadge({ mode }: { mode: PublishMode }) {
  const tone = mode === "MOCK" ? "muted" : mode === "REAL" ? "destructive" : mode === "REAL_DRY_RUN" ? "warning" : "destructive";
  return <Badge tone={tone}>{LABELS[mode]}</Badge>;
}
