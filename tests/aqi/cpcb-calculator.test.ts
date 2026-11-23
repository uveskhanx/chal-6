import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePollutantSubIndex,
  getAQICategory,
  calculateCompositeCPCB_NAQI,
  calculateHISI,
  CPCB_BENCHMARKS,
} from "@/lib/aqi/cpcb-calculator";
import { PollutantDetail, PollutantCode } from "@/lib/aqi/types";

describe("CPCB Calculator — Statutory NAQI Engine", () => {
  describe("Breakpoint Sub-Index Calculation", () => {
    it("correctly computes PM2.5 sub-index across breakpoints", () => {
      // 0 - 30 -> 0 - 50 (Good)
      const res0 = calculatePollutantSubIndex("PM2.5", 15);
      assert.ok(res0);
      assert.equal(res0.subIndex, 25);
      assert.equal(res0.category, "Good");

      // 31 - 60 -> 51 - 100 (Satisfactory)
      const res1 = calculatePollutantSubIndex("PM2.5", 60);
      assert.ok(res1);
      assert.equal(res1.subIndex, 100);
      assert.equal(res1.category, "Satisfactory");

      // 61 - 90 -> 101 - 200 (Moderate)
      const res2 = calculatePollutantSubIndex("PM2.5", 75);
      assert.ok(res2);
      assert.equal(res2.subIndex, 149);
      assert.equal(res2.category, "Moderate");

      // 121 - 250 -> 301 - 400 (Very Poor)
      const res3 = calculatePollutantSubIndex("PM2.5", 250);
      assert.ok(res3);
      assert.equal(res3.subIndex, 400);
      assert.equal(res3.category, "Very Poor");

      // 251 - 500 -> 401 - 500 (Severe)
      const res4 = calculatePollutantSubIndex("PM2.5", 380);
      assert.ok(res4);
      assert.equal(res4.category, "Severe");
      assert.ok(res4.subIndex > 400 && res4.subIndex <= 500);
    });

    it("correctly handles concentration cap for extreme smog (Severe > 500)", () => {
      const resCapped = calculatePollutantSubIndex("PM2.5", 750);
      assert.ok(resCapped);
      assert.equal(resCapped.subIndex, 500);
      assert.equal(resCapped.category, "Severe");
    });

    it("returns null for negative or non-finite concentrations", () => {
      assert.equal(calculatePollutantSubIndex("PM2.5", -5), null);
      assert.equal(calculatePollutantSubIndex("PM2.5", NaN), null);
      assert.equal(calculatePollutantSubIndex("PM2.5", Infinity), null);
    });

    it("correctly computes 8-hr pollutants (CO, O3)", () => {
      // CO: 0 - 1.0 -> 0 - 50 (Good)
      const coGood = calculatePollutantSubIndex("CO", 0.5);
      assert.ok(coGood);
      assert.equal(coGood.category, "Good");

      // CO: 1.1 - 2.0 -> 51 - 100 (Satisfactory)
      const coSat = calculatePollutantSubIndex("CO", 2.0);
      assert.ok(coSat);
      assert.equal(coSat.subIndex, 100);
      assert.equal(coSat.category, "Satisfactory");

      // O3: 0 - 50 -> 0 - 50 (Good)
      const o3Good = calculatePollutantSubIndex("O3", 30);
      assert.ok(o3Good);
      assert.equal(o3Good.subIndex, 30);
      assert.equal(o3Good.category, "Good");
    });

    it("handles continuous floating point concentrations without gap anomalies", () => {
      // Continuous float test: 30.4 -> rounds to 30 -> Good
      const resBelow = calculatePollutantSubIndex("PM2.5", 30.4);
      assert.ok(resBelow);
      assert.equal(resBelow.category, "Good");

      // Continuous float test: 30.5 -> rounds to 31 -> Satisfactory
      const resAbove = calculatePollutantSubIndex("PM2.5", 30.5);
      assert.ok(resAbove);
      assert.equal(resAbove.category, "Satisfactory");

      // CO 1.04 -> rounds to 1.0 -> Good
      const coBelow = calculatePollutantSubIndex("CO", 1.04);
      assert.ok(coBelow);
      assert.equal(coBelow.category, "Good");

      // CO 1.06 -> rounds to 1.1 -> Satisfactory
      const coAbove = calculatePollutantSubIndex("CO", 1.06);
      assert.ok(coAbove);
      assert.equal(coAbove.category, "Satisfactory");
    });
  });

  describe("AQI Category Mapping", () => {
    it("maps scores to statutory CPCB category bands", () => {
      assert.equal(getAQICategory(35), "Good");
      assert.equal(getAQICategory(75), "Satisfactory");
      assert.equal(getAQICategory(150), "Moderate");
      assert.equal(getAQICategory(260), "Poor");
      assert.equal(getAQICategory(380), "Very Poor");
      assert.equal(getAQICategory(450), "Severe");
      assert.equal(getAQICategory(500), "Severe");
    });
  });

  describe("Composite Statutory CPCB NAQI Calculation", () => {
    const createMockDetail = (
      code: PollutantCode,
      subIndex: number | null,
      isDataSufficient: boolean
    ): PollutantDetail => ({
      code,
      name: code,
      value: 100,
      unit: "µg/m³",
      rawUnit: "µg/m³",
      subIndex,
      category: subIndex !== null ? getAQICategory(subIndex) : null,
      averagingPeriod: CPCB_BENCHMARKS[code as keyof typeof CPCB_BENCHMARKS]?.period || "24-hour",
      validHoursCount: isDataSufficient ? 18 : 10,
      isDataSufficient,
      standardBenchmark: "CPCB Standard",
      observedAt: new Date().toISOString(),
      qualityScore: 90,
    });

    it("returns Insufficient Data when fewer than 3 pollutants are monitored", () => {
      const result = calculateCompositeCPCB_NAQI({
        "PM2.5": createMockDetail("PM2.5", 350, true),
        PM10: createMockDetail("PM10", 280, true),
      });

      assert.equal(result.aqi, null);
      assert.equal(result.category, "Insufficient Data");
      assert.equal(result.isDataSufficient, false);
      assert.match(result.notes, /requires at least 3 valid pollutants/);
    });

    it("returns Insufficient Data when 3 pollutants exist but none is particulate (PM2.5 or PM10)", () => {
      const result = calculateCompositeCPCB_NAQI({
        NO2: createMockDetail("NO2", 150, true),
        SO2: createMockDetail("SO2", 80, true),
        CO: createMockDetail("CO", 60, true),
      });

      assert.equal(result.aqi, null);
      assert.equal(result.category, "Insufficient Data");
      assert.equal(result.isDataSufficient, false);
      assert.match(result.notes, /requires at least one particulate pollutant/);
    });

    it("ignores pollutants with insufficient data (<16 hrs for 24-hr standards)", () => {
      const result = calculateCompositeCPCB_NAQI({
        "PM2.5": createMockDetail("PM2.5", 420, true), // Valid
        PM10: createMockDetail("PM10", 350, false), // Invalid (insufficient hours)
        NO2: createMockDetail("NO2", 180, true), // Valid
        SO2: createMockDetail("SO2", 70, false), // Invalid
      });

      // Only 2 valid pollutants (PM2.5, NO2), so must fail minimum 3 rule
      assert.equal(result.aqi, null);
      assert.equal(result.isDataSufficient, false);
    });

    it("computes composite NAQI as maximum sub-index when all statutory criteria are met", () => {
      const result = calculateCompositeCPCB_NAQI({
        "PM2.5": createMockDetail("PM2.5", 440, true), // Highest
        PM10: createMockDetail("PM10", 380, true),
        NO2: createMockDetail("NO2", 190, true),
        SO2: createMockDetail("SO2", 95, true),
        CO: createMockDetail("CO", 120, true),
      });

      assert.equal(result.aqi, 440);
      assert.equal(result.category, "Severe");
      assert.equal(result.dominantPollutant, "PM2.5");
      assert.equal(result.isDataSufficient, true);
    });
  });

  describe("Hourly Instantaneous Smog Indicator (HISI)", () => {
    it("calculates acute 1-hour smog indicator from PM2.5 and PM10", () => {
      // Acute 1-hour PM2.5 = 180 µg/m³ (Very Poor)
      const res = calculateHISI(180, 220);
      assert.ok(res.hisi > 300);
      assert.equal(res.category, "Very Poor");
    });

    it("handles missing or single-pollutant hourly values safely", () => {
      const resOnlyPM25 = calculateHISI(45, undefined);
      assert.equal(resOnlyPM25.category, "Satisfactory");

      const resZero = calculateHISI(undefined, undefined);
      assert.equal(resZero.hisi, 0);
      assert.equal(resZero.category, "Good");
    });
  });
});
