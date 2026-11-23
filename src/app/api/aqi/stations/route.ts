import { NextRequest, NextResponse } from "next/server";
import { StationsQuerySchema } from "@/lib/aqi/types";
import { getNearbyCPCBStations } from "@/lib/aqi/providers/cpcb";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      lat: searchParams.get("lat") ?? undefined,
      lon: searchParams.get("lon") ?? undefined,
      radiusKm: searchParams.get("radiusKm") ?? undefined,
    };

    const parsedQuery = StationsQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "INVALID_STATIONS_QUERY",
          details: parsedQuery.error.format(),
        },
        { status: 400 }
      );
    }

    const { lat, lon, radiusKm } = parsedQuery.data;
    const stations = getNearbyCPCBStations(lat, lon, radiusKm);

    return NextResponse.json(
      {
        stations,
        count: stations.length,
        query: {
          lat: lat ?? null,
          lon: lon ?? null,
          radiusKm: radiusKm ?? 50,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: unknown) {
    logger.error("[API /api/aqi/stations] Unhandled exception:", undefined, error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve monitoring stations.",
      },
      { status: 500 }
    );
  }
}
