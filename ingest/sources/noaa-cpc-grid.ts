/**
 * Shared parser for NOAA CPC fixed-width YEAR × month index tables.
 *
 * Several CPC ENSO products publish in the identical layout: a YEAR JAN FEB ...
 * DEC grid where each cell is a monthly value and unobserved future months are
 * filled with the sentinel -999.9. The Southern Oscillation Index and the
 * 850 mb West-Pacific trade-wind index both use this format, so one tolerant
 * parser serves both (and any future CPC monthly index we add).
 *
 *   https://www.cpc.ncep.noaa.gov/data/indices/soi
 *   https://www.cpc.ncep.noaa.gov/data/indices/wpac850
 *
 * Layout:
 *   <optional header / title lines>
 *   YEAR   JAN   FEB ...   DEC
 *   2025   0.2   0.5 ...  -0.0
 *   2026   1.1   1.4   1.2  -0.6  -0.9-999.9-999.9 ... -999.9
 *
 * Note the cells can run together with no space before a negative sentinel
 * (e.g. "-0.9-999.9"), so we tokenise on a signed-float regex, not whitespace.
 */

const MISSING = -999.9;

export interface MonthlyGridPoint {
  /** YYYY-MM-15 ISO date of the latest valid month. */
  observed_at: string;
  /** Latest valid monthly value. */
  value: number;
  /** Prior valid month value, for trend (null if only one month exists). */
  previous: number | null;
  /** Year of the latest valid month. */
  year: number;
  /** 1-based month of the latest valid value. */
  month: number;
}

/** A value is "valid" if it is finite and not the -999.9 fill sentinel. */
function isValid(v: number): boolean {
  return Number.isFinite(v) && Math.abs(v - MISSING) > 0.001;
}

/**
 * Parse a CPC monthly grid into a flat, date-ordered series of valid readings.
 * Header lines (anything whose first token is not a 4-digit year) are skipped.
 * Cells are extracted with a signed-decimal regex so run-together negatives
 * (".. -0.9-999.9") split correctly.
 */
export function parseMonthlyGrid(text: string): { year: number; month: number; value: number }[] {
  const out: { year: number; month: number; value: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Tokenise every signed decimal on the line.
    const nums = line.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) continue;
    const year = Number(nums[0]);
    // A data row starts with a 4-digit year; header rows ("YEAR JAN ...") have
    // no leading number and are dropped by the regex producing a non-year token.
    if (!Number.isInteger(year) || year < 1900 || year > 2100) continue;
    // Remaining tokens are the (up to 12) monthly cells.
    const cells = nums.slice(1).map(Number);
    for (let i = 0; i < cells.length && i < 12; i++) {
      if (isValid(cells[i])) out.push({ year, month: i + 1, value: cells[i] });
    }
  }
  return out;
}

/**
 * Fetch a CPC monthly-grid endpoint and return the latest valid reading plus the
 * prior month (for trend). Throws if the endpoint is unreachable or yields no
 * valid rows — callers wrap this in the orchestrator's run() so a failure
 * degrades to last-good rather than crashing the cycle.
 */
export async function fetchMonthlyGrid(url: string, label: string): Promise<MonthlyGridPoint> {
  const res = await fetch(url, {
    headers: { "user-agent": "newcis-ingest/0.1" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const text = await res.text();
  const series = parseMonthlyGrid(text);
  if (series.length === 0) throw new Error(`${label}: no valid rows parsed`);
  const latest = series[series.length - 1];
  const previous = series.length >= 2 ? series[series.length - 2].value : null;
  return {
    observed_at: new Date(Date.UTC(latest.year, latest.month - 1, 15)).toISOString().slice(0, 10),
    value: latest.value,
    previous,
    year: latest.year,
    month: latest.month,
  };
}

/** flat/up/down trend with a dead-band so noise doesn't flip the arrow. */
export function gridTrend(value: number, previous: number | null, deadband: number): "up" | "down" | "flat" {
  if (previous === null) return "flat";
  const delta = value - previous;
  return Math.abs(delta) < deadband ? "flat" : delta > 0 ? "up" : "down";
}
