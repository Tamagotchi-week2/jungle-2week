import { NextResponse } from "next/server";
import { harvestFarm } from "@/lib/server/gatherState";

export async function POST() {
  try {
    return NextResponse.json(harvestFarm());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
