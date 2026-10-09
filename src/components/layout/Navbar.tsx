"use client"

import { signOut, useSession } from "next-auth/react"
import { Camera, LayoutGrid, LogOut, NotebookTabs } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { href: "/", label: "Feed", icon: LayoutGrid },
  { href: "/planner", label: "Planner", icon: NotebookTabs },
]

export function Navbar() {
  const { data: session } = useSession()
  const name = session?.user?.name || "Curator"
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-[60] w-full h-14 sm:h-16 bg-white/70 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-500 flex items-center justify-center shadow-sm shadow-pink-500/20 group-hover:scale-105 transition-transform">
          <Camera size={16} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="hidden min-[400px]:inline font-semibold text-zinc-900 tracking-tight">IG Curator</span>
      </Link>

      {session && (
        <div className="flex items-center gap-0.5 bg-soft-100/80 rounded-full p-1 mx-2">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-full text-sm font-medium transition-colors ${
                  active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>
      )}

      {session ? (
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2 pl-1 pr-1 sm:pr-3 py-1 rounded-full sm:bg-soft-100/80">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-semibold flex items-center justify-center uppercase">
              {name.charAt(0)}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-zinc-800 max-w-[140px] truncate">
              {name}
            </span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("ig-curator-profile");
              localStorage.removeItem("ig-curator-items");
              signOut();
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-soft-100 px-2.5 sm:px-3 py-2 rounded-full transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-700 px-3 sm:px-4 py-2 rounded-full hover:bg-soft-100 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-zinc-900 text-white px-4 sm:px-5 py-2 rounded-full hover:bg-black transition-colors shadow-sm"
          >
            Sign up
          </Link>
        </div>
      )}
    </nav>
  )
}
