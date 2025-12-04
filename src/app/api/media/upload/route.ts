import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadMediaToLate } from "@/lib/late";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const accountId = formData.get("accountId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        { error: "Missing accountId" },
        { status: 400 },
      );
    }

    const account = await prisma.account.findUnique({
      where: { id: Number(accountId) },
    });

    if (!account || !account.lateAccountId) {
      return NextResponse.json(
        { error: "Account not found or missing lateAccountId" },
        { status: 400 },
      );
    }

    const media = await uploadMediaToLate({
      file,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      lateAccountId: account.lateAccountId,
    });

    return NextResponse.json({ success: true, media });
  } catch (err: any) {
    console.error("Media upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload media" },
      { status: 500 },
    );
  }
}
