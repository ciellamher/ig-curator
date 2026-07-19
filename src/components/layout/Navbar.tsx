"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { Camera } from "lucide-react"

export function Navbar() {
  return (
    <nav className="w-full h-16 bg-white border-b border-soft-100 flex items-center justify-between px-6 shadow-sm">
      <div className="font-semibold text-foreground tracking-tight">IG Curator</div>
    </nav>
  )
}
