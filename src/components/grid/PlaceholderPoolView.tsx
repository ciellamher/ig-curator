"use client"

import { useState } from "react";
import { SlotItem } from "@/types";
import { Plus, CheckSquare, Square, Check, ArrowUpToLine, Video, GalleryHorizontal, Trash2 } from "lucide-react";

interface PlaceholderPoolViewProps {
  placeholders: SlotItem[];
  updateItems: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
  onTransferToMainGrid: (selectedSlotIds: string[]) => void;
  isSearchActive?: boolean;
  searchResults?: string[];
  focusedMatchId?: string | null;
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

export function PlaceholderPoolView({
  placeholders,
  updateItems,
  updateItem,
  activeSlotId,
  setActiveSlotId,
  onTransferToMainGrid,
  isSearchActive,
  searchResults = [],
  focusedMatchId,
}: PlaceholderPoolViewProps) {
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
      id: `slot-draft-${Math.floor(Math.random() * 1000000000)}`,
      type: "placeholder",
      urls: [],
      currentUrlIndex: 0,
      hexColor: randomColor,
      text: "",
      contentType: "Post",
      folderId: "draft-pool",
    };
    updateItems((prev) => [newPlaceholder, ...prev]);
  };

  const handleDeleteDraft = (id: string) => {
    updateItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    if (activeSlotId === id) setActiveSlotId(null);
  };

  const handleTransfer = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    onTransferToMainGrid(selectedIds);
    setSelectedIds([]);
    setToastMessage(`Transferred ${count} ${count === 1 ? 'box' : 'boxes'} to Row 1 of Main Grid!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full flex flex-col bg-white h-full relative overflow-hidden select-none">
      {/* Minimal Action Header */}
      <div className="px-4 py-2 border-b border-soft-100 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
          Draft Boxes ({placeholders.length})
        </span>

        <div className="flex items-center gap-1.5">
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
            className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white hover:bg-black rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Add Box</span>
          </button>
        </div>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="mx-4 mt-2 p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-semibold shadow-md animate-in slide-in-from-top-2 z-40">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-400" strokeWidth={3} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto pb-24 bg-white">
        {placeholders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 pb-8 text-center">
            <p className="text-xs font-bold text-foreground/70">No draft boxes</p>
            <p className="text-[11px] text-foreground/40 mt-0.5 mb-4 max-w-[200px]">
              Add draft placeholders to plan off the main grid.
            </p>
            <button
              onClick={handleAddPlaceholder}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black transition-all cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Add First Draft Box</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[1px] bg-white w-full">
            {placeholders.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isActive = activeSlotId === item.id;
              const hasImage = item.type === "image" && item.urls && item.urls.length > 0;
              const isSearchResult = searchResults.includes(item.id);
              const isFocusedSearchMatch = focusedMatchId === item.id;

              return (
                <div
                  id={`grid-slot-${item.id}`}
                  key={item.id}
                  onClick={() => {
                    setActiveSlotId(item.id);
                  }}
                  className={`
                    relative w-full aspect-[4/5] overflow-hidden cursor-pointer group select-none transition-all duration-200
                    ${isSearchActive
                      ? isSearchResult
                        ? "ring-4 ring-slate-900 ring-offset-1 z-30 shadow-xl opacity-100 scale-[1.01]"
                        : "opacity-40 grayscale-[40%]"
                      : isActive 
                      ? "ring-4 ring-slate-900 ring-inset z-20" 
                      : "hover:ring-2 hover:ring-slate-300/60 hover:ring-inset"}
                    ${isSelected ? "brightness-95" : ""}
                  `}
                >
                  {hasImage ? (
                    <div className="w-full h-full relative overflow-hidden bg-soft-100">
                      <img
                        src={item.urls[item.currentUrlIndex || 0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center p-2 relative"
                      style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                    >
                      {item.text ? (
                        <span
                          className="text-white text-center font-extrabold drop-shadow-md leading-tight w-full break-words px-2"
                          style={{ fontSize: `${item.fontSize || 14}px` }}
                        >
                          {item.text}
                        </span>
                      ) : (
                        <span
                          className="text-white/90 text-center font-extrabold drop-shadow-md leading-tight w-full break-words px-2"
                          style={{ fontSize: `${item.fontSize || 14}px` }}
                        >
                          Draft
                        </span>
                      )}
                    </div>
                  )}

                  {/* Selection Checkbox Badge */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    className={`
                      absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all z-30 shadow-xs cursor-pointer active:scale-95
                      ${isSelected ? "bg-slate-900 text-white scale-105" : "bg-white/80 text-foreground/50 hover:bg-white hover:text-slate-900"}
                    `}
                    title={isSelected ? "Deselect box" : "Select box for transfer"}
                  >
                    {isSelected ? <Check size={14} strokeWidth={3} /> : <Square size={14} />}
                  </div>

                  {/* Delete Button on Hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDraft(item.id);
                    }}
                    className="absolute bottom-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-foreground/40 hover:text-red-600 rounded-md shadow-xs opacity-0 group-hover:opacity-100 transition-opacity z-30"
                    title="Delete box"
                  >
                    <Trash2 size={12} />
                  </button>

                  {/* Content Type Badges */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none z-20">
                    {item.contentType === "Reel" && (
                      <div className="bg-white/80 backdrop-blur text-foreground p-1 rounded-full shadow-xs">
                        <Video size={11} />
                      </div>
                    )}
                    {item.contentType === "Carousel" && (
                      <div className="bg-white/80 backdrop-blur text-foreground p-1 rounded-full shadow-xs">
                        <GalleryHorizontal size={11} />
                      </div>
                    )}
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
              {selectedIds.length} {selectedIds.length === 1 ? "Box Selected" : "Boxes Selected"}
            </span>

            <button
              onClick={handleTransfer}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
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
