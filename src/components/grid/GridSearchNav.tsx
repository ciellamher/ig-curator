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
    <div className="flex items-center gap-2 bg-white border border-soft-200 rounded-full px-3 py-1.5 shadow-xs transition-all focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-800/10">
      <Search size={14} className="text-foreground/40 shrink-0" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder}
        className="w-36 sm:w-52 bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-foreground/40"
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
