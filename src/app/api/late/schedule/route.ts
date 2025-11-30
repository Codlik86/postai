import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createLatePost } from "@/lib/late";

function toScheduledISO(date: Date, time: string, timezone: string) {
  const isoDate = date.toISOString().slice(0, 10);
  const ref = new Date(`${isoDate}T${time || "10:00"}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(ref);

  const get = (type: string) => fmt.find((p) => p.type === type)?.value ?? "00";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId is required" },
        { status: 400 },
      );
    }

    const batch = await prisma.contentBatch.findUnique({
      where: { id: Number(batchId) },
      include: {
        posts: {
          include: { account: true },
          orderBy: [{ date: "asc" }, { time: "asc" }],
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
      if (!post.caption || post.caption.trim().length === 0) {
        results.push({
          postId: post.id,
          platform: post.platform,
          status: "skipped",
          error: "Empty content",
        });
        continue;
      }

      try {
        const { postId: latePostId, status } = await createLatePost({
          content: post.caption,
          scheduledFor: toScheduledISO(post.date, post.time, batch.timezone),
          timezone: batch.timezone,
          platform: post.platform,
          accountId: post.account.lateAccountId,
          media: post.mediaUrl
            ? {
                url: post.mediaUrl,
                type: "image",
                filename: "media",
              }
            : null,
          type: post.kind as any,
          firstComment: post.firstComment ?? undefined,
        });

        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: status ?? "scheduled",
          },
        });

        results.push({
          postId: post.id,
          platform: post.platform,
          latePostId,
          status: status ?? "scheduled",
        });
      } catch (error) {
        console.error(error);
        results.push({
          postId: post.id,
          platform: post.platform,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.status !== "failed").length;
    if (successCount > 0) {
      await prisma.contentBatch.update({
        where: { id: batch.id },
        data: {
          status: successCount === results.length ? "scheduled" : "partially_scheduled",
        },
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to schedule in Late" },
      { status: 500 },
    );
  }
}
