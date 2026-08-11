import { NextResponse } from "next/server";
import { completeMineSession } from "@/lib/server/gatherState";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json(completeMineSession(body));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        gained: 0,
        resources: { crop: 0, mineral: 0, seafood: 0 },
      },
      { status: 400 },
    );
  }
}
