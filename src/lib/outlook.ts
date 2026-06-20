/**
 * ENSO outlook — pure, deterministic precursor-alignment logic.
 *
 * This is the analytical glue of the /forecast page. It does NOT forecast (that
 * is production Phase 3 and is walled off in CLAUDE.md §0). It does two honest,
 * explainable things with data NEWCIS already holds:
 *
 *   1. Relays the NMME dynamical forecast (PROJECTED_ONI) — the genuine model
 *      output the operational centres run — as a projected ENSO phase.
 *   2. Diagnoses precursor ALIGNMENT: do the three independent present-state ENSO
 *      signals (observed ONI, SOI, west-Pacific trade-wind anomaly) point the
 *      same way the model does? Agreement raises confidence; disagreement lowers
 *      it. This is the standard "are the precursors consistent with the forecast"
 *      sanity check a duty forecaster makes — a reading, not a model.
 *
 * Every output traces to one of those inputs. No opaque weighting, no invented
 * numbers. Missing inputs degrade to "unknown"/neutral, never throw.
 */
import type { Indicator, RiskThreshold } from "./types";

export type EnsoLean = "el_nino" | "la_nina" | "neutral";
export type OutlookConfidence = "low" | "moderate" | "high";

/** One precursor's contribution to the outlook — shown as a signed row in the UI. */
export interface PrecursorSignal {
  key: string;
  label: string;
  /** Which way this signal currently leans, on the ENSO axis. */
  lean: EnsoLean;
  /** The raw value behind the lean (for display), null if the indicator is absent. */
  value: number | null;
  unit: string;
  /** One-line plain-English reason ("weakened trades push warm water east"). */
  note: string;
}

export interface Outlook {
  /** The NMME model's projected phase for the forward window. */
  projectedLean: EnsoLean;
  /** Projected ONI value (°C) the lean is derived from, null if forecast absent. */
  projectedOni: number | null;
  /** Human label of the forecast target window, e.g. "MJJ 2026". */
  targetWindow: string | null;
  /** The three present-state precursor signals, each signed. */
  precursors: PrecursorSignal[];
  /** How many precursors agree with the model's projected lean. */
  agreement: number;
  /** Total precursors that had data this cycle (agreement is out of this). */
  precursorsWithData: number;
  /**
   * Confidence in the outlook: high when the model and most precursors agree,
   * low when they conflict or data is sparse. NOT a probability — a qualitative
   * consistency read, badged as such in the UI.
   */
  confidence: OutlookConfidence;
  /** One-sentence narrative summarising model + precursor alignment. */
  summary: string;
}

const PHASE_LABEL: Record<EnsoLean, string> = {
  el_nino: "El Niño",
  la_nina: "La Niña",
  neutral: "neutral",
};

/**
 * Lean of a symmetric ENSO value (ONI-like): positive past the watch edge → El
 * Niño, negative past it → La Niña, else neutral. `watchEdge` defaults to 0.5.
 */
function symmetricLean(value: number | null, watchEdge: number): EnsoLean {
  if (value === null) return "neutral";
  if (value >= watchEdge) return "el_nino";
  if (value <= -watchEdge) return "la_nina";
  return "neutral";
}

/**
 * Lean of an inverted ENSO signal (SOI, trade-wind anomaly): a sustained NEGATIVE
 * value is the El Niño sign (weakened/westerly trades, negative SOI). `edge` is
 * the magnitude past which the signal is meaningful (defaults to the metric's
 * green_max magnitude when a threshold is supplied).
 */
function invertedLean(value: number | null, edge: number): EnsoLean {
  if (value === null) return "neutral";
  if (value <= -Math.abs(edge)) return "el_nino";
  if (value >= Math.abs(edge)) return "la_nina";
  return "neutral";
}

function find(indicators: Indicator[], key: string): Indicator | undefined {
  return indicators.find((i) => i.key === key);
}

/**
 * Derive the ENSO outlook from the current indicator set.
 *
 * @param indicators  Latest indicator readings (must include PROJECTED_ONI for a
 *                    model lean; ONI/SOI/TRADE_WIND_ANOM feed the precursor rows).
 * @param thresholds  Threshold rows — used only to read each signal's watch edge,
 *                    so the outlook escalation lines up with the gauge bands.
 * @param targetWindow  Human label of the forecast window (from the NMME source).
 */
