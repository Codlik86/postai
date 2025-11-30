import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateDayPosts, type PlannedPostInput } from "@/lib/gpt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchId, date } = body;

    if (!batchId || !date) {
      return NextResponse.json(
        { error: "batchId and date are required" },
        { status: 400 },
      );
    }

    const batch = await prisma.contentBatch.findUnique({
      where: { id: Number(batchId) },
      include: { posts: { include: { account: true } } },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const postsForDay = batch.posts.filter(
      (p) => p.date.toISOString().slice(0, 10) === date,
    );

    if (!postsForDay.length) {
      return NextResponse.json(
        { error: "No posts for this day" },
        { status: 400 },
      );
    }

    const planned: PlannedPostInput[] = postsForDay.map((p) => ({
      date,
      platform: p.platform,
      kind: p.kind,
      theme: batch.themes?.split(",")?.[0]?.trim() ?? "",
    }));

    const generated = await generateDayPosts({
      productDescription:
        batch.gptBrief ||
        "Бренд 'Помни' — телеграм-бот эмоциональной поддержки и дневник.",
      batchName: batch.name,
      themes: batch.themes?.split(",").map((t) => t.trim()) ?? [],
      posts: planned,
    });

    for (let i = 0; i < postsForDay.length; i += 1) {
      const post = postsForDay[i];
      const data = generated[i];
      if (!data) continue;
      await prisma.post.update({
        where: { id: post.id },
        data: {
          caption: data.caption,
          firstComment: data.firstComment,
          status: "generated",
        },
      });
    }

    const updatedPosts = await prisma.post.findMany({
      where: { batchId: batch.id },
      include: { account: true },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return NextResponse.json({ posts: updatedPosts });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate day posts" },
      { status: 500 },
    );
  }
}
