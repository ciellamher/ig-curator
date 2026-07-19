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

  if (accessToken === "demo_token_123") {
    return { 
      success: true, 
      liveItems: [
        { url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600", caption: "Welcome to your Demo Instagram!", contentType: "Post" },
        { url: "https://images.unsplash.com/photo-1512413914482-1c25fb18128e?q=80&w=600", caption: "This is a dummy Reel.", contentType: "Reel" },
        { url: "https://images.unsplash.com/photo-1517329782449-810562a4ec2f?q=80&w=600", caption: "Start planning your grid above.", contentType: "Post" },
      ].map(p => ({
        url: p.url,
        caption: p.caption,
        permalink: "#",
        contentType: p.contentType,
      }))
    }
  }

  const media = await fetchInstagramMedia(accessToken)
  if (!media) {
    return { success: false, error: "Failed to fetch media" }
  }

  // Parse media into our SlotItem format
  const liveItems = media.slice(0, 18).map((post: any) => {
    return {
      url: post.media_type === "VIDEO" ? (post.thumbnail_url || post.media_url) : post.media_url,
      caption: post.caption,
      permalink: post.permalink,
      contentType: post.media_type === "VIDEO" ? "Reel" : "Post",
    }
  })

  return { success: true, liveItems }
}
