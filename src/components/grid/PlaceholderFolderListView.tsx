"use client"

import { useState } from "react";
import { SlotItem } from "@/types";
import { FolderPlus, Folder, ChevronRight, Trash2, Layers, Plus } from "lucide-react";

interface PlaceholderFolderListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

export function PlaceholderFolderListView({
  folders,
  allItems,
  onFolderClick,
  updateItem,
  onCreateFolder,
  onDeleteFolder,
}: PlaceholderFolderListViewProps) {
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim() || "New Placeholder Folder";
    onCreateFolder(name);
    setNewFolderName("");
    setIsCreating(false);
  };

  return (
    <div className="w-full flex flex-col bg-white h-full overflow-y-auto pb-12">
      {/* Header Bar inside list view */}
      <div className="flex items-center justify-between p-4 sm:px-6 border-b border-soft-100 bg-soft-50/50">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Folder className="text-pastel-600" size={20} />
            <span>Placeholder Folders</span>
          </h2>
          <p className="text-xs text-foreground/60 mt-0.5">
            Store and organize design concepts before moving them to your main grid.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white hover:bg-black rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Folder</span>
          </button>
        )}
      </div>

      {/* Inline Create Folder Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-4 bg-pastel-50 border-b border-pastel-200 flex items-center gap-2 animate-in slide-in-from-top-2">
          <Folder className="text-pastel-600 shrink-0" size={20} />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name (e.g., Summer Launch, Aesthetic Grid)..."
            autoFocus
            className="flex-1 px-3 py-1.5 bg-white border border-soft-200 rounded-xl text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-slate-800"
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="px-3 py-1.5 text-foreground/60 hover:text-foreground text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Folders List */}
      {folders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto min-h-[300px]">
          <div className="w-16 h-16 bg-pastel-100 text-pastel-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <FolderPlus size={32} />
          </div>
          <h3 className="text-base font-bold text-foreground">No placeholder folders yet</h3>
          <p className="text-xs text-foreground/60 max-w-xs mt-1 mb-4">
            Create folders to store your draft slots, colors, and layout ideas off the main dashboard.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black transition-all cursor-pointer"
          >
            <Plus size={14} /> Create Your First Folder
          </button>
        </div>
      ) : (
        <div className="divide-y divide-soft-100">
          {folders.map((folder) => {
            const innerItems = allItems.filter((i) => i.folderId === folder.id);
            const previewItems = innerItems.slice(0, 4);

            return (
              <div
                key={folder.id}
                onClick={() => onFolderClick(folder.id)}
                className="w-full flex items-center justify-between p-4 sm:px-6 cursor-pointer hover:bg-soft-50 transition-colors group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Folder Preview Box */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-soft-200 bg-soft-100 p-1.5 flex flex-wrap gap-1 shrink-0 shadow-xs relative overflow-hidden group-hover:border-slate-300 transition-colors">
                    {previewItems.length > 0 ? (
                      previewItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="w-[calc(50%-2px)] h-[calc(50%-2px)] rounded-md overflow-hidden border border-white/60 shadow-2xs"
                          style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                        >
                          {item.type === "image" && item.urls[item.currentUrlIndex] && (
                            <img
                              src={item.urls[item.currentUrlIndex]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-foreground/30">
                        <Layers size={20} />
                      </div>
                    )}
                  </div>

                  {/* Folder Title & Metadata */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <input
                      value={folder.text || folder.caption || ""}
                      onChange={(e) => updateItem(folder.id, { text: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Folder Name"
                      className="font-bold text-foreground text-base sm:text-lg tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-slate-300 rounded px-1 -ml-1 w-full truncate"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pastel-100 text-pastel-700">
                        {innerItems.length} {innerItems.length === 1 ? "placeholder box" : "placeholder boxes"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Are you sure you want to delete this folder and its placeholder boxes?")) {
                        onDeleteFolder(folder.id);
                      }
                    }}
                    className="p-2 text-foreground/30 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-80 group-hover:opacity-100"
                    title="Delete Folder"
                  >
                    <Trash2 size={18} />
                  </button>
                  <ChevronRight size={20} className="text-foreground/30 group-hover:text-foreground/70 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
