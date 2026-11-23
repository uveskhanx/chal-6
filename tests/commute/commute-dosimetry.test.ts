import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateCommuteDosimetry } from "@/lib/commute/dosimetry";
import { MINUTE_VENTILATION_RATES, DEPOSITION_FRACTIONS } from "@/lib/commute/constants";

describe("SaansAI Commute Dosimetry & Physiological Model", () => {
  it("strictly implements the fundamental continuous dosimetry integral D = ∫ C(t) * V_E(t) dt", () => {
    // 388 µg/m³ ambient, 30 mins, Sedentary (0.008 m³/min), Open vehicle (P_v = 1.0), No mask
    const result = calculateCommuteDosimetry({
      distanceKm: 12.8,
      durationMinutes: 30,
      mode: "two_wheeler",
      activityProfile: "sedentary",
      ambientPM25: 388,
      maskType: "NONE",
      customPenetrationFactor: 1.0,
    });

    // Inhaled mass = 388 ug/m3 * 0.008 m3/min * 30 min = 93.12 ug
    assert.equal(result.inhaledMassPM25Ug, 93.1);

    // Deposited dose = Inhaled * DF_nominal (0.28) = 93.12 * 0.28 = 26.07 ug
    assert.equal(result.depositedDosePM25Ug, 26.1);
  });

  it("evaluates minute ventilation scaling across physical exertion levels", () => {
    assert.equal(MINUTE_VENTILATION_RATES.sedentary.m3PerMin, 0.008);
    assert.equal(MINUTE_VENTILATION_RATES.moderate.m3PerMin, 0.024); // Walking (3x sedentary)
    assert.equal(MINUTE_VENTILATION_RATES.intense.m3PerMin, 0.036);  // Cycling (4.5x sedentary)

    const walkResult = calculateCommuteDosimetry({
      distanceKm: 4.8,
      durationMinutes: 60,
      mode: "walking",
      activityProfile: "moderate",
      ambientPM25: 200,
      maskType: "NONE",
    });

    // Walking: 200 ug/m3 * 0.024 m3/min * 60 min = 288 ug inhaled
    assert.equal(walkResult.inhaledMassPM25Ug, 288.0);
    assert.equal(walkResult.depositedDosePM25Ug, Number((288 * 0.28).toFixed(1)));
  });

  it("computes ICRP 66 physiological deposition uncertainty bounds", () => {
    const result = calculateCommuteDosimetry({
      distanceKm: 10,
      durationMinutes: 30,
      mode: "auto_rickshaw",
      ambientPM25: 300,
      maskType: "NONE",
    });

    assert.ok(result.doseRangePM25Ug[0] < result.depositedDosePM25Ug);
    assert.ok(result.doseRangePM25Ug[1] > result.depositedDosePM25Ug);
    assert.equal(result.depositionFractionPM25, DEPOSITION_FRACTIONS.pm25.nominal);
  });

  it("verifies N95 respirator 95% particulate filtration reduction", () => {
    const unmasked = calculateCommuteDosimetry({
      distanceKm: 10,
      durationMinutes: 30,
      mode: "auto_rickshaw",
      ambientPM25: 350,
      maskType: "NONE",
    });

    const n95Masked = calculateCommuteDosimetry({
      distanceKm: 10,
      durationMinutes: 30,
      mode: "auto_rickshaw",
      ambientPM25: 350,
      maskType: "N95",
    });

    // N95 slashes inhaled mass by 95%
    assert.ok(n95Masked.inhaledMassPM25Ug < unmasked.inhaledMassPM25Ug * 0.06);
    assert.ok(n95Masked.depositedDosePM25Ug < unmasked.depositedDosePM25Ug * 0.06);
    assert.equal(n95Masked.effectiveMaskFiltration, 95);
  });

  it("safely handles numerical boundaries, zero duration, and non-finite inputs", () => {
    const zeroDuration = calculateCommuteDosimetry({
      distanceKm: 0,
      durationMinutes: 0,
      mode: "metro_underground",
      ambientPM25: 100,
      maskType: "NONE",
    });

    assert.ok(Number.isFinite(zeroDuration.inhaledMassPM25Ug));
    assert.ok(Number.isFinite(zeroDuration.depositedDosePM25Ug));
    assert.ok(zeroDuration.inhaledMassPM25Ug >= 0);

    const negativeAmbient = calculateCommuteDosimetry({
      distanceKm: 5,
      durationMinutes: 20,
      mode: "walking",
      ambientPM25: -50,
      maskType: "NONE",
    });

    assert.strictEqual(negativeAmbient.inhaledMassPM25Ug, 0);
    assert.strictEqual(negativeAmbient.depositedDosePM25Ug, 0);
    assert.strictEqual(negativeAmbient.timeWeightedAveragePM25, 0);
  });
});
