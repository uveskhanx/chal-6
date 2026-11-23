import "server-only";
import { RawPollutantReading, MonitoringStation, PollutantCode } from "../types";
import { env } from "../../env";
import { logger } from "@/lib/logger";

interface OpenAQLocationResult {
  id: number;
  name: string;
  locality?: string;
  country: { code: string; name: string };
  coordinates: { latitude: number; longitude: number };
  sensors?: { id: number; name: string; parameter: { id: number; name: string; units: string } }[];
  datetimeLast?: { utc: string; local: string };
}

interface OpenAQLatestMeasurement {
  sensorId: number;
  value: number;
  period: { datetimeFrom: { utc: string }; datetimeTo: { utc: string } };
  parameter: { name: string; units: string };
}

const OPENAQ_PARAM_MAP: Record<string, PollutantCode> = {
  pm25: "PM2.5",
  pm10: "PM10",
  no2: "NO2",
  so2: "SO2",
  co: "CO",
  o3: "O3",
  nh3: "NH3",
  pb: "Pb",
};

/**
 * OpenAQ v3 Provider Adapter.
 * Queries active Indian monitoring stations and their latest pollutant measurements.
 */
export async function fetchOpenAQData(
  latitude: number,
  longitude: number,
  radiusMeters: number = 25000
): Promise<{
  station: MonitoringStation;
  readings: RawPollutantReading[];
} | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (env.OPENAQ_API_KEY) {
    headers["X-API-Key"] = env.OPENAQ_API_KEY;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

    // Step 1: Query closest monitoring location in India
    const locationsUrl = `https://api.openaq.org/v3/locations?coordinates=${latitude},${longitude}&radius=${radiusMeters}&iso=IN&limit=3`;
    const locRes = await fetch(locationsUrl, {
      headers,
      signal: controller.signal,
      next: { revalidate: 900 },
    });

    if (!locRes.ok) {
      if (locRes.status === 429) {
        logger.warn("[OpenAQ v3] Rate limit exceeded (429). Triggering fallback.");
      }
      clearTimeout(timeoutId);
      return null;
    }

    const locJson = await locRes.json();
    const locations: OpenAQLocationResult[] = locJson.results;

    if (!Array.isArray(locations) || locations.length === 0) {
      clearTimeout(timeoutId);
      return null;
    }

    const targetLocation = locations[0];

    // Step 2: Query latest measurements for this location
    const latestUrl = `https://api.openaq.org/v3/locations/${targetLocation.id}/latest`;
    const latestRes = await fetch(latestUrl, {
      headers,
      signal: controller.signal,
      next: { revalidate: 900 },
    });

    clearTimeout(timeoutId);

    if (!latestRes.ok) {
      return null;
    }

    const latestJson = await latestRes.json();
    const measurements: OpenAQLatestMeasurement[] = latestJson.results || [];

    const readings: RawPollutantReading[] = [];

    for (const m of measurements) {
      const paramKey = m.parameter?.name?.toLowerCase().trim();
      const pollutantCode = OPENAQ_PARAM_MAP[paramKey];

      if (pollutantCode && Number.isFinite(m.value) && m.value >= 0) {
        readings.push({
          pollutant: pollutantCode,
          value: m.value,
          unit: m.parameter?.units || "µg/m³",
          timestamp: m.period?.datetimeTo?.utc || new Date().toISOString(),
          averagingHours: 18,
        });
      }
    }

    if (readings.length === 0) {
      return null;
    }

    const station: MonitoringStation = {
      id: `openaq_${targetLocation.id}`,
      name: targetLocation.name || `OpenAQ Station #${targetLocation.id}`,
      city: targetLocation.locality || "National Capital Region",
      state: "India",
      country: "IN",
      latitude: targetLocation.coordinates.latitude,
      longitude: targetLocation.coordinates.longitude,
      sourceProvider: "OPENAQ",
    };

    return { station, readings };
  } catch (error) {
    logger.warn("[OpenAQ v3 Provider] Request failed or timed out:", undefined, error);
    return null;
  }
}
