import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { uploadMediaToLate } from "@/lib/late";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 },
      );
    }

    const media = await uploadMediaToLate(file);
    return NextResponse.json(media);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to upload media" },
      { status: 500 },
    );
  }
}
