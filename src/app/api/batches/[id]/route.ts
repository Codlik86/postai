import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const batch = await prisma.contentBatch.findUnique({
    where: { id },
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
