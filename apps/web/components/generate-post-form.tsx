"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";

export type GeneratableAccount = {
  id: string;
  platform: string;
  label: string;
  mode: "MOCK" | "REAL" | "REAL_DRY_RUN" | "REAL_BLOCKED";
};

export function GeneratePostForm({ accounts }: { accounts: GeneratableAccount[] }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [socialAccountId, setSocialAccountId] = useState(accounts[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim() || !socialAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, socialAccountId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate content");
      }
      setTopic("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <select
        value={socialAccountId}
        onChange={(e) => setSocialAccountId(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-2 text-sm"
        disabled={loading}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label} — {account.mode}
          </option>
        ))}
      </select>
      <div className="flex-1">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic, e.g. AI side hustle"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={loading}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={loading || !socialAccountId}>
        {loading ? "Generating…" : "Generate Ideas + Post"}
      </Button>
    </form>
  );
}
