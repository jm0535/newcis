"use client";

// 12-month trend line for one indicator, written for a dual audience. The chart
// title is the human-readable label (not the raw metric key); a one-line plain
// explanation says what the signal is and which direction is dangerous; the
// GREEN/AMBER/RED/BLACK threshold bands are drawn AND labelled so the audience
// sees exactly when we cross into a higher alert. Sparse series (1–2 readings,
// common early in the PoC) get a clear "single reading" treatment instead of an
// empty-looking line.
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoricalReading, Indicator, RiskThreshold } from "@/lib/types";
import { classifyIndicator } from "@/lib/risk-engine";
import { ALERT_COLOUR, ALERT_LABEL, INDICATOR_META } from "@/lib/ui";
import { StatusPill } from "./ui";

const ALERT_STATUS = { GREEN: "green", AMBER: "amber", RED: "red", BLACK: "black" } as const;

// Use the live token so colours stay legible in both dark and light themes.
const TOKEN = {
  grid: "var(--border-subtle)",
  axis: "var(--text-muted)",
  surface: "var(--surface-1)",
  border: "var(--border-default)",
  text: "var(--text-1)",
  line: "var(--accent)",
};

export function TrendChart({
  indicator,
  history,
  threshold,
  height = 170,
}: {
  indicator: Indicator;
  history: HistoricalReading[];
  threshold: RiskThreshold | undefined;
  height?: number;
}) {
  const meta = INDICATOR_META[indicator.key];
  const level = classifyIndicator(indicator.value, threshold);

  const series = history
    .filter((h) => h.key === indicator.key)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .map((h) => ({ date: h.observed_at.slice(0, 10), value: h.value }));

  // Threshold reference lines, each LABELLED so the dashed line reads as "RED here".
  // Every chart shows all three escalation lines (AMBER, RED, BLACK) so a viewer
  // sees the full ladder. Symmetric metrics (ENSO temperature anomalies) also
  // mirror the lines below zero; one-sided metrics (counts, percentiles) do not.
  const refs: { y: number; c: string; label: string }[] = (() => {
    if (!threshold) return [];
    if (threshold.inverted) {
      return [
        { y: threshold.green_max, c: ALERT_COLOUR.AMBER, label: "AMBER" },
        { y: threshold.amber_max, c: ALERT_COLOUR.RED, label: "RED" },
        { y: threshold.red_max, c: ALERT_COLOUR.BLACK, label: "BLACK" },
      ];
    }
    const positive = [
      { y: threshold.green_max, c: ALERT_COLOUR.AMBER, label: "AMBER" },
      { y: threshold.amber_max, c: ALERT_COLOUR.RED, label: "RED" },
      { y: threshold.red_max, c: ALERT_COLOUR.BLACK, label: "BLACK" },
    ];
    // Default to symmetric for non-inverted metrics unless explicitly one-sided.
    if (threshold.symmetric === false) return positive;
    return [
      ...positive,
      { y: -threshold.green_max, c: ALERT_COLOUR.AMBER, label: "AMBER" },
      { y: -threshold.amber_max, c: ALERT_COLOUR.RED, label: "RED" },
      { y: -threshold.red_max, c: ALERT_COLOUR.BLACK, label: "BLACK" },
    ];
  })();

  // CRITICAL FIX: Recharts auto-fits the Y-axis to the DATA only. When the live
  // readings sit far below the thresholds (e.g. ONI ~0.4 vs a 1.5 BLACK line),
  // the RED/BLACK reference lines fall OUTSIDE the visible axis and silently
  // vanish — the user sees a chart "missing its threshold lines". So we widen the
  // domain to span BOTH the data and every reference line, then pad ~8% so the
  // top/bottom lines and their labels aren't clipped at the frame edge.
  const yDomain: [number, number] = (() => {
    const ys = [...series.map((s) => s.value), ...refs.map((r) => r.y)];
    if (ys.length === 0) return [0, 1];
    let min = Math.min(...ys);
    const max = Math.max(...ys);
    // Anchor the baseline at 0 for explicitly one-sided metrics (e.g. SEISMIC
    // counts) that can never go negative, so the axis reads from a true zero.
    if (threshold?.symmetric === false && min > 0) min = 0;
    if (min === max) {
      // Degenerate (single flat value) — open a small window around it.
      const pad = Math.abs(max) * 0.1 || 1;
      return [min - pad, max + pad];
    }
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  })();

  return (
    <div className="flex flex-col gap-2">
      {/* Header: friendly label + current alert pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-1 leading-snug">{indicator.label}</div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted mt-0.5">
            {indicator.key} · {indicator.unit}
          </div>
        </div>
        {threshold && (
          <StatusPill status={ALERT_STATUS[level]} size="sm">
            {ALERT_LABEL[level]}
          </StatusPill>
        )}
      </div>

      {/* Plain-language meaning + which direction is dangerous */}
      {meta && (
        <p className="text-xs text-text-2 leading-relaxed">
          {meta.plain} <span className="text-text-muted">{meta.dangerLabel}</span>
        </p>
      )}

      {series.length === 0 ? (
        <div
          className="text-xs text-text-muted border border-dashed border-border-default rounded flex items-center justify-center text-center px-3"
          style={{ height }}
        >
          No trend yet — history accumulates one point per ingest cycle.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={series} margin={{ top: 8, right: 44, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TOKEN.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: TOKEN.axis, fontSize: 10 }}
                minTickGap={24}
              />
              <YAxis
                domain={yDomain}
                allowDataOverflow
                tick={{ fill: TOKEN.axis, fontSize: 10 }}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: TOKEN.surface,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: TOKEN.text,
                }}
                labelStyle={{ color: TOKEN.axis }}
              />
              {refs.map((r, i) => (
                <ReferenceLine
                  key={i}
                  y={r.y}
                  stroke={r.c}
                  strokeDasharray="4 2"
                  strokeOpacity={0.75}
                  label={{
                    value: r.label,
                    position: "right",
                    fill: r.c,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="value"
                stroke={TOKEN.line}
                strokeWidth={2}
                dot={{ r: series.length <= 2 ? 4 : 2, fill: TOKEN.line }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {series.length <= 2 && (
            <p className="text-[10px] text-text-muted -mt-1">
              Only {series.length} reading{series.length === 1 ? "" : "s"} so far — the line fills
              in as ingest runs each cycle.
            </p>
          )}
        </>
      )}
    </div>
  );
}
