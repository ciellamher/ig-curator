"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { Camera } from "lucide-react"

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="w-full h-16 bg-white border-b border-soft-100 flex items-center justify-between px-6 shadow-sm">
      <div className="font-semibold text-foreground tracking-tight">IG Curator</div>
      
      <div className="flex items-center gap-4">
        {session ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {session.user?.name || "Curator"}
              </span>
            </div>
            <button 
              onClick={() => signOut()}
              className="text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={() => signIn("demo")}
            className="text-sm font-medium bg-foreground text-white px-5 py-2 rounded-full hover:opacity-90 transition-opacity shadow-sm"
          >
            Log In
          </button>
        )}
      </div>
    </nav>
  )
}
