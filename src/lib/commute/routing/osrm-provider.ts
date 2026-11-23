import "server-only";
import { CalculatedRoute, RoutePoint, RouteSegment } from "../types";

/**
 * Open Source Routing Machine (OSRM) Public Provider
 * Queries actual road networks for turn-by-turn geometries, exact road distances, and durations.
 */
export async function calculateOSRMRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  profile: "driving" | "walking" | "cycling" = "driving"
): Promise<CalculatedRoute | null> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 4500);

    const endpoint = `https://router.project-osrm.org/route/v1/${profile}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SaansAI-CommuteOptimizer/1.0 (Google Developers Challenge 6)",
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const distanceMeters = route.distance || 0;
    const durationSeconds = route.duration || 0;
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    // OSRM GeoJSON geometry coordinates are [lon, lat] -> convert to [lat, lon]
    const rawCoords = route.geometry?.coordinates || [];
    const geometry: Array<[number, number]> = rawCoords.map((pt: [number, number]) => [pt[1], pt[0]]);

    // Extract segments from steps
    const segments: RouteSegment[] = [];
    const legs = route.legs || [];
    let segIdx = 0;

    for (const leg of legs) {
      const steps = leg.steps || [];
      for (const step of steps) {
        if (step.distance > 50) {
          const stepCoords = step.geometry?.coordinates || [];
          const startPt: RoutePoint = stepCoords.length > 0
            ? { lat: stepCoords[0][1], lon: stepCoords[0][0] }
            : origin;
          const endPt: RoutePoint = stepCoords.length > 1
            ? { lat: stepCoords[stepCoords.length - 1][1], lon: stepCoords[stepCoords.length - 1][0] }
            : destination;

          segments.push({
            index: segIdx++,
            start: startPt,
            end: endPt,
            distanceMeters: Math.round(step.distance),
            durationSeconds: Math.round(step.duration),
            instruction: step.maneuver?.instruction || step.name || "Follow road",
            roadName: step.name || "Connecting Road",
          });
        }
      }
    }

    // If no granular steps, fallback to single leg segment
    if (segments.length === 0) {
      segments.push({
        index: 0,
        start: origin,
        end: destination,
        distanceMeters,
        durationSeconds,
        instruction: "Follow standard arterial roadway to destination.",
        roadName: "Direct Road Link",
      });
    }

    return {
      id: `osrm_${profile}_${Date.now()}`,
      name: `${origin.name || "Origin"} to ${destination.name || "Destination"}`,
      summary: `via ${segments[0]?.roadName || "Road Network"} (${profile})`,
      origin,
      destination,
      distanceKm,
      durationMinutes,
      mode: profile,
      geometry,
      segments,
      provider: "OSRM",
      isEstimated: false,
      trafficAware: false,
    };
  } catch (error) {
    console.warn("[OSRM] Routing request failed:", error);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
