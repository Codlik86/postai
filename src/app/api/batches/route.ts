import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  generatePostsForBatch,
  type PlannedPostInput,
} from "@/lib/gpt";

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

function localToUtc(date: string, time: string, timeZone: string) {
  const ref = new Date(`${date}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
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

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function platformType(platform: string) {
  if (platform === "instagram") return "reel";
  if (platform === "tiktok") return "tiktok";
  if (platform === "telegram") return "post";
  if (platform === "threads") return "post";
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
      notes = "",
      platforms = [],
      postsPerDay = 1,
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
        notes,
        status: "draft",
      },
    });

    const planned: PlannedPostInput[] = [];
    days.forEach((date) => {
      platforms.forEach((platform) => {
        for (let i = 0; i < postsPerDay; i += 1) {
          planned.push({
            date,
            platform,
            type: platformType(platform),
            theme: themes[i % (themes.length || 1)] ?? "",
          });
        }
      });
    });

    const generatedMap = await generatePostsForBatch({
      productDescription:
        notes ||
        "Бренд 'Помни' — телеграм-бот эмоциональной поддержки и дневник.",
      batchName: name,
      themes,
      posts: planned,
    });

    const postsToCreate = planned.map((p, index) => {
      const content = generatedMap[index]?.content ?? "";
      const firstComment = generatedMap[index]?.firstComment;
      const account = accounts.find((a) => a.platform === p.platform)!;
      const scheduledFor = localToUtc(p.date, "10:00", timezone);
      return {
        batchId: batch.id,
        accountId: account.id,
        platform: p.platform,
        scheduledFor,
        localTime: "10:00",
        timezone,
        type: p.type,
        content,
        firstComment,
        status: "generated",
      };
    });

    const posts = await prisma.post.createMany({ data: postsToCreate });
    await prisma.contentBatch.update({
      where: { id: batch.id },
      data: { status: "generated" },
    });

    const createdPosts = await prisma.post.findMany({
      where: { batchId: batch.id },
      include: { account: true },
      orderBy: [{ scheduledFor: "asc" }],
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
