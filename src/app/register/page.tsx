"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera } from "lucide-react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain both letters and numbers");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto login after registration
      const loginRes = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (loginRes?.error) {
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl shadow-float border border-white p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-pink-500/25">
            <Camera size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Create Account</h1>
          <p className="text-sm text-foreground/60 mt-1">Start curating your feed</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center">
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-foreground/60">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-semibold hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
