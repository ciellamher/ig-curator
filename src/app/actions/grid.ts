"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { SlotItem } from "@/types"

export async function syncGridToCloud(items: SlotItem[], profileData?: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Unauthorized" }
    }

    // @ts-ignore
    const userId = session.user.id

    await prisma.userGrid.upsert({
      where: { userId },
      update: {
        itemsData: JSON.stringify(items),
        profileData: profileData ? JSON.stringify(profileData) : undefined,
      },
      create: {
        userId,
        itemsData: JSON.stringify(items),
        profileData: profileData ? JSON.stringify(profileData) : null,
      }
    })

    return { success: true }
  } catch (e: any) {
    return { success: false, error: String(e.message || e) }
  }
}

export async function fetchGridFromCloud() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { success: false, data: null }

    // @ts-ignore
    const userId = session.user.id

    const grid = await prisma.userGrid.findUnique({
      where: { userId }
    })

    if (!grid) return { success: true, data: null }

    return { 
      success: true, 
      data: {
        items: JSON.parse(grid.itemsData),
        profile: grid.profileData ? JSON.parse(grid.profileData) : null
      }
    }
  } catch (e: any) {
    return { success: false, error: String(e.message || e) }
  }
}
