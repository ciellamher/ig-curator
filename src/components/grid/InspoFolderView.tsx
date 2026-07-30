"use client";

import { useState, useRef } from "react";
import { SlotItem } from "@/types";
import {
  ChevronLeft,
  Plus,
  Upload,
  Trash2,
  Grid3X3,
  ArrowUpToLine,
  X,
  PlaySquare,
  UserSquare2,
  Download,
} from "lucide-react";

interface InspoFolderViewProps {
  folder: SlotItem;
  itemsInFolder: SlotItem[];
  onBack: () => void;
  updateItems: (
    newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[]),
  ) => void;
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
  const [uploadType, setUploadType] = useState<"posts" | "stories">("posts");
  const [isUploading, setIsUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<SlotItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storyItems = itemsInFolder.filter(
    (i) => i.contentType === "InspoStory" || i.contentType === "Story",
  );
  const postItems = itemsInFolder.filter(
    (i) =>
      i.contentType === "InspoPost" ||
      !i.contentType ||
      i.contentType === "Post",
  );

  const handleUploadClick = (type: "posts" | "stories") => {
    setUploadType(type);
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Create new Inspo items for each uploaded file
      const newItems: SlotItem[] = newBase64Strings.map((base64, index) => ({
        id: `inspo-item-${Math.floor(Math.random() * 1000000000)}-${index}`,
        type: "image",
        urls: [base64],
        currentUrlIndex: 0,
        hexColor: "#E5D3C8",
        text: uploadType === "stories" ? "Highlight" : "",
        folderId: folder.id,
        contentType: uploadType === "posts" ? "InspoPost" : "InspoStory",
      }));

      updateItems((curr) => [...newItems, ...curr]);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
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
        onChange={handleUpload}
        className="hidden"
        accept="image/*"
        multiple
      />

      {/* Header Bar - Instagram Style */}
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
          onClick={() => handleUploadClick("posts")}
          disabled={isUploading}
          className="p-1 -mr-1 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer"
          title="Add new post"
        >
          <Plus size={28} strokeWidth={1.5} />
        </button>
      </div>

      {/* Highlights (Stories) Section */}
      <div className="w-full overflow-x-auto no-scrollbar py-4 px-4 border-b border-soft-100 flex gap-4 sm:gap-6 items-start">
        {/* Add Highlight Button */}
        <div
          className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
          onClick={() => handleUploadClick("stories")}
        >
          <div className="w-[68px] h-[68px] rounded-full border border-soft-300 flex items-center justify-center bg-white shadow-xs">
            <Plus size={28} strokeWidth={1.5} className="text-slate-900" />
          </div>
          <span className="text-xs text-slate-900 font-medium mt-1">New</span>
        </div>

        {storyItems.map((item) => (
          <div
            key={item.id}
            className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group"
            onClick={() => setPreviewItem(item)}
          >
            <div className="w-[72px] h-[72px] rounded-full p-[2px] border border-soft-300 hover:border-slate-400 transition-colors">
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
            </div>
            <span className="text-[11px] text-slate-900 font-medium truncate w-[72px] text-center">
              {item.text || "Highlight"}
            </span>
          </div>
        ))}
      </div>

      {/* Profile Tabs */}
      <div className="flex border-b border-soft-200">
        <div className="flex-1 flex justify-center py-3 border-b border-slate-900 text-slate-900">
          <Grid3X3 size={24} strokeWidth={1.5} />
        </div>
        <div className="flex-1 flex justify-center py-3 text-foreground/20 pointer-events-none">
          <PlaySquare size={24} strokeWidth={1.5} />
        </div>
        <div className="flex-1 flex justify-center py-3 text-foreground/20 pointer-events-none">
          <UserSquare2 size={24} strokeWidth={1.5} />
        </div>
      </div>

      {/* Grid (Posts) Section */}
      {postItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
          <div className="w-16 h-16 rounded-full border-2 border-slate-300 flex items-center justify-center mb-4">
            <Grid3X3 size={32} strokeWidth={1.5} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            No Posts Yet
          </h3>
          <p className="text-sm">
            Click the + at the top to add photos to this folder.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px] pb-24 bg-white">
          {postItems.map((item) => (
            <div
              key={item.id}
              className="aspect-[3/4] relative cursor-pointer group bg-soft-100"
              onClick={() => setPreviewItem(item)}
            >
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
          ))}
        </div>
      )}

      {/* Full Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center">
          <div
            className={`rounded-3xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 mx-4 shadow-2xl ${previewItem.contentType === "InspoStory" || previewItem.contentType === "Story" ? "bg-black border border-zinc-800" : "bg-white"}`}
          >
            {/* Modal Header */}
            <div
              className={`p-4 flex items-center justify-between ${previewItem.contentType === "InspoStory" || previewItem.contentType === "Story" ? "bg-black border-b border-zinc-800" : "bg-white border-b border-soft-100"}`}
            >
              <span
                className={`text-sm font-bold ${previewItem.contentType === "InspoStory" || previewItem.contentType === "Story" ? "text-white" : "text-slate-900"}`}
              >
                {previewItem.contentType === "InspoStory" ||
                previewItem.contentType === "Story"
                  ? "Story Preview"
                  : "Post Preview"}
              </span>
              <button
                onClick={() => setPreviewItem(null)}
                className={`p-1 rounded-full cursor-pointer transition-colors ${previewItem.contentType === "InspoStory" || previewItem.contentType === "Story" ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-slate-500 hover:text-slate-900 hover:bg-soft-100"}`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Photo Preview */}
            <div
              className={`relative flex w-full items-center justify-center overflow-hidden bg-black ${
                previewItem.contentType === "InspoStory" ||
                previewItem.contentType === "Story"
                  ? "aspect-[9/16]"
                  : "aspect-[3/4] bg-soft-100"
              }`}
            >
              {previewItem.urls && previewItem.urls.length > 0 ? (
                <img
                  src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                  alt=""
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: previewItem.hexColor || "#E5D3C8" }}
                >
                  <span className="text-white font-bold">
                    {previewItem.text}
                  </span>
                </div>
              )}
            </div>

            {/* Actions & Caption */}
            <div
              className={`p-4 flex flex-col gap-3 ${previewItem.contentType === "InspoStory" || previewItem.contentType === "Story" ? "bg-black" : "bg-white"}`}
            >
              {/* Caption Input (Posts Only) */}
              {!(
                previewItem.contentType === "InspoStory" ||
                previewItem.contentType === "Story"
              ) && (
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
                    placeholder="Write a caption or idea..."
                    className="w-full p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs resize-none min-h-[60px]"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (previewItem.urls && previewItem.urls.length > 0) {
                      const link = document.createElement("a");
                      link.href =
                        previewItem.urls[previewItem.currentUrlIndex || 0];
                      link.download = `inspo-${previewItem.id}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <Download size={16} strokeWidth={2.2} />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => handleDeleteItem(previewItem.id)}
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] ${previewItem.contentType === "InspoStory" || previewItem.contentType === "Story" ? "bg-zinc-900 hover:bg-zinc-800 text-red-500" : "bg-red-50 hover:bg-red-100 text-red-600"}`}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
