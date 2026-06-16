/**
 * WEF Strategic Intelligence insights. Seeded from WEF's OPENLY published,
 * citable outputs (Global Risks Report, public Forum Stories) and linked back to
 * their real public pages. Badged DEMO — honest: we do not have a WEF API or an
 * embedding licence, and we never lift login-gated/paywalled content. A later
 * official WEF API swaps these for LIVE rows without a render change.
 *
 * `summary` is a PARAPHRASE, not WEF body text (copyright). `sector` ties a tile
 * to a NEWCIS sector for the node drill panel; omit it for national-level tiles.
 */
import type { Provenance, Sector } from "./types";
import { readJson } from "./data";

export interface WefInsight {
  id: string;
  title: string;
  summary: string;
  url: string;
  sector?: Sector;
  source: string;
  published: string;
  provenance: Provenance;
}

export const getWefInsights = () =>
  readJson<WefInsight[]>("wef_insights.json", []);
