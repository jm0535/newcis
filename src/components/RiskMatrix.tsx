"use client";

// National risk matrix — sectors × provinces as a COLOUR HEATMAP, built to scale
// from the focus set to the full 22 provinces without a horizontal scrollbar (a
// scroll-only matrix is unreadable for an executive at a glance). Design:
//   - Cells are solid traffic-light colour, not text pills — colour IS the signal
//     at this density; a small trend caret rides each cell.
//   - Provinces are SORTED BY SEVERITY (worst to the left) so the PM's eye lands
//     on the trouble first; the sector-name column is frozen (sticky) on scroll.
//   - A per-sector "National" roll-up column states the worst level + how many
//     provinces sit at it, so each row answers "how bad is this sector nationally?"
//   - Click any cell → a popover with the full detail (the "why is Enga red?" drill).
//   - On phones the grid is replaced by a ranked hotspot list — what an executive
//     actually needs on mobile is the priorities, not a 176-cell grid.
// Province-count-agnostic: it renders whatever provinces appear in the data.
import { useMemo, useState } from "react";
import type { RiskLevel, SectorRisk, Sector } from "@/lib/types";
import { RISK_COLOUR, TREND_GLYPH } from "@/lib/ui";
import { ALL_SHORT_LABELS, ALL_NAMES } from "@/lib/focus-provinces";

const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
  "Disaster & Hazard",
];

// Severity weight — drives both the province sort and the worst-level roll-up.
const LEVEL_WEIGHT: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };
const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  med: "MED",
  high: "HIGH",
  critical: "CRITICAL",
};
const LEVEL_TEXT_ON_CELL: Record<RiskLevel, string> = {
  // Black/critical is dark → light text; the rest are vivid → dark text reads best.
  low: "text-black/80",
  med: "text-black/80",
  high: "text-white",
  critical: "text-white",
};

const shortLabel = (code: string) => ALL_SHORT_LABELS[code] ?? code;
const fullName = (code: string) => ALL_NAMES[code] ?? code;

