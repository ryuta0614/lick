"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import type { PostStatus } from "@social-growth-os/shared";

async function callAction(postId: string, action: string, body?: unknown): Promise<void> {
  const response = await fetch(`/api/posts/${postId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Failed to ${action}`);
  }
}

export function PostActions({
  postId,
  status,
  isRealPublish,
  username,
}: {
  postId: string;
  status: PostStatus;
  /** True when this post targets a real, connected Threads account with dry-run off (CLAUDE.md Phase 2.5 STEP 2). */
  isRealPublish?: boolean;
  username?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  async function run(action: string, body?: unknown) {
    setPending(action);
    setError(null);
    try {
      await callAction(postId, action, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {status === "APPROVED" && isRealPublish && (
        <p className="rounded-md border border-destructive bg-red-50 p-2 text-sm font-bold text-destructive">
          ⚠ REAL THREADS POST @{username} — this will publish to the real Threads account, right now.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "REVIEW" && (
          <>
            <Button onClick={() => run("approve")} disabled={pending !== null}>
              Approve
            </Button>
            <Button variant="outline" onClick={() => run("rewrite")} disabled={pending !== null}>
              Rewrite
            </Button>
            <Button variant="destructive" onClick={() => run("reject")} disabled={pending !== null}>
              Reject
            </Button>
          </>
        )}

        {status === "APPROVED" && (
          <>
            <Button onClick={() => run("publish")} disabled={pending !== null}>
              Publish now
            </Button>
            <Button variant="destructive" onClick={() => run("reject")} disabled={pending !== null}>
              Reject
            </Button>
          </>
        )}
      </div>

      {status === "APPROVED" && (
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <Button
            variant="outline"
            disabled={!scheduledAt || pending !== null}
            onClick={() => run("schedule", { scheduledAt: new Date(scheduledAt).toISOString() })}
          >
            Schedule
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