export function deriveOutlook(
  indicators: Indicator[],
  thresholds: RiskThreshold[],
  targetWindow: string | null = null,
): Outlook {
  const thByKey = new Map(thresholds.map((t) => [t.metric, t]));
  const oniEdge = thByKey.get("ONI")?.green_max ?? 0.5;

  // 1. Model lean (relayed NMME forecast).
  const projected = find(indicators, "PROJECTED_ONI");
  const projectedOni = projected?.value ?? null;
  const projectedLean = symmetricLean(projectedOni, oniEdge);

  // 2. Precursor signals — three independent present-state ENSO diagnostics.
  const precursors: PrecursorSignal[] = [];

  const oni = find(indicators, "ONI");
  if (oni) {
    const lean = symmetricLean(oni.value, oniEdge);
    precursors.push({
      key: "ONI",
      label: "Observed ONI",
      lean,
      value: oni.value,
      unit: oni.unit,
      note:
        lean === "el_nino"
          ? "Niño-3.4 SST already above the El Niño watch edge"
          : lean === "la_nina"
            ? "Niño-3.4 SST already below the La Niña watch edge"
            : "Niño-3.4 SST in the neutral band",
    });
  }

  const soi = find(indicators, "SOI");
  if (soi) {
    const edge = Math.abs(thByKey.get("SOI")?.green_max ?? 0.7);
    const lean = invertedLean(soi.value, edge);
    precursors.push({
      key: "SOI",
      label: "Southern Oscillation Index",
      lean,
      value: soi.value,
      unit: soi.unit,
      note:
        lean === "el_nino"
          ? "Sustained negative SOI: atmosphere coupled toward El Niño"
          : lean === "la_nina"
            ? "Sustained positive SOI: atmosphere coupled toward La Niña"
            : "SOI near neutral: no clear atmospheric coupling",
    });
  }

  const wind = find(indicators, "TRADE_WIND_ANOM");
  if (wind) {
    const edge = Math.abs(thByKey.get("TRADE_WIND_ANOM")?.green_max ?? 0.5);
    const lean = invertedLean(wind.value, edge);
    precursors.push({
      key: "TRADE_WIND_ANOM",
      label: "West-Pacific trade winds",
      lean,
      value: wind.value,
      unit: wind.unit,
      note:
        lean === "el_nino"
          ? "Weakened/westerly trades push warm water east: leading El Niño trigger"
          : lean === "la_nina"
            ? "Strengthened easterly trades pile warm water west: leading La Niña sign"
            : "Trade-wind anomaly near neutral",
    });
  }

  // 3. Alignment: how many precursors agree with the model's projected lean.
  const withData = precursors.filter((p) => p.lean !== "neutral");
  const agreement =
    projectedLean === "neutral"
      ? withData.filter((p) => p.lean === "neutral").length
      : withData.filter((p) => p.lean === projectedLean).length;
  const precursorsWithData = withData.length;

  // 4. Confidence — a qualitative consistency read, not a probability.
  //    high  = model leans + ≥2 precursors agree
  //    moderate = model leans + exactly 1 agrees, OR neutral-everything
  //    low  = conflict (a precursor opposes the model) or no usable data
  const opposing =
    projectedLean === "neutral"
      ? 0
      : withData.filter((p) => p.lean !== "neutral" && p.lean !== projectedLean).length;
  let confidence: OutlookConfidence;
  if (projectedLean === "neutral") {
    confidence = precursorsWithData === 0 ? "moderate" : opposingNeutralMix(withData);
  } else if (agreement >= 2 && opposing === 0) {
    confidence = "high";
  } else if (agreement >= 1 && opposing === 0) {
    confidence = "moderate";
  } else {
    confidence = "low";
  }

  // 5. Narrative.
  const summary = buildSummary(
    projectedLean,
    projectedOni,
    targetWindow,
    agreement,
    precursorsWithData,
    confidence,
  );

  return {
    projectedLean,
    projectedOni,
    targetWindow,
    precursors,
    agreement,
    precursorsWithData,
    confidence,
    summary,
  };
}

/**
 * When the model is neutral, confidence keys off whether the precursors are also
 * quiet (moderate — a coherent neutral) or pulling in conflicting directions
 * (low — an unsettled, hard-to-call state).
 */
function opposingNeutralMix(withData: PrecursorSignal[]): OutlookConfidence {
  const elNino = withData.filter((p) => p.lean === "el_nino").length;
  const laNina = withData.filter((p) => p.lean === "la_nina").length;
  // Both phases represented among precursors while the model says neutral → mixed.
  return elNino > 0 && laNina > 0 ? "low" : "moderate";
}

function buildSummary(
  lean: EnsoLean,
  projectedOni: number | null,
  targetWindow: string | null,
  agreement: number,
  withData: number,
  confidence: OutlookConfidence,
): string {
  const win = targetWindow ? ` for ${targetWindow}` : "";
  if (lean === "neutral") {
    return projectedOni === null
      ? "No dynamical forecast available this cycle; outlook is indeterminate."
      : `The NMME dynamical forecast projects a neutral ENSO state${win} (projected ONI ${fmt(projectedOni)} °C). Present-state precursors are ${confidence === "low" ? "mixed" : "broadly consistent"}.`;
  }
  const phase = PHASE_LABEL[lean];
  const align =
    withData === 0
      ? "no present-state precursors carried a clear signal this cycle"
      : `${agreement} of ${withData} present-state precursors agree`;
  return `The NMME dynamical forecast leans ${phase}${win} (projected ONI ${fmt(projectedOni)} °C); ${align}, giving ${confidence} confidence in the outlook.`;
}

function fmt(v: number | null): string {
  return v === null ? "—" : (Math.round(v * 100) / 100).toFixed(2);
}
