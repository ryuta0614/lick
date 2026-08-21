"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";

export function TrendCollectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/trends/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: [{ title, source: "manual" }] }),
      });
      setTitle("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Manually add a trend/topic"
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        disabled={loading}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Adding…" : "Add trend"}
      </Button>
    </form>
  );
}
