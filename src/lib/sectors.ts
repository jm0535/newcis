// Sector metadata — lead agency + which indicators drive each panel.
// Lead-agency labels mirror the NEWCIS concept document; in production these
// become role-based dashboards owned by each agency.
import type { Sector } from "./types";

export interface SectorMeta {
  sector: Sector;
  lead_agency: string;
  drivers: string[]; // indicator keys, matches risk-engine SECTOR_DRIVERS
  description: string;
}

export const SECTOR_META: SectorMeta[] = [
  {
    sector: "Food Security",
    lead_agency: "Department of Agriculture & Livestock (DAL)",
    drivers: ["RAINFALL_ANOM", "NDVI", "SOIL_MOISTURE"],
    description:
      "Drought stress → highland staple crop loss (sweet potato, taro). NDVI lags rainfall by 4–8 weeks; an early canary.",
  },
  {
    sector: "Water Security",
    lead_agency: "Water PNG · Climate Change & Development Authority",
    drivers: ["RAINFALL_ANOM", "SOIL_MOISTURE"],
    description:
      "Rural water systems are rain-fed. Sustained deficits force trucking, school closures, and hygiene-driven disease spikes.",
  },
  {
    sector: "Public Health",
    lead_agency: "National Department of Health (NDoH)",
    drivers: ["TEMP_ANOM", "RAINFALL_ANOM"],
    description:
      "Heat + drought drive cholera, dengue, and malnutrition admissions. Combined with food stress, the trigger for cluster activation.",
  },
  {
    sector: "Economic Stability",
    lead_agency: "Department of Treasury",
    drivers: ["ONI"],
    description:
      "ENSO-linked commodity shocks (LNG, coffee, cocoa) and disaster-recovery spending strain the fiscal position.",
  },
  {
    sector: "Infrastructure",
    lead_agency: "Department of Works & Highways",
    drivers: ["RAINFALL_ANOM"],
    description:
      "La Niña phase floods Highlands Highway sections; El Niño shrinks river transport on the Fly/Sepik. Asymmetric but both disrupt.",
  },
  {
    sector: "Energy Security",
    lead_agency: "PNG Power · Department of Petroleum & Energy",
    drivers: ["RAINFALL_ANOM"],
    description:
      "Hydropower (Rouna, Yonki) capacity tracks reservoir inflow. ENSO-driven rainfall deficit forces diesel generation and load shedding.",
  },
  {
    sector: "Social Stability",
    lead_agency: "Department of Provincial & Local Government Affairs",
    drivers: ["ONI"],
    description:
      "Resource scarcity historically correlates with tribal conflict in Highlands provinces. Province cells fed LIVE from ACLED conflict-events (90-day window via HDX HAPI).",
  },
];
