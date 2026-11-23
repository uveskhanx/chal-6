"use client";

import React from "react";
import { Wind, Flame, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  RoomConfiguration,
  RoomType,
  InfiltrationLevel,
  VentilationMode,
  PurifierFanSpeed,
  IndoorSourceType,
  StoredRoom,
} from "@/lib/simulator/types";

export interface RoomConfigurationFormProps {
  room: RoomConfiguration;
  onChangeRoom: (updated: RoomConfiguration) => void;
  onSelectPreset: (type: RoomType) => void;
  onRunSimulation: () => void;
  onSaveRoom: () => void;
  isSimulating: boolean;
  saveSuccessMsg: string | null;
  savedRooms: StoredRoom[];
  floorAreaM2: number;
  volumeM3: number;
}

export function RoomConfigurationForm({
  room,
  onChangeRoom,
  onSelectPreset,
  onRunSimulation,
  onSaveRoom,
  isSimulating,
  saveSuccessMsg,
  savedRooms,
  floorAreaM2,
  volumeM3,
}: RoomConfigurationFormProps) {
  const roomTypes: RoomType[] = ["bedroom", "living_room", "kitchen", "classroom"];

  return (
    <div className="space-y-4">
      {savedRooms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Saved Rooms:</span>
          {savedRooms.map((sr) => (
            <button
              key={sr.id}
              type="button"
              onClick={() => onChangeRoom(sr.config)}
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

      {/* Step 1: Physical Space & Envelope */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Step 1 · Room Geometry
            </span>
            <div className="flex gap-1">
              {roomTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelectPreset(t)}
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
                  onChangeRoom({
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
                  onChangeRoom({
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
                  onChangeRoom({
                    ...room,
                    dimensions: { ...room.dimensions, heightM: parseFloat(e.target.value) || 2.0 },
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded font-mono text-xs focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded p-2 flex justify-between items-center text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              Floor Area: <strong className="text-slate-800 dark:text-slate-200">{floorAreaM2} m²</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Air Volume: <strong className="text-cyan-700 dark:text-cyan-400">{volumeM3} m³</strong>
            </span>
          </div>

          <div>
            <label htmlFor="room-infiltration-select" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Building Envelope Infiltration
            </label>
            <select
              id="room-infiltration-select"
              aria-label="Building Envelope Infiltration Level"
              value={room.infiltrationLevel}
              onChange={(e) =>
                onChangeRoom({ ...room, infiltrationLevel: e.target.value as InfiltrationLevel })
              }
              className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-[#0B1220] dark:text-slate-100 rounded text-xs bg-white focus:ring-1 focus:ring-cyan-500"
            >
              <option value="tight_seal">Tight Weatherstripping (λ = 0.35 ACH)</option>
              <option value="standard_indian_apartment">Standard Indian Apartment (λ = 0.95 ACH)</option>
              <option value="leaky_drafty">Drafty / Balcony Gaps (λ = 2.1 ACH)</option>
            </select>
          </div>

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
                onChangeRoom({ ...room, ventilationMode: e.target.value as VentilationMode })
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

      {/* Step 2: Filtration & Hardware */}
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
              onChange={(e) => onChangeRoom({ ...room, hasAirPurifier: e.target.checked })}
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
                  <label htmlFor="purifier-cadr-slider" className="font-semibold text-slate-600 dark:text-slate-300">
                    Certified CADR (Clean Air Volume)
                  </label>
                  <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">{room.purifierCADR} m³/h</span>
                </div>
                <input
                  id="purifier-cadr-slider"
                  type="range"
                  min="100"
                  max="800"
                  step="20"
                  value={room.purifierCADR}
                  onChange={(e) => onChangeRoom({ ...room, purifierCADR: parseInt(e.target.value) || 100 })}
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
                      onClick={() => onChangeRoom({ ...room, purifierFanSpeed: spd })}
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
              No air cleaner enabled. Room particulate removal will rely strictly on natural surface deposition (k_d).
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Internal Emission Sources */}
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
              onChange={(e) => onChangeRoom({ ...room, indoorSource: e.target.value as IndoorSourceType })}
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
                    onChangeRoom({ ...room, indoorSourceDurationMinutes: parseInt(e.target.value) || 30 })
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
                    onChangeRoom({ ...room, indoorSourceStartMinute: parseInt(e.target.value) || 0 })
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
          onClick={onRunSimulation}
          disabled={isSimulating}
          className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 py-2.5 shadow-sm"
        >
          <Play className="h-3.5 w-3.5" />
          <span>{isSimulating ? "Simulating..." : "Run Physics Simulation"}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSaveRoom}
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
  );
}
