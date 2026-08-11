import { NextResponse } from "next/server";
import { plantFarm } from "@/lib/server/gatherState";

export async function POST() {
  try {
    return NextResponse.json(plantFarm());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
