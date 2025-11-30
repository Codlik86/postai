import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateWeeklyBrief } from "@/lib/gpt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, platforms, notes } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "platforms must be a non-empty array" },
        { status: 400 },
      );
    }

    const result = await generateWeeklyBrief({
      startDate,
      endDate,
      platforms,
      notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate weekly brief" },
      { status: 500 },
    );
  }
}
