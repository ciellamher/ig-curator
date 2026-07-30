"use client";

import { useState, useRef } from "react";
import { SlotItem } from "@/types";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Grid3X3,
  X,
  Download,
  PlaySquare,
  UserSquare2,
} from "lucide-react";
import { StoryFolderView } from "./StoryFolderView";

interface InspoFolderViewProps {
  folder: SlotItem;
  itemsInFolder: SlotItem[];
  allItems: SlotItem[];
  onBack: () => void;
  updateItems: (
    newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[]),
  ) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  onCopyToMainGrid: (item: SlotItem, targetType: "Post" | "Story") => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
}

export function InspoFolderView({
  folder,
  itemsInFolder,
  allItems,
  onBack,
  updateItems,
  updateItem,
  onCopyToMainGrid,
  activeSlotId,
  setActiveSlotId,
}: InspoFolderViewProps) {
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<SlotItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Treat all old InspoStories and new InspoHighlights as Highlight Folders
  const highlightFolders = itemsInFolder.filter(
    (i) =>
      i.contentType === "InspoHighlight" ||
      i.contentType === "InspoStory" ||
      i.contentType === "Story",
  );

  const postItems = itemsInFolder.filter(
    (i) =>
      i.contentType === "InspoPost" ||
      !i.contentType ||
      i.contentType === "Post",
  );

  // If a highlight is open, render the StoryFolderView!
  if (activeHighlightId) {
    const highlightFolder = itemsInFolder.find(
      (i) => i.id === activeHighlightId,
    );
    if (highlightFolder) {
      return (
        <StoryFolderView
          folder={highlightFolder}
          stories={allItems.filter((i) => i.folderId === activeHighlightId)}
          onBack={() => setActiveHighlightId(null)}
          updateItems={updateItems}
          updateItem={updateItem}
          activeSlotId={activeSlotId}
          setActiveSlotId={setActiveSlotId}
        />
      );
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadPosts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const base64Promises = files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
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
          }),
      );

      const newBase64Strings = await Promise.all(base64Promises);

      // Create new InspoPost items
      const newItems: SlotItem[] = newBase64Strings.map((base64, index) => ({
        id: `inspo-item-${Math.floor(Math.random() * 1000000000)}-${index}`,
        type: "image",
        urls: [base64],
        currentUrlIndex: 0,
        hexColor: "#E5D3C8",
        text: "",
        folderId: folder.id,
        contentType: "InspoPost",
      }));

      updateItems((curr) => [...newItems, ...curr]);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleAddHighlight = () => {
    const newHighlight: SlotItem = {
      id: `inspo-highlight-${Math.floor(Math.random() * 1000000000)}`,
      type: "placeholder",
      urls: [],
      currentUrlIndex: 0,
      hexColor: "#E5D3C8",
      text: "New Folder",
      folderId: folder.id,
      contentType: "InspoHighlight",
    };
    updateItems((curr) => [newHighlight, ...curr]);
    setActiveHighlightId(newHighlight.id); // auto-open it
  };

  const handleDeleteItem = (itemId: string) => {
    updateItems((curr) => curr.filter((i) => i.id !== itemId));
    if (previewItem?.id === itemId) setPreviewItem(null);
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-[calc(100vh-80px)]">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadPosts}
        className="hidden"
        accept="image/*"
        multiple
      />

      {/* Header Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-soft-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer"
          title="Back to Collections"
        >
          <ChevronLeft size={28} strokeWidth={1.5} />
        </button>

        <h2 className="text-base font-bold text-slate-900 leading-tight">
          {folder.text || "Inspo Folder"}
        </h2>

        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className="p-1 -mr-1 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer"
          title="Add new post inspo"
        >
          <Plus size={28} strokeWidth={1.5} />
        </button>
      </div>

      {/* Highlights (Collections of Stories) Section */}
      <div className="w-full overflow-x-auto no-scrollbar py-4 px-4 border-b border-soft-100 flex gap-4 sm:gap-6 items-start">
        {/* Add Highlight Button */}
        <div
          className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
          onClick={handleAddHighlight}
        >
          <div className="w-[68px] h-[68px] rounded-full border border-soft-300 flex items-center justify-center bg-white shadow-xs">
            <Plus size={28} strokeWidth={1.5} className="text-slate-900" />
          </div>
          <span className="text-xs text-slate-900 font-medium mt-1">New</span>
        </div>

        {highlightFolders.map((item) => (
          <div
            key={item.id}
            className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group"
            onClick={() => setActiveHighlightId(item.id)}
          >
            <div className="w-[72px] h-[72px] rounded-full p-[2px] border border-soft-300 hover:border-slate-400 transition-colors relative">
              <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-soft-100 relative">
                {item.urls && item.urls.length > 0 ? (
                  <img
                    src={item.urls[item.currentUrlIndex || 0]}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                  />
                )}
              </div>

              {/* Delete Highlight (Subtle button on hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete highlight "${item.text}"?`)) {
                    handleDeleteItem(item.id);
                  }
                }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-white/90 rounded-full shadow-sm text-red-500 hover:text-red-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-soft-200"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <span className="text-[11px] text-slate-900 font-medium truncate w-[72px] text-center">
              {item.text || "Highlight"}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-soft-100">
        <div className="flex-1 py-3 text-center border-b-2 border-slate-900 text-slate-900 font-bold text-sm">
          <Grid3X3 className="inline-block mr-2 -mt-1" size={16} />
          Feed Inspo
        </div>
        <div className="flex-1 py-3 text-center border-b-2 border-transparent text-foreground/40 font-bold text-sm">
          <PlaySquare className="inline-block mr-2 -mt-1" size={16} />
          Reels
        </div>
        <div className="flex-1 py-3 text-center border-b-2 border-transparent text-foreground/40 font-bold text-sm">
          <UserSquare2 className="inline-block mr-2 -mt-1" size={16} />
          Tags
        </div>
      </div>

      {/* Grid (Posts) Section */}
      {postItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-foreground/40">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-soft-200 flex items-center justify-center mb-4">
            <Plus size={24} className="text-soft-300" />
          </div>
          <p className="text-sm font-medium mb-1">No post inspo yet</p>
          <p className="text-xs">Tap + at top right to add photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px] pb-24 bg-white">
          {postItems.map((item) => (
            <div
              key={item.id}
              className="aspect-[3/4] relative cursor-pointer group bg-soft-100 overflow-hidden"
              onClick={() => setPreviewItem(item)}
            >
              {item.urls && item.urls.length > 0 ? (
                <img
                  src={item.urls[item.currentUrlIndex || 0]}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: item.hexColor || "#E5D3C8" }}
                />
              )}

              {/* Overlay Buttons */}
              <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-20">
                {item.urls && item.urls.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement("a");
                      link.href = item.urls[item.currentUrlIndex || 0];
                      link.download = `inspo-${item.id}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                    title="Download photo"
                  >
                    <Download size={13} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this photo?")) {
                      handleDeleteItem(item.id);
                    }
                  }}
                  className="p-1.5 bg-white/80 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                  title="Delete photo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Preview Modal (For Posts Only now) */}
      {previewItem && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center">
          <div
            className={`rounded-3xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 mx-4 shadow-2xl bg-white`}
          >
            {/* Modal Header */}
            <div className="p-4 flex items-center justify-between bg-white border-b border-soft-100">
              <span className="text-sm font-bold text-slate-900">
                Post Preview
              </span>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-full cursor-pointer transition-colors text-slate-500 hover:text-slate-900 hover:bg-soft-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Photo Preview */}
            <div className="relative flex w-full items-center justify-center overflow-hidden bg-black aspect-[3/4] bg-soft-100">
              {previewItem.urls && previewItem.urls.length > 0 ? (
                <img
                  src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: previewItem.hexColor || "#E5D3C8" }}
                />
              )}
            </div>

            {/* Actions & Caption */}
            <div className="p-4 flex flex-col gap-3 bg-white">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-foreground/60 uppercase tracking-wider">
                  Caption / Notes
                </label>
                <textarea
                  value={previewItem.text || ""}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setPreviewItem({ ...previewItem, text: newText });
                    updateItem(previewItem.id, { text: newText });
                  }}
                  placeholder="Jot down ideas, captions, or notes for this photo..."
                  className="w-full h-24 p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
