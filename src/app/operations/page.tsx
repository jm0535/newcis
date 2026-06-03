// Page 4 — Intelligence & Operations.
// National situation summary, high-risk focus province list, cluster status
// (DEMO — seeded), action tracker (DEMO), Refresh button (Option 3), and the
// SITREP generator.
import { PageNav } from "@/components/PageNav";
import { ProvenanceBadge } from "@/components/Provenance";
import { RefreshButton } from "@/components/RefreshButton";
import { SitrepGenerator } from "@/components/SitrepGenerator";
import { StatusBar } from "@/components/StatusBar";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
  listSitreps,
} from "@/lib/data";
import { ALERT_BG_CLASS, RISK_BG_CLASS, fmtDateTime } from "@/lib/ui";

export const dynamic = "force-dynamic";

const FOCUS_NAMES: Record<string, string> = {
  PG08: "Enga",
  PG09: "Western Highlands",
  PG07: "Southern Highlands",
  PG02: "Gulf",
};

// Cluster board + action tracker are seeded for the PoC — operational
// integration is a Phase-2 task. Provenance badge keeps the audience honest.
const CLUSTERS: { name: string; lead: string; status: "STANDBY" | "ACTIVE" | "STANDDOWN" }[] = [
  { name: "Food Security", lead: "DAL · WFP", status: "STANDBY" },
  { name: "Water, Sanitation & Hygiene", lead: "Water PNG · UNICEF", status: "STANDBY" },
  { name: "Health", lead: "NDoH · WHO", status: "STANDBY" },
  { name: "Logistics", lead: "DoW · WFP", status: "STANDBY" },
  { name: "Protection", lead: "DCDR · IOM", status: "STANDDOWN" },
];

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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/operations" />

      <div className="px-6 py-5 border-b border-zinc-900 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            NEWCIS <span className="text-zinc-500 font-normal">· Intelligence & Operations</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            National situation, focus-province risk, cluster status, and the SITREP generator.
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">
              National Situation
            </h2>
            {national ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className={`p-3 rounded border ${ALERT_BG_CLASS[national.alert_level]}`}>
                  <div className="text-[10px] uppercase opacity-80">Alert</div>
                  <div className="text-lg font-semibold">{national.alert_level}</div>
                </div>
                <div className="p-3 rounded border border-zinc-800 bg-zinc-900/50">
                  <div className="text-[10px] uppercase text-zinc-500">ENSO Phase</div>
                  <div className="text-sm text-zinc-100">{national.enso_phase.replace(/_/g, " ")}</div>
                </div>
                <div className="p-3 rounded border border-zinc-800 bg-zinc-900/50">
                  <div className="text-[10px] uppercase text-zinc-500">Risk Rating</div>
                  <div className="text-sm text-zinc-100">{national.national_risk_rating.toUpperCase()}</div>
                </div>
                <div className="p-3 rounded border border-zinc-800 bg-zinc-900/50">
                  <div className="text-[10px] uppercase text-zinc-500">High-Risk Provinces</div>
                  <div className="text-sm text-zinc-100">{national.high_risk_province_count}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No national status — run ingest.</div>
            )}
          </div>

          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">
              Focus Provinces — Worst Sector Risk
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {focusProvinceRisks.map((p) => (
                <div key={p.code} className="border border-zinc-800 rounded p-3 bg-zinc-950">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{p.code}</div>
                  <div className="text-sm font-semibold text-zinc-100">{p.name}</div>
                  {p.worst ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${RISK_BG_CLASS[p.worst.level]}`}
                      >
                        {p.worst.level}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">{p.worst.sector}</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-zinc-500">No risk data</div>
                  )}
                </div>
              ))}
            </div>
            {highRiskRows.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs text-zinc-300">
                {highRiskRows.map((r, i) => (
                  <li key={i} className="flex justify-between border-b border-zinc-900 pb-1">
                    <span>
                      <span className="text-zinc-100 font-medium">{FOCUS_NAMES[r.province_code]}</span>
                      <span className="text-zinc-500"> · {r.sector}</span>
                    </span>
                    <span
                      className={`px-1.5 rounded border text-[10px] font-semibold uppercase ${RISK_BG_CLASS[r.level]}`}
                    >
                      {r.level}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                Cluster Status Board
              </h2>
              <ProvenanceBadge value="DEMO" />
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="text-left pl-2 py-1 font-normal">Cluster</th>
                  <th className="text-left py-1 font-normal">Lead</th>
                  <th className="text-right pr-2 py-1 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {CLUSTERS.map((c) => (
                  <tr key={c.name} className="border-t border-zinc-900">
                    <td className="pl-2 py-1.5 text-zinc-200">{c.name}</td>
                    <td className="py-1.5 text-zinc-500 text-xs">{c.lead}</td>
                    <td className="pr-2 py-1.5 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                          c.status === "ACTIVE"
                            ? "bg-red-500/20 text-red-300 border-red-500/50"
                            : c.status === "STANDBY"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                              : "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                Action Tracker
              </h2>
              <ProvenanceBadge value="DEMO" />
            </div>
            <ul className="space-y-1.5 text-sm">
              {ACTIONS.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border-b border-zinc-900 pb-1.5"
                >
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-16 shrink-0">
                    {a.owner}
                  </span>
                  <span className="flex-1 text-zinc-200">{a.task}</span>
                  <span className="text-[11px] text-zinc-500 font-mono">{a.due}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                      a.status === "DONE"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                        : "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"
                    }`}
                  >
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="space-y-6">
          <SitrepGenerator />

          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Recent SITREPs
            </h2>
            {sitreps.length === 0 ? (
              <div className="text-xs text-zinc-500">No reports generated yet.</div>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {sitreps.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <a
                      href={`/api/sitrep/${s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-300 hover:underline truncate"
                    >
                      {s.period}
                    </a>
                    <span className="text-zinc-500 font-mono shrink-0">
                      {s.generated_at.slice(11, 16)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Ingest Pipeline
            </h2>
            <div className="text-xs text-zinc-400 space-y-1">
              <div>
                Last:{" "}
                <span className="font-mono text-zinc-200">{fmtDateTime(lastRun?.finished_at)}</span>
              </div>
              <div>
                Status: <span className="text-zinc-200">{lastRun?.status ?? "—"}</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-2">
                {indicators.length} indicators live · {sectorRisk.length} sector cells.
              </div>
              {lastRun?.notes && (
                <div className="text-[11px] text-zinc-500 mt-2 leading-snug">{lastRun.notes}</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="border-t border-zinc-900 px-6 py-3 text-[11px] text-zinc-500 flex flex-wrap justify-between gap-2">
        <span>
          Last ingest:{" "}
          <span className="text-zinc-300 font-mono">{fmtDateTime(lastRun?.finished_at)}</span>
        </span>
        <span>newcis.in4metrix.dev</span>
      </footer>
    </main>
  );
}
