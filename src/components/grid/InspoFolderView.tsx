"use client"

import { useState, useRef } from "react";
import { SlotItem } from "@/types";
import { ChevronLeft, Plus, Upload, Trash2, Grid3X3, Circle, ArrowUpToLine, Image as ImageIcon, Sparkles, X, ChevronRight } from "lucide-react";

interface InspoFolderViewProps {
  folder: SlotItem;
  itemsInFolder: SlotItem[];
  onBack: () => void;
  updateItems: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  onCopyToMainGrid: (item: SlotItem, targetType: "Post" | "Story") => void;
}

export function InspoFolderView({
  folder,
  itemsInFolder,
  onBack,
  updateItems,
  updateItem,
  onCopyToMainGrid,
}: InspoFolderViewProps) {
  const [subTab, setSubTab] = useState<"posts" | "stories">("posts");
  const [isUploading, setIsUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<SlotItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedItems = itemsInFolder.filter((i) => {
    if (subTab === "posts") {
      return i.contentType === "InspoPost" || !i.contentType || i.contentType === "Post";
    } else {
      return i.contentType === "InspoStory" || i.contentType === "Story";
    }
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const base64Promises = files.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_SIZE = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height = Math.round((height * MAX_SIZE) / width);
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width = Math.round((width * MAX_SIZE) / height);
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));

      const newBase64Strings = await Promise.all(base64Promises);
      
      // Create new Inspo items for each uploaded file
      const newItems: SlotItem[] = newBase64Strings.map((base64, index) => ({
        id: `inspo-item-${Math.floor(Math.random() * 1000000000)}-${index}`,
        type: "image",
        urls: [base64],
        currentUrlIndex: 0,
        hexColor: "#E5D3C8",
        text: "",
        folderId: folder.id,
        contentType: subTab === "posts" ? "InspoPost" : "InspoStory",
      }));

      updateItems((curr) => [...newItems, ...curr]);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteItem = (itemId: string) => {
    updateItems((curr) => curr.filter((i) => i.id !== itemId));
    if (previewItem?.id === itemId) setPreviewItem(null);
  };

  return (
    <div className="w-full flex flex-col p-3 sm:p-6 pb-24">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept="image/*"
        multiple
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 bg-white border border-soft-200 text-slate-800 hover:bg-soft-100 rounded-full shadow-xs transition-all cursor-pointer"
            title="Back to Inspo Collections"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">
              {folder.text || "Inspo Folder"}
            </h2>
            <span className="text-[11px] font-medium text-foreground/50">
              {itemsInFolder.length} total inspo media
            </span>
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-40"
        >
          <Upload size={14} strokeWidth={2.2} />
          <span>{isUploading ? "Uploading..." : `Add ${subTab === "posts" ? "Post" : "Story"} Inspo`}</span>
        </button>
      </div>

      {/* Sub-Tabs Toggle: Posts vs Stories */}
      <div className="bg-white border border-soft-200 p-1 rounded-2xl flex gap-1 mb-5 shadow-2xs">
        <button
          onClick={() => setSubTab("posts")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === "posts"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-foreground/50 hover:text-slate-900"
          }`}
        >
          <Grid3X3 size={15} />
          <span>Posts & Feed ({itemsInFolder.filter((i) => i.contentType === "InspoPost" || !i.contentType || i.contentType === "Post").length})</span>
        </button>

        <button
          onClick={() => setSubTab("stories")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === "stories"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-foreground/50 hover:text-slate-900"
          }`}
        >
          <Circle size={15} />
          <span>Stories & Highlights ({itemsInFolder.filter((i) => i.contentType === "InspoStory" || i.contentType === "Story").length})</span>
        </button>
      </div>

      {/* Inspo Grid View */}
      {displayedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-3xl border border-dashed border-soft-300 my-4">
          <div className="w-12 h-12 bg-soft-100 rounded-full flex items-center justify-center mb-3 text-slate-700">
            {subTab === "posts" ? <Grid3X3 size={22} /> : <Circle size={22} />}
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            No {subTab === "posts" ? "Posts" : "Stories"} Inspo Photos Yet
          </h3>
          <p className="text-xs text-foreground/50 max-w-xs mt-1 mb-4">
            Upload real inspiration photos for your {subTab === "posts" ? "main feed posts" : "story & highlight ideas"}.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-black transition-all cursor-pointer shadow-xs"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Upload {subTab === "posts" ? "Post" : "Story"} Photo</span>
          </button>
        </div>
      ) : (
        <div className={`grid ${subTab === "posts" ? "grid-cols-3 gap-[1px] bg-white" : "grid-cols-3 gap-2"}`}>
          {displayedItems.map((item) => {
            const hasImage = item.urls && item.urls.length > 0;

            return (
              <div
                key={item.id}
                onClick={() => setPreviewItem(item)}
                className={`
                  relative overflow-hidden cursor-pointer group select-none transition-all duration-150 bg-soft-100
                  ${subTab === "stories" ? "aspect-[9/16] rounded-xl shadow-xs border border-soft-200" : "aspect-[4/5]"}
                  hover:ring-2 hover:ring-slate-900/60 hover:ring-inset
                `}
              >
                {hasImage ? (
                  <img
                    src={item.urls[item.currentUrlIndex || 0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-2"
                    style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                  >
                    <span className="text-white text-xs font-bold">{item.text || "Inspo"}</span>
                  </div>
                )}

                {/* Quick Copy Action Overlay on Hover */}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 z-20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyToMainGrid(item, subTab === "posts" ? "Post" : "Story");
                    }}
                    className="px-2.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-[10px] font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    title="Copy photo to Main Planner"
                  >
                    <ArrowUpToLine size={12} strokeWidth={2.5} />
                    <span>Copy to Grid</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="p-1 bg-white/90 hover:bg-red-50 text-red-600 rounded-md transition-colors cursor-pointer"
                    title="Delete inspo photo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Preview & Transfer Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-soft-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Inspo Photo Preview</span>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 text-foreground/40 hover:text-foreground rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Photo Preview */}
            <div className="w-full aspect-[4/5] bg-soft-100 relative overflow-hidden">
              {previewItem.urls && previewItem.urls.length > 0 ? (
                <img
                  src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: previewItem.hexColor || "#E5D3C8" }}
                >
                  <span className="text-white font-bold">{previewItem.text}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 flex flex-col gap-2 bg-soft-50">
              <button
                onClick={() => {
                  onCopyToMainGrid(previewItem, subTab === "posts" ? "Post" : "Story");
                  setPreviewItem(null);
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowUpToLine size={16} strokeWidth={2.2} />
                <span>Copy to {subTab === "posts" ? "Main Feed Grid" : "Story Feed"}</span>
              </button>

              <button
                onClick={() => handleDeleteItem(previewItem.id)}
                className="w-full py-2 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Delete Inspo Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
