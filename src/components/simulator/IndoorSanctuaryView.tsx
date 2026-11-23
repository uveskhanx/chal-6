"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  Layers,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { IndoorHacksPanel } from "./IndoorHacksPanel";
import { RoomConfigurationForm } from "./RoomConfigurationForm";
import { SimulationMetricsBar } from "./SimulationMetricsBar";
import { ScientificParametersView } from "./ScientificParametersView";
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
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <RoomConfigurationForm
            room={room}
            savedRooms={savedRooms}
            isSimulating={isSimulating}
            saveSuccessMsg={saveSuccessMsg}
            onChangeRoom={setRoom}
            onSelectPreset={selectRoomPreset}
            onRunSimulation={() => handleRunSimulation()}
            onSaveRoom={handleSaveRoom}
            floorAreaM2={floorAreaM2}
            volumeM3={volumeM3}
          />

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
              <SimulationMetricsBar
                metrics={simulation.metrics}
                parameters={simulation.parameters}
              />
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
        <ScientificParametersView simulation={simulation} />
      )}
    </div>
  );
}
