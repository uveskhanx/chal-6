import {
  ActivityProfile,
  MaskType,
  TravelMode,
  DosimetryResult,
  SegmentExposurePoint,
} from "./types";
import {
  MINUTE_VENTILATION_RATES,
  DEPOSITION_FRACTIONS,
  VEHICLE_CABIN_PROFILES,
} from "./constants";
import { evaluateMaskProtection } from "./mask-model";

export interface CalculateCommuteDosimetryParams {
  segments?: SegmentExposurePoint[];
  distanceKm: number;
  durationMinutes: number;
  mode: TravelMode;
  activityProfile?: ActivityProfile;
  ambientPM25: number;
  ambientPM10?: number;
  maskType?: MaskType;
  customPenetrationFactor?: number;
}

/**
 * Advanced Exposure Dosimetry Engine
 * Calculates inhaled particulate mass and respiratory tract deposited dose
 * based on the continuous integral formulation:
 * 
 *   D_inhaled = \int_0^T C_breathing(t) * V_E(t) dt
 * 
 * Discretized across journey segments:
 *   D_inhaled = \sum_{i=1}^N C_breathing,i * V_E,i * \Delta t_i
 * 
 * Traceable Sources:
 * - US EPA Exposure Factors Handbook (2011 Edition), Table 6-1 (Minute Ventilation V_E)
 * - ICRP Publication 66 (1994), Human Respiratory Tract Model (Deposition Fractions DF)
 */
export function calculateCommuteDosimetry(
  params: CalculateCommuteDosimetryParams
): DosimetryResult {
  const {
    segments,
    durationMinutes,
    mode,
    activityProfile,
    ambientPM25,
    ambientPM10,
    maskType = "NONE",
    customPenetrationFactor,
  } = params;

  // Sanitize numerical inputs to ensure physical validity
  const safeAmbientPM25 = Math.max(0, Number.isFinite(ambientPM25) ? ambientPM25 : 0);
  const safeAmbientPM10 = Math.max(
    0,
    Number.isFinite(ambientPM10) ? (ambientPM10 as number) : safeAmbientPM25 * 1.55
  );

  const modeProfile = VEHICLE_CABIN_PROFILES[mode] || VEHICLE_CABIN_PROFILES.car_ac_recirc;
  const selectedActivity = activityProfile || modeProfile.activityProfile;
  const ventRates = MINUTE_VENTILATION_RATES[selectedActivity];
  const maskEval = evaluateMaskProtection(maskType);

  const P_v = customPenetrationFactor !== undefined ? customPenetrationFactor : modeProfile.penetrationFactor;
  const breathingRatio = maskEval.breathingZoneConcentrationRatio; // (1 - eta_eff)

  let totalInhaledPM25Ug = 0;
  let totalInhaledPM10Ug = 0;
  let timeWeightedPM25Sum = 0;
  let timeWeightedPM10Sum = 0;
  let totalDurationWeight = 0;

  if (segments && segments.length > 0) {
    // Segment-by-segment integration
    for (const seg of segments) {
      const segDuration = Math.max(0.01, Number.isFinite(seg.durationMinutes) ? seg.durationMinutes : 0.1);
      const segPM25 = Math.max(0, Number.isFinite(seg.estimatedPM25) ? seg.estimatedPM25 : safeAmbientPM25);
      const segPM10 = Math.max(0, Number.isFinite(seg.estimatedPM10) ? seg.estimatedPM10 : safeAmbientPM10);
      const cBreathingPM25 = segPM25 * P_v * breathingRatio;
      const cBreathingPM10 = segPM10 * P_v * breathingRatio;

      // Inhaled mass = C (ug/m3) * V_E (m3/min) * dt (min) -> ug
      const inhaledSegPM25 = cBreathingPM25 * ventRates.m3PerMin * segDuration;
      const inhaledSegPM10 = cBreathingPM10 * ventRates.m3PerMin * segDuration;

      totalInhaledPM25Ug += inhaledSegPM25;
      totalInhaledPM10Ug += inhaledSegPM10;

      timeWeightedPM25Sum += cBreathingPM25 * segDuration;
      timeWeightedPM10Sum += cBreathingPM10 * segDuration;
      totalDurationWeight += segDuration;
    }
  } else {
    // Lumped trip calculation
    const tripDuration = Math.max(1, Number.isFinite(durationMinutes) ? durationMinutes : 1);
    const cBreathingPM25 = safeAmbientPM25 * P_v * breathingRatio;
    const cBreathingPM10 = safeAmbientPM10 * P_v * breathingRatio;

    totalInhaledPM25Ug = cBreathingPM25 * ventRates.m3PerMin * tripDuration;
    totalInhaledPM10Ug = cBreathingPM10 * ventRates.m3PerMin * tripDuration;

    timeWeightedPM25Sum = cBreathingPM25 * tripDuration;
    timeWeightedPM10Sum = cBreathingPM10 * tripDuration;
    totalDurationWeight = tripDuration;
  }

  const twaPM25 = totalDurationWeight > 0 ? Number((timeWeightedPM25Sum / totalDurationWeight).toFixed(1)) : 0;
  const twaPM10 = totalDurationWeight > 0 ? Number((timeWeightedPM10Sum / totalDurationWeight).toFixed(1)) : 0;

  // ICRP 66 Deposited Dose: D_dep = DF * D_inhaled
  const dfPM25 = DEPOSITION_FRACTIONS.pm25.nominal;
  const dfPM10 = DEPOSITION_FRACTIONS.pm10.nominal;

  const depositedPM25Ug = totalInhaledPM25Ug * dfPM25;
  const depositedPM10Ug = totalInhaledPM10Ug * dfPM10;

  // Uncertainty interval from physiological deposition bounds
  const doseMinPM25 = totalInhaledPM25Ug * DEPOSITION_FRACTIONS.pm25.min;
  const doseMaxPM25 = totalInhaledPM25Ug * DEPOSITION_FRACTIONS.pm25.max;

  return {
    inhaledMassPM25Ug: Number(totalInhaledPM25Ug.toFixed(1)),
    inhaledMassPM10Ug: Number(totalInhaledPM10Ug.toFixed(1)),
    depositedDosePM25Ug: Number(depositedPM25Ug.toFixed(1)),
    depositedDosePM10Ug: Number(depositedPM10Ug.toFixed(1)),
    doseRangePM25Ug: [Number(doseMinPM25.toFixed(1)), Number(doseMaxPM25.toFixed(1))],
    timeWeightedAveragePM25: twaPM25,
    timeWeightedAveragePM10: twaPM10,
    minuteVentilationM3Min: ventRates.m3PerMin,
    effectiveMaskFiltration: maskEval.effectiveProtectionPercent,
    effectiveCabinPenetration: P_v,
    depositionFractionPM25: dfPM25,
    depositionFractionPM10: dfPM10,
    durationMinutes: totalDurationWeight,
  };
}
