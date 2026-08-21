"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";

export function GeneratePostForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
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
      <Button type="submit" disabled={loading}>
        {loading ? "Generating…" : "Generate Ideas + Post"}
      </Button>
    </form>
  );
}
