import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest, context: any) {
  const { id } = await context.params;
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const batch = await prisma.contentBatch.findUnique({
    where: { id: numericId },
    include: {
      posts: {
        include: { account: true },
        orderBy: [{ scheduledFor: "asc" }],
      },
    },
  });

  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(batch);
}
