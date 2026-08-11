import { NextResponse } from "next/server";
import { getFarmState } from "@/lib/server/gatherState";

export async function GET() {
  return NextResponse.json(getFarmState());
}
