import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: "Buffer OAuth deprecated. Use Late API key instead." },
    { status: 410 },
  );
}
