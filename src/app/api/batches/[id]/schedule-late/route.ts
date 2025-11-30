import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createLatePost } from "@/lib/late";

export async function POST(request: NextRequest, context: any) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
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

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const results: {
      postId: number;
      platform: string;
      latePostId?: string;
      status: string;
      error?: string;
    }[] = [];

    for (const post of batch.posts) {
      if (!["generated", "edited"].includes(post.status)) {
        continue;
      }

      try {
        const { postId: latePostId, status } = await createLatePost({
          content: post.content,
          scheduledFor: post.scheduledFor.toISOString(),
          timezone: post.timezone,
          platform: post.platform,
          accountId: post.account.lateAccountId,
          media: post.mediaUrl
            ? {
                url: post.mediaUrl,
                type: (post.mediaType as any) ?? "image",
                filename: post.mediaFilename ?? "media",
              }
            : null,
          type: post.type as any,
          firstComment: post.firstComment ?? undefined,
        });

        await prisma.post.update({
          where: { id: post.id },
          data: {
            latePostId,
            status,
            lateError: null,
          },
        });

        results.push({
          postId: post.id,
          platform: post.platform,
          latePostId,
          status,
        });
      } catch (error) {
        console.error(error);
        await prisma.post.update({
          where: { id: post.id },
          data: {
            lateError:
              error instanceof Error ? error.message : "Failed to send to Late",
            status: "failed",
          },
        });
        results.push({
          postId: post.id,
          platform: post.platform,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successful = results.filter((r) => r.status !== "failed").length;
    const total = batch.posts.filter((p) =>
      ["generated", "edited"].includes(p.status),
    ).length;

    await prisma.contentBatch.update({
      where: { id: batch.id },
      data: {
        status:
          successful === 0
            ? batch.status
            : successful === total
              ? "scheduled"
              : "partially_scheduled",
      },
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to schedule in Late" },
      { status: 500 },
    );
  }
}
