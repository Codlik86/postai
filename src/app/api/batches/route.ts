import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE ?? "Europe/Moscow";

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function dateRange(start: string, end: string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const days = [];
  for (
    let d = new Date(startDate);
    d.getTime() <= endDate.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function platformType(platform: string) {
  if (platform === "instagram") return "reel";
  if (platform === "tiktok") return "tiktok";
  if (platform === "threads") return "post";
  if (platform === "telegram") return "post";
  return "post";
}

export async function GET(_request: NextRequest) {
  const batches = await prisma.contentBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { posts: true } },
    },
  });

  const data = batches.map((b) => {
    const count = (b as typeof b & { _count: { posts: number } })._count.posts;
    return {
      id: b.id,
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      status: b.status,
      postsCount: count,
    };
  });

  return NextResponse.json({ batches: data });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      startDate,
      endDate,
      timezone = DEFAULT_TZ,
      themes = [],
      gptBrief = "",
      platforms = [],
    } = body;

    if (!name || !startDate || !endDate || !Array.isArray(platforms)) {
      return NextResponse.json(
        { error: "name, startDate, endDate, platforms are required" },
        { status: 400 },
      );
    }

    const days = dateRange(startDate, endDate);
    const accounts = await prisma.account.findMany({
      where: { platform: { in: platforms } },
    });

    const missing = platforms.filter(
      (p: string) => !accounts.find((a) => a.platform === p),
    );
    if (missing.length) {
      return NextResponse.json(
        { error: `Нет аккаунтов для платформ: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    const batch = await prisma.contentBatch.create({
      data: {
        name,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        timezone,
        themes: themes.join(", "),
        gptBrief,
        status: "draft",
      },
    });

    const postsToCreate: {
      batchId: number;
      accountId: number;
      platform: string;
      kind: string;
      date: Date;
      time: string;
      caption: string | null;
      firstComment: string | null;
      mediaUrl: string | null;
      status: string;
    }[] = [];
    days.forEach((day) => {
      platforms.forEach((platform) => {
        const account = accounts.find((a) => a.platform === platform);
        if (!account) return;
        postsToCreate.push({
          batchId: batch.id,
          accountId: account.id,
          platform,
          kind: platformType(platform),
          date: parseDate(day),
          time: "10:00",
          caption: null,
          firstComment: null,
          mediaUrl: null,
          status: "draft",
        });
      });
    });

    await prisma.post.createMany({ data: postsToCreate });

    const createdPosts = await prisma.post.findMany({
      where: { batchId: batch.id },
      include: { account: true },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return NextResponse.json({
      batch,
      posts: createdPosts,
      accounts,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create batch" },
      { status: 500 },
    );
  }
}
