// Page 4 — Intelligence & Operations.
import { PageNav } from "@/components/PageNav";
import { ProvenanceBadge } from "@/components/Provenance";
import { RefreshButton } from "@/components/RefreshButton";
import { SitrepGenerator } from "@/components/SitrepGenerator";
import { StatusBar } from "@/components/StatusBar";
import { Card, SectionHeader, StatusPill, Badge, EmptyState, MetricTile } from "@/components/ui";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
  listSitreps,
} from "@/lib/data";
import { fmtDateTime } from "@/lib/ui";
import { FileText, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const FOCUS_NAMES: Record<string, string> = {
  PG08: "Enga",
  PG09: "Western Highlands",
  PG07: "Southern Highlands",
  PG02: "Gulf",
};

const ALERT_TONE = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  BLACK: "black",
} as const;

const RISK_STATUS = {
  low: "green",
  med: "amber",
  high: "red",
  critical: "black",
} as const;

const CLUSTERS: { name: string; lead: string; status: "STANDBY" | "ACTIVE" | "STANDDOWN" }[] = [
  { name: "Food Security", lead: "DAL · WFP", status: "STANDBY" },
  { name: "Water, Sanitation & Hygiene", lead: "Water PNG · UNICEF", status: "STANDBY" },
  { name: "Health", lead: "NDoH · WHO", status: "STANDBY" },
  { name: "Logistics", lead: "DoW · WFP", status: "STANDBY" },
  { name: "Protection", lead: "DCDR · IOM", status: "STANDDOWN" },
];

const CLUSTER_STATUS_MAP = {
  ACTIVE: "red",
  STANDBY: "amber",
  STANDDOWN: "neutral",
} as const;

const ACTIONS: { owner: string; task: string; due: string; status: "OPEN" | "DONE" }[] = [
  { owner: "NSA Sec", task: "Brief Cabinet on current ENSO posture", due: "2026-06-10", status: "OPEN" },
  { owner: "NDC", task: "Verify focus-province contact lists", due: "2026-06-12", status: "OPEN" },
  { owner: "DAL", task: "Issue planting-window advisory (Highlands)", due: "2026-06-15", status: "OPEN" },
];

