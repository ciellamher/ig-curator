"use client"

import { useState } from "react"
import { Image as ImageIcon, Plus, Video, LayoutGrid, CircleDot } from "lucide-react"

export function MediaLibrary() {
  const [filter, setFilter] = useState<"All" | "Post" | "Reel" | "Story">("Post")

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 border-b border-soft-100">
        <h2 className="text-lg font-medium text-foreground">Media Library</h2>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-pastel-500 text-white rounded-full text-sm font-medium hover:bg-pastel-400 transition-colors">
          <Plus size={14} /> Upload
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 bg-soft-50 border-b border-soft-100 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setFilter(filter === "Post" ? "All" : "Post")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === "Post" ? "bg-pastel-500 text-white" : "bg-white border border-soft-200 text-foreground/60 hover:text-foreground"}`}
        >
          <LayoutGrid size={12} /> Posts
        </button>
        <button 
          onClick={() => setFilter(filter === "Reel" ? "All" : "Reel")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === "Reel" ? "bg-pastel-500 text-white" : "bg-white border border-soft-200 text-foreground/60 hover:text-foreground"}`}
        >
          <Video size={12} /> Reels
        </button>
        <button 
          onClick={() => setFilter(filter === "Story" ? "All" : "Story")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === "Story" ? "bg-pastel-500 text-white" : "bg-white border border-soft-200 text-foreground/60 hover:text-foreground"}`}
        >
          <CircleDot size={12} /> Stories
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-soft-50">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Mock Media Items filtered by selection */}
          {Array.from({ length: filter === "All" ? 12 : 4 }).map((_, i) => (
            <div 
              key={i} 
              className={`
                bg-white border border-soft-100 flex flex-col items-center justify-center text-foreground/40 hover:border-pastel-300 transition-colors cursor-grab active:cursor-grabbing shadow-sm
                ${filter === "Story" || filter === "Reel" ? "aspect-[9/16] rounded-lg" : filter === "Post" ? "aspect-[4/5] rounded-xl" : "aspect-square rounded-xl"}
              `}
            >
              {filter === "Reel" || filter === "Story" ? <Video size={24} className="mb-2 opacity-50" /> : <ImageIcon size={24} className="mb-2 opacity-50" />}
              <span className="text-xs">Drag to plan</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
