"use client";

// SITREP generator panel. POSTs current state → /api/sitrep, receives the
// stored artefact, opens its HTML in a new tab for print-to-PDF.
import { useState } from "react";

export function SitrepGenerator() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sitrep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analyst_note: note || undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "sitrep failed");
      setLatestId(body.sitrep.id);
      window.open(`/api/sitrep/${body.sitrep.id}`, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Weekly SITREP</h3>
        <p className="text-[11px] text-zinc-500">
          Generate a templated situation report from current data. Opens in a new tab — use the
          browser's print dialog to save as PDF.
        </p>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Analyst note (optional) — appended to the report"
        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60"
      />

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={generate}
          disabled={busy}
          className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-semibold border ${
            busy
              ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-wait"
              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/25"
          }`}
        >
          {busy ? "Generating…" : "Generate SITREP"}
        </button>
        {latestId && (
          <a
            href={`/api/sitrep/${latestId}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-emerald-300 hover:underline truncate"
          >
            Reopen latest
          </a>
        )}
      </div>

      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
