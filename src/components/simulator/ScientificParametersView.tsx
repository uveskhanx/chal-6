"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SimulationOutput } from "@/lib/simulator/types";

export interface ScientificParametersViewProps {
  simulation: SimulationOutput;
}

export function ScientificParametersView({ simulation }: ScientificParametersViewProps) {
  return (
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
            {"dC/dt = P · λ · C_out + S(t)/V - (λ + k_f + k_d) · C"}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
            <div className="border border-slate-200 dark:border-slate-800 rounded p-2.5 bg-slate-50/50 dark:bg-[#1E293B]/30">
              <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">Active Room Parameters:</div>
              <ul className="space-y-1 font-mono text-slate-600 dark:text-slate-300">
                <li>Volume (V): {simulation.parameters.roomVolumeM3} m³</li>
                <li>Floor Area: {simulation.parameters.floorAreaM2} m²</li>
                <li>Air Exchange (λ): {simulation.parameters.outdoorAirExchangeACH} ACH</li>
                <li>Envelope Penetration (P): {simulation.parameters.envelopePenetrationFactorPM25}</li>
                <li>Deposition Loss (k_d): {simulation.parameters.particleDepositionRatePM25} h⁻¹</li>
                <li>Purifier Rate (k_f): {simulation.parameters.purifierRemovalRate} h⁻¹</li>
                <li>Total Removal (K_total): {simulation.parameters.effectiveTotalRemovalRatePM25} h⁻¹</li>
              </ul>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded p-2.5 bg-slate-50/50 dark:bg-[#1E293B]/30">
              <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">Analytical Solution Formulation:</div>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Integrated analytically across discrete time intervals Δt:
              </p>
              <div className="bg-slate-100 dark:bg-[#1E293B] p-2 rounded font-mono text-[10px] text-slate-800 dark:text-slate-200">
                {"C(t + Δt) = C_ss + (C(t) - C_ss) · exp(-K_total · Δt)"}
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
  );
}
