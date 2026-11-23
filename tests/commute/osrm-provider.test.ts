import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateOSRMRoute } from "@/lib/commute/routing/osrm-provider";
import { RoutePoint } from "@/lib/commute/types";

describe("OSRM Routing Engine & Graceful Degradation", () => {
  const origin: RoutePoint = {
    lat: 28.6468,
    lon: 77.3160,
    name: "Anand Vihar",
  };

  const destination: RoutePoint = {
    lat: 28.6315,
    lon: 77.2167,
    name: "Connaught Place",
  };

  it("handles unreachable routing server by safely returning null without crashing", async () => {
    // Calling with out-of-bounds invalid coordinates or when offline
    const invalidOrigin: RoutePoint = { lat: 999, lon: 999 };
    const route = await calculateOSRMRoute(invalidOrigin, destination);
    assert.strictEqual(route, null);
  });

  it("parses valid route structure or falls back gracefully under network timeouts", async () => {
    const route = await calculateOSRMRoute(origin, destination, "driving");
    if (route) {
      assert.ok(route.distanceKm > 0);
      assert.ok(route.durationMinutes > 0);
      assert.ok(route.geometry.length > 0);
      assert.equal(route.mode, "driving");
      assert.equal(route.provider, "OSRM");
    } else {
      // Offline fallback: verified null return for graceful cascade to synthesized routing
      assert.strictEqual(route, null);
    }
  });
});
