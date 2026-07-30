"use client"

import { useState } from "react";
import { SlotItem } from "@/types";
import { Folder, ChevronRight, Trash2, Layers, Plus } from "lucide-react";

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
    const name = newFolderName.trim() || "New Folder";
    onCreateFolder(name);
    setNewFolderName("");
    setIsCreating(false);
  };

  return (
    <div className="w-full flex flex-col bg-white h-full overflow-y-auto select-none">
      {/* Minimal Top Action Bar */}
      <div className="px-4 py-2.5 border-b border-soft-100 flex items-center justify-between bg-white sticky top-0 z-20">
        <span className="text-xs font-bold text-foreground/50 tracking-wider uppercase">
          Folders ({folders.length})
        </span>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-black text-white rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New Folder</span>
          </button>
        )}
      </div>

      {/* Inline Create Input */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-3 bg-soft-50 border-b border-soft-200 flex items-center gap-2 animate-in fade-in duration-150">
          <Folder size={16} className="text-foreground/50 shrink-0" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            autoFocus
            className="flex-1 px-2.5 py-1 bg-white border border-soft-200 rounded-lg text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-slate-800"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="px-2 py-1 text-foreground/40 hover:text-foreground text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Ultra Minimal Folder List */}
      {folders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto min-h-[260px]">
          <div className="w-12 h-12 rounded-2xl bg-soft-100 text-foreground/40 flex items-center justify-center mb-3">
            <Folder size={22} strokeWidth={1.8} />
          </div>
          <p className="text-xs font-bold text-foreground/80">No folders yet</p>
          <p className="text-[11px] text-foreground/40 mt-0.5 mb-4 max-w-[200px]">
            Store draft boxes off the main grid.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black transition-all cursor-pointer"
          >
            <Plus size={13} /> Create Folder
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
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-soft-50 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Folder Thumbnail / Stack */}
                  <div className="w-12 h-12 rounded-xl border border-soft-200 bg-soft-100 p-1 flex flex-wrap gap-0.5 shrink-0 relative overflow-hidden items-center justify-center">
                    {previewItems.length > 0 ? (
                      previewItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="w-[calc(50%-2px)] h-[calc(50%-2px)] rounded-sm overflow-hidden"
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
                      <Layers size={16} className="text-foreground/30" />
                    )}
                  </div>

                  {/* Clean Minimal Folder Name & Item Count */}
                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <input
                      value={folder.text || folder.caption || ""}
                      onChange={(e) => updateItem(folder.id, { text: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Folder Name"
                      className="font-bold text-foreground text-sm tracking-tight bg-transparent border-none outline-none focus:ring-1 focus:ring-slate-300 rounded px-0.5 -ml-0.5 w-full truncate"
                    />
                    <span className="text-[11px] font-medium text-foreground/50 mt-0.5">
                      {innerItems.length} {innerItems.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                </div>

                {/* Minimal Right Actions */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this folder?")) {
                        onDeleteFolder(folder.id);
                      }
                    }}
                    className="p-1.5 text-foreground/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Folder"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={16} className="text-foreground/30 group-hover:text-foreground/70 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
