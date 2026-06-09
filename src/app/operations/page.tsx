// Page 4 — Intelligence & Operations.
import { AUTO_REFRESH_LABEL } from "@/components/AutoRefresh";
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
import { FOCUS_NAMES, FOCUS_COUNT } from "@/lib/focus-provinces";
import { FileText, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

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

  const RANK = { low: 0, med: 1, high: 2, critical: 3 } as const;
  // One row per province: its single worst-hit sector and how many of its sectors
  // are at HIGH or CRITICAL. Ranked worst-first so the operations watch-list leads
  // with the provinces that need attention — at 22 provinces a flat grid buries
  // the priorities; a severity-ranked table surfaces them.
  const provinceWatchlist = Object.keys(FOCUS_NAMES)
    .map((code) => {
      const rows = sectorRisk.filter((r) => r.province_code === code);
      const worst = [...rows].sort((a, b) => RANK[b.level] - RANK[a.level])[0];
      const stressedCount = rows.filter(
        (r) => r.level === "high" || r.level === "critical",
      ).length;
      return { code, name: FOCUS_NAMES[code], worst, stressedCount };
    })
    .sort(
      (a, b) =>
        (b.worst ? RANK[b.worst.level] : -1) - (a.worst ? RANK[a.worst.level] : -1) ||
        b.stressedCount - a.stressedCount ||
        // Graduated within-band score: among provinces tied on worst level and
        // stressed-sector count, the one whose worst cell sits deeper in its band
        // leads. The level still dominates — this only orders genuine ties.
        (b.worst ? b.worst.score : 0) - (a.worst ? a.worst.score : 0) ||
        a.name.localeCompare(b.name),
    );
  const provincesAtRisk = provinceWatchlist.filter(
    (p) => p.worst && (p.worst.level === "high" || p.worst.level === "critical"),
  ).length;

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/operations" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
            Intelligence &amp; Operations
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">NEWCIS</h1>
          <p className="text-xs text-text-muted mt-2 max-w-2xl leading-relaxed">
            The action view: where things stand, which provinces need attention, who is on
            standby, what is owed and by whom — and a one-click Weekly SITREP for Cabinet.
          </p>
        </div>
        <RefreshButton />
      </header>

      <div className="px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <SectionHeader
              title="National Situation"
              description="The headline numbers at a glance — the alert level we are at, the Pacific climate phase, the overall risk rating, and how many focus provinces are in trouble."
            />
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
            <SectionHeader
              title="Provincial Watch-List"
              description={`All ${FOCUS_COUNT} provinces ranked worst-first by their single most-stressed sector — the priority order for operational attention. "Stressed" counts how many of a province's sectors sit at HIGH or CRITICAL.`}
              action={
                <span className="text-[11px] text-text-muted">
                  <span className="text-status-red font-semibold" data-numeric>
                    {provincesAtRisk}
                  </span>{" "}
                  of{" "}
                  <span data-numeric>{FOCUS_COUNT}</span> at risk
                </span>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[460px]">
                <thead className="text-[10px] uppercase tracking-[0.08em] text-text-muted">
                  <tr>
                    <th className="text-left pl-2 py-1 font-medium w-8">#</th>
                    <th className="text-left py-1 font-medium">Province</th>
                    <th className="text-left py-1 font-medium">Worst level</th>
                    <th className="text-left py-1 font-medium">Worst sector</th>
                    <th className="text-right pr-2 py-1 font-medium">Stressed</th>
                  </tr>
                </thead>
                <tbody>
                  {provinceWatchlist.map((p, i) => (
                    <tr
                      key={p.code}
                      className="border-t border-border-subtle"
                    >
                      <td className="pl-2 py-2 text-text-muted" data-numeric>
                        {i + 1}
                      </td>
                      <td className="py-2">
                        <span className="text-text-1 font-medium">{p.name}</span>
                        <span className="text-text-disabled text-[10px] ml-1.5" data-numeric>
                          {p.code}
                        </span>
                      </td>
                      <td className="py-2">
                        {p.worst ? (
                          <StatusPill status={RISK_STATUS[p.worst.level]} size="sm">
                            {p.worst.level}
                          </StatusPill>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 text-text-muted text-xs truncate max-w-[10rem]">
                        {p.worst?.sector ?? "—"}
                      </td>
                      <td className="pr-2 py-2 text-right" data-numeric>
                        {p.stressedCount > 0 ? (
                          <span className="text-status-red font-semibold">{p.stressedCount}</span>
                        ) : (
                          <span className="text-text-disabled">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding="lg">
            <SectionHeader
              title="Cluster Status Board"
              description="Response teams by sector. STANDBY = ready but not activated · ACTIVE = mobilised and responding · STAND-DOWN = no current role. Seeded for the demo."
              action={<ProvenanceBadge value="DEMO" />}
            />
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[420px]">
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
            </table></div>
          </Card>

          <Card padding="lg">
            <SectionHeader
              title="Action Tracker"
              description="Who owes what, by when. OPEN = still to do · DONE = complete. Seeded for the demo."
              action={<ProvenanceBadge value="DEMO" />}
            />
            <ul className="space-y-1.5 text-sm">
              {ACTIONS.map((a, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle pb-1.5"
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
            <SectionHeader
              title="Recent SITREPs"
              description="Reports generated this session — click to reopen and print."
            />
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
            <SectionHeader
              title="Ingest Pipeline"
              description="Health of the data feed — when it last ran and how much it pulled. The dashboard always shows the last good data, even if a source fails."
            />
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

      <footer className="border-t border-border-subtle px-4 md:px-6 py-3 text-[11px] text-text-muted flex flex-wrap justify-between gap-2">
        <span>
          Last ingest{" "}
          <span className="text-text-2" data-numeric>
            {fmtDateTime(lastRun?.finished_at)}
          </span>
        </span>
        <span>Auto-refreshes {AUTO_REFRESH_LABEL}</span>
        <span>
          Powered by{" "}
          <a
            href="https://www.in4metrix.dev"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            in4metrix
          </a>
        </span>
      </footer>
    </main>
  );
}
