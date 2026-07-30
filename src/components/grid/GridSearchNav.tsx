"use client"

import { Search, ChevronUp, ChevronDown, X } from "lucide-react";

interface GridSearchNavProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClearSearch: () => void;
}

export function GridSearchNav({
  searchQuery,
  setSearchQuery,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClearSearch,
}: GridSearchNavProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    } else if (e.key === "Escape") {
      onClearSearch();
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-white border border-soft-200 rounded-full px-3 py-1 shadow-xs transition-all focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-800/10">
      <Search size={14} className="text-foreground/40 shrink-0" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search placeholders (e.g. selfie, detail)..."
        className="w-36 sm:w-48 bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-foreground/40"
      />

      {searchQuery.trim() !== "" && (
        <div className="flex items-center gap-1 pl-1 border-l border-soft-200 shrink-0">
          {/* Match counter badge */}
          <span className="text-[10px] font-extrabold text-slate-700 px-1.5 py-0.5 rounded-full bg-slate-100 whitespace-nowrap">
            {matchCount > 0 ? `${currentMatchIndex + 1} of ${matchCount}` : "0 matches"}
          </span>

          {/* Nav buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onPrevMatch}
              disabled={matchCount <= 1}
              className="p-1 text-foreground/60 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-soft-100 rounded-md transition-colors cursor-pointer"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={onNextMatch}
              disabled={matchCount <= 1}
              className="p-1 text-foreground/60 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-soft-100 rounded-md transition-colors cursor-pointer"
              title="Next match (Enter)"
            >
              <ChevronDown size={14} strokeWidth={2.5} />
            </button>
          </div>

          <button
            onClick={onClearSearch}
            className="p-1 text-foreground/40 hover:text-foreground hover:bg-soft-100 rounded-full transition-colors cursor-pointer"
            title="Clear search"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
