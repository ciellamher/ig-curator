"use client"

import { SlotItem, ContentType } from "@/types"

interface EditorPanelProps {
  activeSlot: SlotItem | null;
  updateSlot: (id: string, updates: Partial<SlotItem>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EditorPanel({ activeSlot, updateSlot, onSave, isSaving }: EditorPanelProps) {
  if (!activeSlot) {
    return (
      <div className="bg-white rounded-[2rem] shadow-diffused p-8 h-full flex flex-col items-center justify-center text-foreground/40 border border-soft-100 min-h-[400px]">
        <p className="font-medium text-lg">Editor Panel</p>
        <p className="text-sm">Select a grid slot to edit</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-diffused p-6 h-full flex flex-col gap-6 border border-soft-100">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-lg text-foreground">Editing Slot</h3>
        <button 
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 bg-pastel-500 text-white rounded-full text-sm font-medium hover:bg-pastel-400 disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving..." : "Save to DB"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground/80">Content Type</label>
        <select
          value={activeSlot.contentType || "Post"}
          onChange={(e) => updateSlot(activeSlot.id, { contentType: e.target.value as ContentType })}
          className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-300 text-sm"
        >
          <option value="Post">Post</option>
          <option value="Reel">Reel</option>
          <option value="Carousel">Carousel</option>
          <option value="Story">Story</option>
        </select>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <label className="text-sm font-medium text-foreground/80">Caption & Hashtags</label>
        <textarea
          value={activeSlot.caption || ""}
          onChange={(e) => updateSlot(activeSlot.id, { caption: e.target.value })}
          placeholder="Write a caption..."
          className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-300 text-sm flex-1 min-h-[120px] resize-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground/80">Audio/Song Track</label>
        <input
          type="text"
          value={activeSlot.audioTrack || ""}
          onChange={(e) => updateSlot(activeSlot.id, { audioTrack: e.target.value })}
          placeholder="e.g. Lofi Girl - chill beats"
          className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-300 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground/80">Schedule Time</label>
        <input
          type="datetime-local"
          value={activeSlot.scheduledTime || ""}
          onChange={(e) => updateSlot(activeSlot.id, { scheduledTime: e.target.value })}
          className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-300 text-sm text-foreground"
        />
      </div>

      <div className="border-t border-soft-200 my-2 pt-4 flex flex-col gap-4">
        <h4 className="text-sm font-medium text-foreground">Placeholder Appearance</h4>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground/80">Hex Color</label>
          <input
            type="text"
            value={activeSlot.hexColor || ""}
            onChange={(e) => updateSlot(activeSlot.id, { hexColor: e.target.value })}
            placeholder="#fdfdfd"
            className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-300 text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground/80">Overlay Text</label>
          <input
            type="text"
            value={activeSlot.text || ""}
            onChange={(e) => updateSlot(activeSlot.id, { text: e.target.value })}
            placeholder="Moodboard text..."
            className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-300 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
