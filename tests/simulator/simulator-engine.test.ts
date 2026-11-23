import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateRoomVolumeM3,
  calculateFloorAreaM2,
  runIndoorSimulation,
  stepAnalyticalConcentration,
} from "@/lib/simulator/engine";
import { RoomConfiguration, OutdoorConditions } from "@/lib/simulator/types";

describe("SaansAI Indoor Air Quality Simulation Engine", () => {
  const baseRoom: RoomConfiguration = {
    name: "Test Bedroom",
    roomType: "bedroom",
    dimensions: { lengthM: 4.0, widthM: 3.5, heightM: 3.0 }, // 42 m³
    occupantsCount: 2,
    infiltrationLevel: "standard_indian_apartment",
    ventilationMode: "closed_windows",
    windowOpeningFraction: 0,
    hasAirPurifier: true,
    purifierCADR: 250, // m³/h
    purifierFanSpeed: "medium", // 70% of 250 = 175 m³/h
    indoorSource: "none",
    indoorSourceStartMinute: 0,
    indoorSourceDurationMinutes: 0,
  };

  const baseOutdoor: OutdoorConditions = {
    pm25: 200,
    pm10: 300,
    isLive: false,
    isManualAssumption: false,
    sourceName: "CPCB Station",
    confidenceScore: 0.95,
  };

  describe("Room Geometry Calculations", () => {
    it("correctly computes room volume in cubic meters", () => {
      const volume = calculateRoomVolumeM3({ lengthM: 5.0, widthM: 4.0, heightM: 3.0 });
      assert.equal(volume, 60.0);
    });

    it("correctly computes floor area in square meters", () => {
      const area = calculateFloorAreaM2({ lengthM: 4.5, widthM: 3.2, heightM: 2.8 });
      assert.equal(area, 14.4);
    });
  });

  describe("Analytical Mathematical Model & Steady-State Verification", () => {
    it("approaches exact analytical steady-state C_ss under constant inputs", () => {
      // P = 0.70, λ = 0.95 h⁻¹, C_out = 200 µg/m³, S = 0
      // effectiveCADR = 250 * 0.70 = 175 m³/h
      // V = 42 m³ => k_f = 175 / 42 = 4.1667 h⁻¹
      // k_d = 0.24 h⁻¹
      // K_total = 0.95 + 4.1667 + 0.24 = 5.3567 h⁻¹
      // C_ss = (P * λ * C_out) / K_total = (0.7 * 0.95 * 200) / 5.3567 = 133 / 5.3567 ≈ 24.83 µg/m³
      const output = runIndoorSimulation({
        room: { ...baseRoom, initialIndoorPM25: 150 },
        outdoor: baseOutdoor,
        parameters: { durationHours: 6, timeStepMinutes: 2 },
      });

      const finalVal = output.metrics.finalPM25;
      const expectedCss = output.parameters.steadyStateConcentrationPM25;
      // After 6 hours (over 30 half-lives), final should be virtually identical to steady-state
      assert.ok(Math.abs(finalVal - expectedCss) < 1.0, `Expected final ${finalVal} to match Css ${expectedCss}`);
    });

    it("evaluates zero indoor emissions with purifier clearance", () => {
      const output = runIndoorSimulation({
        room: { ...baseRoom, indoorSource: "none", initialIndoorPM25: 200 },
        outdoor: baseOutdoor,
        parameters: { durationHours: 4, timeStepMinutes: 2 },
      });

      // Particulate concentration must decay downward
      assert.ok(output.metrics.finalPM25 < output.metrics.initialPM25);
      assert.ok(output.metrics.finalPM25 < 50);
    });

    it("correctly models acute burst emission from cooking (Tadka)", () => {
      const output = runIndoorSimulation({
        room: {
          ...baseRoom,
          indoorSource: "cooking_tadka", // 1,500 µg/min
          indoorSourceStartMinute: 20,
          indoorSourceDurationMinutes: 30,
          initialIndoorPM25: 30,
        },
        outdoor: baseOutdoor,
        parameters: { durationHours: 4, timeStepMinutes: 2 },
      });

      // Peak must be substantially higher than initial due to the 1500 µg/min emission
      assert.ok(output.metrics.peakPM25 > 150);
      // After emission stops, purifier and deposition should clean the air
      assert.ok(output.metrics.finalPM25 < output.metrics.peakPM25);
    });

    it("verifies filtration impact: enabled purifier vs. disabled purifier", () => {
      const withoutPurifier = runIndoorSimulation({
        room: { ...baseRoom, hasAirPurifier: false, purifierFanSpeed: "off", initialIndoorPM25: 150 },
        outdoor: baseOutdoor,
        parameters: { durationHours: 4, timeStepMinutes: 2 },
      });

      const withPurifier = runIndoorSimulation({
        room: { ...baseRoom, hasAirPurifier: true, purifierFanSpeed: "high", initialIndoorPM25: 150 },
        outdoor: baseOutdoor,
        parameters: { durationHours: 4, timeStepMinutes: 2 },
      });

      // Room with HEPA purifier must achieve significantly lower final and mean concentrations
      assert.ok(withPurifier.metrics.finalPM25 < withoutPurifier.metrics.finalPM25);
      assert.ok(withPurifier.metrics.averagePM25 < withoutPurifier.metrics.averagePM25);
      assert.ok(withPurifier.parameters.purifierRemovalRate > 0);
      assert.equal(withoutPurifier.parameters.purifierRemovalRate, 0);
    });

    it("verifies ventilation impact: open windows increases indoor smog during severe outdoor pollution", () => {
      const closed = runIndoorSimulation({
        room: { ...baseRoom, ventilationMode: "closed_windows", hasAirPurifier: false, initialIndoorPM25: 50 },
        outdoor: { ...baseOutdoor, pm25: 400 },
        parameters: { durationHours: 4, timeStepMinutes: 2 },
      });

      const open = runIndoorSimulation({
        room: { ...baseRoom, ventilationMode: "windows_open", hasAirPurifier: false, initialIndoorPM25: 50 },
        outdoor: { ...baseOutdoor, pm25: 400 },
        parameters: { durationHours: 4, timeStepMinutes: 2 },
      });

      // Open windows must drive concentration much higher toward outdoor 400 µg/m³
      assert.ok(open.metrics.finalPM25 > closed.metrics.finalPM25);
      assert.ok(open.parameters.outdoorAirExchangeACH > closed.parameters.outdoorAirExchangeACH);
    });

    it("guarantees numerical stability and non-negative bounds under extreme inputs", () => {
      const extreme = runIndoorSimulation({
        room: {
          ...baseRoom,
          indoorSource: "cooking_tadka",
          initialIndoorPM25: 0,
        },
        outdoor: { ...baseOutdoor, pm25: 1500 },
        parameters: { durationHours: 12, timeStepMinutes: 10 },
      });

      for (const p of extreme.timePoints) {
        assert.ok(p.indoorPM25 >= 0, "Indoor PM2.5 must never be negative");
        assert.ok(p.indoorPM10 >= 0, "Indoor PM10 must never be negative");
        assert.ok(!isNaN(p.indoorPM25));
        assert.ok(!isNaN(p.indoorPM10));
      }
    });

    it("verifies analytical ODE step function under zero loss, steady-state and non-finite inputs", () => {
      // 1. Zero removal rate kTotal = 0: simple linear accumulation
      const linearAccum = stepAnalyticalConcentration(100, 50, 0, 2); // 100 + 50 * 2 = 200
      assert.strictEqual(linearAccum, 200);

      // 2. Exact steady-state: when C(0) == C_ss, concentration remains unchanged
      const alpha = 100;
      const kTotal = 2; // C_ss = 50
      const atSteadyState = stepAnalyticalConcentration(50, alpha, kTotal, 1);
      assert.ok(Math.abs(atSteadyState - 50) < 1e-6);

      // 3. Non-finite inputs gracefully bounded to 0
      assert.strictEqual(stepAnalyticalConcentration(-10, alpha, kTotal, 1), 50 * (1 - Math.exp(-2)));
      assert.strictEqual(stepAnalyticalConcentration(NaN, alpha, kTotal, 1), 50 * (1 - Math.exp(-2)));
    });
  });
});
