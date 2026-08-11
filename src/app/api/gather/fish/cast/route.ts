import { NextResponse } from "next/server";
import { createFishSession } from "@/lib/server/gatherState";

export async function POST() {
  return NextResponse.json(createFishSession());
}
