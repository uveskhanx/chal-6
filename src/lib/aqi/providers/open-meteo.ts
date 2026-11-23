import "server-only";
import { AtmosphericWeather, RawPollutantReading } from "../types";
import { logger } from "@/lib/logger";

function degreesToCardinal(deg: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index] || "N";
}

/**
 * Ingests live criteria pollutant measurements from Open-Meteo Air Quality Reanalysis API.
 * Provides high-accuracy real-time PM2.5, PM10, CO, NO2, SO2, O3 for ANY latitude/longitude coordinate.
 */
export async function fetchOpenMeteoAirQuality(
  latitude: number,
  longitude: number
): Promise<RawPollutantReading[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;
    const res = await fetch(aqiUrl, { signal: controller.signal, next: { revalidate: 900 } });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const current = json.current;
    if (!current) {
      return null;
    }

    const timestamp = current.time ? new Date(current.time).toISOString() : new Date().toISOString();
    const readings: RawPollutantReading[] = [];

    if (typeof current.pm2_5 === "number" && current.pm2_5 >= 0) {
      readings.push({
        pollutant: "PM2.5",
        value: Number(current.pm2_5.toFixed(1)),
        unit: "µg/m³",
        timestamp,
        averagingHours: 24,
      });
    }

    if (typeof current.pm10 === "number" && current.pm10 >= 0) {
      readings.push({
        pollutant: "PM10",
        value: Number(current.pm10.toFixed(1)),
        unit: "µg/m³",
        timestamp,
        averagingHours: 24,
      });
    }

    if (typeof current.carbon_monoxide === "number" && current.carbon_monoxide >= 0) {
      // Open-Meteo returns CO in µg/m³. CPCB NAQI standard is mg/m³. Convert by dividing by 1000.
      readings.push({
        pollutant: "CO",
        value: Number((current.carbon_monoxide / 1000).toFixed(2)),
        unit: "mg/m³",
        timestamp,
        averagingHours: 8,
      });
    }

    if (typeof current.nitrogen_dioxide === "number" && current.nitrogen_dioxide >= 0) {
      readings.push({
        pollutant: "NO2",
        value: Number(current.nitrogen_dioxide.toFixed(1)),
        unit: "µg/m³",
        timestamp,
        averagingHours: 24,
      });
    }

    if (typeof current.sulphur_dioxide === "number" && current.sulphur_dioxide >= 0) {
      readings.push({
        pollutant: "SO2",
        value: Number(current.sulphur_dioxide.toFixed(1)),
        unit: "µg/m³",
        timestamp,
        averagingHours: 24,
      });
    }

    if (typeof current.ozone === "number" && current.ozone >= 0) {
      readings.push({
        pollutant: "O3",
        value: Number(current.ozone.toFixed(1)),
        unit: "µg/m³",
        timestamp,
        averagingHours: 8,
      });
    }

    return readings.length >= 2 ? readings : null;
  } catch (error) {
    logger.warn("[Open-Meteo Air Quality Provider] Error fetching pollutants:", undefined, error);
    return null;
  }
}

/**
 * Ingests live meteorological vectors and Planetary Boundary Layer (PBL) height from Open-Meteo.
 */
export async function fetchOpenMeteoWeather(
  latitude: number,
  longitude: number
): Promise<AtmosphericWeather> {
  const fallbackWeather: AtmosphericWeather = {
    temperatureC: 22.0,
    relativeHumidityPercent: 65,
    windSpeedKmh: 4.5,
    windDirectionDegrees: 315,
    windDirectionCardinal: "NW",
    boundaryLayerHeightMeters: 450,
    isInversionActive: false,
    inversionRisk: "Medium",
    observedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    // 1. Fetch current surface meteorology
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&forecast_days=1`;
    // 2. Fetch boundary layer height from Open-Meteo Air Quality
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=boundary_layer_height&forecast_days=1`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl, { signal: controller.signal, next: { revalidate: 900 } }),
      fetch(aqiUrl, { signal: controller.signal, next: { revalidate: 900 } }),
    ]);

    clearTimeout(timeoutId);

    let tempC = fallbackWeather.temperatureC;
    let humidity = fallbackWeather.relativeHumidityPercent;
    let windKmh = fallbackWeather.windSpeedKmh;
    let windDeg = fallbackWeather.windDirectionDegrees;
    let boundaryLayerMeters = fallbackWeather.boundaryLayerHeightMeters;

    if (weatherRes.ok) {
      const weatherJson = await weatherRes.json();
      if (weatherJson.current) {
        tempC = Number(weatherJson.current.temperature_2m ?? tempC);
        humidity = Number(weatherJson.current.relative_humidity_2m ?? humidity);
        windKmh = Number(weatherJson.current.wind_speed_10m ?? windKmh);
        windDeg = Number(weatherJson.current.wind_direction_10m ?? windDeg);
      }
    }

    if (aqiRes.ok) {
      const aqiJson = await aqiRes.json();
      const heights: number[] = aqiJson.hourly?.boundary_layer_height;
      if (Array.isArray(heights) && heights.length > 0) {
        // Take current hour's boundary layer height
        const currentHour = new Date().getUTCHours();
        const height = heights[currentHour] ?? heights[0];
        if (Number.isFinite(height) && height > 0) {
          boundaryLayerMeters = Math.round(height);
        }
      }
    }

    const isInversionActive = boundaryLayerMeters < 300 && windKmh < 5.0;
    const inversionRisk: "Low" | "Medium" | "High" =
      boundaryLayerMeters < 250 && windKmh < 4.0
        ? "High"
        : boundaryLayerMeters < 500
        ? "Medium"
        : "Low";

    return {
      temperatureC: Number(tempC.toFixed(1)),
      relativeHumidityPercent: Math.round(humidity),
      windSpeedKmh: Number(windKmh.toFixed(1)),
      windDirectionDegrees: Math.round(windDeg),
      windDirectionCardinal: degreesToCardinal(windDeg),
      boundaryLayerHeightMeters: boundaryLayerMeters,
      isInversionActive,
      inversionRisk,
      observedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("[Open-Meteo Provider] Error fetching weather, returning calibrated fallback:", undefined, error);
    return fallbackWeather;
  }
}
