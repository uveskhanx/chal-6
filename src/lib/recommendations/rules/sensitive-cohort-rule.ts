import { NormalizedAirQualityReport } from "../../aqi/types";
import { Recommendation, UserPreferences } from "../types";

/**
 * Rule: Sensitive & Vulnerable Cohort Protection.
 * Evaluates lifestyle risk for self-reported respiratory sensitivity or households with children/elderly.
 * 
 * Traceable Sources:
 * - CPCB NAQI Health Advisory Table (2014) for Sensitive Groups.
 * - Global Initiative for Asthma (GINA) Environmental Exposure Protocols (2023).
 * - WHO Guidelines for Vulnerable Populations (2021).
 */
export function evaluateSensitiveCohortRule(
  report: NormalizedAirQualityReport,
  preferences: UserPreferences,
  currentHour: number,
  dataMode: "live" | "forecast" | "calibrated_baseline" | "demonstration"
): Recommendation | null {
  if (preferences.sensitivity === "standard") {
    return null;
  }

  const aqi = report.cpcbNAQI ?? report.hisi;
  const isElevated = aqi > 100 || report.cpcbCategory !== "Good";

  if (!isElevated) {
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

  const isChildElderly = preferences.sensitivity === "vulnerable_household";
  const priority = aqi > 300 ? "critical" : aqi > 200 ? "high" : "medium";

  const supportingDataText = `Cohort: ${isChildElderly ? "Child / Elderly in Household" : "Respiratory Sensitivity"}, AQI: ${aqi} (${report.cpcbCategory})`;

  return {
    id: "rec_sensitive_cohort_protection",
    title: isChildElderly
      ? "Vulnerable Household Care: Suspend Outdoor Play & Morning Elder Walks"
      : "Respiratory Sensitivity Protocol: Indoor Sanctuary & Inversion Avoidance",
    category: "precaution",
    priority,
    actionSummary: isChildElderly
      ? "Keep children and seniors in a closed, air-purified room during morning and evening inversion hours."
      : "Avoid early morning outdoor exposure; keep prescribed rescue medication accessible.",
    explanation:
      "Children breathe more air per kilogram of body weight with narrower airways, while seniors often experience reduced cardiovascular reserve. Early morning cold fog combined with fine particulates triggers airway hyperreactivity and bronchospasm.",
    supportingData,
    supportingDataText,
    source: "CPCB NAQI Advisory Table 5 (2014); GINA Asthma Protocols (2023)",
    observedAt: report.calculatedAt,
    dataFreshnessMinutes: report.provenance.freshnessMinutes,
    dataMode,
    confidenceScore: report.provenance.confidenceScore,
    targetTimeWindow: "Strict morning avoidance (06:00 – 10:00 IST)",
    indoorAlternative: {
      title: "Clean Air Bedroom Sanctuary",
      description:
        "Maintain bedroom PM2.5 below 25 µg/m³ with steady air filtration. Avoid incense sticks, mosquito coils, or unvented cooking smoke.",
      intensity: "low",
    },
    matchedPreferences: [
      `Sensitivity Setting: ${preferences.sensitivity}`,
      `Preferred Slot: ${preferences.preferredTime}`,
    ],
  };
}
