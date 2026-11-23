import { NextRequest, NextResponse } from "next/server";
import { SingleSimulationRequestSchema } from "@/lib/simulator/types";
import { runIndoorSimulation } from "@/lib/simulator/engine";
import { generateIndoorRecommendations } from "@/lib/simulator/recommendations";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = SingleSimulationRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "INVALID_SIMULATION_PARAMETERS",
          message: "Request failed validation.",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { room, outdoor, parameters } = validation.data;
    const simulation = runIndoorSimulation({ room, outdoor, parameters });
    const recommendations = generateIndoorRecommendations({ simulation, room, outdoor });

    return NextResponse.json({
      simulation,
      recommendations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal simulation engine error.";
    logger.error("[SimulatorAPI] Simulation error:", undefined, error);
    return NextResponse.json(
      {
        error: "SIMULATION_FAILED",
        message,
      },
      { status: 500 }
    );
  }
}
