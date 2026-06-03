"use client";

// Refresh button (Option 3 from CLAUDE.md). Fires POST /api/ingest, polls until
// the response lands, then router.refresh() to re-fetch every server component
// with the new /data state. Punchy for live demos: real upstream pulls in front
// of the audience without leaving the dashboard.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  const busy = pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs uppercase tracking-wider font-semibold border transition-colors ${
          busy
            ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-wait"
            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/25"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${busy ? "bg-zinc-500" : "bg-emerald-400 animate-pulse"}`}
        />
        {busy ? "Refreshing…" : "Refresh data"}
      </button>
      {message && <span className="text-[10px] text-emerald-400 max-w-md truncate">{message}</span>}
      {error && <span className="text-[10px] text-red-400 max-w-md truncate">{error}</span>}
    </div>
  );
}
