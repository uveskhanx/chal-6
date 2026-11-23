import "server-only";
import { PollutantCode, AQICategory, PollutantDetail } from "./types";

interface Breakpoint {
  bLow: number;
  bHigh: number;
  iLow: number;
  iHigh: number;
  category: AQICategory;
}

// Statutory CPCB NAQI Breakpoint Table (CPCB, October 2014)
const CPCB_BREAKPOINTS: Record<PollutantCode, Breakpoint[]> = {
  "PM2.5": [
    { bLow: 0, bHigh: 30, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 31, bHigh: 60, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 61, bHigh: 90, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 91, bHigh: 120, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 121, bHigh: 250, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 251, bHigh: 500, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  PM10: [
    { bLow: 0, bHigh: 50, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 51, bHigh: 100, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 101, bHigh: 250, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 251, bHigh: 350, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 351, bHigh: 430, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 431, bHigh: 600, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  NO2: [
    { bLow: 0, bHigh: 40, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 41, bHigh: 80, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 81, bHigh: 180, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 181, bHigh: 280, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 281, bHigh: 400, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 401, bHigh: 600, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  SO2: [
    { bLow: 0, bHigh: 40, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 41, bHigh: 80, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 81, bHigh: 380, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 381, bHigh: 800, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 801, bHigh: 1600, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 1601, bHigh: 2400, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  CO: [
    { bLow: 0, bHigh: 1.0, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 1.1, bHigh: 2.0, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 2.1, bHigh: 10.0, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 10.1, bHigh: 17.0, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 17.1, bHigh: 34.0, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 34.1, bHigh: 50.0, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  O3: [
    { bLow: 0, bHigh: 50, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 51, bHigh: 100, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 101, bHigh: 168, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 169, bHigh: 208, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 209, bHigh: 748, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 749, bHigh: 1000, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  NH3: [
    { bLow: 0, bHigh: 200, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 201, bHigh: 400, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 401, bHigh: 800, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 801, bHigh: 1200, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 1201, bHigh: 1800, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 1801, bHigh: 2400, iLow: 401, iHigh: 500, category: "Severe" },
  ],
  Pb: [
    { bLow: 0, bHigh: 0.5, iLow: 0, iHigh: 50, category: "Good" },
    { bLow: 0.6, bHigh: 1.0, iLow: 51, iHigh: 100, category: "Satisfactory" },
    { bLow: 1.1, bHigh: 2.0, iLow: 101, iHigh: 200, category: "Moderate" },
    { bLow: 2.1, bHigh: 3.0, iLow: 201, iHigh: 300, category: "Poor" },
    { bLow: 3.1, bHigh: 3.5, iLow: 301, iHigh: 400, category: "Very Poor" },
    { bLow: 3.6, bHigh: 5.0, iLow: 401, iHigh: 500, category: "Severe" },
  ],
};

export const CPCB_BENCHMARKS: Record<PollutantCode, { period: string; benchmark: string; minHours: number }> = {
  "PM2.5": { period: "24-hour", benchmark: "CPCB: 60 µg/m³", minHours: 16 },
  PM10: { period: "24-hour", benchmark: "CPCB: 100 µg/m³", minHours: 16 },
  NO2: { period: "24-hour", benchmark: "CPCB: 80 µg/m³", minHours: 16 },
  SO2: { period: "24-hour", benchmark: "CPCB: 80 µg/m³", minHours: 16 },
  CO: { period: "8-hour", benchmark: "CPCB: 2.0 mg/m³", minHours: 6 },
  O3: { period: "8-hour", benchmark: "CPCB: 100 µg/m³", minHours: 6 },
  NH3: { period: "24-hour", benchmark: "CPCB: 400 µg/m³", minHours: 16 },
  Pb: { period: "24-hour", benchmark: "CPCB: 1.0 µg/m³", minHours: 16 },
};

export const POLLUTANT_NAMES: Record<PollutantCode, string> = {
  "PM2.5": "Fine Particulate Matter",
  PM10: "Coarse Particulate Matter",
  NO2: "Nitrogen Dioxide",
  SO2: "Sulphur Dioxide",
  CO: "Carbon Monoxide",
  O3: "Ozone",
  NH3: "Ammonia",
  Pb: "Lead",
};

/**
 * Calculates the CPCB sub-index for a single pollutant using piecewise linear interpolation.
 * Statutory reference: Central Pollution Control Board (CPCB), October 2014, National Air Quality Index.
 * Continuous values are aligned to pollutant measurement precision (CO and Pb to 0.1, others to 1)
 * to prevent floating-point gap discontinuities between discrete breakpoint thresholds.
 */
export function calculatePollutantSubIndex(
  pollutant: PollutantCode,
  concentration: number
): { subIndex: number; category: AQICategory } | null {
  if (concentration < 0 || !Number.isFinite(concentration)) {
    return null;
  }

  const breakpoints = CPCB_BREAKPOINTS[pollutant];
  if (!breakpoints) return null;

  // Align concentration to statutory reporting resolution
  const effectiveConc =
    pollutant === "CO" || pollutant === "Pb"
      ? Math.round(concentration * 10) / 10
      : Math.round(concentration);

  // Find matching breakpoint interval [bLow, bHigh]
  for (const bp of breakpoints) {
    if (effectiveConc >= bp.bLow && effectiveConc <= bp.bHigh) {
      const subIndex = Math.round(
        ((bp.iHigh - bp.iLow) / (bp.bHigh - bp.bLow)) * (effectiveConc - bp.bLow) + bp.iLow
      );
      return { subIndex: Math.min(500, Math.max(0, subIndex)), category: bp.category };
    }
  }

  // If concentration exceeds the highest statutory breakpoint: capped at 500 (Severe)
  const highest = breakpoints[breakpoints.length - 1];
  if (effectiveConc > highest.bHigh) {
    return { subIndex: 500, category: "Severe" };
  }

  return null;
}

/**
 * Determines AQI category from sub-index value.
 */
export function getAQICategory(index: number): AQICategory {
  if (index <= 50) return "Good";
  if (index <= 100) return "Satisfactory";
  if (index <= 200) return "Moderate";
  if (index <= 300) return "Poor";
  if (index <= 400) return "Very Poor";
  return "Severe";
}

/**
 * Calculates statutory composite CPCB NAQI from monitored pollutant details.
 * Enforces:
 * 1. Minimum 3 monitored pollutants.
 * 2. At least one must be a particulate pollutant (PM2.5 or PM10).
 * 3. Individual pollutant 16-hr / 6-hr data sufficiency.
 */
export function calculateCompositeCPCB_NAQI(
  pollutants: Partial<Record<PollutantCode, PollutantDetail>>
): {
  aqi: number | null;
  category: AQICategory;
  dominantPollutant: PollutantCode | null;
  isDataSufficient: boolean;
  notes: string;
} {
  const validPollutants: { code: PollutantCode; subIndex: number }[] = [];

  for (const [codeStr, detail] of Object.entries(pollutants)) {
    const code = codeStr as PollutantCode;
    if (detail && detail.subIndex !== null && detail.isDataSufficient) {
      validPollutants.push({ code, subIndex: detail.subIndex });
    }
  }

  // Check 1: Minimum 3 pollutants requirement
  if (validPollutants.length < 3) {
    return {
      aqi: null,
      category: "Insufficient Data",
      dominantPollutant: null,
      isDataSufficient: false,
      notes: `Statutory CPCB NAQI requires at least 3 valid pollutants. Currently only ${validPollutants.length} monitored with full data sufficiency.`,
    };
  }

  // Check 2: At least one particulate pollutant requirement (PM2.5 or PM10)
  const hasParticulate = validPollutants.some(
    (p) => p.code === "PM2.5" || p.code === "PM10"
  );

  if (!hasParticulate) {
    return {
      aqi: null,
      category: "Insufficient Data",
      dominantPollutant: null,
      isDataSufficient: false,
      notes: "Statutory CPCB NAQI requires at least one particulate pollutant (PM2.5 or PM10) with ≥16 hrs data.",
    };
  }

  // Composite NAQI = max(sub-indices)
  let maxSubIndex = -1;
  let dominant: PollutantCode | null = null;

  for (const p of validPollutants) {
    if (p.subIndex > maxSubIndex) {
      maxSubIndex = p.subIndex;
      dominant = p.code;
    }
  }

  return {
    aqi: maxSubIndex,
    category: getAQICategory(maxSubIndex),
    dominantPollutant: dominant,
    isDataSufficient: true,
    notes: `CPCB NAQI successfully computed across ${validPollutants.length} valid pollutants with dominant: ${dominant}.`,
  };
}

/**
 * Calculates the Hourly Instantaneous Smog Indicator (HISI) from acute hourly readings.
 */
export function calculateHISI(pm25_1hr?: number, pm10_1hr?: number): { hisi: number; category: AQICategory } {
  let highestIndex = 0;

  if (pm25_1hr !== undefined && pm25_1hr >= 0) {
    const res = calculatePollutantSubIndex("PM2.5", pm25_1hr);
    if (res && res.subIndex > highestIndex) highestIndex = res.subIndex;
  }

  if (pm10_1hr !== undefined && pm10_1hr >= 0) {
    const res = calculatePollutantSubIndex("PM10", pm10_1hr);
    if (res && res.subIndex > highestIndex) highestIndex = res.subIndex;
  }

  return {
    hisi: highestIndex,
    category: getAQICategory(highestIndex),
  };
}
