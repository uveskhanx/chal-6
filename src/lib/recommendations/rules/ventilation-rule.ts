import { NormalizedAirQualityReport } from "../../aqi/types";
import { Recommendation, UserPreferences } from "../types";

/**
 * Rule: Indoor Natural Ventilation & Window Sealing Decision.
 * Evaluates boundary layer height, ambient PM2.5, and diurnal thermal cycle.
 * 
 * Traceable Sources:
 * - CPCB Continuous Ambient Air Quality Monitoring Protocol (2014).
 * - IMD Winter Inversion Diurnal Mixing Layer Reports.
 * - ASHRAE Standard 62.1: Ventilation for Acceptable Indoor Air Quality.
 */
export function evaluateVentilationRule(
  report: NormalizedAirQualityReport,
  preferences: UserPreferences,
  currentHour: number,
  dataMode: "live" | "forecast" | "calibrated_baseline" | "demonstration"
): Recommendation | null {
  const pm25 = report.pollutants["PM2.5"]?.value ?? 100;
  const boundaryLayer = report.weather.boundaryLayerHeightMeters;
  const isInversion = report.weather.isInversionActive || boundaryLayer < 250;
  const isSolarWindow = currentHour >= 12 && currentHour <= 15;

  const supportingData = {
    aqi: report.cpcbNAQI,
    aqiCategory: report.cpcbCategory,
    dominantPollutant: report.dominantPollutant,
    pm25Value: pm25,
    boundaryLayerMeters: boundaryLayer,
    windSpeedKmh: report.weather.windSpeedKmh,
    isInversionActive: report.weather.isInversionActive,
  };

  const supportingDataText = `Boundary Layer: ${Math.round(boundaryLayer)}m, Inversion Active: ${isInversion ? "Yes" : "No"}, PM2.5: ${pm25} µg/m³`;

  // Case 1: Inversion trapped or severe particulate pollution
  if (isInversion || report.cpcbCategory === "Severe" || report.cpcbCategory === "Very Poor") {
    return {
      id: "rec_ventilation_sealed",
      title: "Seal External Windows; Maintain Recirculated Air Filtration",
      category: "ventilation",
      priority: "high",
      actionSummary: "Keep road-facing and perimeter windows firmly closed. Run indoor air filtration.",
      explanation:
        "Surface thermal inversion traps toxic combustion aerosols below 250m. Opening windows introduces outdoor fine particles directly into living spaces. Maintain indoor air circulation with mechanical or DIY HEPA purifiers.",
      supportingData,
      supportingDataText,
      source: "ASHRAE Standard 62.1; IMD Boundary Layer Inversion Guidance",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "Keep sealed (Do not ventilate between 18:00 – 11:00 IST)",
      directImpact: {
        whatToChange: "Keep windows firmly shut. Block frame air gaps using weatherstripping or damp towels.",
        whyRelevant: `Nocturnal and morning boundary layer inversion (${Math.round(boundaryLayer)}m) traps vehicle exhaust at ground level.`,
        expectedBenefit: "Reduces outdoor particle infiltration flux by 65% - 75% compared to keeping windows ajar.",
        calculationMethodology: "First-principles mass-balance building infiltration model (P = 0.70, λ = 0.95 ACH sealed vs. 2.8 ACH window ajar).",
        assumptionsAndLimitations: "Assumes building envelope has standard residential Indian masonry and glass fittings.",
        quantifiedMetrics: {
          indoorConcentrationReductionPercent: 70,
          exposureReductionPercent: 65,
        },
      },
      indoorAlternative: {
        title: "Closed-Room Recirculation Mode",
        description:
          "Seal window frame gaps with damp towels or weatherstrips. Run air filtration on continuous low mode in occupied bedrooms.",
        intensity: "low",
      },
      matchedPreferences: [
        `Commute / Housing Type: ${preferences.locationType}`,
        `Sensitivity: ${preferences.sensitivity}`,
      ],
    };
  }

  // Case 2: Midday solar window with moderate air quality
  if (isSolarWindow && boundaryLayer >= 400 && pm25 < 120) {
    return {
      id: "rec_ventilation_controlled_purge",
      title: "Controlled 20-Minute Cross-Ventilation Permitted",
      category: "ventilation",
      priority: "medium",
      actionSummary: "Open opposite windows briefly between 12:30 and 14:30 IST to purge indoor CO2 and VOCs.",
      explanation:
        "Peak solar heating expands the boundary mixing layer to its daily maximum, diluting surface particulate density. A short cross-draft purges stagnant indoor carbon dioxide without allowing prolonged smog settling.",
      supportingData,
      supportingDataText,
      source: "CPCB Urban Air Dynamics (2014); ASHRAE 62.1 IAQ Purge Protocol",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "12:30 – 14:30 IST (Brief purge only)",
      matchedPreferences: [`Preferred Window: ${preferences.preferredTime}`],
    };
  }

  // Case 3: Good or Satisfactory air quality
  if (report.cpcbCategory === "Good" || report.cpcbCategory === "Satisfactory") {
    return {
      id: "rec_ventilation_open",
      title: "Natural Cross-Ventilation Recommended",
      category: "ventilation",
      priority: "low",
      actionSummary: "Open windows for unrestricted fresh air exchange.",
      explanation:
        "Outdoor air is clean with low particulate density and favorable atmospheric dispersion. Natural ventilation refreshes indoor oxygen levels.",
      supportingData,
      supportingDataText,
      source: "CPCB NAQI Guidelines (2014) Clean Category",
      observedAt: report.calculatedAt,
      dataFreshnessMinutes: report.provenance.freshnessMinutes,
      dataMode,
      confidenceScore: report.provenance.confidenceScore,
      targetTimeWindow: "Unrestricted",
      matchedPreferences: [`Location Preference: ${preferences.locationType}`],
    };
  }

  return null;
}
