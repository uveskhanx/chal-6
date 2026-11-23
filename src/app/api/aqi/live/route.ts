import { NextRequest, NextResponse } from "next/server";
import { CoordinatesQuerySchema } from "@/lib/aqi/types";
import { getAirQualityReport } from "@/lib/aqi/service";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      lat: searchParams.get("lat") || searchParams.get("latitude"),
      lon: searchParams.get("lon") || searchParams.get("longitude"),
      stationId: searchParams.get("stationId") ?? undefined,
      scenario: searchParams.get("scenario") ?? undefined,
    };

    const parsedQuery = CoordinatesQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "INVALID_COORDINATES_QUERY",
          details: parsedQuery.error.format(),
        },
        { status: 400 }
      );
    }

    const report = await getAirQualityReport(parsedQuery.data);

    return NextResponse.json(report, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
        "X-SaansAI-Provenance": report.provenance.type,
      },
    });
  } catch (error: unknown) {
    logger.error("[API /api/aqi/live] Unhandled exception:", undefined, error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate air quality report.",
      },
      { status: 500 }
    );
  }
}
