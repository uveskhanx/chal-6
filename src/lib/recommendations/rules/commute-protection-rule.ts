import { NormalizedAirQualityReport } from "../../aqi/types";
import { Recommendation, UserPreferences } from "../types";

/**
 * Rule: Sustainable Commute Exposure Mitigation.
 * Evaluates commuter modality (walking, cycling, metro, auto/two-wheeler, car)
 * against ambient traffic exhaust and boundary layer stagnation.
 * 
 * Traceable Sources:
 * - CPCB Vehicular Pollution Control Guidelines (2014).
 * - UNEP Sustainable Urban Mobility & Low-Emission Commute Framework (2022).
 * - NIOSH / CDC Particulate Respirator Guidance (N95 / FFP2 Standards).
 */
export function evaluateCommuteProtectionRule(
  report: NormalizedAirQualityReport,
  preferences: UserPreferences,
  currentHour: number,
  dataMode: "live" | "forecast" | "calibrated_baseline" | "demonstration"
): Recommendation | null {
  const aqi = report.cpcbNAQI ?? report.hisi;
  const pm25 = report.pollutants["PM2.5"]?.value;
  const isHighSmog = report.cpcbCategory === "Severe" || report.cpcbCategory === "Very Poor" || aqi > 300;
  const isModerateSmog = report.cpcbCategory === "Poor" || aqi > 200;

  const supportingData = {
    aqi: report.cpcbNAQI,
    aqiCategory: report.cpcbCategory,
    dominantPollutant: report.dominantPollutant,
    pm25Value: pm25,
    boundaryLayerMeters: report.weather.boundaryLayerHeightMeters,
    windSpeedKmh: report.weather.windSpeedKmh,
    isInversionActive: report.weather.isInversionActive,
  };

  const supportingDataText = `Commute Mode: ${preferences.commuteMode}, AQI: ${aqi} (${report.cpcbCategory}), Dominant: ${report.dominantPollutant ?? "Particulates"}`;

  // Commute Mode: Walking or Cycling under High Smog
  if ((preferences.commuteMode === "walking" || preferences.commuteMode === "cycling") && isHighSmog) {
    return {
      id: "rec_commute_active_hazard",
      title: "Shift Active Commute (Walking/Cycling) to Metro or Enclosed Transit",
      category: "commute",
      priority: "critical",
      actionSummary: "Avoid outdoor roadside cycling and walking during peak morning and evening inversion hours.",
      explanation:
        "Active commuters inhale up to 3x more air volume per kilometer than passive passengers. Traveling immediately adjacent to arterial traffic tailpipes under low boundary mixing layers leads to acute inhalation of ultrafine black carbon and nitrogen dioxide.",
      supportingData,
      supportingDataText,
      source: "UNEP Sustainable Urban Mobility; CPCB Vehicular Emission Assessment (2014)",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "Morning Commute (08:00 – 10:30 IST) & Evening (17:30 – 20:30 IST)",
      directImpact: {
        whatToChange: "Switch roadside walking or cycling to Metro or electric bus during smog.",
        whyRelevant: "Walking/cycling raises ventilation rate to 24-36 L/min, inhaling 3x more toxic exhaust directly at road level.",
        expectedBenefit: "Reduces inhaled particle burden by ~75% and deposited lung dose from 91 µg to 22 µg.",
        calculationMethodology: "EPA Minute Ventilation Handbook and ICRP 66 Human Respiratory Tract Model over typical 10km route.",
        assumptionsAndLimitations: "Assumes transit access within comfortable walking distance.",
        quantifiedMetrics: {
          exposureReductionPercent: 75,
          inhaledDoseAvoidedUg: 69,
          emissionsAvoidedGCO2e: 0,
        },
      },
      indoorAlternative: {
        title: "Underground Metro / Sealed Transit Transfer",
        description:
          "Board electric rapid transit or carpool in a closed vehicle with AC recirculation enabled. If walking is unavoidable, wear a genuine fit-tested N95 respirator.",
        intensity: "low",
      },
      matchedPreferences: [
        `Commute Mode: ${preferences.commuteMode}`,
        `Sensitivity: ${preferences.sensitivity}`,
      ],
    };
  }

  // Commute Mode: Two-Wheeler / Open Auto
  if (preferences.commuteMode === "two_wheeler" && (isHighSmog || isModerateSmog)) {
    return {
      id: "rec_commute_twowheeler_n95",
      title: "Mandatory Fit-Tested N95 Mask for Open Two-Wheeler Commute",
      category: "commute",
      priority: "high",
      actionSummary: "Wear a certified N95 / FFP2 respirator with an adjustable nasal clip during two-wheeler travel.",
      explanation:
        "Cloth scarves and surgical masks allow massive edge-seal leakage (> 70%) and fail to trap sub-micron PM2.5 combustion aerosols. Certified particulate respirators with an airtight facial perimeter are required in heavy traffic.",
      supportingData,
      supportingDataText,
      source: "NIOSH / CDC Particulate Filtration Standards; CPCB Traffic Exposure Notes",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "Travel Transit Window",
      matchedPreferences: [`Commute Mode: ${preferences.commuteMode}`],
    };
  }

  // Commute Mode: Car / Cab
  if (preferences.commuteMode === "car_cab" && (isHighSmog || isModerateSmog)) {
    return {
      id: "rec_commute_car_recirculation",
      title: "Activate HVAC Internal Recirculation in Vehicle Cabin",
      category: "commute",
      priority: "medium",
      actionSummary: "Switch vehicle ventilation mode from 'Fresh Air Intake' to 'Internal Recirculation'.",
      explanation:
        "Fresh-air intake pulls tailpipe exhaust directly from the vehicle ahead in slow-moving congestion. Recirculating filtered cabin air reduces in-cabin PM2.5 concentrations by 60% to 80% within 10 minutes.",
      supportingData,
      supportingDataText,
      source: "Society of Automotive Engineers (SAE) In-Cabin Air Quality Standards",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "Traffic Transit Window",
      matchedPreferences: [`Commute Mode: ${preferences.commuteMode}`],
    };
  }

  // Commute Mode: Public Transit / Metro (Clean or moderate)
  if (preferences.commuteMode === "public_transit") {
    return {
      id: "rec_commute_public_transit",
      title: "Public Rapid Transit: Low-Exposure & Low-Emission Choice",
      category: "commute",
      priority: "low",
      actionSummary: "Utilize metro rail lines to minimize personal per-capita emission contribution.",
      explanation:
        "Electric metro systems reduce urban road congestion and protect commuters from direct roadway vehicle tailpipe plumes.",
      supportingData,
      supportingDataText,
      source: "CPCB Urban Transport Sustainability Framework",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "Daily Commute",
      matchedPreferences: [`Commute Mode: ${preferences.commuteMode}`],
    };
  }

  return null;
}
