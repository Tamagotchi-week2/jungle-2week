import { NextResponse } from "next/server";
import { createMineSession } from "@/lib/server/gatherState";

export async function POST() {
  return NextResponse.json(createMineSession());
}
