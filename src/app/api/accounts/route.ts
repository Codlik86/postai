import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { platform: "asc" },
  });
  return NextResponse.json({ accounts });
}