export default async function OperationsPage() {
  const [national, indicators, sectorRisk, lastRun, sitreps] = await Promise.all([
    getNationalStatus(),
    getIndicators(),
    getSectorRisk(),
    getLastRun(),
    listSitreps(),
  ]);

  const highRiskRows = sectorRisk.filter(
    (r) => FOCUS_NAMES[r.province_code] && (r.level === "high" || r.level === "critical"),
  );
  const focusProvinceRisks = Object.keys(FOCUS_NAMES).map((code) => {
    const rows = sectorRisk.filter((r) => r.province_code === code);
    const worst = rows.sort((a, b) => {
      const rank = { low: 0, med: 1, high: 2, critical: 3 } as const;
      return rank[b.level] - rank[a.level];
    })[0];
    return { code, name: FOCUS_NAMES[code], worst };
  });

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/operations" />

      <header className="px-6 py-6 border-b border-border-subtle flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
            Intelligence &amp; Operations
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">NEWCIS</h1>
          <p className="text-xs text-text-muted mt-2 max-w-2xl leading-relaxed">
            National situation, focus-province risk, cluster status, and the SITREP generator.
          </p>
        </div>
        <RefreshButton />
      </header>

      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <SectionHeader title="National Situation" />
            {national ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricTile
                  label="Alert"
                  value={national.alert_level}
                  tone={ALERT_TONE[national.alert_level]}
                />
                <MetricTile
                  label="ENSO Phase"
                  value={
                    <span className="text-base">{national.enso_phase.replace(/_/g, " ")}</span>
                  }
                />
                <MetricTile
                  label="Risk Rating"
                  value={national.national_risk_rating.toUpperCase()}
                  tone={RISK_STATUS[national.national_risk_rating]}
                />
                <MetricTile
                  label="High-Risk Provinces"
                  value={String(national.high_risk_province_count)}
                />
              </div>
            ) : (
              <EmptyState title="No national status" description="Run ingest to populate." />
            )}
          </Card>

          <Card padding="lg">
            <SectionHeader title="Focus Provinces — Worst Sector Risk" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {focusProvinceRisks.map((p) => (
                <Card key={p.code} variant="muted" padding="sm">
                  <div className="text-[10px] text-text-muted uppercase tracking-[0.08em]" data-numeric>
                    {p.code}
                  </div>
                  <div className="text-sm font-semibold text-text-1 mt-0.5">{p.name}</div>
                  {p.worst ? (
                    <div className="mt-2 flex items-center gap-2">
                      <StatusPill status={RISK_STATUS[p.worst.level]} size="sm">
                        {p.worst.level}
                      </StatusPill>
                      <span className="text-[11px] text-text-muted truncate">
                        {p.worst.sector}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-text-muted">No risk data</div>
                  )}
                </Card>
              ))}
            </div>
            {highRiskRows.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs">
                {highRiskRows.map((r, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center border-b border-border-subtle pb-1.5"
                  >
                    <span>
                      <span className="text-text-1 font-medium">
                        {FOCUS_NAMES[r.province_code]}
                      </span>
                      <span className="text-text-muted"> · {r.sector}</span>
                    </span>
                    <StatusPill status={RISK_STATUS[r.level]} size="sm">
                      {r.level}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg">
            <SectionHeader
              title="Cluster Status Board"
              action={<ProvenanceBadge value="DEMO" />}
            />
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-[0.08em] text-text-muted">
                <tr>
                  <th className="text-left pl-2 py-1 font-medium">Cluster</th>
                  <th className="text-left py-1 font-medium">Lead</th>
                  <th className="text-right pr-2 py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {CLUSTERS.map((c) => (
                  <tr key={c.name} className="border-t border-border-subtle">
                    <td className="pl-2 py-2 text-text-1">{c.name}</td>
                    <td className="py-2 text-text-muted text-xs">{c.lead}</td>
                    <td className="pr-2 py-2 text-right">
                      <StatusPill status={CLUSTER_STATUS_MAP[c.status]} size="sm">
                        {c.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card padding="lg">
            <SectionHeader title="Action Tracker" action={<ProvenanceBadge value="DEMO" />} />
            <ul className="space-y-1.5 text-sm">
              {ACTIONS.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border-b border-border-subtle pb-1.5"
                >
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-muted w-16 shrink-0">
                    {a.owner}
                  </span>
                  <span className="flex-1 text-text-1">{a.task}</span>
                  <span className="text-[11px] text-text-muted shrink-0" data-numeric>
                    {a.due}
                  </span>
                  <Badge variant={a.status === "DONE" ? "accent" : "subtle"}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <aside className="space-y-6">
          <SitrepGenerator />

          <Card padding="lg">
            <SectionHeader title="Recent SITREPs" />
            {sitreps.length === 0 ? (
              <EmptyState
                icon={<FileText size={28} />}
                title="No reports yet"
                description="Generate a SITREP above to populate this list."
              />
            ) : (
              <ul className="space-y-1.5 text-xs">
                {sitreps.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 items-center">
                    <a
                      href={`/api/sitrep/${s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline truncate inline-flex items-center gap-1"
                    >
                      <ExternalLink size={11} />
                      {s.period}
                    </a>
                    <span className="text-text-muted shrink-0" data-numeric>
                      {s.generated_at.slice(11, 16)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg">
            <SectionHeader title="Ingest Pipeline" />
            <div className="text-xs text-text-2 space-y-1.5">
              <div>
                Last{" "}
                <span className="text-text-1" data-numeric>
                  {fmtDateTime(lastRun?.finished_at)}
                </span>
              </div>
              <div>
                Status: <span className="text-text-1">{lastRun?.status ?? "—"}</span>
              </div>
              <div className="text-[11px] text-text-muted mt-2" data-numeric>
                {indicators.length} indicators · {sectorRisk.length} sector cells.
              </div>
              {lastRun?.notes && (
                <div className="text-[11px] text-text-muted mt-2 leading-snug">
                  {lastRun.notes}
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <footer className="border-t border-border-subtle px-6 py-3 text-[11px] text-text-muted flex flex-wrap justify-between gap-2">
        <span>
          Last ingest{" "}
          <span className="text-text-2" data-numeric>
            {fmtDateTime(lastRun?.finished_at)}
          </span>
        </span>
        <span data-numeric>newcis.in4metrix.dev</span>
      </footer>
    </main>
  );
}
