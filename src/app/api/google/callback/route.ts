import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt, exchangeCode, syncUserCalendar } from "@/lib/googleCalendar"

/** Google sends the user back here after they allow (or deny) calendar access. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origin = url.origin
  const session = await getServerSession(authOptions)
  // @ts-ignore - id is added in the session callback
  const userId: string | undefined = session?.user?.id
  if (!userId) return NextResponse.redirect(`${origin}/login`)

  const state = url.searchParams.get("state")
  const expected = request.cookies.get("gcal_state")?.value
  const done = (result: string) => {
    const res = NextResponse.redirect(`${origin}/?gcal=${result}`)
    res.cookies.delete({ name: "gcal_state", path: "/api/google" })
    return res
  }
  if (url.searchParams.get("error")) return done("denied")
  if (!state || !expected || state !== expected) return done("failed")

  try {
    const { refreshToken } = await exchangeCode(url.searchParams.get("code") || "", `${origin}/api/google/callback`)
    await prisma.googleCalendarLink.upsert({
      where: { userId },
      update: { refreshToken: encrypt(refreshToken), lastError: null },
      create: { userId, refreshToken: encrypt(refreshToken) },
    })
    await syncUserCalendar(userId)
    return done("connected")
  } catch (e) {
    console.error("Google Calendar connect failed:", e)
    return done("failed")
  }
}
