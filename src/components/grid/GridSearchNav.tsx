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
    <div className="flex items-center justify-between gap-2 bg-white/95 backdrop-blur-md border border-soft-200 rounded-full px-3 py-1.5 shadow-sm transition-all focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-800/10 w-full max-w-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Search size={15} className="text-foreground/40 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search placeholders (e.g. selfie)..."
          className="w-full bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-foreground/40"
        />
        {searchQuery.trim() !== "" && (
          <button
            onClick={onClearSearch}
            className="p-1 text-foreground/40 hover:text-foreground rounded-full transition-colors cursor-pointer shrink-0"
            title="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {searchQuery.trim() !== "" && (
        <div className="flex items-center gap-1.5 pl-2 border-l border-soft-200 shrink-0 select-none">
          {/* Match counter badge */}
          <span className="text-[10px] font-extrabold text-slate-700 px-2 py-0.5 rounded-full bg-slate-100 whitespace-nowrap">
            {matchCount > 0 ? `${currentMatchIndex + 1} / ${matchCount}` : "0 matches"}
          </span>

          {/* Large, Easy to Click Up/Down & Next Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevMatch}
              disabled={matchCount <= 1}
              className="p-1.5 text-slate-700 hover:text-slate-900 bg-soft-100 hover:bg-soft-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all cursor-pointer active:scale-95"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp size={15} strokeWidth={2.5} />
            </button>
            
            <button
              onClick={onNextMatch}
              disabled={matchCount <= 1}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-black text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Next match (Enter)"
            >
              <span>Next</span>
              <ChevronDown size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
