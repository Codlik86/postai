import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(_request: NextRequest) {
  const accounts = await prisma.account.findMany({
    orderBy: [{ platform: "asc" }],
  });
  return NextResponse.json({ accounts });
}
