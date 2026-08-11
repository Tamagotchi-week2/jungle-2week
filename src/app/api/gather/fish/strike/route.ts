import { NextResponse } from "next/server";
import { strikeFishSession } from "@/lib/server/gatherState";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json(strikeFishSession(body));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        reason: "too_late",
        gained: 0,
        resources: { crop: 0, mineral: 0, seafood: 0 },
      },
      { status: 400 },
    );
  }
}
