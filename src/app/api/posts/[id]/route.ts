import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    const updated = await prisma.post.update({
      where: { id: numericId },
      data: {
        caption: body.caption,
        firstComment: body.firstComment,
        time: body.time ?? undefined,
        kind: body.kind ?? undefined,
        mediaUrl: body.media?.url ?? body.mediaUrl,
        status: body.status ?? "edited",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 },
    );
  }
}
