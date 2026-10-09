// Server-only helpers shared by the planner's server actions.
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export type Result<T> = { success: true; data: T } | { success: false; error: string }

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  // @ts-ignore - id is added in the session callback
  const userId: string | undefined = session?.user?.id
  if (!userId) throw new Error("Unauthorized")
  return userId
}

export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e: any) {
    console.error("Planner action failed:", e)
    return { success: false, error: String(e?.message || e) }
  }
}
