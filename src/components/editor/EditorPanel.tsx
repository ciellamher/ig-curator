"use client";

import { useState, useRef, useEffect } from "react";
import { SlotItem, ContentType } from "@/types";
import {
  Upload,
  Trash2,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ImageMinus,
  ArrowDownToLine,
  Download,
  ImageIcon,
  Plus,
  GalleryHorizontal,
  Video,
} from "lucide-react";
import { LocalMediaImage, LocalMediaVideo } from "@/components/grid/LocalMedia";
import { CoverPicker } from "./CoverPicker";
import { draggedItemIds, droppedPhotos, isPhotoDrag, PHOTO_DRAG_TYPE, withoutMoved } from "@/lib/photoDrag";
import { FEED_REORDER_STORIES_EVENT } from "@/lib/planner/types";

/** Data type for moving a photo within a box */
const PHOTO_ORDER_TYPE = "application/x-ig-curator-photo-index";

const isVideoUrl = (url: string) => url.startsWith("data:video") || url.includes("-video-");

/** Saves one photo or video to the computer, named after the box. */
async function downloadMedia(url: string, name: string) {
  let href = url;
  let blob: Blob | null = null;
  if (url.startsWith("local-media://")) {
    const { getMediaBlob } = await import("@/lib/idb");
    blob = await getMediaBlob(url.replace("local-media://", ""));
    if (!blob) return;
    href = URL.createObjectURL(blob);
  }
  const ext = blob?.type.split("/")[1]?.replace("quicktime", "mov").replace("jpeg", "jpg") ?? (isVideoUrl(url) ? "mp4" : "jpg");
  const a = document.createElement("a");
  a.href = href;
  a.download = `${name.replace(/[\/\\:*?"<>|]/g, "").trim() || "photo"}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (blob) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

interface EditorPanelProps {
  activeSlot: SlotItem | null;
  updateSlot: (id: string, updates: Partial<SlotItem>) => void;
  onClose?: () => void;
  onDeleteSlot?: (id: string) => void;
  /** Shown inside a planner page: no "Move to Drafts" */
  pageOnly?: boolean;
  /** A page with no feed box at all: nothing on the phone to hide */
  virtualPage?: boolean;
  /** All items across the board, so folder stories or connected items can be resolved */
  allItems?: SlotItem[];
  /** Handler to drop/add photos into folder if activeSlot is a folder */
  onDropPhotos?: (folderId: string, urls: string[], sourceIds?: string[]) => void;
  /** Handler when stories in a folder are reordered or removed */
  updateItems?: React.Dispatch<React.SetStateAction<SlotItem[]>>;
}

export function EditorPanel({
  activeSlot,
  updateSlot,
  onClose,
  onDeleteSlot,
  pageOnly = false,
  virtualPage = false,
  allItems = [],
  onDropPhotos,
  updateItems,
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "appearance">(
    "details",
  );
  const [isUploading, setIsUploading] = useState(false);
  // A video just added to a reel (or "Change cover"): ask what its cover should be
  const [coverFor, setCoverFor] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDraggingOverPanel, setIsDraggingOverPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localText, setLocalText] = useState(activeSlot?.text || "");
  const [localHex, setLocalHex] = useState(activeSlot?.hexColor || "");

  // Follow changes made elsewhere (e.g. renaming the page in the planner), except while the field is being typed in
  const textRef = useRef<HTMLInputElement>(null);
  const slotText = activeSlot?.text || "";
  const slotHex = activeSlot?.hexColor || "";
  useEffect(() => {
    if (document.activeElement !== textRef.current) setLocalText(slotText);
  }, [activeSlot?.id, slotText]);
  useEffect(() => {
    setLocalHex(slotHex);
  }, [activeSlot?.id, slotHex]);

  if (!activeSlot) return null;

  // Folder stories vs slot urls
  const isFolder = activeSlot.contentType === "StoryFolder";
  const folderStories = allItems.filter((i) => i.folderId === activeSlot.id);
  const folderUrls = folderStories.flatMap((s) => s.urls || []);
  const effectiveUrls =
    isFolder && (!activeSlot.urls || activeSlot.urls.length === 0)
      ? folderUrls
      : activeSlot.urls || [];

  const currentIdx = Math.min(
    activeSlot.currentUrlIndex || 0,
    Math.max(0, effectiveUrls.length - 1),
  );

  const nextImage = () => {
    if (effectiveUrls.length > 1) {
      updateSlot(activeSlot.id, {
        currentUrlIndex: (currentIdx + 1) % effectiveUrls.length,
      });
    }
  };

  const prevImage = () => {
    if (effectiveUrls.length > 1) {
      updateSlot(activeSlot.id, {
        currentUrlIndex:
          (currentIdx - 1 + effectiveUrls.length) % effectiveUrls.length,
      });
    }
  };

  /** `sourceIds`: the inspo photos or stories they were dragged from, which they move out of */
  const appendUrls = (newBase64Strings: string[], sourceIds: string[] = []) => {
    if (newBase64Strings.length === 0) return;
    if (isFolder) {
      if (onDropPhotos) {
        onDropPhotos(activeSlot.id, newBase64Strings, sourceIds);
      } else if (updateItems) {
        const newStories: SlotItem[] = newBase64Strings.map((u, n) => ({
          id: `story-${Date.now()}-${n}-${Math.floor(Math.random() * 1000)}`,
          type: isVideoUrl(u) ? "video" : "image",
          urls: [u],
          currentUrlIndex: 0,
          hexColor: "#E4E4E7",
          text: "",
          contentType: "Story",
          folderId: activeSlot.id,
        }));
        updateItems((curr) => [...curr, ...newStories]);
      }
    } else {
      const newUrls = [...effectiveUrls, ...newBase64Strings];
      updateSlot(activeSlot.id, {
        type:
          newBase64Strings.length && newBase64Strings.every(isVideoUrl)
            ? "video"
            : "image",
        urls: newUrls,
        contentType:
          newUrls.length > 1 && !activeSlot.contentType
            ? "Carousel"
            : activeSlot.contentType,
        currentUrlIndex: effectiveUrls.length,
      });
      const moved = sourceIds.filter((id) => id !== activeSlot.id);
      if (moved.length && updateItems) updateItems((curr) => withoutMoved(curr, moved));
      const video = newBase64Strings.find(isVideoUrl);
      if (video && activeSlot.contentType === "Reel") setCoverFor(video);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const { saveFilesLocally } = await import("@/lib/localUpload");
      const newBase64Strings = await saveFilesLocally(files);
      appendUrls(newBase64Strings);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handlePanelDragOver = (e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes("Files") ||
      isPhotoDrag(e) ||
      e.dataTransfer.types.includes("text/uri-list")
    ) {
      e.preventDefault();
      setIsDraggingOverPanel(true);
    }
  };

  const handlePanelDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOverPanel(false);
    }
  };

  const handlePanelDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPanel(false);

    const files = Array.from(e.dataTransfer.files || []).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/") || !f.type,
    );
    if (files.length > 0) {
      setIsUploading(true);
      try {
        const { saveFilesLocally } = await import("@/lib/localUpload");
        const urls = await saveFilesLocally(files);
        appendUrls(urls);
      } catch (err) {
        console.error("Drop files failed", err);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const uriPhotos = droppedPhotos(e);
    if (uriPhotos.length > 0) {
      appendUrls(uriPhotos, draggedItemIds(e));
      return;
    }

    const singleUri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (
      singleUri &&
      (singleUri.startsWith("data:") ||
        singleUri.startsWith("http") ||
        singleUri.startsWith("local-media://") ||
        singleUri.startsWith("blob:"))
    ) {
      appendUrls([singleUri]);
    }
  };

  const handleReorderPhotos = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const selected = effectiveUrls[currentIdx];
    const reordered = [...effectiveUrls];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    if (isFolder) {
      if (updateItems) {
        const rank = (story: SlotItem) => {
          const u = story.urls?.[0];
          const idx = u ? reordered.indexOf(u) : 9999;
          return idx === -1 ? 9999 : idx;
        };
        updateItems((curr) => {
          const stories = curr
            .filter((i) => i.folderId === activeSlot.id)
            .sort((a, b) => rank(a) - rank(b));
          let n = 0;
          return curr.map((i) => (i.folderId === activeSlot.id ? stories[n++] : i));
        });
        window.dispatchEvent(
          new CustomEvent(FEED_REORDER_STORIES_EVENT, {
            detail: { folderId: activeSlot.id, urls: reordered },
          }),
        );
      }
      updateSlot(activeSlot.id, {
        urls: reordered,
        currentUrlIndex: Math.max(0, reordered.indexOf(selected)),
      });
    } else {
      updateSlot(activeSlot.id, {
        urls: reordered,
        currentUrlIndex: Math.max(0, reordered.indexOf(selected)),
      });
    }
  };

  const handleRemovePhoto = (idxToRemove: number) => {
    if (isFolder) {
      const story = folderStories[idxToRemove];
      if (story && updateItems) {
        updateItems((curr) => curr.filter((i) => i.id !== story.id));
      }
      return;
    }

    const newUrls = effectiveUrls.filter((_, idx) => idx !== idxToRemove);
    if (newUrls.length === 0) {
      updateSlot(activeSlot.id, {
        type: "placeholder",
        urls: [],
        currentUrlIndex: 0,
      });
    } else {
      const newIndex = Math.min(
        newUrls.length - 1,
        Math.max(0, currentIdx > idxToRemove ? currentIdx - 1 : currentIdx),
      );
      updateSlot(activeSlot.id, {
        urls: newUrls,
        currentUrlIndex: newIndex,
        type: newUrls.every(isVideoUrl) ? "video" : "image",
      });
    }
  };

  const handleDelete = () => {
    if (effectiveUrls.length > 0) {
      handleRemovePhoto(currentIdx);
    } else {
      if (onDeleteSlot) onDeleteSlot(activeSlot.id);
    }
  };

  const isDraftPlaceholder =
    activeSlot.folderId === "draft-pool" &&
    (!activeSlot.urls || activeSlot.urls.length === 0);

  return (
    <div className="p-4 flex flex-col gap-3.5 h-full max-h-[85vh] overflow-y-auto no-scrollbar text-foreground select-none bg-white">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept="image/*,video/*"
        multiple
      />

      {/* Quick Action Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Add / Upload & Move to Drafts Buttons */}
          <div className="flex-1 flex gap-2 items-center">
            {isDraftPlaceholder && (
              <span className="text-[10px] sm:text-xs font-bold text-slate-800 uppercase tracking-wider px-1 mr-1">
                Draft Box
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center p-2.5 bg-slate-900 text-white hover:bg-black rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
              title={isUploading ? "Uploading..." : "Add / Upload Photo"}
            >
              <Upload size={18} strokeWidth={2.2} />
            </button>
            {activeSlot.folderId !== "draft-pool" && !pageOnly && (
              <button
                onClick={() => {
                  updateSlot(activeSlot.id, { folderId: "draft-pool" });
                }}
                className="flex-1 flex items-center justify-center p-2.5 bg-slate-200 text-slate-800 hover:bg-slate-300 rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Move back to Drafts"
              >
                <ArrowDownToLine size={18} strokeWidth={2.2} />
              </button>
            )}
          </div>

          {/* Single Photo / Slot Trash Button */}
          <button
            onClick={handleDelete}
            className="p-2.5 bg-soft-100 border border-soft-200 text-slate-600 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-200 rounded-xl active:scale-95 transition-all cursor-pointer shrink-0"
            title={
              effectiveUrls.length > 0
                ? "Delete Current Photo"
                : "Delete Box"
            }
          >
            <Trash2 size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Carousel & Photo Section */}
        <div
          onDragOver={handlePanelDragOver}
          onDragLeave={handlePanelDragLeave}
          onDrop={handlePanelDrop}
          className={`flex flex-col gap-2 p-3 bg-soft-50/80 border rounded-2xl transition-all ${
            isDraggingOverPanel
              ? "border-slate-800 bg-slate-50 ring-2 ring-slate-800/10"
              : "border-soft-200/80"
          }`}
        >
          {/* Format Selector & Counter */}
          <div className="flex items-center justify-between gap-1.5">
            {!isFolder && !virtualPage ? (
              <div className="flex items-center bg-white p-0.5 rounded-lg border border-soft-200 shadow-2xs">
                {(["Post", "Carousel", "Reel"] as const).map((fmt) => {
                  const currentFormat =
                    activeSlot.contentType ||
                    (effectiveUrls.length > 1 ? "Carousel" : "Post");
                  const isActive = currentFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() =>
                        updateSlot(activeSlot.id, { contentType: fmt })
                      }
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                        isActive
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <GalleryHorizontal size={14} className="text-slate-700" />
                {isFolder ? "Story Folder" : "Media Carousel"}
              </span>
            )}

            {effectiveUrls.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-zinc-500">
                  {effectiveUrls.length > 1
                    ? `Slide ${currentIdx + 1} of ${effectiveUrls.length}`
                    : "1 photo"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const url = effectiveUrls[currentIdx];
                    if (url) {
                      downloadMedia(
                        url,
                        `${activeSlot.text || "photo"}${
                          effectiveUrls.length > 1 ? ` ${currentIdx + 1}` : ""
                        }`,
                      );
                    }
                  }}
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-white cursor-pointer"
                  title="Download photo"
                >
                  <Download size={13} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-soft-200 text-[11px] font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 shadow-2xs cursor-pointer"
                  title="Add photo to carousel"
                >
                  <Plus size={12} strokeWidth={2.4} /> Add
                </button>
              </div>
            )}
          </div>

          {/* Main Carousel Preview or Empty Drop Zone */}
          {effectiveUrls.length > 0 ? (
            <div className="relative w-full aspect-[4/5] max-h-56 rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center border border-zinc-200 shadow-xs group">
              {isVideoUrl(effectiveUrls[currentIdx] || "") ? (
                <LocalMediaVideo
                  src={effectiveUrls[currentIdx]}
                  controls={false}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <LocalMediaImage
                  src={effectiveUrls[currentIdx]}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                />
              )}

              {/* Prev / Next Chevrons on Main Preview */}
              {effectiveUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-xs transition-all shadow-md cursor-pointer"
                    title="Previous slide"
                  >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-xs transition-all shadow-md cursor-pointer"
                    title="Next slide"
                  >
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </button>
                </>
              )}

              {/* Top badges: Cover or Format */}
              <div className="absolute top-2 left-2 flex items-center gap-1">
                {currentIdx === 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold tracking-tight shadow-xs">
                    Cover
                  </span>
                )}
                {(activeSlot.contentType === "Carousel" ||
                  effectiveUrls.length > 1) && (
                  <span className="px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <GalleryHorizontal size={10} /> Carousel
                  </span>
                )}
              </div>

              {/* Top right: Delete current slide */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto(currentIdx);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white/90 hover:text-white hover:bg-rose-600 backdrop-blur-xs transition-all shadow-xs cursor-pointer opacity-80 hover:opacity-100"
                title="Remove this photo from carousel"
              >
                <Trash2 size={13} strokeWidth={2.2} />
              </button>

              {/* Bottom overlay: Dots / Position indicator */}
              {effectiveUrls.length > 1 && (
                <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-auto">
                  {effectiveUrls.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSlot(activeSlot.id, { currentUrlIndex: dotIdx });
                      }}
                      className={`transition-all rounded-full cursor-pointer ${
                        dotIdx === currentIdx
                          ? "w-2.5 h-2.5 bg-white shadow-xs scale-110"
                          : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                      }`}
                      title={`Jump to slide ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full aspect-[4/3] max-h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-4 text-center cursor-pointer transition-all ${
                isDraggingOverPanel
                  ? "border-slate-900 bg-slate-50 ring-4 ring-slate-900/10 scale-[1.01]"
                  : "border-soft-300 bg-white hover:bg-soft-50/70 hover:border-slate-400"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-soft-100 border border-soft-200 flex items-center justify-center text-slate-800">
                <GalleryHorizontal size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {isDraggingOverPanel
                    ? "Drop photos here"
                    : "Add photos or create carousel"}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Drag & drop photos here or click to upload
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-1 bg-soft-100 border border-soft-200 rounded-full text-slate-700 shadow-2xs">
                Supports multiple photos · Drag to sort
              </span>
            </div>
          )}

          {/* Reorderable Thumbnail Sorter Strip */}
          {effectiveUrls.length > 0 && (
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 px-0.5">
                <span>Sort Carousel Photos</span>
                <span className="text-[10px] text-zinc-400">
                  Drag thumbnails to reorder
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-0.5">
                {effectiveUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PHOTO_ORDER_TYPE, String(idx));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (
                        !Array.from(e.dataTransfer.types).includes(
                          PHOTO_ORDER_TYPE,
                        )
                      )
                        return;
                      e.preventDefault();
                      setDragOverIdx(idx);
                    }}
                    onDragLeave={() =>
                      setDragOverIdx((d) => (d === idx ? null : d))
                    }
                    onDrop={(e) => {
                      const from = Number(
                        e.dataTransfer.getData(PHOTO_ORDER_TYPE),
                      );
                      setDragOverIdx(null);
                      if (Number.isNaN(from) || from === idx) return;
                      e.preventDefault();
                      handleReorderPhotos(from, idx);
                    }}
                    onClick={() =>
                      updateSlot(activeSlot.id, { currentUrlIndex: idx })
                    }
                    title={
                      idx === 0
                        ? "Cover photo · Drag to reorder"
                        : `Slide ${idx + 1} · Drag to reorder`
                    }
                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
                      idx === currentIdx
                        ? "border-slate-900 ring-2 ring-slate-900/10 shadow-xs"
                        : "border-transparent hover:border-slate-300"
                    } ${
                      dragOverIdx === idx
                        ? "outline outline-2 outline-offset-1 outline-slate-900 scale-105"
                        : ""
                    }`}
                  >
                    {isVideoUrl(url) ? (
                      <LocalMediaVideo
                        src={url}
                        muted
                        playsInline
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <LocalMediaImage
                        src={url}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    )}
                    <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/65 text-white text-[9px] font-bold leading-tight">
                      {idx === 0 ? "Cover" : idx + 1}
                    </span>
                    {/* Quick delete button on thumbnail hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(idx);
                      }}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Delete slide"
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}

                {/* Append slide button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-soft-300 hover:border-slate-600 hover:bg-white flex flex-col items-center justify-center text-zinc-500 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
                  title="Add another slide"
                >
                  <Plus size={16} strokeWidth={2.4} />
                  <span className="text-[9px] font-bold mt-0.5">Add</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* A reel's cover */}
      {activeSlot.contentType === "Reel" &&
        effectiveUrls.some(isVideoUrl) && (
          <div className="flex items-center gap-2.5 p-2.5 bg-soft-50/80 border border-soft-200/80 rounded-2xl">
            <div className="w-9 h-12 rounded-md overflow-hidden bg-zinc-200 shrink-0">
              {activeSlot.coverUrl && (
                <LocalMediaImage
                  src={activeSlot.coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <span className="text-xs font-semibold text-foreground/80">
              {activeSlot.coverUrl ? "Cover" : "No cover yet"}
            </span>
            <button
              onClick={() =>
                setCoverFor(effectiveUrls.find(isVideoUrl) ?? null)
              }
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-soft-200 rounded-lg text-xs font-semibold hover:bg-soft-100 cursor-pointer"
            >
              <ImageIcon size={13} />{" "}
              {activeSlot.coverUrl ? "Change cover" : "Choose cover"}
            </button>
          </div>
        )}
      {coverFor && (
        <CoverPicker
          videoUrl={coverFor}
          onClose={() => setCoverFor(null)}
          onPick={(coverUrl) => {
            updateSlot(activeSlot.id, { coverUrl });
            setCoverFor(null);
          }}
        />
      )}

      {/* iOS Segmented Tabs - Hidden for draft placeholders */}
      {!isDraftPlaceholder && (
        <div className="bg-soft-100/80 p-1 rounded-xl flex gap-1 border border-soft-200/60">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
              activeTab === "details"
                ? "bg-white text-slate-900 font-bold shadow-xs"
                : "text-foreground/50 hover:text-foreground"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("appearance")}
            className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
              activeTab === "appearance"
                ? "bg-white text-slate-900 font-bold shadow-xs"
                : "text-foreground/50 hover:text-foreground"
            }`}
          >
            Placeholder
          </button>
        </div>
      )}

      {/* Tab Content / Minimal Placeholder Controls */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4 py-1">
        {isDraftPlaceholder || activeTab === "appearance" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">
                Filler Color (Hex)
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={localHex}
                  onChange={(e) => setLocalHex(e.target.value)}
                  onBlur={() =>
                    updateSlot(activeSlot.id, { hexColor: localHex })
                  }
                  placeholder="#E4E4E7"
                  className="flex-1 p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs transition-all uppercase font-mono font-bold text-slate-800"
                />
                <input
                  type="color"
                  value={localHex || "#E4E4E7"}
                  onChange={(e) => {
                    setLocalHex(e.target.value);
                    updateSlot(activeSlot.id, { hexColor: e.target.value });
                  }}
                  className="w-10 h-10 rounded-xl border border-soft-200 shadow-sm shrink-0 cursor-pointer p-0.5 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">
                Placeholder Label / Text
              </label>
              <input
                type="text"
                ref={textRef}
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                onBlur={() =>
                  localText !== activeSlot.text &&
                  updateSlot(activeSlot.id, { text: localText })
                }
                placeholder="e.g. Selfie, Detail (Perfume), Full Body..."
                className="p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs font-semibold transition-all"
              />
            </div>

            {/* Custom Font Size Control */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">
                  Text Font Size
                </label>
                <span className="text-xs font-bold text-slate-800">
                  {activeSlot.fontSize || 14}px
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="36"
                  value={activeSlot.fontSize || 14}
                  onChange={(e) =>
                    updateSlot(activeSlot.id, {
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="flex-1 accent-slate-800 cursor-pointer"
                />
                <div className="flex gap-1">
                  {[12, 14, 18, 24].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        updateSlot(activeSlot.id, { fontSize: size })
                      }
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        (activeSlot.fontSize || 14) === size
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white border-soft-200 text-foreground/70 hover:bg-soft-100"
                      }`}
                    >
                      {size === 12
                        ? "S"
                        : size === 14
                          ? "M"
                          : size === 18
                            ? "L"
                            : "XL"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {!virtualPage && activeSlot.contentType !== "Story" && (
              <div className="flex items-center gap-3 bg-soft-50 border border-soft-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="hideFromGrid"
                  checked={activeSlot.isHiddenFromPhone || false}
                  onChange={(e) =>
                    updateSlot(activeSlot.id, {
                      isHiddenFromPhone: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-slate-800 focus:ring-slate-800/20 cursor-pointer"
                />
                <label
                  htmlFor="hideFromGrid"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  Hide from phone{" "}
                  <span className="text-foreground/50">
                    (Posts and Reels)
                  </span>
                </label>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">
                Schedule Time
              </label>
              <input
                type="datetime-local"
                value={activeSlot.scheduledTime || ""}
                onChange={(e) =>
                  updateSlot(activeSlot.id, {
                    scheduledTime: e.target.value,
                  })
                }
                className="p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs transition-all"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
