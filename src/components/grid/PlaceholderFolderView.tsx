"use client"

import { useState } from "react";
import { SlotItem } from "@/types";
import { ChevronLeft, Plus, CheckSquare, Square, Trash2, Edit3, Image as ImageIcon, Check, ArrowUpToLine } from "lucide-react";

interface PlaceholderFolderViewProps {
  folder: SlotItem;
  placeholders: SlotItem[];
  onBack: () => void;
  updateItems: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
  onTransferToMainGrid: (selectedSlotIds: string[]) => void;
}

const PASTEL_COLORS = [
  "#E5D3C8",
  "#F3E8EE",
  "#E2ECE9",
  "#EAE4E9",
  "#FDFBFA",
  "#D8E2DC",
  "#FFE5D9",
  "#F4ACB7",
];

export function PlaceholderFolderView({
  folder,
  placeholders,
  onBack,
  updateItems,
  updateItem,
  activeSlotId,
  setActiveSlotId,
  onTransferToMainGrid,
}: PlaceholderFolderViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === placeholders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(placeholders.map((p) => p.id));
    }
  };

  const handleAddPlaceholder = () => {
    const randomColor = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
    const newPlaceholder: SlotItem = {
      id: `slot-${Math.floor(Math.random() * 1000000000)}`,
      type: "placeholder",
      urls: [],
      currentUrlIndex: 0,
      hexColor: randomColor,
      text: "",
      contentType: "Post",
      folderId: folder.id,
    };
    updateItems((prev) => [newPlaceholder, ...prev]);
  };

  const handleDeletePlaceholder = (id: string) => {
    updateItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    if (activeSlotId === id) setActiveSlotId(null);
  };

  const handleTransfer = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    onTransferToMainGrid(selectedIds);
    setSelectedIds([]);
    setToastMessage(`Transferred ${count} ${count === 1 ? 'box' : 'boxes'} to Row 1`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full flex flex-col bg-white h-full relative overflow-hidden select-none">
      {/* Minimal Header */}
      <div className="px-4 py-2.5 border-b border-soft-100 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-1 rounded-lg hover:bg-soft-100 text-foreground/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
            title="Back to Folders"
          >
            <ChevronLeft size={18} />
          </button>

          <input
            value={folder.text || folder.caption || ""}
            onChange={(e) => updateItem(folder.id, { text: e.target.value })}
            placeholder="Folder Name"
            className="font-bold text-foreground text-sm sm:text-base tracking-tight bg-transparent border-none outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 -ml-1 w-full truncate"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {placeholders.length > 0 && (
            <button
              onClick={selectAll}
              className="p-1.5 text-xs font-semibold text-foreground/60 hover:text-foreground rounded-lg transition-colors cursor-pointer"
              title={selectedIds.length === placeholders.length ? "Deselect All" : "Select All"}
            >
              {selectedIds.length === placeholders.length ? (
                <CheckSquare size={16} className="text-slate-900" />
              ) : (
                <Square size={16} />
              )}
            </button>
          )}

          <button
            onClick={handleAddPlaceholder}
            className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white hover:bg-black rounded-full text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Box</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mx-4 mt-2 p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-semibold shadow-md animate-in slide-in-from-top-2 z-40">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-400" strokeWidth={3} />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => onBack()}
            className="text-[11px] text-pastel-200 hover:underline cursor-pointer"
          >
            View Grid
          </button>
        </div>
      )}

      {/* Grid View */}
      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {placeholders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center">
            <div className="w-10 h-10 bg-soft-100 rounded-xl flex items-center justify-center mb-2 text-foreground/30">
              <ImageIcon size={20} />
            </div>
            <p className="text-xs font-bold text-foreground/70">Folder is empty</p>
            <button
              onClick={handleAddPlaceholder}
              className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black transition-all cursor-pointer"
            >
              <Plus size={13} /> Add Box
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {placeholders.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const hasImage = item.type === "image" && item.urls && item.urls.length > 0;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`
                    relative w-full aspect-[4/5] rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer group select-none
                    ${isSelected ? "border-slate-900 ring-2 ring-slate-900 shadow-sm" : "border-soft-200 hover:border-slate-400"}
                  `}
                  style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                >
                  {hasImage ? (
                    <img
                      src={item.urls[item.currentUrlIndex || 0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-1.5 flex flex-col justify-between items-center text-center">
                      <div className="w-full flex justify-end">
                        {/* Empty spacer */}
                      </div>
                      {item.text && (
                        <p className="text-[11px] font-bold text-foreground/80 line-clamp-3 px-0.5">
                          {item.text}
                        </p>
                      )}
                      <span className="text-[9px] text-foreground/40 font-semibold uppercase">
                        Box
                      </span>
                    </div>
                  )}

                  {/* Selection Badge */}
                  <div
                    className={`
                      absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center transition-all z-20 shadow-2xs
                      ${isSelected ? "bg-slate-900 text-white" : "bg-white/80 text-foreground/30 hover:bg-white"}
                    `}
                  >
                    {isSelected ? <Check size={12} strokeWidth={3} /> : <Square size={12} />}
                  </div>

                  {/* Hover Buttons */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlotId(item.id);
                      }}
                      className="p-1 bg-white/90 hover:bg-white text-slate-800 rounded shadow-xs"
                      title="Edit"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlaceholder(item.id);
                      }}
                      className="p-1 bg-white/90 hover:bg-red-50 text-red-600 rounded shadow-xs"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="absolute bottom-3 inset-x-3 z-40 animate-in slide-in-from-bottom-3">
          <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl flex items-center justify-between">
            <span className="text-xs font-bold pl-1">
              {selectedIds.length} {selectedIds.length === 1 ? "Selected" : "Selected"}
            </span>

            <button
              onClick={handleTransfer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <ArrowUpToLine size={14} strokeWidth={2.5} />
              <span>Transfer to Row 1</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
