"use client";

// Refresh button. Fires POST /api/ingest, then router.refresh() to re-fetch every
// server component with the new /data state. Punchy for live demos.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "ingest failed");
      setMessage(`Ingest ${body.lastRun.status}: ${body.lastRun.notes}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        onClick={run}
        disabled={pending}
        icon={<RefreshCw size={12} className={pending ? "animate-spin" : ""} />}
      >
        {pending ? "Refreshing…" : "Refresh data"}
      </Button>
      {message && (
        <span className="text-[10px] text-status-green max-w-md truncate">{message}</span>
      )}
      {error && <span className="text-[10px] text-status-red max-w-md truncate">{error}</span>}
    </div>
  );
}
