import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSpatialCacheKey,
  getStationCacheKey,
  getCachedAQIReport,
  setCachedAQIReport,
} from "@/lib/aqi/cache";
import { NormalizedAirQualityReport } from "@/lib/aqi/types";

describe("SaansAI Air Quality Caching Engine", () => {
  const sampleReport: NormalizedAirQualityReport = {
    station: {
      id: "DL_TEST_STATION",
      name: "Test Monitoring Station",
      city: "Delhi",
      state: "Delhi",
      country: "IN",
      latitude: 28.65,
      longitude: 77.25,
      sourceProvider: "CPCB",
    },
    calculatedAt: new Date().toISOString(),
    cpcbNAQI: 185,
    cpcbCategory: "Moderate",
    dominantPollutant: "PM2.5",
    isDataSufficient: true,
    dataSufficiencyNotes: "16-hr threshold met",
    hisi: 185,
    hisiCategory: "Moderate",
    pollutants: {
      "PM2.5": {
        code: "PM2.5",
        name: "Fine Particulate Matter",
        value: 78,
        unit: "µg/m³",
        rawUnit: "µg/m³",
        subIndex: 185,
        category: "Moderate",
        averagingPeriod: "24-hr",
        validHoursCount: 18,
        isDataSufficient: true,
        standardBenchmark: "CPCB: 60 µg/m³",
        observedAt: new Date().toISOString(),
        qualityScore: 1.0,
      },
      PM10: undefined,
      NO2: undefined,
      SO2: undefined,
      CO: undefined,
      O3: undefined,
      NH3: undefined,
      Pb: undefined,
    },
    weather: {
      temperatureC: 22,
      relativeHumidityPercent: 60,
      windSpeedKmh: 6,
      windDirectionDegrees: 280,
      windDirectionCardinal: "W",
      boundaryLayerHeightMeters: 450,
      isInversionActive: false,
      inversionRisk: "Low",
      observedAt: new Date().toISOString(),
    },
    provenance: {
      type: "OFFICIAL_CAAQMS",
      badgeText: "Official CAAQMS",
      source: "CPCB Network",
      freshnessMinutes: 10,
      confidenceScore: 0.95,
      isInterpolated: false,
      isDemo: false,
    },
    disclaimer: "Real-time telemetry normalized under Indian CPCB standards.",
  };

  it("generates deterministic spatial cache keys rounded to 2 decimal places", () => {
    const key1 = getSpatialCacheKey(28.6468, 77.3160);
    const key2 = getSpatialCacheKey(28.6471, 77.3159);
    assert.equal(key1, "aqi:cell:28.65_77.32");
    assert.equal(key2, "aqi:cell:28.65_77.32");
  });

  it("generates normalized lowercase station cache keys", () => {
    const key = getStationCacheKey("DL001_ANAND_VIHAR");
    assert.equal(key, "aqi:station:dl001_anand_vihar");
  });

  it("stores and retrieves reports from in-memory cache within TTL", async () => {
    const testKey = "aqi:test:in_memory_hit";
    await setCachedAQIReport(testKey, sampleReport);

    const retrieved = await getCachedAQIReport(testKey);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.cpcbNAQI, 185);
    assert.equal(retrieved.station.id, "DL_TEST_STATION");
  });

  it("returns null on cache miss for non-existent keys", async () => {
    const nonExistent = await getCachedAQIReport("aqi:test:completely_unknown_key_xyz");
    assert.strictEqual(nonExistent, null);
  });
});
