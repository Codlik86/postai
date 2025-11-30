import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchLateAccounts } from "@/lib/late";

export async function GET(_request: NextRequest) {
  try {
    const lateAccounts = await fetchLateAccounts();
    const accounts = [];

    for (const acc of lateAccounts) {
      const upserted = await prisma.account.upsert({
        where: { lateAccountId: acc._id },
        update: {
          platform: acc.platform,
          username: acc.username,
          displayName: acc.displayName,
          avatarUrl: acc.profilePicture ?? null,
        },
        create: {
          platform: acc.platform,
          username: acc.username,
          displayName: acc.displayName,
          avatarUrl: acc.profilePicture ?? null,
          lateAccountId: acc._id,
        },
      });
      accounts.push(upserted);
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to sync Late accounts" },
      { status: 500 },
    );
  }
}
