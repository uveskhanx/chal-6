import "server-only";
import { PollutantCode, RawPollutantReading, MonitoringStation } from "./types";
import { calculateHaversineDistanceKm } from "./providers/cpcb";

export interface StationWithReadings {
  station: MonitoringStation;
  readings: RawPollutantReading[];
}

const CRITERIA_POLLUTANT_CODES: readonly PollutantCode[] = [
  "PM2.5",
  "PM10",
  "NO2",
  "SO2",
  "CO",
  "O3",
  "NH3",
  "Pb",
] as const;

/**
 * Pure Deterministic Inverse Distance Weighting (IDW) with power parameter p = 2.
 * Interpolates pollutant concentrations for target coordinates from nearest active stations.
 */
export function interpolateSpatialAQI(
  targetLat: number,
  targetLon: number,
  candidateStations: StationWithReadings[],
  maxDistanceKm: number = 30,
  maxNeighbors: number = 3
): {
  interpolatedReadings: RawPollutantReading[];
  usedStationsCount: number;
  averageDistanceKm: number;
} | null {
  // Step 1: Calculate distances to all candidate stations
  const stationsWithDist = candidateStations
    .map((item) => ({
      ...item,
      distanceKm: calculateHaversineDistanceKm(
        targetLat,
        targetLon,
        item.station.latitude,
        item.station.longitude
      ),
    }))
    .filter((item) => item.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (stationsWithDist.length === 0) {
    return null;
  }

  // If closest station is within 100 meters, return its readings directly
  if (stationsWithDist[0].distanceKm < 0.1) {
    return {
      interpolatedReadings: stationsWithDist[0].readings,
      usedStationsCount: 1,
      averageDistanceKm: stationsWithDist[0].distanceKm,
    };
  }

  // Take k nearest neighbors
  const nearest = stationsWithDist.slice(0, maxNeighbors);
  const interpolatedReadings: RawPollutantReading[] = [];

  for (const pollutant of CRITERIA_POLLUTANT_CODES) {
    let weightSum = 0;
    let weightedValueSum = 0;
    let sampleCount = 0;
    let unit = "µg/m³";

    for (const item of nearest) {
      const reading = item.readings.find((r) => r.pollutant === pollutant);
      if (reading && Number.isFinite(reading.value) && reading.value >= 0) {
        // IDW weight w_i = 1 / d_i^2 with numerical floor
        const safeDist = Math.max(0.05, item.distanceKm);
        const weight = 1 / (safeDist * safeDist);
        weightSum += weight;
        weightedValueSum += weight * reading.value;
        unit = reading.unit;
        sampleCount++;
      }
    }

    if (sampleCount > 0 && weightSum > 0) {
      const interpolatedValue = Number((weightedValueSum / weightSum).toFixed(1));
      interpolatedReadings.push({
        pollutant,
        value: interpolatedValue,
        unit,
        timestamp: new Date().toISOString(),
        averagingHours: 18,
      });
    }
  }

  const avgDistance =
    nearest.reduce((acc, curr) => acc + curr.distanceKm, 0) / nearest.length;

  return {
    interpolatedReadings,
    usedStationsCount: nearest.length,
    averageDistanceKm: Number(avgDistance.toFixed(2)),
  };
}
