"use client";

import { useState } from "react";
import { SlotItem } from "@/types";
import { Plus, FolderHeart, Trash2, X, Edit2, ChevronLeft } from "lucide-react";

interface InspoFolderListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  onAddFolder: (title: string, hexColor?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  updateItem?: (id: string, updates: Partial<SlotItem>) => void;
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
  updateItem,
}: InspoFolderListViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (editingFolderId && updateItem) {
      updateItem(editingFolderId, {
        text: newTitle.trim(),
        hexColor: selectedColor,
      });
      setEditingFolderId(null);
    } else {
      onAddFolder(newTitle.trim(), selectedColor);
      setIsCreating(false);
    }
    setNewTitle("");
  };

  const openEditModal = (folder: SlotItem) => {
    setEditingFolderId(folder.id);
    setNewTitle(folder.text || "");
    setSelectedColor(folder.hexColor || FOLDER_COLORS[0]);
  };

  return (
    <div className="w-full flex flex-col pb-24">
      {/* iOS Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-soft-100 px-4 py-3 flex items-center justify-between">
        <button className="p-1 -ml-1 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer opacity-0 pointer-events-none">
          <ChevronLeft size={28} strokeWidth={1.5} />
        </button>

        <h2 className="text-base font-bold text-slate-900 leading-tight">
          Inspo Collections
        </h2>

        <button
          onClick={() => {
            setNewTitle("");
            setSelectedColor(FOLDER_COLORS[0]);
            setIsCreating(true);
            setEditingFolderId(null);
          }}
          className="p-1 -mr-1 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer"
          title="New Collection"
        >
          <Plus size={28} strokeWidth={1.5} />
        </button>
      </div>

      <div className="px-4 py-4">
        {/* Create / Edit Folder Modal */}
        {(isCreating || editingFolderId) && (
          <form
            onSubmit={handleCreateOrEdit}
            className="mb-6 p-4 bg-white border border-soft-200 rounded-2xl shadow-lg flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                {editingFolderId ? "Edit Folder" : "Create Inspo Folder"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingFolderId(null);
                }}
                className="p-1 text-foreground/40 hover:text-foreground rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-foreground/60">
                Folder Name
              </label>
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
              <label className="text-[11px] font-bold text-foreground/60">
                Theme Color
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer shrink-0 ${
                      selectedColor === color
                        ? "border-slate-900 scale-110 shadow-xs"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingFolderId(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-foreground/60 hover:text-foreground rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {editingFolderId ? "Save Changes" : "Create Folder"}
              </button>
            </div>
          </form>
        )}

        {/* Folders Grid */}
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5">
          {folders.map((folder) => {
            const folderItems = allItems.filter(
              (i) => i.folderId === folder.id,
            );
            const firstImage = folderItems.find(
              (i) => i.urls && i.urls.length > 0,
            )?.urls[0];

            return (
              <div
                key={folder.id}
                onClick={() => onFolderClick(folder.id)}
                className="group cursor-pointer flex flex-col gap-2"
              >
                <div
                  className="w-full aspect-square rounded-xl overflow-hidden relative shadow-sm border border-soft-200/50"
                  style={{ backgroundColor: folder.hexColor || "#E5D3C8" }}
                >
                  {firstImage && (
                    <img
                      src={firstImage}
                      alt={folder.text}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Subtle Edit & Delete Buttons on hover */}
                  <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(folder);
                      }}
                      className="p-1.5 bg-white/80 backdrop-blur-sm text-slate-700 hover:text-slate-900 rounded-lg shadow-sm"
                      title="Edit folder"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Delete inspo folder "${folder.text}" and all its photos?`,
                          )
                        ) {
                          onDeleteFolder(folder.id);
                        }
                      }}
                      className="p-1.5 bg-white/80 backdrop-blur-sm text-slate-700 hover:text-red-600 rounded-lg shadow-sm"
                      title="Delete folder"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Folder Title */}
                <h3 className="text-[13px] font-bold text-slate-900 truncate px-1">
                  {folder.text || "Untitled Folder"}
                </h3>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
