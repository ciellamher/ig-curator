import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GOOGLE_SCOPE, googleCalendarConfigured } from "@/lib/googleCalendar"

/** Starts "Connect Google Calendar": sends the user to Google's consent screen. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const origin = new URL(request.url).origin
  if (!session?.user) return NextResponse.redirect(`${origin}/login`)
  if (!googleCalendarConfigured()) return NextResponse.redirect(`${origin}/?gcal=unavailable`)

  const state = crypto.randomBytes(24).toString("base64url")
  const params = new URLSearchParams({
    client_id: process.env.GCAL_CLIENT_ID!,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  res.cookies.set("gcal_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/google", maxAge: 600 })
  return res
}
