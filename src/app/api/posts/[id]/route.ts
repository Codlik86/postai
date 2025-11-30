import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    const updated = await prisma.post.update({
      where: { id },
      data: {
        content: body.content,
        firstComment: body.firstComment,
        scheduledFor: body.scheduledFor
          ? new Date(body.scheduledFor)
          : undefined,
        localTime: body.localTime,
        type: body.type,
        mediaUrl: body.media?.url ?? body.mediaUrl,
        mediaType: body.media?.type ?? body.mediaType,
        mediaFilename: body.media?.filename ?? body.mediaFilename,
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
