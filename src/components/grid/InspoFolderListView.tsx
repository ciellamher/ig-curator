"use client";

import { useState } from "react";
import { SlotItem } from "@/types";
import {
  Plus,
  FolderHeart,
  Trash2,
  X,
  Circle,
  Grid3X3,
  Edit2,
} from "lucide-react";

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
    <div className="w-full flex flex-col p-4 sm:p-6 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderHeart size={22} className="text-slate-800 shrink-0" />
            <span className="truncate">Inspo Collections</span>
          </h2>
          <p className="text-xs text-foreground/50 mt-1 truncate">
            Organize real inspiration photos for Posts, Stories, & Highlights
          </p>
        </div>
      </div>

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
        {/* Add Folder Box */}
        <div
          onClick={() => {
            setNewTitle("");
            setSelectedColor(FOLDER_COLORS[0]);
            setIsCreating(true);
            setEditingFolderId(null);
          }}
          className="group relative bg-soft-50/50 hover:bg-soft-100 border-2 border-dashed border-soft-200 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[120px]"
        >
          <div className="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center mb-1.5">
            <Plus className="text-slate-700" size={16} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-bold text-slate-600">New Folder</span>
        </div>

        {folders.map((folder) => {
          const folderItems = allItems.filter((i) => i.folderId === folder.id);
          const postCount = folderItems.filter(
            (i) =>
              i.contentType === "InspoPost" ||
              !i.contentType ||
              i.contentType === "Post",
          ).length;
          const storyCount = folderItems.filter(
            (i) => i.contentType === "InspoStory" || i.contentType === "Story",
          ).length;
          const firstImage = folderItems.find(
            (i) => i.urls && i.urls.length > 0,
          )?.urls[0];

          return (
            <div
              key={folder.id}
              onClick={() => onFolderClick(folder.id)}
              className="group relative bg-white border border-soft-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[120px]"
            >
              {/* Edit & Delete Buttons (Always visible) */}
              <div className="absolute top-3 right-3 flex gap-1 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(folder);
                  }}
                  className="p-1.5 bg-soft-50 hover:bg-soft-100 text-slate-500 hover:text-slate-900 rounded-lg transition-all"
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
                  className="p-1.5 bg-soft-50 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-all"
                  title="Delete folder"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Folder Info */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 truncate pr-16 group-hover:text-slate-800">
                  {folder.text || "Untitled Folder"}
                </h3>
              </div>
              
              <div className="flex flex-col gap-1 mt-4 text-[11px] font-semibold text-slate-500 overflow-hidden">
                <span className="flex items-center gap-1.5 whitespace-nowrap truncate">
                  <Grid3X3 size={12} className="shrink-0" /> {postCount} Posts
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap truncate">
                  <Circle size={12} className="shrink-0" /> {storyCount} Stories
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
