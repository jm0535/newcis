// Page 4 — Intelligence & Operations.
import { DashboardFooter } from "@/components/DashboardFooter";
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
import { SOURCE_META, sourceLabel } from "@/lib/sources";
import { FOCUS_NAMES, FOCUS_COUNT } from "@/lib/focus-provinces";
import { FileText, ExternalLink, FileDown } from "lucide-react";

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

// Response clusters — each a sector of the national disaster response, with the
// PNG lead agency and its international partner spelled out in full (the acronyms
// alone mean nothing to a non-specialist). `readiness` is a plain-English line an
// executive can read without knowing the cluster system.
type ClusterStage = "ACTIVE" | "STANDBY" | "STANDDOWN";
const CLUSTERS: {
  name: string;
  lead: string;
  leadFull: string;
  stage: ClusterStage;
  readiness: string;
}[] = [
  {
    name: "Food Security",
    lead: "DAL · WFP",
    leadFull: "Dept. of Agriculture & Livestock, with the UN World Food Programme",
    stage: "STANDBY",
    readiness: "Teams ready; monitoring crop and food-price stress, not yet deployed.",
  },
  {
    name: "Water, Sanitation & Hygiene",
    lead: "Water PNG · UNICEF",
    leadFull: "Water PNG, with UNICEF",
    stage: "STANDBY",
    readiness: "Ready to respond if drought cuts safe-water access.",
  },
  {
    name: "Health",
    lead: "NDoH · WHO",
    leadFull: "National Dept. of Health, with the World Health Organization",
    stage: "STANDBY",
    readiness: "Watching for disease and nutrition impacts; no outbreak response active.",
  },
  {
    name: "Logistics",
    lead: "DoW · WFP",
    leadFull: "Dept. of Works, with the UN World Food Programme",
    stage: "STANDBY",
    readiness: "Transport and supply lines on call to move relief if activated.",
  },
  {
    name: "Protection",
    lead: "DCDR · IOM",
    leadFull: "Dept. of Community Development & Religion, with the UN Migration Agency",
    stage: "STANDDOWN",
    readiness: "No current role; will re-engage if displacement risk rises.",
  },
];

// Plain-language meaning for each readiness stage, shown both as the chip label
// and in the legend so the board needs no glossary.
const CLUSTER_STAGE: Record<
  ClusterStage,
  { label: string; tone: "red" | "amber" | "neutral"; meaning: string }
> = {
  ACTIVE: { label: "Responding", tone: "red", meaning: "mobilised and responding now" },
  STANDBY: { label: "On standby", tone: "amber", meaning: "ready but not yet activated" },
  STANDDOWN: { label: "Stood down", tone: "neutral", meaning: "no current role" },
};

// Action items owed by national bodies. `ownerFull` expands each acronym; `why`
// gives the one-line reason the task matters, so the tracker reads as decisions,
// not codes.
const ACTIONS: {
  owner: string;
  ownerFull: string;
  task: string;
  why: string;
  due: string;
  status: "OPEN" | "DONE";
}[] = [
  {
    owner: "NSA Sec",
    ownerFull: "National Security Adviser's Secretariat",
    task: "Brief Cabinet on the current ENSO posture",
    why: "Keeps national leadership aligned on the climate alert level.",
    due: "2026-06-10",
    status: "OPEN",
  },
  {
    owner: "NDC",
    ownerFull: "National Disaster Centre",
    task: "Verify focus-province contact lists",
    why: "Ensures warnings reach the right people fast if the alert escalates.",
    due: "2026-06-12",
    status: "OPEN",
  },
  {
    owner: "DAL",
    ownerFull: "Dept. of Agriculture & Livestock",
    task: "Issue planting-window advisory (Highlands)",
    why: "Helps farmers time planting around the forecast dry spell.",
    due: "2026-06-15",
    status: "OPEN",
  },
];

