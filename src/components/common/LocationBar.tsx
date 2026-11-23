"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MapPin, Navigation, Search, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CityOption {
  name: string;
  lat: number;
  lon: number;
  state: string;
}

export const POPULAR_CITIES: CityOption[] = [
  { name: "Delhi NCR", lat: 28.6139, lon: 77.2090, state: "Delhi" },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777, state: "Maharashtra" },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka" },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639, state: "West Bengal" },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867, state: "Telangana" },
  { name: "Chennai", lat: 13.0827, lon: 80.2707, state: "Tamil Nadu" },
  { name: "Pune", lat: 18.5204, lon: 73.8567, state: "Maharashtra" },
  { name: "Lucknow", lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh" },
  { name: "Jaipur", lat: 26.9124, lon: 75.7873, state: "Rajasthan" },
  { name: "Ahmedabad", lat: 23.0225, lon: 72.5714, state: "Gujarat" },
];

export function LocationBar({
  currentStationName,
  currentCity,
}: {
  currentStationName?: string;
  currentCity?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentLat = searchParams.get("lat");
  const currentLon = searchParams.get("lon");
  const currentCityParam = searchParams.get("city");

  const [isLocating, setIsLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeCityName, setActiveCityName] = useState<string>(
    currentCityParam || currentCity || (currentLat ? "Custom Location" : "Delhi NCR")
  );

  // Sync active city name when props change
  useEffect(() => {
    if (currentCityParam) {
      setActiveCityName(currentCityParam);
    } else if (currentCity) {
      setActiveCityName(currentCity);
    } else if (currentLat && currentLon) {
      const match = POPULAR_CITIES.find(
        (c) =>
          Math.abs(c.lat - parseFloat(currentLat)) < 0.15 &&
          Math.abs(c.lon - parseFloat(currentLon)) < 0.15
      );
      setActiveCityName(match ? match.name : "Detected GPS Location");
    }
  }, [currentCityParam, currentCity, currentLat, currentLon]);

  const handleSelectCity = (city: CityOption) => {
    setLocError(null);
    setActiveCityName(city.name);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lat", city.lat.toFixed(4));
    params.set("lon", city.lon.toFixed(4));
    params.set("city", city.name);
    params.delete("scenario"); // Clear any fixed scenario so live data is fetched
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        setActiveCityName("My Current GPS Location");

        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", latitude.toFixed(4));
        params.set("lon", longitude.toFixed(4));
        params.set("city", "Current Location");
        params.delete("scenario");
        router.push(`${pathname}?${params.toString()}`);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocError("Location access was denied. Please select your city below.");
        } else {
          setLocError("Could not determine your GPS location. Please choose a city below.");
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setLocError(null);

    try {
      // 1. Check local popular list first
      const matchedLocal = POPULAR_CITIES.find((c) =>
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
      if (matchedLocal) {
        handleSelectCity(matchedLocal);
        setSearchQuery("");
        setIsSearching(false);
        return;
      }

      // 2. Query free geocoding API
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchQuery.trim()
        )}&count=1&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const newCity: CityOption = {
            name: `${result.name}, ${result.admin1 || result.country}`,
            lat: result.latitude,
            lon: result.longitude,
            state: result.admin1 || "",
          };
          handleSelectCity(newCity);
          setSearchQuery("");
        } else {
          setLocError(`No location found for "${searchQuery}". Please check the spelling.`);
        }
      }
    } catch (error) {
      console.warn("[LocationBar] Geocoding lookup error:", error);
      setLocError("Geocoding lookup failed. Please pick a city from the list.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-2xs space-y-3">
      {/* Top Row: Active Location and GPS Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-400 shrink-0">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {activeCityName}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Telemetry
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm sm:max-w-md">
              {currentStationName || (currentLat && currentLon ? `${currentLat}° N, ${currentLon}° E` : "Real-time atmospheric station readings")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDetectLocation}
            disabled={isLocating}
            className="text-xs border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 h-8"
          >
            {isLocating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Detecting GPS...
              </>
            ) : (
              <>
                <Navigation className="h-3.5 w-3.5 mr-1.5 text-cyan-600 dark:text-cyan-400" />
                Use My Location
              </>
            )}
          </Button>

          {/* Quick Search Form */}
          <form onSubmit={handleSearchCity} className="relative flex items-center" role="search" aria-label="City search form">
            <input
              id="location-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any city..."
              aria-label="Search city or location"
              className="h-8 w-36 sm:w-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              aria-label="Submit search for city"
              className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {isSearching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {locError && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900">
          {locError}
        </div>
      )}

      {/* Quick Pick Popular Cities Row */}
      <div
        role="toolbar"
        aria-label="Quick-pick Indian metropolitan cities"
        className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]"
      >
        <span className="text-slate-400 dark:text-slate-500 text-[10px] font-semibold shrink-0 uppercase tracking-wider mr-1">
          Quick Pick:
        </span>
        {POPULAR_CITIES.map((city) => {
          const isSelected = activeCityName.includes(city.name);
          return (
            <button
              key={city.name}
              type="button"
              onClick={() => handleSelectCity(city)}
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                isSelected
                  ? "bg-cyan-600 text-white font-bold shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {isSelected && <Check className="inline h-3 w-3 mr-0.5" />}
              {city.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
