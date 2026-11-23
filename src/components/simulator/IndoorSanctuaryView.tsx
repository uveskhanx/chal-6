"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  Wind,
  Flame,
  Layers,
  Save,
  ChevronRight,
  ExternalLink,
  Wrench,
} from "lucide-react";
import { IndoorHacksPanel } from "./IndoorHacksPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiUrl } from "@/lib/api-client";
import {
  RoomConfiguration,
  OutdoorConditions,
  SimulationOutput,
  IndoorActionRecommendation,
  MultiScenarioComparisonOutput,
  RoomType,
  VentilationMode,
  InfiltrationLevel,
  IndoorSourceType,
  PurifierFanSpeed,
  StoredRoom,
} from "@/lib/simulator/types";
import { DEFAULT_ROOM_PROFILES } from "@/lib/simulator/constants";
import { RoomSchematic } from "./RoomSchematic";
import { SimulationChart } from "./SimulationChart";
import { ScenarioComparisonChart } from "./ScenarioComparisonChart";

interface IndoorSanctuaryViewProps {
  initialScenarioKey?: string;
}

export function IndoorSanctuaryView({ initialScenarioKey = "delhi-anand-vihar" }: IndoorSanctuaryViewProps) {
  // 1. Room Configuration State
  const [room, setRoom] = useState<RoomConfiguration>(DEFAULT_ROOM_PROFILES.default_bedroom);
  const [savedRooms, setSavedRooms] = useState<StoredRoom[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 2. Outdoor Conditions State
  const [outdoor, setOutdoor] = useState<OutdoorConditions>({
    pm25: initialScenarioKey === "mumbai-bandra" ? 42 : 388,
    pm10: initialScenarioKey === "mumbai-bandra" ? 65 : 540,
    isLive: false,
    isManualAssumption: false,
    sourceName: initialScenarioKey === "mumbai-bandra" ? "Bandra CAAQMS (MPCB)" : "Anand Vihar CAAQMS (DPCC)",
    confidenceScore: 0.9,
    scenarioName: initialScenarioKey,
  });

  // 3. Simulation Parameters & Results State
  const [durationHours, setDurationHours] = useState(4);
  const [simulation, setSimulation] = useState<SimulationOutput | null>(null);
  const [recommendations, setRecommendations] = useState<IndoorActionRecommendation[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentScrubPoint, setCurrentScrubPoint] = useState<number | null>(null);

  // 4. Scenario Comparison State
  const [activeTab, setActiveTab] = useState<"simulator" | "compare" | "recommendations" | "hacks" | "parameters">("simulator");
  const [selectedPreset, setSelectedPreset] = useState<string>("winter_smog_defense");
  const [comparison, setComparison] = useState<MultiScenarioComparisonOutput | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Load Saved Rooms on Mount
  const loadSavedRooms = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/simulator/rooms?userId=user_default"));
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) setSavedRooms(data.rooms);
      }
    } catch (err) {
      console.warn("Failed to load saved rooms:", err);
    }
  }, []);

  // Run Simulation Function
  const handleRunSimulation = useCallback(
    async (targetRoom = room, targetOutdoor = outdoor, dur = durationHours) => {
      setIsSimulating(true);
      try {
        const res = await fetch(apiUrl("/api/simulator/simulate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room: targetRoom,
            outdoor: targetOutdoor,
            parameters: { durationHours: dur, timeStepMinutes: 2 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSimulation(data.simulation);
          setRecommendations(data.recommendations || []);
        }
      } catch (err) {
        console.error("Simulation request failed:", err);
      } finally {
        setIsSimulating(false);
      }
    },
    [room, outdoor, durationHours]
  );

  // Run Scenario Comparison Function
  const handleRunComparison = useCallback(
    async (presetKey = selectedPreset) => {
      setIsComparing(true);
      try {
        const res = await fetch(apiUrl("/api/simulator/compare"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baselineRoom: room,
            outdoor,
            presetKey,
            parameters: { durationHours, timeStepMinutes: 2 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setComparison(data.comparison);
        }
      } catch (err) {
        console.error("Comparison request failed:", err);
      } finally {
        setIsComparing(false);
      }
    },
    [room, outdoor, selectedPreset, durationHours]
  );

  // Initial Load
  const initialFetchDone = React.useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    loadSavedRooms();
    handleRunSimulation();

    // Fetch live local outdoor air quality dynamically
    const fetchLiveOutdoor = async () => {
      try {
        const res = await fetch(apiUrl("/api/aqi/live"));
        if (res.ok) {
          const liveReport = await res.json();
          const pm25 = liveReport.pollutants?.["PM2.5"]?.value;
          const pm10 = liveReport.pollutants?.["PM10"]?.value;
          if (typeof pm25 === "number" && pm25 > 0) {
            const liveOutdoor: OutdoorConditions = {
              pm25,
              pm10: pm10 ?? pm25 * 1.3,
              isLive: true,
              isManualAssumption: false,
              sourceName: liveReport.station?.name || "Live Atmospheric Grid",
              confidenceScore: 0.95,
              scenarioName: "live",
            };
            setOutdoor(liveOutdoor);
            handleRunSimulation(room, liveOutdoor, durationHours);
          }
        }
      } catch (err) {
        console.warn("Could not fetch live outdoor conditions:", err);
      }
    };
    fetchLiveOutdoor();
  }, [loadSavedRooms, handleRunSimulation, room, durationHours]);

  // Handle Preset Room Selection
  const selectRoomPreset = (type: RoomType) => {
    let preset = DEFAULT_ROOM_PROFILES.default_bedroom;
    if (type === "living_room") preset = DEFAULT_ROOM_PROFILES.default_living_room;
    if (type === "kitchen") preset = DEFAULT_ROOM_PROFILES.default_kitchen;
    if (type === "classroom") {
      preset = {
        name: "Standard Classroom",
        roomType: "classroom",
        dimensions: { lengthM: 8.0, widthM: 6.0, heightM: 3.2 },
        occupantsCount: 30,
        infiltrationLevel: "leaky_drafty",
        ventilationMode: "closed_windows",
        windowOpeningFraction: 0,
        hasAirPurifier: true,
        purifierCADR: 600,
        purifierFanSpeed: "high",
        indoorSource: "none",
        indoorSourceStartMinute: 0,
        indoorSourceDurationMinutes: 0,
      };
    }
    if (type === "office") {
      preset = {
        name: "Open Work Office",
        roomType: "office",
        dimensions: { lengthM: 10.0, widthM: 7.0, heightM: 3.0 },
        occupantsCount: 15,
        infiltrationLevel: "standard_indian_apartment",
        ventilationMode: "mechanical_filtered",
        windowOpeningFraction: 0,
        hasAirPurifier: true,
        purifierCADR: 750,
        purifierFanSpeed: "medium",
        indoorSource: "none",
        indoorSourceStartMinute: 0,
        indoorSourceDurationMinutes: 0,
      };
    }

    setRoom(preset);
    handleRunSimulation(preset, outdoor, durationHours);
  };

  // Save Room Configuration
  const handleSaveRoom = async () => {
    try {
      const res = await fetch(apiUrl("/api/simulator/rooms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_default", room }),
      });
      if (res.ok) {
        setSaveSuccessMsg("Room saved to profile!");
        loadSavedRooms();
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.warn("Failed to save room:", err);
    }
  };

  // Dimensions & Volume Calculation
  const volumeM3 =
    Math.round(room.dimensions.lengthM * room.dimensions.widthM * room.dimensions.heightM * 10) / 10;
  const floorAreaM2 = Math.round(room.dimensions.lengthM * room.dimensions.widthM * 10) / 10;

  const currentDisplayPM25 =
    currentScrubPoint !== null
      ? currentScrubPoint
      : simulation?.metrics.finalPM25 ?? room.initialIndoorPM25 ?? outdoor.pm25 * 0.7;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Indoor Air Sanctuary Simulator
            </h1>
            <Badge variant="outline" className="text-cyan-700 bg-cyan-50 border-cyan-200 text-xs">
              Mass-Balance Physics Engine
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Model how outdoor winter smog enters indoor spaces, how internal cooking and incense create acute spikes,
            and how HEPA filtration clears particles based on differential mass-balance kinetics.
          </p>
        </div>

        {/* Outdoor Conditions Indicator */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <label htmlFor="outdoor-baseline-select" className="block text-[10px] uppercase font-bold text-slate-400">Outdoor Baseline</label>
            <select
              id="outdoor-baseline-select"
              aria-label="Outdoor air quality baseline scenario"
              value={outdoor.scenarioName || "live"}
              onChange={(e) => {
                const sc = e.target.value;
                let newOutdoor: OutdoorConditions;
                if (sc === "mumbai-bandra") {
                  newOutdoor = {
                    pm25: 68,
                    pm10: 74,
                    isLive: true,
                    isManualAssumption: false,
                    sourceName: "Mumbai CAAQMS",
                    confidenceScore: 0.95,
                    scenarioName: "mumbai-bandra",
                  };
                } else if (sc === "bengaluru") {
                  newOutdoor = {
                    pm25: 52,
                    pm10: 56,
                    isLive: true,
                    isManualAssumption: false,
                    sourceName: "Bengaluru CAAQMS",
                    confidenceScore: 0.95,
                    scenarioName: "bengaluru",
                  };
                } else if (sc === "severe_smog") {
                  newOutdoor = {
                    pm25: 388,
                    pm10: 540,
                    isLive: false,
                    isManualAssumption: true,
                    sourceName: "Severe Smog Inversion Episode",
                    confidenceScore: 0.9,
                    scenarioName: "severe_smog",
                  };
                } else {
                  // Live Local Ambient
                  newOutdoor = {
                    pm25: outdoor.pm25,
                    pm10: outdoor.pm10,
                    isLive: true,
                    isManualAssumption: false,
                    sourceName: outdoor.sourceName,
                    confidenceScore: 0.95,
                    scenarioName: "live",
                  };
                }
                setOutdoor(newOutdoor);
                handleRunSimulation(room, newOutdoor, durationHours);
              }}
              className="text-xs font-bold text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-white dark:bg-[#1E293B] cursor-pointer"
            >
              <option value="live">📍 Live Ambient ({Math.round(outdoor.pm25)} µg/m³)</option>
              <option value="bengaluru">Bengaluru Moderate (52 µg/m³)</option>
              <option value="mumbai-bandra">Mumbai Coastal Air (68 µg/m³)</option>
              <option value="severe_smog">Severe Smog Episode (388 µg/m³)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tabbed Navigation */}
      <div role="tablist" aria-label="Indoor air simulation perspectives" className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-semibold">
        <button
          type="button"
          role="tab"
          id="tab-sim-simulator"
          aria-selected={activeTab === "simulator"}
          aria-controls="panel-sim-simulator"
          onClick={() => setActiveTab("simulator")}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === "simulator"
              ? "border-b-2 border-cyan-600 text-cyan-700 dark:text-cyan-400 dark:border-cyan-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Sliders className="h-4 w-4" aria-hidden="true" />
          <span>Interactive Simulator</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-sim-compare"
          aria-selected={activeTab === "compare"}
          aria-controls="panel-sim-compare"
          onClick={() => {
            setActiveTab("compare");
            if (!comparison) handleRunComparison();
          }}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === "compare"
              ? "border-b-2 border-cyan-600 text-cyan-700 dark:text-cyan-400 dark:border-cyan-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" aria-hidden="true" />
          <span>Scenario Comparison Lab</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-sim-recommendations"
          aria-selected={activeTab === "recommendations"}
          aria-controls="panel-sim-recommendations"
          onClick={() => setActiveTab("recommendations")}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === "recommendations"
              ? "border-b-2 border-cyan-600 text-cyan-700 dark:text-cyan-400 dark:border-cyan-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>Grounded Action Plan ({recommendations.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-sim-hacks"
          aria-selected={activeTab === "hacks"}
          aria-controls="panel-sim-hacks"
          onClick={() => setActiveTab("hacks")}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === "hacks"
              ? "border-b-2 border-cyan-600 text-cyan-700 dark:text-cyan-400 dark:border-cyan-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          <span>Practical Indoor Hacks (6)</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-sim-parameters"
          aria-selected={activeTab === "parameters"}
          aria-controls="panel-sim-parameters"
          onClick={() => setActiveTab("parameters")}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === "parameters"
              ? "border-b-2 border-cyan-600 text-cyan-700 dark:text-cyan-400 dark:border-cyan-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
          <span>Scientific Model & Citations</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INTERACTIVE SIMULATOR                             */}
      {/* ======================================================== */}
      {activeTab === "simulator" && (
        <div id="panel-sim-simulator" role="tabpanel" aria-labelledby="tab-sim-simulator" className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Room Geometry & Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {savedRooms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Saved Rooms:</span>
                {savedRooms.map((sr) => (
                  <button
                    key={sr.id}
                    type="button"
                    onClick={() => {
                      setRoom(sr.config);
                      handleRunSimulation(sr.config, outdoor, durationHours);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      room.id === sr.id
                        ? "bg-cyan-600 text-white"
                        : "bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E293B]"
                    }`}
                  >
                    {sr.config.name}
                  </button>
                ))}
              </div>
            )}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Step 1 · Room Geometry
                  </span>
                  <div className="flex gap-1">
                    {(["bedroom", "living_room", "kitchen", "classroom"] as RoomType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => selectRoomPreset(t)}
                        className={`text-[10px] px-2 py-0.5 rounded capitalize transition-colors ${
                          room.roomType === t
                            ? "bg-cyan-600 text-white font-bold"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {t.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <CardTitle className="text-base">Physical Space & Envelope</CardTitle>
                <CardDescription className="text-xs">
                  Configure metric dimensions and building leakage characteristics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                {/* Length, Width, Height */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="room-length-input" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Length (m)
                    </label>
                    <input
                      id="room-length-input"
                      type="number"
                      step="0.1"
                      min="1.5"
                      max="20"
                      aria-label="Room length in meters"
                      value={room.dimensions.lengthM}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          dimensions: { ...room.dimensions, lengthM: parseFloat(e.target.value) || 1.5 },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded font-mono text-xs focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="room-width-input" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Width (m)
                    </label>
                    <input
                      id="room-width-input"
                      type="number"
                      step="0.1"
                      min="1.5"
                      max="20"
                      aria-label="Room width in meters"
                      value={room.dimensions.widthM}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          dimensions: { ...room.dimensions, widthM: parseFloat(e.target.value) || 1.5 },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded font-mono text-xs focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="room-height-input" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Height (m)
                    </label>
                    <input
                      id="room-height-input"
                      type="number"
                      step="0.1"
                      min="2.0"
                      max="6.0"
                      aria-label="Room height in meters"
                      value={room.dimensions.heightM}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          dimensions: { ...room.dimensions, heightM: parseFloat(e.target.value) || 2.0 },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded font-mono text-xs focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Auto Calculated Volume Badge */}
                <div className="bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded p-2 flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Floor Area: <strong className="text-slate-800 dark:text-slate-200">{floorAreaM2} m²</strong></span>
                  <span className="text-slate-500 dark:text-slate-400">Air Volume: <strong className="text-cyan-700 dark:text-cyan-400">{volumeM3} m³</strong></span>
                </div>

                {/* Building Infiltration Level */}
                <div>
                  <label htmlFor="room-infiltration-select" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Building Envelope Infiltration
                  </label>
                  <select
                    id="room-infiltration-select"
                    aria-label="Building Envelope Infiltration Level"
                    value={room.infiltrationLevel}
                    onChange={(e) =>
                      setRoom({ ...room, infiltrationLevel: e.target.value as InfiltrationLevel })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded text-xs bg-white focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="tight_seal">Tight Weatherstripping (λ = 0.35 ACH)</option>
                    <option value="standard_indian_apartment">Standard Indian Apartment (λ = 0.95 ACH)</option>
                    <option value="leaky_drafty">Drafty / Balcony Gaps (λ = 2.1 ACH)</option>
                  </select>
                </div>

                {/* Window & Ventilation Mode */}
                <div>
                  <label htmlFor="room-ventilation-select" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>Window & Ventilation State</span>
                    <Wind className="h-3 w-3 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                  </label>
                  <select
                    id="room-ventilation-select"
                    aria-label="Window and ventilation state"
                    value={room.ventilationMode}
                    onChange={(e) =>
                      setRoom({ ...room, ventilationMode: e.target.value as VentilationMode })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded text-xs bg-white focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="closed_windows">Windows Closed & Latched (P = 0.70)</option>
                    <option value="window_ajar">Window Ajar 25% (P = 0.90, λ = 2.8 ACH)</option>
                    <option value="windows_open">Windows Wide Open (P = 1.00, λ = 6.5 ACH)</option>
                    <option value="mechanical_filtered">Mechanical HVAC (MERV/HEPA Filtered Intake)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Hardware & Purifier Config */}
            <Card>
              <CardHeader className="pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Step 2 · Filtration & Hardware
                </span>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>HEPA Air Purifier</span>
                  <input
                    type="checkbox"
                    checked={room.hasAirPurifier}
                    onChange={(e) => setRoom({ ...room, hasAirPurifier: e.target.checked })}
                    aria-label="Enable HEPA air purifier"
                    className="h-4 w-4 text-cyan-600 rounded border-slate-300 dark:border-slate-700 focus:ring-cyan-500"
                  />
                </CardTitle>
                <CardDescription className="text-xs">
                  Clean Air Delivery Rate (CADR) determines mechanical particle clearance kinetics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                {room.hasAirPurifier ? (
                  <>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <label htmlFor="purifier-cadr-slider" className="font-semibold text-slate-600 dark:text-slate-300">Certified CADR (Clean Air Volume)</label>
                        <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">{room.purifierCADR} m³/h</span>
                      </div>
                      <input
                        id="purifier-cadr-slider"
                        type="range"
                        min="100"
                        max="800"
                        step="20"
                        value={room.purifierCADR}
                        onChange={(e) => setRoom({ ...room, purifierCADR: parseInt(e.target.value) || 100 })}
                        aria-label="Certified CADR Clean Air Delivery Rate"
                        aria-valuenow={room.purifierCADR}
                        aria-valuemin={100}
                        aria-valuemax={800}
                        className="w-full accent-cyan-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>Compact (150 m³/h)</span>
                        <span>Standard (300 m³/h)</span>
                        <span>Heavy-Duty (600+ m³/h)</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Operating Fan Speed
                      </span>
                      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Operating fan speed">
                        {(["low", "medium", "high", "turbo"] as PurifierFanSpeed[]).map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            role="radio"
                            aria-checked={room.purifierFanSpeed === spd}
                            onClick={() => setRoom({ ...room, purifierFanSpeed: spd })}
                            className={`py-1 text-[11px] rounded capitalize font-medium transition-colors ${
                              room.purifierFanSpeed === spd
                                ? "bg-cyan-600 text-white font-bold"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {spd}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900 rounded p-2 text-[11px] text-cyan-900 dark:text-cyan-300 flex justify-between">
                      <span>Air Changes per Hour (ACH):</span>
                      <strong className="font-mono">
                        {volumeM3 > 0 ? (Math.round((room.purifierCADR / volumeM3) * 10) / 10).toFixed(1) : "0"} ACH
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-[#1E293B]/40 border border-slate-200 dark:border-slate-800 rounded text-center text-slate-500 dark:text-slate-400 text-xs">
                    No air cleaner enabled. Room particulate removal will rely strictly on natural surface deposition ($k_d$).
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Indoor Pollution Source */}
            <Card>
              <CardHeader className="pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Step 3 · Internal Emission Sources</span>
                  <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                </span>
                <CardTitle className="text-base">Household Emission Scenarios</CardTitle>
                <CardDescription className="text-xs">
                  Simulate transient indoor particle generation (cooking, incense, or coils).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <label htmlFor="indoor-source-select" className="sr-only">Indoor emission source</label>
                  <select
                    id="indoor-source-select"
                    aria-label="Household emission source scenario"
                    value={room.indoorSource}
                    onChange={(e) => setRoom({ ...room, indoorSource: e.target.value as IndoorSourceType })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded text-xs bg-white focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="none">No Indoor Emission Source</option>
                    <option value="cooking_tadka">Indian Cooking: Tadka / Deep Frying (+1500 µg/min)</option>
                    <option value="incense_agarbatti">Incense Stick: Agarbatti (+450 µg/min)</option>
                    <option value="mosquito_coil">Mosquito Repellent Coil (+650 µg/min)</option>
                    <option value="candle">Scented Paraffin Candle (+90 µg/min)</option>
                    <option value="smoking">Tobacco Cigarette Smoke (+2000 µg/min)</option>
                  </select>
                </div>

                {room.indoorSource !== "none" && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label htmlFor="emission-duration-select" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Emission Duration
                      </label>
                      <select
                        id="emission-duration-select"
                        aria-label="Emission duration in minutes"
                        value={room.indoorSourceDurationMinutes}
                        onChange={(e) =>
                          setRoom({ ...room, indoorSourceDurationMinutes: parseInt(e.target.value) || 30 })
                        }
                        className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded text-xs bg-white"
                      >
                        <option value={15}>15 Minutes (Brief)</option>
                        <option value={30}>30 Minutes (Standard)</option>
                        <option value={60}>60 Minutes (Prolonged)</option>
                        <option value={120}>120 Minutes (Continuous)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="emission-start-minute-input" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Start At Minute
                      </label>
                      <input
                        id="emission-start-minute-input"
                        type="number"
                        min="0"
                        max="240"
                        step="5"
                        aria-label="Emission start minute"
                        value={room.indoorSourceStartMinute}
                        onChange={(e) =>
                          setRoom({ ...room, indoorSourceStartMinute: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Run & Save Actions */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => handleRunSimulation()}
                disabled={isSimulating}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 py-2.5 shadow-sm"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{isSimulating ? "Simulating..." : "Run Physics Simulation"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveRoom}
                className="text-xs border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Room</span>
              </Button>
            </div>
            {saveSuccessMsg && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded text-xs text-center font-medium">
                {saveSuccessMsg}
              </div>
            )}
          </div>

          {/* Right Column: Visual Schematic, Simulation Graph & Metrics (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Visual Isometric Room Representation */}
            <RoomSchematic
              roomType={room.roomType}
              lengthM={room.dimensions.lengthM}
              widthM={room.dimensions.widthM}
              heightM={room.dimensions.heightM}
              volumeM3={volumeM3}
              ventilationMode={room.ventilationMode}
              infiltrationLevel={room.infiltrationLevel}
              hasAirPurifier={room.hasAirPurifier}
              purifierCADR={room.purifierCADR}
              purifierFanSpeed={room.purifierFanSpeed}
              indoorSource={room.indoorSource}
              currentPM25={currentDisplayPM25}
            />

            {/* Key Simulation Outcome KPI Cards */}
            {simulation && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Initial PM2.5</div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                    {simulation.metrics.initialPM25} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">µg/m³</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Peak Surge</div>
                  <div className="text-base font-bold text-orange-600 dark:text-orange-400 font-mono mt-0.5">
                    {simulation.metrics.peakPM25} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">µg/m³</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Final Equilibrium</div>
                  <div className="text-base font-bold text-cyan-700 dark:text-cyan-400 font-mono mt-0.5">
                    {simulation.metrics.finalPM25} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">µg/m³</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Settling Half-Life</div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                    {simulation.parameters.halfLifeSettlingTimeMinutes} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">min</span>
                  </div>
                </div>
              </div>
            )}

            {/* Time-Series Simulation Graph */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Indoor Particulate Decay & Concentration Curve
                  </CardTitle>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <label htmlFor="sim-duration-select">Duration:</label>
                    <select
                      id="sim-duration-select"
                      aria-label="Simulation duration hours"
                      value={durationHours}
                      onChange={(e) => {
                        const dur = parseInt(e.target.value) || 4;
                        setDurationHours(dur);
                        handleRunSimulation(room, outdoor, dur);
                      }}
                      className="px-1.5 py-0.5 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-[#1E293B] font-mono text-[11px] text-slate-900 dark:text-slate-100"
                    >
                      <option value={2}>2 Hours</option>
                      <option value={4}>4 Hours</option>
                      <option value={8}>8 Hours</option>
                      <option value={12}>12 Hours</option>
                    </select>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {"Calculated using dC/dt = P·λ·C_out + S(t)/V - K_total·C."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {simulation ? (
                  <SimulationChart
                    timePoints={simulation.timePoints}
                    durationHours={durationHours}
                    onHoverPoint={(p) => setCurrentScrubPoint(p ? p.indoorPM25 : null)}
                  />
                ) : (
                  <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
                    Running simulation engine...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Link to AI Assistant */}
            <div className="bg-gradient-to-r from-cyan-900 to-slate-900 text-white rounded-lg p-3.5 flex items-center justify-between gap-4 shadow-sm">
              <div>
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ask SaansAI About This Simulation</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Our agent uses the verified <code className="text-cyan-200 font-mono text-[10px]">simulate_indoor_air_quality</code> tool
                  to analyze your room and give customized advice.
                </p>
              </div>
              <Link href={`/assistant?q=${encodeURIComponent(`How can I improve the air quality in my ${room.roomType}? Current outdoor PM2.5 is ${outdoor.pm25} µg/m³.`)}`}>
                <Button size="sm" variant="secondary" className="text-xs shrink-0 flex items-center gap-1">
                  <span>Chat with Agent</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SCENARIO COMPARISON LAB                           */}
      {/* ======================================================== */}
      {activeTab === "compare" && (
        <div id="panel-sim-compare" role="tabpanel" aria-labelledby="tab-sim-compare" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Scenario Comparison Matrix</CardTitle>
                  <CardDescription className="text-xs">
                    Compare multiple interventions side-by-side from identical starting conditions using deterministic physics.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="preset-comparison-select" className="sr-only">Preset scenario comparison</label>
                  <select
                    id="preset-comparison-select"
                    aria-label="Preset scenario comparison selection"
                    value={selectedPreset}
                    onChange={(e) => {
                      setSelectedPreset(e.target.value);
                      handleRunComparison(e.target.value);
                    }}
                    className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded text-xs bg-white dark:bg-[#1E293B] dark:text-slate-100 font-medium"
                  >
                    <option value="winter_smog_defense">Preset: Purifier Filtration Impact</option>
                    <option value="ventilation_dilemma">Preset: Windows Closed vs. Open</option>
                    <option value="indoor_cooking_surge">Preset: Kitchen Tadka Surge</option>
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunComparison()}
                    disabled={isComparing}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    <span>Rerun</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparison ? (
                <>
                  <div className="bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900 rounded-lg p-3 text-xs text-cyan-900 dark:text-cyan-300 font-medium">
                    <span className="font-bold text-cyan-950 dark:text-cyan-200">Key Finding: </span>
                    {comparison.keyTakeaway}
                  </div>

                  <ScenarioComparisonChart
                    scenarios={comparison.scenarios}
                    durationHours={durationHours}
                  />

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">Scientific Assumptions:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {comparison.scientificCaveats.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
                  Running scenario comparison...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: EVIDENCE-BASED ACTION RECOMMENDATIONS             */}
      {/* ======================================================== */}
      {activeTab === "recommendations" && (
        <div id="panel-sim-recommendations" role="tabpanel" aria-labelledby="tab-sim-recommendations" className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Prioritized Action Plan for {room.name || room.roomType}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every suggestion connects directly to your simulation inputs, outdoor smog levels, and statutory guidance.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {recommendations.length} Recommendations Generated
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map((rec) => (
              <Card key={rec.id} className="border-slate-200 dark:border-slate-800 shadow-2xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] uppercase font-bold ${
                        rec.priority === "critical"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          : rec.priority === "high"
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300"
                          : "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300"
                      }`}
                    >
                      {rec.priority} Priority
                    </Badge>
                    <span className="text-[10px] text-slate-400 capitalize">{rec.category.replace("_", " ")}</span>
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{rec.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p className="text-slate-700 dark:text-slate-200 font-medium">{rec.actionRequired}</p>

                  <div className="bg-slate-50 dark:bg-[#1E293B]/60 rounded p-2 text-[11px] space-y-1 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Physical Evidence: </span>
                      {rec.simulationEvidence}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Expected Benefit: </span>
                      {rec.expectedImpact}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Uncertainty Note: </span>
                      {rec.remainingUncertainty}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Basis: {rec.basis}</span>
                    <span className="italic">{rec.citationSource}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PRACTICAL INDOOR HACKS                            */}
      {/* ======================================================== */}
      {activeTab === "hacks" && (
        <div id="panel-sim-hacks" role="tabpanel" aria-labelledby="tab-sim-hacks">
          <IndoorHacksPanel />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: SCIENTIFIC MODEL & CITATIONS                      */}
      {/* ======================================================== */}
      {activeTab === "parameters" && simulation && (
        <div id="panel-sim-parameters" role="tabpanel" aria-labelledby="tab-sim-parameters" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mass-Balance Differential Equation</CardTitle>
              <CardDescription className="text-xs">
                Mathematical specification governing the SaansAI indoor particulate simulation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="bg-slate-900 dark:bg-slate-950 text-cyan-300 font-mono p-3.5 rounded-lg text-sm overflow-x-auto border border-slate-800">
                $$\frac&#123;dC&#125;&#123;dt&#125; = P \cdot \lambda \cdot C_&#123;\text&#123;out&#125;&#125; + \frac&#123;S(t)&#125;&#123;V&#125; - (\lambda + k_f + k_d) \cdot C$$
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
                <div className="border border-slate-200 dark:border-slate-800 rounded p-2.5 bg-slate-50/50 dark:bg-[#1E293B]/30">
                  <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">Active Room Parameters:</div>
                  <ul className="space-y-1 font-mono text-slate-600 dark:text-slate-300">
                    <li>Volume ($V$): {simulation.parameters.roomVolumeM3} m³</li>
                    <li>Floor Area: {simulation.parameters.floorAreaM2} m²</li>
                    <li>Air Exchange ($\lambda$): {simulation.parameters.outdoorAirExchangeACH} ACH</li>
                    <li>Envelope Penetration ($P$): {simulation.parameters.envelopePenetrationFactorPM25}</li>
                    <li>Deposition Loss ($k_d$): {simulation.parameters.particleDepositionRatePM25} h⁻¹</li>
                    <li>Purifier Rate ($k_f$): {simulation.parameters.purifierRemovalRate} h⁻¹</li>
                    <li>Total Removal ($K_&#123;\text&#123;total&#125;&#125;$): {simulation.parameters.effectiveTotalRemovalRatePM25} h⁻¹</li>
                  </ul>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded p-2.5 bg-slate-50/50 dark:bg-[#1E293B]/30">
                  <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">Analytical Solution Formulation:</div>
                  <p className="text-slate-600 dark:text-slate-300 mb-2">
                    Integrated analytically across discrete time intervals $\Delta t$:
                  </p>
                  <div className="bg-slate-100 dark:bg-[#1E293B] p-2 rounded font-mono text-[10px] text-slate-800 dark:text-slate-200">
                    $C(t + \Delta t) = C_&#123;\text&#123;ss&#125;&#125; + (C(t) - C_&#123;\text&#123;ss&#125;&#125;) e^&#123;-K_&#123;\text&#123;total&#125;&#125; \Delta t&#125;$
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                    Guarantees absolute numerical stability, conservation of mass, and non-negative particle bounds.
                  </p>
                </div>
              </div>

              {/* Citations Table */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-2">Traceable Scientific Citations</h3>
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-[#1E293B] text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2">Parameter</th>
                        <th className="p-2">Value</th>
                        <th className="p-2">Source / Organization</th>
                        <th className="p-2">Official Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {simulation.citations.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{c.parameter}</td>
                          <td className="p-2 font-mono text-cyan-800 dark:text-cyan-400">{c.value}</td>
                          <td className="p-2">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                              {c.sourceOrganization}
                            </span>
                          </td>
                          <td className="p-2 text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <span>{c.citationTitle}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
