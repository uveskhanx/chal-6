import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getUserPreferences,
  updateUserPreferences,
  resetUserPreferences,
} from "@/lib/agent/user-store";

describe("SaansAI User Store — Defensive Isolation & Immutability", () => {
  const testUserId = "user_defensive_test";

  beforeEach(() => {
    resetUserPreferences(testUserId);
  });

  it("returns default preferences for a new user", () => {
    const prefs = getUserPreferences(testUserId);
    assert.strictEqual(prefs.preferredTime, "morning");
    assert.strictEqual(prefs.locationType, "balanced");
    assert.strictEqual(prefs.commuteMode, "public_transit");
    assert.strictEqual(prefs.activityType, "walking");
    assert.strictEqual(prefs.sensitivity, "standard");
  });

  it("prevents store mutation via returned reference", () => {
    const prefs1 = getUserPreferences(testUserId);
    // Mutate the local object
    (prefs1 as unknown as { preferredTime: string }).preferredTime = "night";

    // Re-fetch preferences
    const prefs2 = getUserPreferences(testUserId);
    assert.strictEqual(
      prefs2.preferredTime,
      "morning",
      "Store must not be mutated by external modification of returned object"
    );
  });

  it("persists updates when valid partial preferences are supplied", () => {
    const updateResult = updateUserPreferences(testUserId, {
      preferredTime: "evening",
      commuteMode: "public_transit",
    });

    assert.strictEqual(updateResult.success, true);
    assert.strictEqual(updateResult.preferences.preferredTime, "evening");
    assert.strictEqual(updateResult.preferences.commuteMode, "public_transit");

    const fetched = getUserPreferences(testUserId);
    assert.strictEqual(fetched.preferredTime, "evening");
    assert.strictEqual(fetched.commuteMode, "public_transit");
  });

  it("rejects invalid preference values via schema validation", () => {
    // @ts-expect-error - testing invalid runtime input
    const invalidResult = updateUserPreferences(testUserId, { preferredTime: "midnight" });
    assert.strictEqual(invalidResult.success, false);
    assert.ok(invalidResult.error);

    // Ensure store was not modified
    const current = getUserPreferences(testUserId);
    assert.strictEqual(current.preferredTime, "morning");
  });

  it("resets preferences to clean defaults without leaking references", () => {
    updateUserPreferences(testUserId, { sensitivity: "vulnerable_household" });
    const reset = resetUserPreferences(testUserId);
    assert.strictEqual(reset.sensitivity, "standard");

    const fetched = getUserPreferences(testUserId);
    assert.strictEqual(fetched.sensitivity, "standard");
  });
});
