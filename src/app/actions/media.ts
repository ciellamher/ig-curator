"use server"

import { del } from "@vercel/blob"
import { requireUserId, run, type Result } from "@/lib/planner/server"

/** Deletes photos/videos from cloud storage — only ones inside the signed-in user's own folder. */
export async function deleteCloudMedia(urls: string[]): Promise<Result<{ deleted: number }>> {
  return run(async () => {
    const userId = await requireUserId()
    if (!process.env.BLOB_READ_WRITE_TOKEN) return { deleted: 0 }
    const own = (Array.isArray(urls) ? urls : []).filter((u) => {
      try {
        const url = new URL(u)
        return url.hostname.endsWith(".blob.vercel-storage.com") && url.pathname.startsWith(`/u/${userId}/`)
      } catch {
        return false
      }
    })
    if (own.length) await del(own.slice(0, 500))
    return { deleted: own.length }
  })
}
