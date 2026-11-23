import "server-only";
import { getAirQualityReport } from "@/lib/aqi/service";
import { OutdoorConditions } from "./types";
import { logger } from "@/lib/logger";

export interface OutdoorFetchOptions {
  lat?: number;
  lon?: number;
  scenario?: string;
  manualPM25?: number;
  manualPM10?: number;
}

/**
 * Retrieves validated outdoor environmental conditions for indoor simulation.
 * Connects directly to SaansAI's CPCB CAAQMS / OpenAQ / Open-Meteo pipeline.
 *
 * If live data is unavailable or fails, returns an explicitly labeled manual scenario
 * with isManualAssumption=true to preserve scientific integrity.
 */
export async function getOutdoorConditionsForSimulation(
  options: OutdoorFetchOptions = {}
): Promise<OutdoorConditions> {
  const { lat = 28.6468, lon = 77.3160, scenario, manualPM25, manualPM10 } = options;

  // 1. If manual inputs provided explicitly, honor them as manual assumption
  if (manualPM25 !== undefined) {
    return {
      pm25: manualPM25,
      pm10: manualPM10 ?? manualPM25 * 1.5,
      isLive: false,
      isManualAssumption: true,
      sourceName: "User Manual Assumption",
      observedAt: new Date().toISOString(),
      confidenceScore: 0.7,
      scenarioName: "Manual Scenario Input",
    };
  }

  // 2. Fetch from existing verified AQI Service pipeline
  try {
    const report = await getAirQualityReport({ lat, lon, scenario });
    const pm25Val = report.pollutants["PM2.5"]?.value;
    const pm10Val = report.pollutants["PM10"]?.value;

    if (typeof pm25Val === "number" && pm25Val > 0) {
      return {
        pm25: Math.round(pm25Val * 10) / 10,
        pm10: typeof pm10Val === "number" ? Math.round(pm10Val * 10) / 10 : undefined,
        temperatureC: report.weather?.temperatureC,
        relativeHumidityPercent: report.weather?.relativeHumidityPercent,
        isLive: !report.provenance.isDemo,
        isManualAssumption: false,
        sourceName: `${report.station.name} (${report.station.city})`,
        stationId: report.station.id,
        observedAt: report.calculatedAt,
        confidenceScore: report.provenance.confidenceScore,
        scenarioName: report.provenance.isDemo ? "Demonstration Reference Scenario" : undefined,
      };
    }
  } catch (error) {
    logger.warn(
      "[SimulatorDataAdapter] Error fetching live outdoor AQI, applying calibrated fallback:",
      undefined,
      error
    );
  }

  // 3. Fallback when outdoor sensors are offline or reporting insufficient data
  // Strictly labeled as an assumed baseline model
  return {
    pm25: 388,
    pm10: 540,
    temperatureC: 17,
    relativeHumidityPercent: 78,
    isLive: false,
    isManualAssumption: true,
    sourceName: "Calibrated Severe Smog Fallback Model (CPCB Delhi Winter Baseline)",
    observedAt: new Date().toISOString(),
    confidenceScore: 0.8,
    scenarioName: "delhi-anand-vihar-calibrated",
  };
}
