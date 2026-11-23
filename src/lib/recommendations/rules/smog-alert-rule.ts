import { NormalizedAirQualityReport } from "../../aqi/types";
import { Recommendation, UserPreferences } from "../types";

/**
 * Rule: Acute Severe Smog Episodic Alert.
 * Triggered under emergency inversion or statutory Severe CPCB conditions (AQI > 400).
 * 
 * Traceable Sources:
 * - Ministry of Environment, Forest and Climate Change (MoEFCC) Graded Response Action Plan (GRAP IV).
 * - CPCB National Air Quality Index Emergency Alert Guidelines (2014).
 */
export function evaluateSmogAlertRule(
  report: NormalizedAirQualityReport,
  preferences: UserPreferences,
  currentHour: number,
  dataMode: "live" | "forecast" | "calibrated_baseline" | "demonstration"
): Recommendation | null {
  const aqi = report.cpcbNAQI ?? report.hisi;
  const isSevere = report.cpcbCategory === "Severe" || aqi > 400 || report.hisi >= 450;
  const isHighInversion = report.weather.inversionRisk === "High" && report.weather.boundaryLayerHeightMeters < 200;

  if (!isSevere && !isHighInversion) {
    return null;
  }

  const supportingData = {
    aqi: report.cpcbNAQI,
    aqiCategory: report.cpcbCategory,
    dominantPollutant: report.dominantPollutant,
    pm25Value: report.pollutants["PM2.5"]?.value,
    boundaryLayerMeters: report.weather.boundaryLayerHeightMeters,
    windSpeedKmh: report.weather.windSpeedKmh,
    isInversionActive: report.weather.isInversionActive,
  };

  const supportingDataText = `Status: SEVERE SMOG EPISODE, AQI: ${aqi}, HISI Peak: ${report.hisi}, Inversion Mixing Depth: ${Math.round(report.weather.boundaryLayerHeightMeters)}m`;

  return {
    id: "rec_smog_alert_critical",
    title: "Critical Smog Episode: Activate Severe Health Protection Protocol",
    category: "precaution",
    priority: "critical",
    actionSummary: "Emergency inversion trap. Remain indoors, seal perimeter doors, and wear fit-tested N95 if stepping outside.",
    explanation:
      "Severe atmospheric trapping prevents vertical and lateral dispersion of toxic combustion aerosols. Prolonged exposure causes adverse respiratory and cardiovascular outcomes even in healthy adults.",
    supportingData,
    supportingDataText,
    source: "MoEFCC Graded Response Action Plan (GRAP IV); CPCB NAQI Severe Protocol (2014)",
    observedAt: report.calculatedAt,
    dataFreshnessMinutes: report.provenance.freshnessMinutes,
    dataMode,
    confidenceScore: report.provenance.confidenceScore,
    targetTimeWindow: "Full 24-Hour Cycle until solar dispersion",
    indoorAlternative: {
      title: "Indoor Air Lockdown & Continuous Filtration",
      description:
        "Cluster family activities into a single sealed inner room with air purifier running on high for 30 minutes, then maintain on quiet mode.",
      intensity: "low",
    },
    matchedPreferences: [
      `User Sensitivity: ${preferences.sensitivity}`,
      `Commute Mode: ${preferences.commuteMode}`,
    ],
  };
}
