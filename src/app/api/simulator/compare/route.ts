import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  RoomConfigurationSchema,
  OutdoorConditionsSchema,
  SimulationParametersSchema,
} from "@/lib/simulator/types";
import {
  compareIndoorScenarios,
  PRESET_SCENARIO_COMPARISONS,
} from "@/lib/simulator/scenarios";
import { logger } from "@/lib/logger";

const CompareRequestSchema = z.object({
  baselineRoom: RoomConfigurationSchema,
  outdoor: OutdoorConditionsSchema,
  presetKey: z.string().optional(),
  alternativeScenarios: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
        roomOverrides: RoomConfigurationSchema.partial(),
      })
    )
    .optional(),
  parameters: SimulationParametersSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = CompareRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "INVALID_COMPARISON_PARAMETERS",
          message: "Request failed validation.",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { baselineRoom, outdoor, presetKey, alternativeScenarios, parameters } =
      validation.data;

    let scenariosToRun = alternativeScenarios || [];

    // If preset requested, load preset definitions
    if (presetKey && PRESET_SCENARIO_COMPARISONS[presetKey]) {
      scenariosToRun = PRESET_SCENARIO_COMPARISONS[presetKey].generateScenarios(baselineRoom);
    } else if (scenariosToRun.length === 0) {
      // Default to winter smog defense preset if nothing specified
      scenariosToRun =
        PRESET_SCENARIO_COMPARISONS.winter_smog_defense.generateScenarios(baselineRoom);
    }

    const comparison = compareIndoorScenarios({
      baselineRoom,
      outdoor,
      alternativeScenarios: scenariosToRun,
      parameters,
    });

    return NextResponse.json({
      comparison,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal comparison engine error.";
    logger.error("[SimulatorCompareAPI] Error:", undefined, error);
    return NextResponse.json(
      {
        error: "COMPARISON_FAILED",
        message,
      },
      { status: 500 }
    );
  }
}
