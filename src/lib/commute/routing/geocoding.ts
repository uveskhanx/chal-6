import "server-only";
import { RoutePoint } from "../types";
import { logger } from "@/lib/logger";

export interface GeocodingResult {
  query: string;
  formattedAddress: string;
  point: RoutePoint;
  confidence: number;
  provider: "local_registry" | "osm_nominatim";
}

// High-precision geographic registry for Indian metropolitan transit hubs
const METRO_LOCATION_REGISTRY: Array<{
  aliases: string[];
  formattedAddress: string;
  lat: number;
  lon: number;
}> = [
  {
    aliases: ["anand vihar", "anand vihar isbt", "anand vihar dpcc", "anand vihar railway station"],
    formattedAddress: "Anand Vihar ISBT, East Delhi, 110092",
    lat: 28.6468,
    lon: 77.3160,
  },
  {
    aliases: ["connaught place", "cp", "rajiv chowk", "inner circle", "new delhi center"],
    formattedAddress: "Connaught Place, Central Delhi, New Delhi, 110001",
    lat: 28.6315,
    lon: 77.2167,
  },
  {
    aliases: ["indirapuram", "indirapuram ghaziabad", "ahinsa khand", "shipra sun city"],
    formattedAddress: "Indirapuram, Ghaziabad, Uttar Pradesh, 201014",
    lat: 28.6415,
    lon: 77.3712,
  },
  {
    aliases: ["noida sector 62", "sector 62 noida", "electronic city noida", "noida sec 62"],
    formattedAddress: "Sector 62, Noida, Gautam Buddha Nagar, Uttar Pradesh, 201309",
    lat: 28.6258,
    lon: 77.3628,
  },
  {
    aliases: ["cyber city", "dlf cyber city", "gurgaon cyber city", "cyber hub"],
    formattedAddress: "DLF Cyber City, DLF Phase 2, Gurugram, Haryana, 122002",
    lat: 28.4952,
    lon: 77.0895,
  },
  {
    aliases: ["hauz khas", "iit delhi", "hauz khas metro", "south delhi iit"],
    formattedAddress: "Hauz Khas / IIT Delhi, South Delhi, New Delhi, 110016",
    lat: 28.5494,
    lon: 77.1994,
  },
  {
    aliases: ["lodhi road", "cpcb head office", "india habitat centre", "lodhi colony"],
    formattedAddress: "Lodhi Road, New Delhi, 110003",
    lat: 28.5910,
    lon: 77.2270,
  },
  {
    aliases: ["rk puram", "r k puram", "rk puram sector 1", "south west delhi"],
    formattedAddress: "R K Puram, New Delhi, 110022",
    lat: 28.5633,
    lon: 77.1869,
  },
  {
    aliases: ["punjabi bagh", "punjabi bagh club", "west delhi"],
    formattedAddress: "Punjabi Bagh, West Delhi, New Delhi, 110026",
    lat: 28.6722,
    lon: 77.1310,
  },
  {
    aliases: ["igi airport", "delhi airport", "terminal 3", "t3 igi"],
    formattedAddress: "Indira Gandhi International Airport (DEL), New Delhi, 110037",
    lat: 28.5562,
    lon: 77.1000,
  },
  {
    aliases: ["bandra west", "bandra", "bandra bandstand", "mumbai bandra"],
    formattedAddress: "Bandra West, Mumbai, Maharashtra, 400050",
    lat: 19.0596,
    lon: 72.8295,
  },
  {
    aliases: ["nariman point", "marine drive", "fort mumbai", "churchgate"],
    formattedAddress: "Nariman Point, South Mumbai, Maharashtra, 400021",
    lat: 18.9256,
    lon: 72.8242,
  },
  {
    aliases: ["andheri east", "andheri", "andheri metro", "marol"],
    formattedAddress: "Andheri East, Mumbai, Maharashtra, 400069",
    lat: 19.1136,
    lon: 72.8697,
  },
];

/**
 * Geocodes an address or landmark into geographic coordinates.
 * Evaluates local high-precision registry first; falls back to OSM Nominatim if available.
 */
export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Check local authoritative registry
  for (const item of METRO_LOCATION_REGISTRY) {
    if (
      item.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized)) ||
      item.formattedAddress.toLowerCase().includes(normalized)
    ) {
      return {
        query,
        formattedAddress: item.formattedAddress,
        point: {
          lat: item.lat,
          lon: item.lon,
          name: item.formattedAddress.split(",")[0],
        },
        confidence: 0.98,
        provider: "local_registry",
      };
    }
  }

  // 2. Query OpenStreetMap Nominatim with strict timeout
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 1800);

    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1&countrycodes=in`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SaansAI-CommuteOptimizer/1.0 (Google Developers Challenge 6)",
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return {
            query,
            formattedAddress: first.display_name,
            point: {
              lat,
              lon,
              name: first.display_name.split(",")[0],
            },
            confidence: 0.85,
            provider: "osm_nominatim",
          };
        }
      }
    }
  } catch (error) {
    logger.warn("[Geocoding] OSM Nominatim geocoding lookup failed:", undefined, error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // 3. Fallback: If query contains "delhi" or looks like an address, return Delhi central anchor with note
  if (normalized.includes("delhi") || normalized.includes("noida") || normalized.includes("ghaziabad")) {
    return {
      query,
      formattedAddress: `${query} (Estimated Delhi NCR Corridor)`,
      point: {
        lat: 28.6315,
        lon: 77.2167,
        name: query,
      },
      confidence: 0.60,
      provider: "local_registry",
    };
  }

  return null;
}
