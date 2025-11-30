import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  generatePostsForBatch,
  type PlannedPostInput,
} from "@/lib/gpt";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: { batch: true, account: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const planned: PlannedPostInput = {
      date: post.scheduledFor.toISOString().slice(0, 10),
      platform: post.platform,
      type: post.type,
      theme: post.batch.themes ?? "",
    };

    const generated = await generatePostsForBatch({
      productDescription:
        post.batch.notes ||
        "Бренд 'Помни' — телеграм-бот эмоциональной поддержки и дневник.",
      batchName: post.batch.name,
      themes: post.batch.themes?.split(",").map((t) => t.trim()) ?? [],
      posts: [planned],
    });

    const content = generated[0]?.content ?? post.content;
    const firstComment = generated[0]?.firstComment ?? post.firstComment;

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        content,
        firstComment,
        status: "generated",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to regenerate post" },
      { status: 500 },
    );
  }
}
