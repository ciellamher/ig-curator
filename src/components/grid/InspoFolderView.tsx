"use client";

import { useState, useRef, useEffect } from "react";
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
  ChevronRight,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Repeat,
  Send,
  Bookmark,
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

  const [profileUsername, setProfileUsername] = useState("your_username");
  const [profileAvatar, setProfileAvatar] = useState(
    "https://i.pravatar.cc/150?img=44",
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ig-curator-profile");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.username) setProfileUsername(p.username);
        if (p.avatarUrl) setProfileAvatar(p.avatarUrl);
      } catch (e) {}
    }
  }, []);

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

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const filePromises = files.map(
        (file) =>
          new Promise<{ url: string; isVideo: boolean }>((resolve, reject) => {
            const isVideo = file.type.startsWith("video/");
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              if (isVideo) {
                resolve({ url: result, isVideo: true });
              } else {
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
                  resolve({ url: canvas.toDataURL("image/jpeg", 0.8), isVideo: false });
                };
                img.onerror = reject;
                img.src = result;
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      );

      const processedFiles = await Promise.all(filePromises);

      // Create new InspoPost items
      const newItems: SlotItem[] = processedFiles.map((pf, index) => ({
        id: `inspo-item-${Math.floor(Math.random() * 1000000000)}-${index}`,
        type: pf.isVideo ? "video" : "image",
        urls: [pf.url],
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
    }
  };

  const handleUploadPosts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    if (e.target) e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    await processFiles(files);
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
    <div
      className="w-full flex flex-col bg-white min-h-[calc(100vh-80px)] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center rounded-lg border-2 border-dashed border-slate-900 pointer-events-none">
          <div className="bg-white px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-soft-100 rounded-full flex items-center justify-center">
              <Plus size={36} className="text-slate-900" strokeWidth={2} />
            </div>
            <span className="font-extrabold text-lg text-slate-900">
              Drop photos here
            </span>
            <span className="text-sm font-medium text-slate-500">
              to add them to this folder
            </span>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadPosts}
        className="hidden"
        accept="image/*,video/*"
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
        <div
          className="flex-1 flex justify-center items-center py-3 border-b-2 border-slate-900 text-slate-900"
          title="Feed Inspo"
        >
          <Grid3X3 size={22} />
        </div>
        <div
          className="flex-1 flex justify-center items-center py-3 border-b-2 border-transparent text-foreground/40"
          title="Reels"
        >
          <PlaySquare size={22} />
        </div>
        <div
          className="flex-1 flex justify-center items-center py-3 border-b-2 border-transparent text-foreground/40"
          title="Tags"
        >
          <UserSquare2 size={22} />
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
                item.urls[item.currentUrlIndex || 0].startsWith("data:video") ? (
                  <video
                    src={item.urls[item.currentUrlIndex || 0]}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={item.urls[item.currentUrlIndex || 0]}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )
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
                      link.download = `inspo-${item.id}.${item.urls[item.currentUrlIndex || 0].startsWith("data:video") ? "mp4" : "jpg"}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                    title="Download media"
                  >
                    <Download size={13} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this media?")) {
                      handleDeleteItem(item.id);
                    }
                  }}
                  className="p-1.5 bg-white/80 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                  title="Delete media"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Preview Modal (Instagram Style) */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className={`bg-white rounded-[20px] w-full max-w-[400px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 shadow-2xl relative`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Instagram Header */}
            <div className="flex items-center justify-between p-3 border-b border-soft-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-soft-200">
                  <img
                    src={profileAvatar || "https://i.pravatar.cc/150?img=44"}
                    className="w-full h-full object-cover"
                    alt="avatar"
                  />
                </div>
                <span className="text-[13px] font-bold text-slate-900 tracking-tight">
                  {profileUsername}
                </span>
              </div>
              <button
                className="text-slate-900 p-1"
                onClick={() => setPreviewItem(null)}
              >
                <MoreHorizontal size={20} />
              </button>
            </div>

            {/* Photo Preview */}
            <div className="relative flex w-full items-center justify-center overflow-hidden bg-black aspect-square bg-soft-100 group">
              {previewItem.urls && previewItem.urls.length > 0 ? (
                <>
                  {previewItem.urls[previewItem.currentUrlIndex || 0].startsWith("data:video") ? (
                    <video
                      src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      playsInline
                      loop
                    />
                  ) : (
                    <img
                      src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Next/Prev Navigation overlay */}
                  {previewItem.urls.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newIndex =
                            ((previewItem.currentUrlIndex || 0) -
                              1 +
                              previewItem.urls!.length) %
                            previewItem.urls!.length;
                          setPreviewItem({
                            ...previewItem,
                            currentUrlIndex: newIndex,
                          });
                          updateItem(previewItem.id, {
                            currentUrlIndex: newIndex,
                          });
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white text-slate-800 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <ChevronLeft size={18} strokeWidth={2.5} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newIndex =
                            ((previewItem.currentUrlIndex || 0) + 1) %
                            previewItem.urls!.length;
                          setPreviewItem({
                            ...previewItem,
                            currentUrlIndex: newIndex,
                          });
                          updateItem(previewItem.id, {
                            currentUrlIndex: newIndex,
                          });
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white text-slate-800 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <ChevronRight size={18} strokeWidth={2.5} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: previewItem.hexColor || "#E5D3C8" }}
                />
              )}
            </div>

            {/* Instagram Action Bar & Caption */}
            <div className="p-3.5 flex flex-col bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <Heart
                    size={24}
                    className="text-slate-900 cursor-pointer hover:opacity-70 transition-opacity"
                    strokeWidth={2}
                  />
                  <MessageCircle
                    size={24}
                    className="text-slate-900 cursor-pointer hover:opacity-70 transition-opacity"
                    strokeWidth={2}
                  />
                  <Repeat
                    size={24}
                    className="text-slate-900 cursor-pointer hover:opacity-70 transition-opacity"
                    strokeWidth={2}
                  />
                  <Send
                    size={24}
                    className="text-slate-900 cursor-pointer hover:opacity-70 transition-opacity"
                    strokeWidth={2}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                    className="cursor-pointer hover:opacity-70 transition-opacity"
                    title="Download photo"
                  >
                    <Download
                      size={24}
                      className="text-slate-900"
                      strokeWidth={2}
                    />
                  </button>
                  <Bookmark
                    size={24}
                    className="text-slate-900 cursor-pointer hover:opacity-70 transition-opacity"
                    strokeWidth={2}
                  />
                </div>
              </div>

              <div className="text-[13px] font-bold text-slate-900 mb-1.5">
                117 likes
              </div>

              <div className="text-[11px] uppercase text-slate-500 font-medium tracking-wide">
                September 7, 2020
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
