"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLogo } from "@/components/ui/AppLogo";
import { PRIVATE_SITE } from "@/lib/features";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    if (res?.error) {
      setError("Invalid username or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl shadow-float border border-white p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center mb-8">
          <AppLogo size={48} className="mb-4 rounded-2xl shadow-lg shadow-black/20" />
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Welcome back</h1>
          <p className="text-sm text-foreground/60 mt-1">Log in to keep curating your feed</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-zinc-50 border border-zinc-100 text-zinc-900 text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-white border border-soft-200 hover:border-soft-300 focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all text-base sm:text-sm placeholder:text-zinc-400"
              placeholder="curator"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-white border border-soft-200 hover:border-soft-300 focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all text-base sm:text-sm placeholder:text-zinc-400"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-black active:scale-[0.99] transition-all disabled:opacity-50 mt-2 cursor-pointer shadow-sm"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {!PRIVATE_SITE && (
        <div className="mt-8 text-center text-sm text-foreground/60">
          Don't have an account?{" "}
          <Link href="/register" className="text-foreground font-semibold hover:underline">
            Sign up
          </Link>
        </div>
        )}
      </div>
    </div>
  );
}
