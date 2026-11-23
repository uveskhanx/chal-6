import "server-only";
import { NormalizedAirQualityReport } from "./types";
import { env } from "../env";
import { logger } from "@/lib/logger";

interface CacheEntry {
  data: NormalizedAirQualityReport;
  cachedAt: number;
  expiresAt: number;
}

// In-memory sliding cache with 15-minute TTL (900,000 ms)
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Generates spatial cache key by rounding coordinates to 2 decimal places (~1.1 km cell).
 */
export function getSpatialCacheKey(lat: number, lon: number): string {
  const roundedLat = lat.toFixed(2);
  const roundedLon = lon.toFixed(2);
  return `aqi:cell:${roundedLat}_${roundedLon}`;
}

export function getStationCacheKey(stationId: string): string {
  return `aqi:station:${stationId.toLowerCase().trim()}`;
}

/**
 * Retrieves cached air quality report if still fresh (<15 mins).
 */
export async function getCachedAQIReport(key: string): Promise<NormalizedAirQualityReport | null> {
  const now = Date.now();

  // 1. Check in-memory cache first
  const entry = memoryCache.get(key);
  if (entry) {
    if (now < entry.expiresAt) {
      return entry.data;
    } else {
      memoryCache.delete(key);
    }
  }

  // 2. Check Upstash Redis if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 400); // 400ms circuit breaker timeout

      const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        signal: controller.signal,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          const parsed = JSON.parse(json.result) as NormalizedAirQualityReport;
          // Store in local memory cache to reduce external Redis roundtrips
          memoryCache.set(key, { data: parsed, cachedAt: now, expiresAt: now + CACHE_TTL_MS });
          return parsed;
        }
      }
    } catch (error) {
      // Fail-open: Redis timeout or network error falls through silently to provider fetch
      logger.debug("[Cache] Upstash Redis read error:", { error: String(error) });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Stores normalized report in cache with 15-minute sliding TTL.
 */
export async function setCachedAQIReport(key: string, data: NormalizedAirQualityReport): Promise<void> {
  const now = Date.now();
  const entry: CacheEntry = {
    data,
    cachedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  };

  // 1. Store in memory
  memoryCache.set(key, entry);

  // 2. Store in Upstash Redis if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 400);

      await fetch(
        `${env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(
          JSON.stringify(data)
        )}?ex=900`,
        {
          headers: {
            Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          },
          signal: controller.signal,
        }
      );
    } catch (error) {
      // Fail-open: Redis timeout or network error should not block user experience
      logger.debug("[Cache] Upstash Redis write error:", { error: String(error) });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
