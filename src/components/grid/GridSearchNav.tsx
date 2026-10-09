"use client";

import { Search, X } from "lucide-react";

interface GridSearchNavProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  matchCount: number;
  onClearSearch: () => void;
  placeholder?: string;
  hideMatchCount?: boolean;
}

export function GridSearchNav({
  searchQuery,
  setSearchQuery,
  matchCount,
  onClearSearch,
  placeholder = "Search...",
  hideMatchCount = false,
}: GridSearchNavProps) {
  return (
    <div className="flex items-center gap-2 h-9 w-full sm:w-auto bg-white/80 backdrop-blur border border-soft-200 rounded-full px-3 transition-all hover:border-soft-300 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-4 focus-within:ring-zinc-900/5">
      <Search size={14} className="text-foreground/40 shrink-0" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 sm:flex-none sm:w-56 lg:w-64 bg-transparent text-base sm:text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
      />

      {searchQuery.trim() !== "" && (
        <div className="flex items-center gap-1.5 pl-1.5 border-l border-soft-200 shrink-0 select-none">
          {!hideMatchCount && (
            <span className="text-[10px] font-extrabold text-slate-700 px-2 py-0.5 rounded-full bg-slate-100 whitespace-nowrap">
              {matchCount === 1 ? "1 match" : `${matchCount} matches`}
            </span>
          )}

          <button
            onClick={onClearSearch}
            className="p-1 text-foreground/40 hover:text-slate-900 rounded-full transition-colors cursor-pointer"
            title="Clear search"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
