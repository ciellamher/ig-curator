"use client"

import { useState } from "react";
import { SlotItem } from "@/types";
import { ChevronLeft, Plus, CheckSquare, Square, Send, Trash2, Edit3, Image as ImageIcon, Sparkles, Check, ArrowUpToLine } from "lucide-react";

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
    setToastMessage(`Transferred ${count} ${count === 1 ? 'box' : 'boxes'} to the first row of your main grid!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="w-full flex flex-col bg-white h-full relative overflow-hidden">
      {/* Folder Header */}
      <div className="p-3 sm:p-4 border-b border-soft-100 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-foreground/70 hover:text-foreground px-2.5 py-1.5 rounded-full bg-soft-100 hover:bg-soft-200 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Folders</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddPlaceholder}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-black rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add Box</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 px-1">
          <div>
            <input
              value={folder.text || folder.caption || ""}
              onChange={(e) => updateItem(folder.id, { text: e.target.value })}
              placeholder="Folder Name"
              className="font-bold text-foreground text-lg sm:text-xl tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-slate-300 rounded px-1 -ml-1 w-full"
            />
            <p className="text-xs text-foreground/50 px-1">
              Select boxes to transfer them straight to row 1 of your main grid.
            </p>
          </div>

          {placeholders.length > 0 && (
            <button
              onClick={selectAll}
              className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-soft-200 bg-soft-50 hover:bg-soft-100 transition-colors cursor-pointer shrink-0"
            >
              {selectedIds.length === placeholders.length ? (
                <>
                  <CheckSquare size={14} className="text-slate-900" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={14} />
                  <span>Select All</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="mx-4 mt-3 p-3 bg-emerald-950 text-emerald-100 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-lg animate-in slide-in-from-top-3 z-40 border border-emerald-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center font-bold">
              <Check size={13} strokeWidth={3} />
            </div>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => onBack()}
            className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            View Main Grid
          </button>
        </div>
      )}

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-28">
        {placeholders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 pb-12 text-center">
            <div className="w-14 h-14 bg-soft-100 rounded-full flex items-center justify-center mb-3 text-foreground/40">
              <ImageIcon size={28} />
            </div>
            <p className="text-foreground/70 font-semibold text-sm">This folder is empty</p>
            <p className="text-foreground/40 text-xs mt-1 mb-4">Add placeholder boxes to start designing off-grid.</p>
            <button
              onClick={handleAddPlaceholder}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black transition-all cursor-pointer"
            >
              <Plus size={14} /> Add First Placeholder Box
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {placeholders.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isActive = activeSlotId === item.id;
              const hasImage = item.type === "image" && item.urls && item.urls.length > 0;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`
                    relative w-full aspect-[4/5] rounded-2xl overflow-hidden border-2 transition-all duration-150 cursor-pointer group select-none shadow-xs
                    ${isSelected ? "border-slate-900 ring-4 ring-slate-900/20 scale-[0.98]" : "border-soft-200 hover:border-slate-400"}
                  `}
                  style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                >
                  {/* Image Content if any */}
                  {hasImage ? (
                    <img
                      src={item.urls[item.currentUrlIndex || 0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-foreground/50 tracking-wider uppercase px-1.5 py-0.5 rounded bg-black/5 backdrop-blur-xs">
                          {item.contentType || "Post"}
                        </span>
                      </div>

                      {item.text && (
                        <p className="text-xs font-bold text-foreground/80 line-clamp-3 text-center px-1">
                          {item.text}
                        </p>
                      )}

                      <div className="text-[10px] text-foreground/40 font-medium text-center">
                        Placeholder
                      </div>
                    </div>
                  )}

                  {/* Selection Checkbox Badge */}
                  <div
                    className={`
                      absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center transition-all z-20 shadow-sm
                      ${isSelected ? "bg-slate-900 text-white scale-110" : "bg-white/80 backdrop-blur-xs text-foreground/40 hover:bg-white"}
                    `}
                  >
                    {isSelected ? <Check size={14} strokeWidth={3} /> : <Square size={14} />}
                  </div>

                  {/* Action Overlay buttons */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlotId(item.id);
                      }}
                      className="p-1.5 bg-white/90 backdrop-blur-xs hover:bg-white text-slate-800 rounded-lg shadow-sm transition-all"
                      title="Edit slot details"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlaceholder(item.id);
                      }}
                      className="p-1.5 bg-white/90 backdrop-blur-xs hover:bg-red-50 text-red-600 rounded-lg shadow-sm transition-all"
                      title="Delete slot"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Bar when boxes are selected */}
      {selectedIds.length > 0 && (
        <div className="absolute bottom-4 inset-x-4 z-40 animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 pl-2">
              <div className="w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold text-xs">
                {selectedIds.length}
              </div>
              <span className="text-xs sm:text-sm font-bold">
                {selectedIds.length === 1 ? "1 Box Selected" : `${selectedIds.length} Boxes Selected`}
              </span>
            </div>

            <button
              onClick={handleTransfer}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 hover:bg-pastel-100 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <ArrowUpToLine size={16} strokeWidth={2.5} />
              <span>Transfer to Main Grid (Row 1)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
