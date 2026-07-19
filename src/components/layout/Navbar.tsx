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
              {session.user?.image && (
                <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full" />
              )}
              <span className="text-sm font-medium text-foreground">{session.user?.name || session.user?.email}</span>
            </div>
            <button 
              onClick={() => signOut()}
              className="text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => signIn("instagram")}
              className="flex items-center gap-2 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Camera size={14} /> Connect Instagram
            </button>
            <button 
              onClick={() => signIn()}
              className="text-sm font-medium text-foreground px-4 py-1.5 rounded-full border border-soft-200 hover:bg-soft-50 transition-colors"
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
