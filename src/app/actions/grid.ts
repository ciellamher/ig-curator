"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { SlotItem } from "@/types"

export async function saveGridSlot(item: SlotItem) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return { success: false, error: "Unauthorized" }
    }

    // @ts-ignore - id is added in callbacks
    const userId = session.user.id

    const position = parseInt(item.id.replace("slot-", "").replace("story-", ""))
    if (isNaN(position)) {
      return { success: false, error: "Invalid slot ID" }
    }

    const gridSlot = await prisma.gridSlot.upsert({
      where: {
        userId_position: {
          userId,
          position,
        }
      },
      update: {
        type: item.type,
      },
      create: {
        userId,
        position,
        type: item.type,
      }
    })

    await prisma.postMetadata.upsert({
      where: { gridSlotId: gridSlot.id },
      update: {
        caption: item.caption || null,
        audioTrack: item.audioTrack || null,
        contentType: item.contentType || null,
        scheduledTime: item.scheduledTime ? new Date(item.scheduledTime) : null,
      },
      create: {
        gridSlotId: gridSlot.id,
        caption: item.caption || null,
        audioTrack: item.audioTrack || null,
        contentType: item.contentType || null,
        scheduledTime: item.scheduledTime ? new Date(item.scheduledTime) : null,
      }
    })

    await prisma.media.upsert({
      where: { gridSlotId: gridSlot.id },
      update: {
        url: item.urls.length > 0 ? item.urls[item.currentUrlIndex] : null,
        hexColor: item.hexColor,
        overlayText: item.text,
      },
      create: {
        gridSlotId: gridSlot.id,
        url: item.urls.length > 0 ? item.urls[item.currentUrlIndex] : null,
        hexColor: item.hexColor,
        overlayText: item.text,
      }
    })

    return { success: true }
  } catch (e: any) {
    return { success: false, error: String(e.message || e) }
  }
}
