// One sector panel for Page 3. At the full 22-province set a 22-cell pill grid
// per panel is noise, not signal — an executive scanning eight sectors needs to
// know two things per sector at a glance: (1) the national shape — how many
// provinces sit at each risk level — and (2) where the trouble is — the worst-
// affected provinces, named. So this panel shows:
//   - a worst-level badge + dominant provenance in the header,
//   - a proportional SEVERITY BAR (low/med/high/critical across all provinces),
//   - a ranked HOTSPOT list (HIGH/CRITICAL provinces only, capped) — or a calm
//     "all provinces routine" line when nothing is stressed,
//   - the driving indicators (so "why high?" is one glance).
// Province-count-agnostic: it summarises whatever provinces appear in the data,
// so it reads the same at 4, 10, or 22 provinces.
import type { Indicator, Provenance, RiskLevel, SectorRisk, Trend } from "@/lib/types";
import type { SectorMeta } from "@/lib/sectors";
import { ProvenanceBadge } from "./Provenance";
import { Card, StatusPill } from "./ui";
import { RISK_COLOUR, TREND_GLYPH } from "@/lib/ui";
import { ALL_NAMES } from "@/lib/focus-provinces";

const RISK_STATUS = {
  low: "green",
  med: "amber",
  high: "red",
  critical: "black",
} as const;

const LEVEL_WEIGHT: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };
const LEVELS: RiskLevel[] = ["low", "med", "high", "critical"];
const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  med: "MED",
  high: "HIGH",
  critical: "CRITICAL",
};

// How many hotspot rows to show before collapsing to a "+N more" line.
const HOTSPOT_LIMIT = 5;

const fullName = (code: string) => ALL_NAMES[code] ?? code;

function dominantProvenance(rows: SectorRisk[]): Provenance {
  return rows.some((r) => r.provenance === "LIVE") ? "LIVE" : "DEMO";
}

function dominantTrend(rows: SectorRisk[]): Trend {
  const score = { up: 0, down: 0, flat: 0 };
  for (const r of rows) score[r.trend]++;
  return (Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] as Trend) ?? "flat";
}

function worstLevel(rows: SectorRisk[]): RiskLevel {
  return rows.reduce<RiskLevel>(
    (m, r) => (LEVEL_WEIGHT[r.level] > LEVEL_WEIGHT[m] ? r.level : m),
    "low",
  );
}

export function SectorPanel({
  meta,
  sectorRisk,
  indicators,
}: {
  meta: SectorMeta;
  sectorRisk: SectorRisk[];
  indicators: Indicator[];
}) {
  const rows = sectorRisk.filter((r) => r.sector === meta.sector);
  const provenance = rows.length ? dominantProvenance(rows) : "DEMO";
  const trend = rows.length ? dominantTrend(rows) : "flat";
  const worst = rows.length ? worstLevel(rows) : "low";

  // Distribution across all provinces in the data — drives the severity bar.
  const counts: Record<RiskLevel, number> = { low: 0, med: 0, high: 0, critical: 0 };
  for (const r of rows) counts[r.level]++;
  const total = rows.length;

  // Hotspots: provinces at HIGH or CRITICAL, ranked worst-first.
  const hotspots = rows
    .filter((r) => r.level === "high" || r.level === "critical")
    .sort(
      (a, b) =>
        LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] ||
        fullName(a.province_code).localeCompare(fullName(b.province_code)),
    );
  const shownHotspots = hotspots.slice(0, HOTSPOT_LIMIT);
  const extraHotspots = hotspots.length - shownHotspots.length;

  const driverInds = meta.drivers
    .map((k) => indicators.find((i) => i.key === k))
    .filter((x): x is Indicator => Boolean(x));

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-1">{meta.sector}</div>
          <div className="text-[11px] text-text-muted truncate">{meta.lead_agency}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ProvenanceBadge value={provenance} />
          <div className="flex items-center gap-1.5">
            <StatusPill status={RISK_STATUS[worst]} size="sm">
              {LEVEL_LABEL[worst]}
            </StatusPill>
            <span className="text-base text-text-2" data-numeric>
              {TREND_GLYPH[trend]}
            </span>
          </div>
        </div>
      </header>

      <p className="text-[11px] leading-snug text-text-2">{meta.description}</p>

      {/* Severity distribution across all provinces — the national shape. */}
      {total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.06em] text-text-disabled font-medium">
            <span>
              Across{" "}
              <span className="text-text-muted" data-numeric>
                {total}
              </span>{" "}
              provinces
            </span>
            <span className="normal-case tracking-normal text-text-muted">
              {counts.high + counts.critical > 0 ? (
                <span data-numeric>
                  {counts.high + counts.critical} at risk
                </span>
              ) : (
                "all routine"
              )}
            </span>
          </div>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full border border-border-subtle"
            role="img"
            aria-label={LEVELS.map((l) => `${counts[l]} ${LEVEL_LABEL[l]}`).join(", ")}
          >
            {LEVELS.map((lvl) =>
              counts[lvl] > 0 ? (
                <div
                  key={lvl}
                  className="h-full"
                  style={{
                    width: `${(counts[lvl] / total) * 100}%`,
                    background: RISK_COLOUR[lvl],
                  }}
                  title={`${counts[lvl]} province${counts[lvl] === 1 ? "" : "s"} ${LEVEL_LABEL[lvl]}`}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted">
            {LEVELS.map((lvl) =>
              counts[lvl] > 0 ? (
                <span key={lvl} className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-sm border border-white/10"
                    style={{ background: RISK_COLOUR[lvl] }}
                  />
                  <span data-numeric>{counts[lvl]}</span> {LEVEL_LABEL[lvl]}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Hotspots: where this sector is actually under stress. */}
      <div className="pt-2 border-t border-border-subtle">
        <div className="text-[10px] uppercase tracking-[0.06em] text-text-disabled mb-1.5 font-medium">
          Worst-affected provinces
        </div>
        {hotspots.length === 0 ? (
          <div className="text-[11px] text-text-muted flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full border border-white/10"
              style={{ background: RISK_COLOUR.low }}
            />
            No province above MED — sector routine nationally.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {shownHotspots.map((r) => (
              <li
                key={r.province_code}
                className="flex items-center gap-2 text-[11px]"
                title={`${r.provenance} · ${r.data_source ?? "engine"}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 border border-white/20"
                  style={{ background: RISK_COLOUR[r.level] }}
                />
                <span
                  className="font-bold uppercase tracking-wide w-12 shrink-0"
                  style={{ color: RISK_COLOUR[r.level] }}
                >
                  {LEVEL_LABEL[r.level]}
                </span>
                <span className="text-text-1 truncate flex-1">{fullName(r.province_code)}</span>
                <span className="text-text-muted shrink-0" data-numeric>
                  {TREND_GLYPH[r.trend]}
                </span>
              </li>
            ))}
            {extraHotspots > 0 && (
              <li className="text-[10px] text-text-muted pl-4" data-numeric>
                +{extraHotspots} more
              </li>
            )}
          </ul>
        )}
      </div>

      {driverInds.length > 0 && (
        <div className="text-[11px] text-text-muted pt-2 border-t border-border-subtle">
          <div className="uppercase tracking-[0.06em] text-text-disabled mb-1 font-medium">
            What drives this rating
          </div>
          <div className="flex flex-col gap-0.5">
            {driverInds.map((d) => (
              <div key={d.key} className="flex items-baseline justify-between gap-2" title={d.key}>
                <span className="text-text-2 truncate">{d.label}</span>
                <span className="text-text-muted shrink-0" data-numeric>
                  {d.value === null ? "—" : `${d.value} ${d.unit}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