const ACTION_STATUS: Record<"OPEN" | "DONE", { label: string; tone: "amber" | "neutral" }> = {
  OPEN: { label: "To do", tone: "amber" },
  DONE: { label: "Done", tone: "neutral" },
};

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

  // Data-feed health for the "Data Feeds" card. Same structured source map the
  // status bar uses — NOT the raw lastRun.notes debug string (that stays out of
  // the executive view). Failed feeds sink to the bottom so attention lands there.
  const feedEntries = Object.entries(lastRun?.sources_ok ?? {}).sort(
    ([, a], [, b]) => Number(b) - Number(a),
  );
  const feedsOk = feedEntries.filter(([, ok]) => ok).length;

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/operations" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
            NEWCIS
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Intelligence &amp; Operations
          </h1>
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
              title="Response Readiness"
              description="The national disaster-response teams, grouped by area of work. Each team has a Papua New Guinea lead agency and an international partner. This board shows how ready each team is right now."
              action={<ProvenanceBadge value="DEMO" />}
            />

            <ul className="divide-y divide-border-subtle">
              {CLUSTERS.map((c) => {
                const stage = CLUSTER_STAGE[c.stage];
                return (
                  <li
                    key={c.name}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-text-1 font-medium">{c.name}</span>
                        <Badge variant="subtle">{c.lead}</Badge>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">{c.leadFull}</p>
                      <p className="text-xs text-text-2 mt-1 leading-relaxed">{c.readiness}</p>
                    </div>
                    <StatusPill status={stage.tone} size="sm">
                      {stage.label}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
              {(["ACTIVE", "STANDBY", "STANDDOWN"] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <StatusPill status={CLUSTER_STAGE[k].tone} size="sm">
                    {CLUSTER_STAGE[k].label}
                  </StatusPill>
                  <span>= {CLUSTER_STAGE[k].meaning}</span>
                </span>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <SectionHeader
              title="Decisions & Actions"
              description="The actions national bodies have committed to this period — what each is doing, why it matters, and the date it is due."
              action={<ProvenanceBadge value="DEMO" />}
            />
            <ul className="divide-y divide-border-subtle">
              {ACTIONS.map((a, i) => {
                const st = ACTION_STATUS[a.status];
                return (
                  <li key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-text-1 font-medium leading-snug">{a.task}</p>
                      <StatusPill status={st.tone} size="sm">
                        {st.label}
                      </StatusPill>
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{a.why}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px] text-text-muted">
                      <span className="text-text-2">{a.ownerFull}</span>
                      <span aria-hidden>·</span>
                      <span>
                        due{" "}
                        <span className="text-text-2" data-numeric>
                          {a.due}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        <aside className="space-y-6">
          {/* Anchor target for the landing-page "Weekly SITREP" CTA
              (/operations#sitrep). scroll-mt clears the sticky status bar +
              page nav so the panel isn't hidden under them on jump. */}
          <div id="sitrep" className="scroll-mt-28">
            <SitrepGenerator />
          </div>

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
                    <span className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/sitrep/${s.id}/docx`}
                        className="text-text-muted hover:text-accent inline-flex items-center gap-0.5"
                        title="Download editable Word document"
                      >
                        <FileDown size={11} />
                        docx
                      </a>
                      <span className="text-text-muted" data-numeric>
                        {s.generated_at.slice(11, 16)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg">
            <SectionHeader
              title="Data Feeds"
              description="Where this picture's data comes from, and which feeds reported in this cycle. If a feed is offline we keep showing its last good reading — the dashboard never goes blank."
              action={
                <span className="text-[11px] text-text-muted">
                  <span className="text-status-green font-semibold" data-numeric>
                    {feedsOk}
                  </span>{" "}
                  of <span data-numeric>{feedEntries.length}</span> live
                </span>
              }
            />
            <ul className="space-y-2 text-sm">
              {feedEntries.map(([key, ok]) => {
                const meta = SOURCE_META[key];
                return (
                  <li key={key} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${
                        ok ? "bg-status-green" : "bg-status-red"
                      }`}
                      aria-hidden
                    />
                    <span className="flex flex-col">
                      <span className="text-text-1 leading-tight">
                        {sourceLabel(key)}
                        <span className="text-text-muted font-normal">
                          {" "}
                          — {ok ? "updated this cycle" : "no new data this cycle"}
                        </span>
                      </span>
                      {meta?.what && (
                        <span className="text-[11px] text-text-muted leading-tight">
                          {meta.what}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-text-muted mt-4 pt-3 border-t border-border-subtle">
              Last refreshed{" "}
              <span className="text-text-2" data-numeric>
                {fmtDateTime(lastRun?.finished_at)}
              </span>{" "}
              · tracking{" "}
              <span className="text-text-2" data-numeric>
                {indicators.length}
              </span>{" "}
              climate indicators across all{" "}
              <span className="text-text-2" data-numeric>
                {FOCUS_COUNT}
              </span>{" "}
              provinces.
            </p>
          </Card>
        </aside>
      </div>

      <DashboardFooter lastRun={lastRun} />
    </main>
  );
}
