// Features that can be switched off per deployment (set in the Vercel project's environment variables).

/** SHEIN outfit tracking: Outfits to Prep, orders, clothing status/timeline and alerts. Off with NEXT_PUBLIC_SHEIN=off. */
export const SHEIN_ENABLED = process.env.NEXT_PUBLIC_SHEIN !== "off"

/** Private site: hides sign-up links and asks search engines not to index it. Set NEXT_PUBLIC_PRIVATE_SITE=on. */
export const PRIVATE_SITE = process.env.NEXT_PUBLIC_PRIVATE_SITE === "on"

/**
 * Server-side allow-list for private sites: comma-separated usernames in ALLOWED_USERS. When set, only these accounts
 * can sign in and new sign-ups are refused.
 */
export function allowedUsers(): string[] | null {
  const raw = process.env.ALLOWED_USERS?.trim()
  return raw ? raw.split(",").map((u) => u.trim().toLowerCase()).filter(Boolean) : null
}
