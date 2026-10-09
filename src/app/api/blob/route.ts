import { NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024 // videos can be large; photos are compressed before upload

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  // @ts-ignore - id is added in the session callback
  return session?.user?.id ?? null
}

/** Whether cloud photo storage is set up (a Vercel Blob store is connected). */
export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN) })
}

/** Issues short-lived upload tokens so the browser uploads straight to Vercel Blob, only into the user's own folder. */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Cloud photo storage isn't set up" }, { status: 503 })
  }
  const body = (await request.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const userId = await currentUserId()
        if (!userId) throw new Error("Unauthorized")
        if (!pathname.startsWith(`u/${userId}/`)) throw new Error("Uploads must go to your own folder")
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
