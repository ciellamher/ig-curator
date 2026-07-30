import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // @ts-ignore
    const userId = session.user.id;

    const { items, profile } = await req.json();

    if (!items) {
       return NextResponse.json({ success: false, error: "No items provided" }, { status: 400 });
    }

    await prisma.userGrid.upsert({
      where: { userId },
      update: {
        itemsData: JSON.stringify(items),
        profileData: profile ? JSON.stringify(profile) : undefined,
      },
      create: {
        userId,
        itemsData: JSON.stringify(items),
        profileData: profile ? JSON.stringify(profile) : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API sync error:", error);
    return NextResponse.json({ success: false, error: String(error.message || error) }, { status: 500 });
  }
}
