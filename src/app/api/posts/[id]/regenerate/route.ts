import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  generateDayPosts,
  type PlannedPostInput,
} from "@/lib/gpt";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: numericId },
      include: { batch: true, account: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const planned: PlannedPostInput = {
      date: post.date.toISOString().slice(0, 10),
      platform: post.platform,
      kind: post.kind,
      theme: post.batch.themes?.split(",")?.[0]?.trim() ?? "",
    };

    const generated = await generateDayPosts({
      productDescription:
        post.batch.gptBrief ||
        "Бренд 'Помни' — телеграм-бот эмоциональной поддержки и дневник.",
      batchName: post.batch.name,
      themes: post.batch.themes?.split(",").map((t) => t.trim()) ?? [],
      posts: [planned],
    });

    const content = generated[0]?.caption ?? post.caption ?? "";
    const firstComment = generated[0]?.firstComment ?? post.firstComment;

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        caption: content,
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
