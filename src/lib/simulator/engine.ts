import {
  RoomConfiguration,
  OutdoorConditions,
  SimulationParameters,
  SimulationOutput,
  SimulationTimePoint,
  InspectableModelParameters,
  SimulationMetrics,
} from "./types";
import {
  AIR_EXCHANGE_RATES,
  PENETRATION_FACTORS,
  DEPOSITION_RATES,
  FAN_SPEED_MULTIPLIERS,
  INDOOR_SOURCE_EMISSIONS,
  SCIENTIFIC_CITATIONS,
  SIMULATION_ASSUMPTIONS,
  SIMULATION_LIMITATIONS,
} from "./constants";

export interface EngineRunOptions {
  room: RoomConfiguration;
  outdoor: OutdoorConditions;
  parameters?: Partial<SimulationParameters>;
}

/**
 * Computes exact piecewise analytical integration of differential aerosol mass balance:
 *   dC/dt = alpha - K_total * C
 * Analytical Solution:
 *   C(t + dt) = C_ss + (C(t) - C_ss) * exp(-K_total * dt)
 *   where C_ss = alpha / K_total
 */
export function stepAnalyticalConcentration(
  currentC: number,
  alpha: number,
  kTotal: number,
  dtHours: number
): number {
  if (!Number.isFinite(currentC) || currentC < 0) {
    currentC = 0;
  }
  if (!Number.isFinite(alpha) || alpha < 0) {
    alpha = 0;
  }
  if (kTotal <= 0 || !Number.isFinite(kTotal)) {
    return Math.max(0, currentC + alpha * dtHours);
  }
  const cSteadyState = alpha / kTotal;
  const updatedC = cSteadyState + (currentC - cSteadyState) * Math.exp(-kTotal * dtHours);
  return Math.max(0, updatedC);
}

/**
 * Calculates the exact room geometric volume in cubic meters.
 * Formula: Volume (m³) = Length (m) × Width (m) × Height (m)
 */
export function calculateRoomVolumeM3(dimensions: { lengthM: number; widthM: number; heightM: number }): number {
  const vol = dimensions.lengthM * dimensions.widthM * dimensions.heightM;
  return Math.round(vol * 100) / 100;
}

/**
 * Calculates the room floor area in square meters.
 */
export function calculateFloorAreaM2(dimensions: { lengthM: number; widthM: number; heightM: number }): number {
  const area = dimensions.lengthM * dimensions.widthM;
  return Math.round(area * 100) / 100;
}

/**
 * Core Mass-Balance Indoor Air Quality Simulation Engine.
 *
 * Implements the fundamental differential mass-balance equation:
 * dC/dt = P * λ * C_out + S(t)/V - (λ + k_f(t) + k_d) * C
 *
 * Solves using exact analytical piecewise integration over time steps Δt:
 * C(t + Δt) = C_ss + (C(t) - C_ss) * exp(-K_total * Δt)
 * where C_ss = (P * λ * C_out + S/V) / K_total
 * and K_total = λ + k_f + k_d
 *
 * This method is unconditionally numerically stable, guaranteed non-negative,
 * and eliminates numerical truncation errors present in discrete Euler approximations.
 */
