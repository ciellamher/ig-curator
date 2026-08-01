"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
  FolderPlus,
  Edit2,
} from "lucide-react";
import { StoryFolderView } from "./StoryFolderView";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";

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
  onFolderClick?: (id: string) => void;
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
  onFolderClick,
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
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; message: string } | null>(null);

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

  const childrenByFolderId = useMemo(() => {
    const map = new Map<string, SlotItem[]>();
    for (const item of allItems) {
      if (item.folderId) {
        if (!map.has(item.folderId)) map.set(item.folderId, []);
        map.get(item.folderId)!.push(item);
      }
    }
    return map;
  }, [allItems]);

  // Helper to recursively find up to 4 images inside a folder (including sub-folders)
  const getFolderImages = (
    folderId: string,
    max: number = 4,
    visited = new Set<string>(),
  ): string[] => {
    if (visited.has(folderId)) return [];
    visited.add(folderId);

    let images: string[] = [];
    const children = childrenByFolderId.get(folderId) || [];

    for (const child of children) {
      if (images.length >= max) break;
      if (child.urls && child.urls.length > 0) {
        images.push(child.urls[0]);
      } else if (child.contentType === "InspoFolder") {
        const subImages = getFolderImages(
          child.id,
          max - images.length,
          visited,
        );
        images.push(...subImages);
      }
    }
    return images.slice(0, max);
  };

  // Sub-folders
  const subFolders = itemsInFolder
    .filter((i) => i.contentType === "InspoFolder")
    .sort((a, b) => (a.text || "").localeCompare(b.text || ""));

  const postItems = itemsInFolder.filter(
    (i) =>
      i.contentType === "InspoPost" ||
      !i.contentType ||
      i.contentType === "Post",
  );

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processFiles = async (files: File[], targetFolderId?: string) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const processedFiles: { url: string; isVideo: boolean }[] = [];
      const { saveMediaBlob } = await import('@/lib/idb');
      
      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        
        try {
          const prefix = isVideo ? "video" : "image";
          const uniqueId = `media-${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Convert File to pure Blob to prevent fragile OS file reference loss on refresh
          const arrayBuffer = await file.arrayBuffer();
          const pureBlob = new Blob([arrayBuffer], { type: file.type });
          
          await saveMediaBlob(uniqueId, pureBlob);
          
          processedFiles.push({
            url: `local-media://${uniqueId}`,
            isVideo
          });
        } catch (e) {
          console.error("Failed to save media to IDB:", e);
          continue;
        }
      }

      // Create new InspoPost items
      const newItems: SlotItem[] = processedFiles.map((pf, index) => ({
        id: `inspo-item-${Math.floor(Math.random() * 1000000000)}-${index}`,
        type: pf.isVideo ? "video" : "image",
        urls: [pf.url],
        currentUrlIndex: 0,
        hexColor: "#E5D3C8",
        text: "",
        folderId: targetFolderId || folder.id,
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

  const handleAddSubFolder = () => {
    const newFolder: SlotItem = {
      id: `inspo-folder-${Math.floor(Math.random() * 1000000000)}`,
      type: "placeholder",
      urls: [],
      currentUrlIndex: 0,
      hexColor: "#E5D3C8",
      text: "New Sub-Folder",
      folderId: folder.id,
      contentType: "InspoFolder",
    };
    updateItems((curr) => [newFolder, ...curr]);
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

        <h2 className="text-base font-bold text-slate-900 leading-tight truncate px-2">
          {folder.text || "Inspo Folder"}
        </h2>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (isSelectionMode) {
                setIsSelectionMode(false);
                setSelectedItems(new Set());
              } else {
                setIsSelectionMode(true);
              }
            }}
            className="px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-soft-100 rounded-lg transition-colors cursor-pointer"
          >
            {isSelectionMode ? "Done" : "Select"}
          </button>
          <button
            onClick={handleAddSubFolder}
            className="p-1.5 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer"
            title="Add sub-folder"
          >
            <FolderPlus size={24} strokeWidth={1.5} />
          </button>
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="p-1.5 text-slate-900 hover:bg-soft-100 rounded-full transition-all cursor-pointer"
            title="Add new post inspo"
          >
            <Plus size={28} strokeWidth={1.5} />
          </button>
        </div>
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

      {/* Sub-Folders Section */}
      {subFolders.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 px-4 py-4 border-b border-soft-100 bg-white">
          {subFolders.map((item) => {
            const customCover = item.urls?.[0];
            const folderImages = customCover
              ? [customCover]
              : getFolderImages(item.id);
            const hasSubFolders = (childrenByFolderId.get(item.id) || []).some(
              (i) => i.contentType === "InspoFolder",
            );

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 cursor-pointer group rounded-2xl transition-all ${
                  dragTargetId === item.id
                    ? "ring-2 ring-slate-800 ring-offset-2 scale-105"
                    : ""
                }`}
                onClick={() => onFolderClick && onFolderClick(item.id)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/folder-id", item.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragTargetId(item.id);
                }}
                onDragLeave={() => {
                  setDragTargetId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragTargetId(null);
                  
                  const files = Array.from(e.dataTransfer.files || []);
                  if (files.length > 0) {
                    processFiles(files, item.id);
                    return;
                  }

                  const draggedIdsStr = e.dataTransfer.getData("application/folder-ids");
                  if (draggedIdsStr) {
                    try {
                      const ids = JSON.parse(draggedIdsStr) as string[];
                      ids.forEach(id => {
                        if (id !== item.id) updateItem(id, { folderId: item.id });
                      });
                      if (isSelectionMode) {
                        setIsSelectionMode(false);
                        setSelectedItems(new Set());
                      }
                      return;
                    } catch (e) {}
                  }

                  const draggedId = e.dataTransfer.getData(
                    "application/folder-id",
                  );
                  if (draggedId && draggedId !== item.id) {
                    updateItem(draggedId, { folderId: item.id });
                  }
                }}
              >
                <div className="aspect-square bg-soft-100 rounded-2xl overflow-hidden relative border border-soft-200 group-hover:border-slate-400 group-hover:shadow-md transition-all">
                  {/* Folder Thumbnail */}
                  {!customCover && hasSubFolders && folderImages.length >= 4 ? (
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[1px] bg-white">
                      {folderImages.slice(0, 4).map((url, idx) => (
                        <div
                          key={idx}
                          className="w-full h-full overflow-hidden bg-soft-100"
                        >
                          {url.startsWith("local-media://") ? (
                            <LocalMediaVideo
                              src={url}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              autoPlay
                              playsInline
                            />
                          ) : (
                            <LocalMediaImage
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : folderImages.length > 0 ? (
                    folderImages[0].startsWith("local-media://") ? (
                      <LocalMediaVideo
                        src={folderImages[0]}
                        className="absolute inset-0 w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <LocalMediaImage
                        src={folderImages[0]}
                        alt={item.text}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 p-3 flex flex-col items-center justify-center gap-1.5 opacity-60">
                      <div className="w-8 h-8 rounded-lg border-2 border-slate-400/50 flex items-center justify-center">
                        <Grid3X3 size={16} className="text-slate-400" />
                      </div>
                    </div>
                  )}

                  {/* Edit & Delete Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newName = prompt(
                          "Enter new folder name:",
                          item.text,
                        );
                        if (newName && newName.trim() !== "") {
                          updateItem(item.id, { text: newName.trim() });
                        }
                      }}
                      className="w-7 h-7 bg-white/90 rounded-full shadow-sm text-slate-700 hover:text-slate-900 flex items-center justify-center"
                      title="Edit folder"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({
                          ids: [item.id],
                          message: `Delete folder "${item.text}" and its contents?`,
                        });
                      }}
                      className="w-7 h-7 bg-white/90 rounded-full shadow-sm text-red-500 hover:text-red-700 flex items-center justify-center"
                      title="Delete folder"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs font-bold text-slate-800 text-center truncate px-1">
                    {item.text || "Sub-Folder"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid (Posts) Section */}
      {postItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-foreground/40 bg-white">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-soft-200 flex items-center justify-center mb-4">
            <Plus size={24} className="text-soft-300" />
          </div>
          <p className="text-sm font-medium mb-1">No post inspo yet</p>
          <p className="text-xs">
            Tap + at top right to add photos, or create a sub-folder!
          </p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 gap-2 px-2 pb-24 bg-white mt-2">
          {postItems.map((item) => (
            <div
              key={item.id}
              className={`relative cursor-pointer group bg-soft-100 overflow-hidden break-inside-avoid mb-2 rounded-xl shadow-sm transition-all ${isSelectionMode && selectedItems.has(item.id) ? 'ring-4 ring-slate-800 ring-offset-1 scale-[0.98]' : ''}`}
              onClick={() => {
                if (isSelectionMode) {
                  setSelectedItems(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(item.id)) newSet.delete(item.id);
                    else newSet.add(item.id);
                    return newSet;
                  });
                } else {
                  setPreviewItem(item);
                }
              }}
              draggable
              onDragStart={(e) => {
                if (isSelectionMode && selectedItems.has(item.id)) {
                  e.dataTransfer.setData("application/folder-ids", JSON.stringify(Array.from(selectedItems)));
                } else {
                  e.dataTransfer.setData("application/folder-id", item.id);
                }
              }}
            >
              {isSelectionMode && (
                <div className="absolute top-2 left-2 z-30">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedItems.has(item.id) ? 'bg-slate-800 border-slate-800' : 'bg-white/50 border-white/80 backdrop-blur-sm'}`}>
                    {selectedItems.has(item.id) && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </div>
                </div>
              )}
              {item.urls && item.urls.length > 0 ? (
                item.urls[item.currentUrlIndex || 0].startsWith(
                  "local-media://",
                ) ? (
                  <LocalMediaVideo
                    src={item.urls[item.currentUrlIndex || 0]}
                    className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-300"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                ) : (
                  <LocalMediaImage
                    src={item.urls[item.currentUrlIndex || 0]}
                    className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-300"
                  />
                )
              ) : (
                <div
                  className="w-full aspect-square"
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
                      link.download = `inspo-${item.id}.${item.urls[item.currentUrlIndex || 0].includes("video") ? "mp4" : "jpg"}`;
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
                    setMovingItemId(item.id);
                  }}
                  className="p-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                  title="Move to another folder"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm({ ids: [item.id], message: "Delete this media?" });
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
            <div className="relative flex w-full items-center justify-center overflow-hidden bg-black group">
              {previewItem.urls && previewItem.urls.length > 0 ? (
                <>
                  {previewItem.urls[
                    previewItem.currentUrlIndex || 0
                  ].startsWith("local-media://") ? (
                    <LocalMediaVideo
                      src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                      className="w-full h-auto max-h-[70vh] object-contain"
                      controls
                      autoPlay
                      playsInline
                      loop
                    />
                  ) : (
                    <LocalMediaImage
                      src={previewItem.urls[previewItem.currentUrlIndex || 0]}
                      alt=""
                      className="w-full h-auto max-h-[70vh] object-contain"
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

      {/* Bulk Selection Action Bar */}
      {isSelectionMode && selectedItems.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-5 z-[150] animate-in slide-in-from-bottom-5 border border-white/10">
          <span className="text-[13px] font-bold">{selectedItems.size} Selected</span>
          <div className="w-[1px] h-4 bg-white/20" />
          <button onClick={() => setMovingItemId("bulk")} className="text-[13px] font-bold hover:text-slate-300 transition-colors">Move</button>
          <button onClick={() => {
             setDeleteConfirm({
               ids: Array.from(selectedItems),
               message: `Delete ${selectedItems.size} items?`,
             });
          }} className="text-[13px] font-bold text-red-400 hover:text-red-300 transition-colors">Delete</button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Confirm delete"
        message={deleteConfirm?.message || ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) {
            deleteConfirm.ids.forEach(id => handleDeleteItem(id));
            setSelectedItems(new Set());
            setIsSelectionMode(false);
          }
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Move Photo Modal */}
      {movingItemId && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setMovingItemId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-soft-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Move {movingItemId === "bulk" ? `${selectedItems.size} Photos` : "Photo"}</h3>
              <button
                onClick={() => setMovingItemId(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-full bg-soft-50 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-2 overflow-y-auto flex flex-col gap-1">
              <button
                onClick={() => {
                  if (movingItemId === "bulk") {
                    selectedItems.forEach(id => updateItem(id, { folderId: undefined }));
                    setSelectedItems(new Set());
                    setIsSelectionMode(false);
                  } else {
                    updateItem(movingItemId, { folderId: undefined });
                  }
                  setMovingItemId(null);
                }}
                className="w-full text-left p-3 hover:bg-soft-100 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer text-slate-700"
              >
                <div className="w-8 h-8 rounded-lg bg-soft-200 flex items-center justify-center">
                  <Grid3X3 size={16} className="text-slate-600" />
                </div>
                Move to Root (Ideas)
              </button>

              {allItems
                .filter((i) => i.contentType === "InspoFolder")
                .sort((a, b) => (a.text || "").localeCompare(b.text || ""))
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      if (movingItemId === "bulk") {
                        selectedItems.forEach(id => updateItem(id, { folderId: f.id }));
                        setSelectedItems(new Set());
                        setIsSelectionMode(false);
                      } else {
                        updateItem(movingItemId, { folderId: f.id });
                      }
                      setMovingItemId(null);
                    }}
                    className="w-full text-left p-2 hover:bg-soft-100 rounded-xl text-sm font-semibold transition-colors flex items-center gap-3 cursor-pointer text-slate-700"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-soft-200"
                      style={{ backgroundColor: f.hexColor || "#E5D3C8" }}
                    >
                      <FolderPlus size={14} className="text-slate-900/50" />
                    </div>
                    {f.text || "Untitled Folder"}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
