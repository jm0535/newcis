"use client";

// NMME ensemble plume for the projected ONI. Each dynamical-model member is a
// dot at its projected Niño-3.4 anomaly; the ensemble mean is the bold marker and
// the min/max span the spread. The same GREEN/AMBER/RED/BLACK threshold ladder
// the observed-ONI gauge uses is drawn here, so a viewer reads "where is next
// season heading, and into which alert band" at a glance. This is a RELAYED model
// forecast (NMME / NOAA-GFDL SPEAR) — display, not a NEWCIS forecast.
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ForecastModel, RiskThreshold } from "@/lib/types";
import { ALERT_COLOUR } from "@/lib/ui";

const TOKEN = {
  grid: "var(--border-subtle)",
  axis: "var(--text-muted)",
  surface: "var(--surface-1)",
  border: "var(--border-default)",
  text: "var(--text-1)",
  accent: "var(--accent)",
  dotStroke: "var(--surface-1)", // ring around dots so they read on shaded bands
  mean: "var(--text-1)", // high-contrast mean line, distinct from accent dots
};

// Whole-number °C ticks spanning the domain, so the axis reads "-1, 0, 1" not
// recharts' auto-generated mangled fractions. Always includes 0 as the ENSO
// neutral baseline.
function makeTicks(min: number, max: number): number[] {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 1) ticks.push(t);
  if (!ticks.includes(0) && min <= 0 && max >= 0) ticks.push(0);
  return ticks.sort((a, b) => a - b);
}

export function EnsemblePlume({
  model,
  threshold,
  height = 240,
}: {
  model: ForecastModel;
  threshold: RiskThreshold | undefined;
  height?: number;
}) {
  // Spread members horizontally with a little deterministic jitter so overlapping
  // values are distinguishable, all at y = their projected ONI. (Jitter is index-
  // based, not random, so the chart is stable across renders.)
  const n = model.members.length;
  const points = model.members.map((v, i) => ({
    x: ((i + 0.5) / n) * 100, // even spread 0..100
    y: v,
    member: i + 1,
  }));

  // Y domain spans members AND every threshold line so no band edge is clipped.
  const refYs: number[] = threshold
    ? [
        threshold.green_max,
        threshold.amber_max,
        threshold.red_max,
        -threshold.green_max,
        -threshold.amber_max,
        -threshold.red_max,
      ]
    : [];
  const allY = [model.ensemble_min, model.ensemble_max, ...refYs];
  let yMin = Math.min(...allY);
  let yMax = Math.max(...allY);
  const pad = (yMax - yMin) * 0.12 || 0.3;
  yMin -= pad;
  yMax += pad;

  // Symmetric ENSO bands as faint shaded zones (positive El Niño side).
  const bands = threshold
    ? [
        { y1: threshold.green_max, y2: threshold.amber_max, c: ALERT_COLOUR.AMBER },
        { y1: threshold.amber_max, y2: threshold.red_max, c: ALERT_COLOUR.RED },
        { y1: threshold.red_max, y2: yMax, c: ALERT_COLOUR.BLACK },
        { y1: -threshold.amber_max, y2: -threshold.green_max, c: ALERT_COLOUR.AMBER },
        { y1: -threshold.red_max, y2: -threshold.amber_max, c: ALERT_COLOUR.RED },
        { y1: yMin, y2: -threshold.red_max, c: ALERT_COLOUR.BLACK },
      ]
    : [];

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={TOKEN.grid} strokeDasharray="3 3" />
          {bands.map((b, i) => (
            <ReferenceArea
              key={`band-${i}`}
              y1={b.y1}
              y2={b.y2}
              fill={b.c}
              fillOpacity={0.14}
              stroke="none"
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            hide
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[yMin, yMax]}
            ticks={makeTicks(yMin, yMax)}
            tickFormatter={(v: number) => v.toFixed(1)}
            allowDataOverflow
            tick={{ fill: TOKEN.axis, fontSize: 10 }}
            width={40}
            label={{
              value: "°C",
              angle: -90,
              position: "insideLeft",
              fill: TOKEN.axis,
              fontSize: 10,
            }}
          />
          <ZAxis range={[80, 80]} />
          {/* Threshold ladder (positive El Niño side labelled). */}
          {threshold &&
            [
              { y: threshold.green_max, c: ALERT_COLOUR.AMBER, label: "AMBER" },
              { y: threshold.amber_max, c: ALERT_COLOUR.RED, label: "RED" },
              { y: threshold.red_max, c: ALERT_COLOUR.BLACK, label: "BLACK" },
            ].map((r, i) => (
              <ReferenceLine
                key={`ref-${i}`}
                y={r.y}
                stroke={r.c}
                strokeDasharray="4 2"
                strokeOpacity={0.8}
                label={{
                  value: r.label,
                  position: "right",
                  fill: r.c,
                  fontSize: 9,
                  fontWeight: 600,
                }}
              />
            ))}
          {/* ENSO-neutral baseline at 0 — the reference every anomaly is read against. */}
          <ReferenceLine y={0} stroke={TOKEN.axis} strokeWidth={1} strokeOpacity={0.5} />
          {/* Ensemble mean — the headline projection. Solid, high-contrast, on top. */}
          <ReferenceLine
            y={model.ensemble_mean}
            stroke={TOKEN.mean}
            strokeWidth={2.5}
            label={{
              value: `mean ${model.ensemble_mean.toFixed(2)}`,
              position: "insideTopLeft",
              fill: TOKEN.text,
              fontSize: 10,
              fontWeight: 700,
            }}
          />
          <Tooltip
            cursor={{ stroke: TOKEN.border }}
            // recharts emits one payload entry per axis dataKey (x AND y), so the
            // default tooltip would print the same member twice. Render our own
            // single-row content from the first entry's payload instead.
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as { member?: number; y?: number };
              return (
                <div
                  style={{
                    background: TOKEN.surface,
                    border: `1px solid ${TOKEN.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: TOKEN.text,
                    padding: "6px 10px",
                  }}
                >
                  <div style={{ color: TOKEN.axis, marginBottom: 2 }}>Projected ONI</div>
                  <div data-numeric>
                    Member {p.member} : {Number(p.y).toFixed(2)} °C
                  </div>
                </div>
              );
            }}
          />
          <Scatter
            data={points}
            fill={TOKEN.accent}
            fillOpacity={0.85}
            stroke={TOKEN.dotStroke}
            strokeWidth={1}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent ring-1 ring-surface-1" /> {n} ensemble
          members
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-[2.5px] border-text-1" /> ensemble mean
        </span>
        <span data-numeric>
          spread {model.ensemble_min.toFixed(2)} → {model.ensemble_max.toFixed(2)} °C
        </span>
      </div>
    </div>
  );
}
