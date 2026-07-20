"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { Camera } from "lucide-react"
import Link from "next/link"

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
              onClick={() => {
                localStorage.removeItem("ig-curator-profile");
                localStorage.removeItem("ig-curator-items");
                signOut();
              }}
              className="text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link 
              href="/login"
              className="text-sm font-medium text-foreground px-4 py-2 rounded-full hover:bg-soft-50 transition-colors"
            >
              Log In
            </Link>
            <Link 
              href="/register"
              className="text-sm font-medium bg-foreground text-white px-5 py-2 rounded-full hover:opacity-90 transition-opacity shadow-sm"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
