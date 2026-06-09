"use client";

// SITREP generator panel. POSTs current state → /api/sitrep, receives the stored
// artefact, opens its HTML in a new tab for print-to-PDF, and offers an editable
// .docx download so executives can revise the report in Word and re-share.
import { useState } from "react";
import { FileText, ExternalLink, FileDown } from "lucide-react";
import { Card, Button } from "./ui";

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
    <Card padding="lg" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-1 flex items-center gap-2">
          <FileText size={14} className="text-accent" />
          Weekly SITREP
        </h3>
        <p className="text-[11px] text-text-muted mt-1 leading-snug">
          Generate a templated situation report from current data. Opens in a new tab — print
          to PDF, or download an editable <span className="text-text-2">.docx</span> to revise
          in Word.
        </p>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        aria-label="Analyst note"
        placeholder="Analyst note (optional) — appended to the report"
        className="w-full bg-surface-2 border border-border-default rounded px-2 py-1.5 text-xs text-text-1 placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors"
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="primary"
          onClick={generate}
          disabled={busy}
          icon={<FileText size={12} />}
        >
          {busy ? "Generating…" : "Generate SITREP"}
        </Button>
        {latestId && (
          <div className="flex items-center gap-3">
            <a
              href={`/api/sitrep/${latestId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink size={11} />
              Reopen
            </a>
            <a
              href={`/api/sitrep/${latestId}/docx`}
              className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
            >
              <FileDown size={11} />
              .docx
            </a>
          </div>
        )}
      </div>

      {error && <div className="text-[11px] text-status-red">{error}</div>}
    </Card>
  );
}
