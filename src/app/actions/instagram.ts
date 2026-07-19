"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { fetchInstagramMedia } from "@/lib/instagram"

export async function getLiveGrid() {
  const session = await getServerSession(authOptions)
  
  // @ts-ignore
  const accessToken = session?.instagramAccessToken
  
  if (!accessToken) {
    return { success: false, error: "No Instagram access token" }
  }

  const media = await fetchInstagramMedia(accessToken)
  if (!media) {
    return { success: false, error: "Failed to fetch media" }
  }

  // Parse media into our SlotItem format
  const liveItems = media.slice(0, 9).map((post: any) => {
    return {
      url: post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url,
      caption: post.caption,
      permalink: post.permalink,
    }
  })

  return { success: true, liveItems }
}