export function runIndoorSimulation(options: EngineRunOptions): SimulationOutput {
  const { room, outdoor } = options;
  const durationHours = options.parameters?.durationHours ?? 4;
  const timeStepMinutes = options.parameters?.timeStepMinutes ?? 2;

  // 1. Geometry Calculations
  const roomVolumeM3 = calculateRoomVolumeM3(room.dimensions);
  const floorAreaM2 = calculateFloorAreaM2(room.dimensions);

  // 2. Air Exchange Rate λ (ACH = h⁻¹)
  const achBase = AIR_EXCHANGE_RATES[room.infiltrationLevel][room.ventilationMode];
  // Modulate by window opening fraction if applicable
  const effectiveACH =
    room.ventilationMode === "windows_open" || room.ventilationMode === "window_ajar"
      ? achBase * (room.windowOpeningFraction > 0 ? room.windowOpeningFraction : 1.0)
      : achBase;

  // 3. Envelope Penetration Factors P
  const penetration = PENETRATION_FACTORS[room.ventilationMode];
  const P_pm25 = penetration.pm25;
  const P_pm10 = penetration.pm10;

  // 4. Deposition Removal Rates k_d (h⁻¹)
  const k_d_pm25 = DEPOSITION_RATES.pm25;
  const k_d_pm10 = DEPOSITION_RATES.pm10;

  // 5. Air Purifier CADR & Filtration Removal Rate k_f (h⁻¹)
  const safeRoomVolumeM3 = Math.max(1.0, roomVolumeM3);
  const fanMultiplier = room.hasAirPurifier ? FAN_SPEED_MULTIPLIERS[room.purifierFanSpeed] : 0;
  const effectiveCADR = room.hasAirPurifier ? room.purifierCADR * fanMultiplier : 0; // m³/h
  const k_f = safeRoomVolumeM3 > 0 ? effectiveCADR / safeRoomVolumeM3 : 0; // h⁻¹

  // 6. Total Removal Rates K_total (h⁻¹)
  const K_total_pm25 = effectiveACH + k_f + k_d_pm25;
  const K_total_pm10 = effectiveACH + k_f + k_d_pm10;

  // 7. Indoor Source Emission Rates S (converted to µg/h)
  const sourceConfig = INDOOR_SOURCE_EMISSIONS[room.indoorSource];
  const S_rate_pm25_hourly = sourceConfig.emissionRatePM25UgPerMin * 60; // µg/h
  const S_rate_pm10_hourly = sourceConfig.emissionRatePM10UgPerMin * 60; // µg/h

  // Outdoor Pollutant Baselines
  const C_out_pm25 = outdoor.pm25;
  const C_out_pm10 = outdoor.pm10 ?? outdoor.pm25 * 1.5; // Calibrated ratio if PM10 unmonitored

  // Initial indoor concentrations C(0)
  // If not explicitly provided, estimate initial based on closed infiltration baseline:
  // C(0) = (P * λ * C_out) / (λ + k_d)
  const defaultInitialPM25 =
    K_total_pm25 > 0 ? (P_pm25 * effectiveACH * C_out_pm25) / (effectiveACH + k_d_pm25) : C_out_pm25 * 0.7;
  const defaultInitialPM10 =
    K_total_pm10 > 0 ? (P_pm10 * effectiveACH * C_out_pm10) / (effectiveACH + k_d_pm10) : C_out_pm10 * 0.4;

  let currentPM25 = room.initialIndoorPM25 !== undefined ? room.initialIndoorPM25 : defaultInitialPM25;
  let currentPM10 = room.initialIndoorPM10 !== undefined ? room.initialIndoorPM10 : defaultInitialPM10;

  // Simulation Time Progression
  const totalMinutes = durationHours * 60;
  const timeStepHours = timeStepMinutes / 60;
  const timePoints: SimulationTimePoint[] = [];

  let peakPM25 = currentPM25;
  let peakPM10 = currentPM10;
  let sumPM25 = 0;
  let sumPM10 = 0;
  let countPoints = 0;
  let aucExposurePM25 = 0;
  let minutesAboveWHO = 0;
  let timeToCleanToGoodMinutes: number | null = null;

  const sourceStartMin = room.indoorSourceStartMinute;
  const sourceEndMin = room.indoorSourceStartMinute + room.indoorSourceDurationMinutes;

  for (let minute = 0; minute <= totalMinutes; minute += timeStepMinutes) {
    const hour = Math.round((minute / 60) * 100) / 100;
    const isSourceActive =
      room.indoorSource !== "none" && minute >= sourceStartMin && minute <= sourceEndMin;

    // Record timepoint state
    const roundedPM25 = Math.max(0, Math.round(currentPM25 * 10) / 10);
    const roundedPM10 = Math.max(0, Math.round(currentPM10 * 10) / 10);
    const ioRatio = C_out_pm25 > 0 ? Math.round((roundedPM25 / C_out_pm25) * 100) / 100 : 0;

    timePoints.push({
      minute,
      hour,
      indoorPM25: roundedPM25,
      indoorPM10: roundedPM10,
      outdoorPM25: C_out_pm25,
      outdoorPM10: C_out_pm10,
      indoorOutdoorRatioPM25: ioRatio,
      isSourceActive,
      activePurifierCADR: effectiveCADR,
      effectiveAirExchangeRateACH: Math.round(effectiveACH * 100) / 100,
      whoExceededPM25: roundedPM25 > 15,
    });

    if (roundedPM25 > peakPM25) peakPM25 = roundedPM25;
    if (roundedPM10 > peakPM10) peakPM10 = roundedPM10;
    sumPM25 += roundedPM25;
    sumPM10 += roundedPM10;
    countPoints++;
    aucExposurePM25 += roundedPM25 * timeStepHours;
    if (roundedPM25 > 15) minutesAboveWHO += timeStepMinutes;

    if (timeToCleanToGoodMinutes === null && minute > 0 && roundedPM25 <= 30) {
      timeToCleanToGoodMinutes = minute;
    }

    // Advance to next time point using exact analytical piecewise integration
    if (minute < totalMinutes) {
      const activeS_pm25 = isSourceActive ? S_rate_pm25_hourly : 0;
      const activeS_pm10 = isSourceActive ? S_rate_pm10_hourly : 0;

      const alpha_pm25 = P_pm25 * effectiveACH * C_out_pm25 + activeS_pm25 / safeRoomVolumeM3;
      const alpha_pm10 = P_pm10 * effectiveACH * C_out_pm10 + activeS_pm10 / safeRoomVolumeM3;

      currentPM25 = stepAnalyticalConcentration(currentPM25, alpha_pm25, K_total_pm25, timeStepHours);
      currentPM10 = stepAnalyticalConcentration(currentPM10, alpha_pm10, K_total_pm10, timeStepHours);
    }
  }

  const initialPM25 = timePoints[0]?.indoorPM25 ?? 0;
  const finalPM25 = timePoints[timePoints.length - 1]?.indoorPM25 ?? 0;
  const initialPM10 = timePoints[0]?.indoorPM10 ?? 0;
  const finalPM10 = timePoints[timePoints.length - 1]?.indoorPM10 ?? 0;
  const avgPM25 = countPoints > 0 ? Math.round((sumPM25 / countPoints) * 10) / 10 : 0;
  const avgPM10 = countPoints > 0 ? Math.round((sumPM10 / countPoints) * 10) / 10 : 0;

  const percentChange =
    initialPM25 > 0 ? Math.round(((finalPM25 - initialPM25) / initialPM25) * 1000) / 10 : 0;

  // Steady-state reference for inspectable parameters (without transient sources)
  const steadyStateBaseline =
    K_total_pm25 > 0 ? (P_pm25 * effectiveACH * C_out_pm25) / K_total_pm25 : 0;
  const halfLifeMinutes =
    K_total_pm25 > 0 ? Math.round((Math.LN2 / K_total_pm25) * 60 * 10) / 10 : 0;

  const inspectableParameters: InspectableModelParameters = {
    roomVolumeM3,
    floorAreaM2,
    outdoorAirExchangeACH: Math.round(effectiveACH * 100) / 100,
    envelopePenetrationFactorPM25: P_pm25,
    envelopePenetrationFactorPM10: P_pm10,
    particleDepositionRatePM25: k_d_pm25,
    particleDepositionRatePM10: k_d_pm10,
    purifierRemovalRate: Math.round(k_f * 100) / 100,
    effectiveTotalRemovalRatePM25: Math.round(K_total_pm25 * 100) / 100,
    sourceEmissionRateUgPerHourPM25: S_rate_pm25_hourly,
    sourceEmissionRateUgPerHourPM10: S_rate_pm10_hourly,
    steadyStateConcentrationPM25: Math.round(steadyStateBaseline * 10) / 10,
    halfLifeSettlingTimeMinutes: halfLifeMinutes,
  };

  const metrics: SimulationMetrics = {
    initialPM25,
    peakPM25,
    finalPM25,
    averagePM25: avgPM25,
    initialPM10,
    peakPM10,
    finalPM10,
    averagePM10: avgPM10,
    percentChangeFromInitial: percentChange,
    who24HrGuidelineThreshold: 15,
    whoGuidelineExceedancePercent:
      totalMinutes > 0 ? Math.round((minutesAboveWHO / totalMinutes) * 100) : 0,
    cpcbGoodThreshold: 30,
    hoursToCleanToGoodCategory:
      timeToCleanToGoodMinutes !== null
        ? Math.round((timeToCleanToGoodMinutes / 60) * 10) / 10
        : null,
    areaUnderCurveExposureUgHrM3: Math.round(aucExposurePM25 * 10) / 10,
  };

  return {
    id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    calculatedAt: new Date().toISOString(),
    roomName: room.name || "Configured Room",
    roomType: room.roomType,
    durationHours,
    timeStepMinutes,
    timePoints,
    metrics,
    parameters: inspectableParameters,
    outdoorContext: outdoor,
    citations: SCIENTIFIC_CITATIONS,
    assumptions: SIMULATION_ASSUMPTIONS,
    limitations: SIMULATION_LIMITATIONS,
  };
}