export function RiskMatrix({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const [active, setActive] = useState<string | null>(null); // "code::sector"

  const byKey = useMemo(
    () => new Map(sectorRisk.map((r) => [`${r.province_code}::${r.sector}`, r])),
    [sectorRisk],
  );

  // Provinces present in the data, ranked worst-first (sum of level weights, then
  // peak level, then name) so the most at-risk provinces sit at the left edge.
  const provinces = useMemo(() => {
    const codes = [...new Set(sectorRisk.map((r) => r.province_code))];
    const sevOf = (code: string) => {
      const rows = sectorRisk.filter((r) => r.province_code === code);
      const total = rows.reduce((s, r) => s + LEVEL_WEIGHT[r.level], 0);
      const peak = rows.reduce((m, r) => Math.max(m, LEVEL_WEIGHT[r.level]), 0);
      return { total, peak };
    };
    return codes
      .map((code) => ({ code, ...sevOf(code) }))
      .sort(
        (a, b) => b.total - a.total || b.peak - a.peak || fullName(a.code).localeCompare(fullName(b.code)),
      );
  }, [sectorRisk]);

  // Per-sector national roll-up: worst level across provinces + how many sit at it.
  const rollup = useMemo(() => {
    const out = new Map<Sector, { level: RiskLevel; count: number }>();
    for (const sector of SECTORS) {
      const rows = sectorRisk.filter((r) => r.sector === sector);
      if (rows.length === 0) continue;
      const worst = rows.reduce<RiskLevel>(
        (m, r) => (LEVEL_WEIGHT[r.level] > LEVEL_WEIGHT[m] ? r.level : m),
        "low",
      );
      const count = rows.filter((r) => r.level === worst).length;
      out.set(sector, { level: worst, count });
    }
    return out;
  }, [sectorRisk]);

  // Mobile hotspots: every cell at HIGH or CRITICAL, ranked worst-first.
  const hotspots = useMemo(
    () =>
      sectorRisk
        .filter((r) => r.level === "high" || r.level === "critical")
        .sort(
          (a, b) =>
            LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] ||
            fullName(a.province_code).localeCompare(fullName(b.province_code)),
        ),
    [sectorRisk],
  );

  if (sectorRisk.length === 0) {
    return (
      <div className="text-sm text-text-muted border border-dashed border-border-default rounded-lg px-4 py-8 text-center">
        No sector risk yet — trigger an ingest from the Operations page.
      </div>
    );
  }

  return (
    <div>
      {/* ── Desktop / tablet: colour heatmap ─────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        {/* w-full lets the (unconstrained) sector column absorb slack, while every
            data column is FIXED-narrow — so 10 provinces don't balloon and 22
            still fit without a horizontal scrollbar. */}
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.06em] text-text-muted font-semibold">
              <th className="sticky left-0 z-10 bg-surface-1 text-left font-medium pr-3 pb-2 align-bottom w-auto">
                Sector
              </th>
              <th className="text-center font-semibold pb-2 px-0.5 align-bottom text-text-2 w-[3.5rem]">
                National
              </th>
              {provinces.map((p) => (
                <th
                  key={p.code}
                  className="font-medium pb-2 px-0 align-bottom w-9"
                  title={fullName(p.code)}
                >
                  <span className="block whitespace-nowrap [writing-mode:vertical-rl] rotate-180 mx-auto max-h-20 leading-tight">
                    {shortLabel(p.code)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTORS.map((sector) => {
              const roll = rollup.get(sector);
              return (
                <tr key={sector}>
                  <td className="sticky left-0 z-10 bg-surface-1 text-text-1 pr-3 py-0.5 font-medium whitespace-nowrap">
                    {sector}
                  </td>
                  {/* National roll-up cell */}
                  <td className="px-0.5 py-0.5 w-[3.5rem]">
                    {roll ? (
                      <div
                        className="flex flex-col items-center justify-center rounded h-9 px-1 border border-white/10"
                        style={{ background: RISK_COLOUR[roll.level] }}
                        title={`Worst nationally: ${LEVEL_LABEL[roll.level]} in ${roll.count} province${roll.count === 1 ? "" : "s"}`}
                      >
                        <span className={`text-[9px] font-bold leading-none ${LEVEL_TEXT_ON_CELL[roll.level]}`}>
                          {LEVEL_LABEL[roll.level]}
                        </span>
                        <span className={`text-[8px] leading-none mt-0.5 ${LEVEL_TEXT_ON_CELL[roll.level]} opacity-90`} data-numeric>
                          ×{roll.count}
                        </span>
                      </div>
                    ) : (
                      <div className="h-9 rounded bg-surface-3" />
                    )}
                  </td>
                  {/* Province cells */}
                  {provinces.map((p) => {
                    const key = `${p.code}::${sector}`;
                    const r = byKey.get(key);
                    if (!r) {
                      return (
                        <td key={key} className="px-0.5 py-0.5 w-9">
                          <div className="h-9 w-full rounded border border-dashed border-border-default" />
                        </td>
                      );
                    }
                    const isActive = active === key;
                    return (
                      <td key={key} className="px-0.5 py-0.5 relative w-9">
                        <button
                          type="button"
                          onClick={() => setActive(isActive ? null : key)}
                          title={`${fullName(p.code)} · ${sector}: ${LEVEL_LABEL[r.level]}`}
                          aria-label={`${fullName(p.code)} ${sector} ${LEVEL_LABEL[r.level]}`}
                          className={`h-9 w-full rounded flex items-center justify-center transition-[outline] outline-none ${
                            isActive ? "ring-2 ring-text-1 ring-offset-1 ring-offset-surface-1" : "hover:ring-1 hover:ring-text-1/40"
                          }`}
                          style={{ background: RISK_COLOUR[r.level] }}
                        >
                          <span className={`text-[10px] leading-none ${LEVEL_TEXT_ON_CELL[r.level]}`} data-numeric>
                            {TREND_GLYPH[r.trend]}
                          </span>
                        </button>
                        {isActive && (
                          <CellDetail r={r} provinceName={fullName(p.code)} sector={sector} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-text-muted">
          {(["low", "med", "high", "critical"] as RiskLevel[]).map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-white/10" style={{ background: RISK_COLOUR[lvl] }} />
              {LEVEL_LABEL[lvl]}
            </span>
          ))}
          <span className="text-text-disabled">▲▼▬ = trend · click a cell for detail</span>
        </div>
      </div>

      {/* ── Mobile: ranked hotspot list ──────────────────────────────────── */}
      <div className="sm:hidden">
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-semibold mb-2">
          National hotspots
        </div>
        {hotspots.length === 0 ? (
          <div className="text-xs text-text-muted border border-dashed border-border-default rounded-lg px-3 py-6 text-center">
            No sector is at HIGH or CRITICAL right now — nationally routine.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hotspots.map((r) => (
              <li
                key={`${r.province_code}::${r.sector}`}
                className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                  style={{ background: RISK_COLOUR[r.level] }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wide w-14 shrink-0" style={{ color: RISK_COLOUR[r.level] }}>
                  {LEVEL_LABEL[r.level]}
                </span>
                <span className="text-sm text-text-1 truncate flex-1">
                  {fullName(r.province_code)} <span className="text-text-muted">· {r.sector}</span>
                </span>
                <span className="text-text-2 text-sm shrink-0" data-numeric>
                  {TREND_GLYPH[r.trend]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Drill-down popover for a single cell — answers "why is this province at this level?".
function CellDetail({
  r,
  provinceName,
  sector,
}: {
  r: SectorRisk;
  provinceName: string;
  sector: Sector;
}) {
  return (
    <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 w-52 rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-3)] p-3 text-left">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ background: RISK_COLOUR[r.level] }} />
        <span className="text-xs font-semibold text-text-1">{LEVEL_LABEL[r.level]}</span>
        <span className="ml-auto text-[10px] text-text-muted" data-numeric>
          {TREND_GLYPH[r.trend]} trend
        </span>
      </div>
      <div className="text-[11px] text-text-1 font-medium">{provinceName}</div>
      <div className="text-[11px] text-text-muted mb-2">{sector}</div>
      <dl className="text-[10px] text-text-muted space-y-0.5">
        <div className="flex justify-between gap-2">
          <dt>Score</dt>
          <dd className="text-text-2" data-numeric>
            {r.score.toFixed(2)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Source</dt>
          <dd className="text-text-2 truncate max-w-[7rem]" title={r.data_source}>
            {r.data_source ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Provenance</dt>
          <dd className={r.provenance === "LIVE" ? "text-accent" : "text-text-2"}>{r.provenance}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>As of</dt>
          <dd className="text-text-2" data-numeric>
            {r.as_of.slice(0, 10)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
