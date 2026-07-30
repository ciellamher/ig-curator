"use client"

import { useState } from "react";
import { SlotItem } from "@/types";
import { Plus, FolderHeart, Trash2, Image as ImageIcon, Sparkles, X, Circle, Grid3X3 } from "lucide-react";

interface InspoFolderListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  onAddFolder: (title: string, hexColor?: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

const FOLDER_COLORS = [
  "#E5D3C8",
  "#F3E8EE",
  "#E2ECE9",
  "#EAE4E9",
  "#FDFBFA",
  "#D8E2DC",
  "#FFE5D9",
  "#F4ACB7",
];

export function InspoFolderListView({
  folders,
  allItems,
  onFolderClick,
  onAddFolder,
  onDeleteFolder,
}: InspoFolderListViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddFolder(newTitle.trim(), selectedColor);
    setNewTitle("");
    setIsCreating(false);
  };

  return (
    <div className="w-full flex flex-col p-4 sm:p-6 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FolderHeart size={20} className="text-slate-800" />
            <span>Inspo Collections</span>
          </h2>
          <p className="text-xs text-foreground/50 mt-0.5">
            Organize real inspiration photos for Posts, Stories, & Highlights
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>New Inspo Folder</span>
        </button>
      </div>

      {/* Create Folder Modal */}
      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white border border-soft-200 rounded-2xl shadow-lg flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Create Inspo Folder</h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="p-1 text-foreground/40 hover:text-foreground rounded-full cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-foreground/60">Folder Name</label>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Japan, Summer Campaign, Outfit Ideas..."
              className="p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground/60">Theme Color</label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer shrink-0 ${
                    selectedColor === color ? "border-slate-900 scale-110 shadow-xs" : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 text-xs font-semibold text-foreground/60 hover:text-foreground rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-4 py-1.5 bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Create Folder
            </button>
          </div>
        </form>
      )}

      {/* Folders Grid */}
      {folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-dashed border-soft-300 my-4">
          <div className="w-14 h-14 bg-pastel-100 rounded-full flex items-center justify-center mb-3 text-slate-800">
            <FolderHeart size={26} strokeWidth={1.8} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Inspo Folders Yet</h3>
          <p className="text-xs text-foreground/50 max-w-xs mt-1 mb-4">
            Create folders like <span className="font-semibold text-slate-800">Japan</span> or <span className="font-semibold text-slate-800">Minimal Moodboard</span> to save real photos for Posts & Stories.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-black transition-all cursor-pointer shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Create First Inspo Folder</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
          {folders.map((folder) => {
            const folderItems = allItems.filter((i) => i.folderId === folder.id);
            const postCount = folderItems.filter((i) => i.contentType === "InspoPost" || !i.contentType || i.contentType === "Post").length;
            const storyCount = folderItems.filter((i) => i.contentType === "InspoStory" || i.contentType === "Story").length;
            const firstImage = folderItems.find((i) => i.urls && i.urls.length > 0)?.urls[0];

            return (
              <div
                key={folder.id}
                onClick={() => onFolderClick(folder.id)}
                className="group relative bg-white border border-soft-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
              >
                {/* Thumbnail Cover Box */}
                <div
                  className="w-full aspect-[4/3] relative flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: folder.hexColor || "#E5D3C8" }}
                >
                  {firstImage ? (
                    <img
                      src={firstImage}
                      alt={folder.text}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-slate-800/60">
                      <FolderHeart size={28} strokeWidth={1.8} />
                      <span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">Inspo</span>
                    </div>
                  )}

                  {/* Delete Button on Hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete inspo folder "${folder.text}" and all its photos?`)) {
                        onDeleteFolder(folder.id);
                      }
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-foreground/40 hover:text-red-600 rounded-lg shadow-xs opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    title="Delete folder"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Folder Info Footer */}
                <div className="p-3 flex flex-col justify-between flex-1 bg-white">
                  <h3 className="text-xs font-bold text-slate-900 truncate group-hover:text-slate-800">
                    {folder.text || "Untitled Folder"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] font-medium text-foreground/50">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Grid3X3 size={11} /> {postCount} Posts
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Circle size={11} /> {storyCount} Stories
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
