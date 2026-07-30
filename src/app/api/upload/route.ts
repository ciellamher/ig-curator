import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Generate a unique filename to avoid collisions
    const ext = file.name.split(".").pop() || "jpg";
    const uniqueName = `grid/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const blob = await put(uniqueName, file, {
      access: "public",
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: String(error.message || error) }, { status: 500 });
  }
}
