"use client"

import { useState } from "react"
import { Image as ImageIcon, Folder, Plus } from "lucide-react"

export function MediaLibrary() {
  const [activeTab, setActiveTab] = useState<"ALL" | "COLLECTIONS">("ALL")

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 border-b border-soft-100">
        <h2 className="text-lg font-medium text-foreground">Media Library</h2>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-pastel-500 text-white rounded-full text-sm font-medium hover:bg-pastel-400 transition-colors">
          <Plus size={14} /> Upload
        </button>
      </div>

      <div className="flex border-b border-soft-100">
        <button 
          onClick={() => setActiveTab("ALL")}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "ALL" ? "border-pastel-500 text-pastel-600" : "border-transparent text-foreground/60 hover:text-foreground"}`}
        >
          All Media
        </button>
        <button 
          onClick={() => setActiveTab("COLLECTIONS")}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "COLLECTIONS" ? "border-pastel-500 text-pastel-600" : "border-transparent text-foreground/60 hover:text-foreground"}`}
        >
          Collections
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-soft-50">
        {activeTab === "ALL" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Mock Media Items */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-white border border-soft-100 rounded-xl flex flex-col items-center justify-center text-foreground/40 hover:border-pastel-300 transition-colors cursor-grab active:cursor-grabbing shadow-sm">
                <ImageIcon size={24} className="mb-2 opacity-50" />
                <span className="text-xs">Drag to plan</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="p-4 bg-white border border-soft-100 rounded-xl flex items-center justify-between cursor-pointer hover:border-pastel-300 transition-colors">
              <div className="flex items-center gap-3">
                <Folder className="text-pastel-500" size={20} />
                <span className="font-medium text-sm">Product Shots</span>
              </div>
              <span className="text-xs text-foreground/50">12 items</span>
            </div>
            <div className="p-4 bg-white border border-soft-100 rounded-xl flex items-center justify-between cursor-pointer hover:border-pastel-300 transition-colors">
              <div className="flex items-center gap-3">
                <Folder className="text-pastel-500" size={20} />
                <span className="font-medium text-sm">Behind the Scenes</span>
              </div>
              <span className="text-xs text-foreground/50">8 items</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
