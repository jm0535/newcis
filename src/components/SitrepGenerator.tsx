"use client";

// SITREP generator panel. POSTs current state → /api/sitrep, opens the returned
// HTML in a new tab for print-to-PDF, and offers an editable .docx download so
// executives can revise the report in Word and re-share. Both the open and the
// download work off data returned in-request, so they never depend on a stored
// file — which matters on Vercel, where each serverless invocation has its own
// /tmp and a re-fetch by id can land on a different instance.
import { useState } from "react";
import { FileText, FileDown } from "lucide-react";
import { Card, Button } from "./ui";

export function SitrepGenerator() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

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
      setGenerated(true);
      // Open the report straight from the HTML the POST returned, via a Blob URL —
      // instance-independent, so it always works even on serverless.
      const blob = new Blob([body.sitrep.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // One-shot: generate from current data AND return the .docx in the same request
  // (POST /api/sitrep/docx), then trigger a browser download. No stored-file
  // dependency, so this is reliable on Vercel.
  async function downloadDocx() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/sitrep/docx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analyst_note: note || undefined }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: "docx failed" }));
        throw new Error(msg.error ?? "docx failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="(.+?)"/);
      const filename = match?.[1] ?? "NEWCIS SITREP.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={generate}
          disabled={busy || downloading}
          icon={<FileText size={12} />}
        >
          {busy ? "Generating…" : "Generate SITREP"}
        </Button>
        <Button
          variant="secondary"
          onClick={downloadDocx}
          disabled={busy || downloading}
          icon={<FileDown size={12} />}
        >
          {downloading ? "Preparing…" : "Download .docx"}
        </Button>
      </div>
      {generated && !error && (
        <div className="text-[11px] text-text-muted">
          Report opened in a new tab. Use the browser print dialog for PDF, or the .docx for Word.
        </div>
      )}

      {error && <div className="text-[11px] text-status-red">{error}</div>}
    </Card>
  );
}
