import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const batchId = Number(id);

    if (!id || Number.isNaN(batchId)) {
      return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
    }

    const batch = await prisma.contentBatch.findUnique({
      where: { id: batchId },
      include: {
        posts: {
          include: {
            account: true,
          },
          orderBy: [{ date: "asc" }, { time: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const { posts, ...batchWithoutPosts } = batch;

    return NextResponse.json({
      batch: batchWithoutPosts,
      posts,
    });
  } catch (err) {
    console.error("Failed to load batch by id:", err);
    return NextResponse.json(
      { error: "Failed to load batch" },
      { status: 500 },
    );
  }
}
