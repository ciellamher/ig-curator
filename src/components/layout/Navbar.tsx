"use client"

import { signOut, useSession } from "next-auth/react"
import { LogOut } from "lucide-react"
import Link from "next/link"
import { AppLogo } from "@/components/ui/AppLogo"

export function Navbar() {
  const { data: session } = useSession()
  const name = session?.user?.name || "Curator"

  return (
    <nav className="sticky top-0 z-[60] w-full h-14 sm:h-16 bg-white/80 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5 group">
        <AppLogo size={32} className="rounded-[9px] group-hover:scale-105 transition-transform" />
        <span className="font-semibold text-zinc-950 tracking-tight">IG Curator</span>
      </Link>

      {session ? (
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2 pl-1 pr-1 sm:pr-3 py-1 rounded-full sm:bg-zinc-100">
            <div className="w-7 h-7 rounded-full bg-zinc-950 text-white text-xs font-semibold flex items-center justify-center uppercase">
              {name.charAt(0)}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-zinc-800 max-w-[140px] truncate">{name}</span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("ig-curator-profile")
              localStorage.removeItem("ig-curator-items")
              signOut()
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 px-2.5 sm:px-3 py-2 rounded-full transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/login" className="text-sm font-medium text-zinc-700 px-3 sm:px-4 py-2 rounded-full hover:bg-zinc-100 transition-colors">
            Log in
          </Link>
          <Link href="/register" className="text-sm font-medium bg-zinc-950 text-white px-4 sm:px-5 py-2 rounded-full hover:bg-black transition-colors shadow-sm">
            Sign up
          </Link>
        </div>
      )}
    </nav>
  )
}
