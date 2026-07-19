"use client"

import { useState } from "react"
import { SlotItem, ContentType } from "@/types"

interface EditorPanelProps {
  activeSlot: SlotItem | null;
  updateSlot: (id: string, updates: Partial<SlotItem>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EditorPanel({ activeSlot, updateSlot, onSave, isSaving }: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "appearance">("details");

  if (!activeSlot) return null;

  return (
    <div className="p-6 flex flex-col gap-4 h-full max-h-[85vh] overflow-hidden">
      <div className="flex justify-between items-center pr-10">
        <h3 className="font-bold text-xl text-foreground tracking-tight">Edit Slot</h3>
      </div>

      <div className="flex gap-2 border-b border-soft-100 pb-2">
        <button 
          onClick={() => setActiveTab("details")}
          className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${activeTab === "details" ? "bg-soft-200 text-foreground" : "text-foreground/50 hover:bg-soft-50"}`}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab("appearance")}
          className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${activeTab === "appearance" ? "bg-soft-200 text-foreground" : "text-foreground/50 hover:bg-soft-50"}`}
        >
          Appearance
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-5 py-2">
        {activeTab === "details" ? (
          <>


            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Caption & Hashtags</label>
              <textarea
                value={activeSlot.caption || ""}
                onChange={(e) => updateSlot(activeSlot.id, { caption: e.target.value })}
                placeholder="Write a caption..."
                className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-foreground/30 text-[15px] min-h-[140px] resize-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Schedule Time</label>
              <input
                type="datetime-local"
                value={activeSlot.scheduledTime || ""}
                onChange={(e) => updateSlot(activeSlot.id, { scheduledTime: e.target.value })}
                className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-foreground/30 text-[15px] transition-colors"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Hex Color</label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={activeSlot.hexColor || ""}
                  onChange={(e) => updateSlot(activeSlot.id, { hexColor: e.target.value })}
                  placeholder="#E5D3C8"
                  className="flex-1 p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-foreground/30 text-[15px] transition-colors uppercase font-mono"
                />
                <div 
                  className="w-12 h-12 rounded-xl border border-soft-200 shadow-sm shrink-0" 
                  style={{ backgroundColor: activeSlot.hexColor }} 
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Overlay Text</label>
              <input
                type="text"
                value={activeSlot.text || ""}
                onChange={(e) => updateSlot(activeSlot.id, { text: e.target.value })}
                placeholder="Placeholder label..."
                className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-foreground/30 text-[15px] transition-colors"
              />
            </div>
          </>
        )}
      </div>

      <button 
        onClick={onSave}
        disabled={isSaving}
        className="w-full mt-2 py-3.5 bg-foreground text-white rounded-xl text-[15px] font-bold hover:bg-foreground/90 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
