"use client";

import React from "react";
import { SimulationMetrics, InspectableModelParameters } from "@/lib/simulator/types";

export interface SimulationMetricsBarProps {
  metrics: SimulationMetrics;
  parameters: InspectableModelParameters;
}

export function SimulationMetricsBar({ metrics, parameters }: SimulationMetricsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
        <div className="text-[10px] text-slate-400 font-semibold uppercase">Initial PM2.5</div>
        <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
          {metrics.initialPM25} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">µg/m³</span>
        </div>
      </div>
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
        <div className="text-[10px] text-slate-400 font-semibold uppercase">Peak Surge</div>
        <div className="text-base font-bold text-orange-600 dark:text-orange-400 font-mono mt-0.5">
          {metrics.peakPM25} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">µg/m³</span>
        </div>
      </div>
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
        <div className="text-[10px] text-slate-400 font-semibold uppercase">Final Equilibrium</div>
        <div className="text-base font-bold text-cyan-700 dark:text-cyan-400 font-mono mt-0.5">
          {metrics.finalPM25} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">µg/m³</span>
        </div>
      </div>
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
        <div className="text-[10px] text-slate-400 font-semibold uppercase">Settling Half-Life</div>
        <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
          {parameters.halfLifeSettlingTimeMinutes} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">min</span>
        </div>
      </div>
    </div>
  );
}
