import "server-only";
import {
  PollutantCode,
  RawPollutantReading,
  PollutantDetail,
} from "./types";
import {
  calculatePollutantSubIndex,
  CPCB_BENCHMARKS,
  POLLUTANT_NAMES,
} from "./cpcb-calculator";

/**
 * Physical Constants for Standard Atmospheric Gas Conversions:
 * At standard ambient temperature (25°C = 298.15 K) and pressure (1 atm = 101.325 kPa),
 * the molar volume of an ideal gas is V_m = 24.45 L/mol.
 *
 * Concentration Conversion Formula:
 *   µg/m³ = ppm × (M / 24.45) × 1000
 * where M is the molecular weight in g/mol:
 *   - NO2: 46.0055 g/mol  -> 1 ppm = 1881.6 µg/m³  (approx 1882 µg/m³)
 *   - SO2: 64.066 g/mol   -> 1 ppm = 2620.3 µg/m³  (approx 2620 µg/m³)
 *   - O3:  48.000 g/mol   -> 1 ppm = 1963.2 µg/m³  (approx 1963 µg/m³)
 *   - CO:  28.010 g/mol   -> 1 ppm = 1.145 mg/m³
 */
export const MOLAR_VOLUME_L_PER_MOL = 24.45;
export const CO_PPM_TO_MG_M3 = 1.145;
export const NO2_PPM_TO_UG_M3 = 1882;
export const SO2_PPM_TO_UG_M3 = 2620;
export const O3_PPM_TO_UG_M3 = 1963;

/**
 * Converts gas concentrations from ppm or ppb to standard metric units:
 * - CO: mg/m³
 * - NO2, SO2, O3, NH3: µg/m³
 * Assumes standard atmospheric pressure (1 atm) and 25°C.
 */
export function normalizePollutantValue(
  pollutant: PollutantCode,
  rawValue: number,
  rawUnit: string
): { normalizedValue: number; unit: "µg/m³" | "mg/m³" } | null {
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return null;
  }

  const cleanUnit = rawUnit.trim().toLowerCase();

  // Handle CO (standard metric: mg/m³)
  if (pollutant === "CO") {
    if (cleanUnit === "mg/m³" || cleanUnit === "mg/m3" || cleanUnit === "mg/m^3") {
      return { normalizedValue: rawValue, unit: "mg/m³" };
    }
    if (cleanUnit === "µg/m³" || cleanUnit === "ug/m3" || cleanUnit === "ug/m^3") {
      return { normalizedValue: rawValue / 1000, unit: "mg/m³" };
    }
    if (cleanUnit === "ppm") {
      return { normalizedValue: rawValue * CO_PPM_TO_MG_M3, unit: "mg/m³" };
    }
    // Default fallback assumption for CO
    return { normalizedValue: rawValue, unit: "mg/m³" };
  }

  // Handle all other pollutants (standard metric: µg/m³)
  if (cleanUnit === "µg/m³" || cleanUnit === "ug/m3" || cleanUnit === "ug/m^3") {
    return { normalizedValue: rawValue, unit: "µg/m³" };
  }
  if (cleanUnit === "mg/m³" || cleanUnit === "mg/m3" || cleanUnit === "mg/m^3") {
    return { normalizedValue: rawValue * 1000, unit: "µg/m³" };
  }

  // Gas conversions from ppm / ppb at 25°C: Concentration (µg/m³) = ppm * (M / 24.45) * 1000
  if (pollutant === "NO2") {
    if (cleanUnit === "ppm") return { normalizedValue: rawValue * NO2_PPM_TO_UG_M3, unit: "µg/m³" };
    if (cleanUnit === "ppb") return { normalizedValue: rawValue * (NO2_PPM_TO_UG_M3 / 1000), unit: "µg/m³" };
  }
  if (pollutant === "SO2") {
    if (cleanUnit === "ppm") return { normalizedValue: rawValue * SO2_PPM_TO_UG_M3, unit: "µg/m³" };
    if (cleanUnit === "ppb") return { normalizedValue: rawValue * (SO2_PPM_TO_UG_M3 / 1000), unit: "µg/m³" };
  }
  if (pollutant === "O3") {
    if (cleanUnit === "ppm") return { normalizedValue: rawValue * O3_PPM_TO_UG_M3, unit: "µg/m³" };
    if (cleanUnit === "ppb") return { normalizedValue: rawValue * (O3_PPM_TO_UG_M3 / 1000), unit: "µg/m³" };
  }

  // Default to rawValue in µg/m³
  return { normalizedValue: rawValue, unit: "µg/m³" };
}

/**
 * Normalizes raw pollutant readings into statutory CPCB PollutantDetails.
 * Enforces data sufficiency checks and anomaly detection.
 */
export function normalizePollutantReadings(
  readings: RawPollutantReading[]
): Partial<Record<PollutantCode, PollutantDetail>> {
  const result: Partial<Record<PollutantCode, PollutantDetail>> = {};

  for (const r of readings) {
    const normalized = normalizePollutantValue(r.pollutant, r.value, r.unit);
    if (!normalized) continue;

    // Plausibility & anomaly check (filter out impossible or sensor-error readings)
    if (normalized.normalizedValue > 2500) {
      console.warn(`[AQI Normalizer] Flagged extreme outlier/sensor saturation for ${r.pollutant}: ${normalized.normalizedValue}`);
      continue;
    }

    const benchmark = CPCB_BENCHMARKS[r.pollutant];
    const validHours = r.averagingHours ?? 18; // Default valid hours count
    const isSufficient = validHours >= benchmark.minHours;

    const subIndexResult = calculatePollutantSubIndex(r.pollutant, normalized.normalizedValue);

    result[r.pollutant] = {
      code: r.pollutant,
      name: POLLUTANT_NAMES[r.pollutant],
      value: Number(normalized.normalizedValue.toFixed(1)),
      unit: normalized.unit,
      rawUnit: r.unit,
      subIndex: isSufficient && subIndexResult ? subIndexResult.subIndex : null,
      category: isSufficient && subIndexResult ? subIndexResult.category : null,
      averagingPeriod: `${benchmark.period} (${validHours} hrs valid)`,
      validHoursCount: validHours,
      isDataSufficient: isSufficient,
      standardBenchmark: benchmark.benchmark,
      observedAt: r.timestamp,
      qualityScore: isSufficient ? 1.0 : 0.6,
    };
  }

  return result;
}

/**
 * Computes reproducible confidence score based on sensor distance, data freshness, and provider type.
 */
export function calculateConfidenceScore(
  freshnessMinutes: number,
  distanceKm: number,
  sourceType: "OFFICIAL_CAAQMS" | "OPENAQ_V3" | "SPATIAL_INTERPOLATION" | "HISTORICAL_BASELINE" | "DEMO_SCENARIO"
): number {
  const wFreshness = 0.4;
  const wDistance = 0.4;
  const wSensor = 0.2;

  const fFreshness = Math.max(0, 1 - freshnessMinutes / 180);
  const fDistance = Math.max(0, 1 - distanceKm / 30);
  const sSensor =
    sourceType === "OFFICIAL_CAAQMS" || sourceType === "DEMO_SCENARIO"
      ? 1.0
      : sourceType === "OPENAQ_V3"
      ? 0.85
      : sourceType === "SPATIAL_INTERPOLATION"
      ? 0.7
      : 0.5;

  const score = wFreshness * fFreshness + wDistance * fDistance + wSensor * sSensor;
  return Number(Math.max(0.1, Math.min(1.0, score)).toFixed(2));
}
