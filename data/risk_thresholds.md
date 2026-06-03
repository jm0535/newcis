# Risk thresholds — rationale

These bands drive the traffic-light spine (GREEN → AMBER → RED → BLACK). Retunable by editing
`risk_thresholds.json` — no code change required.

## ONI (Oceanic Niño Index)
NOAA CPC operational definition: 3-month running mean of ERSSTv5 SST anomalies in the Niño 3.4
region. The El Niño / La Niña event threshold is ±0.5 °C for five overlapping seasons. The PoC
maps these into operational alert levels:

| Band  | ONI range  | Meaning                       |
|-------|------------|-------------------------------|
| GREEN | ≤ 0.5      | ENSO-neutral                  |
| AMBER | 0.5 – 1.0  | Weak El Niño / watch          |
| RED   | 1.0 – 1.5  | Moderate El Niño / alert      |
| BLACK | > 1.5      | Strong / very strong event    |

La Niña is symmetric on the negative side and is handled in the engine by taking the absolute
value before comparing.

## SOI (Southern Oscillation Index)
BoM definition (Tahiti − Darwin standardized pressure anomaly). Sustained **negative** SOI =
El Niño. Marked `inverted: true` so the engine knows lower = worse.

## SST anomaly (Niño 3.4)
Weekly NOAA OISST. ONI is a smoothed 3-month version of this — included separately so a sharp
weekly spike can light AMBER before the ONI catches up.

## Rainfall anomaly (% of normal)
PNG-specific severity thresholds derived from the 1997–98 and 2015–16 droughts, both of which
produced sustained rainfall deficits worse than −60% across the highlands. Inverted.

## Temperature anomaly
Reference period 1991–2020. Heat stress alone is not catastrophic in PNG but compounds the
rainfall signal — included so the engine can escalate combined hot-and-dry conditions.

## Soil moisture (SMAP percentile)
US Drought Monitor convention: <20th percentile = severe drought; <10th = exceptional drought.
Inverted.

## NDVI anomaly
MODIS-derived vegetation anomaly vs 5-year mean. Lags rainfall by 4–8 weeks; useful as the
last-clear-canary before food security deteriorates. Inverted.

---

These thresholds are **operational defaults**, not ground truth. Expect to retune after the
first real El Niño cycle the system observes — the file is the place to do it.
