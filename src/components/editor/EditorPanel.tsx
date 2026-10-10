"use client";

import { useState, useRef, useEffect } from "react";
import { SlotItem } from "@/types";
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
} from "lucide-react";
import { LocalMediaImage, LocalMediaVideo } from "@/components/grid/LocalMedia";
import { CoverPicker } from "./CoverPicker";

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
  /** Editing a planner page that has no grid box: no "Move to Drafts" */
  pageOnly?: boolean;
}

export function EditorPanel({
  activeSlot,
  updateSlot,
  onClose,
  onDeleteSlot,
  pageOnly = false,
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "appearance">(
    "details",
  );
  const [isUploading, setIsUploading] = useState(false);
  // A video just added to a reel (or "Change cover"): ask what its cover should be
  const [coverFor, setCoverFor] = useState<string | null>(null);
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

  const nextImage = () => {
    if (activeSlot.urls && activeSlot.urls.length > 1) {
      updateSlot(activeSlot.id, {
        currentUrlIndex:
          (activeSlot.currentUrlIndex + 1) % activeSlot.urls.length,
      });
    }
  };

  const prevImage = () => {
    if (activeSlot.urls && activeSlot.urls.length > 1) {
      updateSlot(activeSlot.id, {
        currentUrlIndex:
          (activeSlot.currentUrlIndex - 1 + activeSlot.urls.length) %
          activeSlot.urls.length,
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const { saveFilesLocally } = await import("@/lib/localUpload");
      const newBase64Strings = await saveFilesLocally(files);

      const newUrls = [...(activeSlot.urls || []), ...newBase64Strings];

      updateSlot(activeSlot.id, {
        type: newBase64Strings.length && newBase64Strings.every(isVideoUrl) ? "video" : "image",
        urls: newUrls,
        currentUrlIndex: (activeSlot.urls || []).length,
      });
      const video = newBase64Strings.find(isVideoUrl);
      if (video && activeSlot.contentType === "Reel") setCoverFor(video);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDelete = () => {
    if (activeSlot.urls && activeSlot.urls.length > 0) {
      // Deletes only the single photo currently being viewed (e.g. 1 of 3)
      const newUrls = activeSlot.urls.filter(
        (_, idx) => idx !== (activeSlot.currentUrlIndex || 0),
      );
      if (newUrls.length === 0) {
        updateSlot(activeSlot.id, {
          type: "placeholder",
          urls: [],
          currentUrlIndex: 0,
        });
      } else {
        const newIndex = Math.min(
          activeSlot.currentUrlIndex || 0,
          newUrls.length - 1,
        );
        updateSlot(activeSlot.id, {
          urls: newUrls,
          currentUrlIndex: newIndex,
        });
      }
    } else {
      // If empty placeholder slot, remove the whole post slot from grid
      if (onDeleteSlot) onDeleteSlot(activeSlot.id);
    }
  };

  const isDraftPlaceholder =
    activeSlot.folderId === "draft-pool" &&
    (!activeSlot.urls || activeSlot.urls.length === 0);

  return (
    <div className="p-4 flex flex-col gap-3.5 h-full max-h-[85vh] overflow-hidden text-foreground select-none">
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
              activeSlot.urls && activeSlot.urls.length > 0
                ? "Delete Current Photo"
                : "Delete Draft Box"
            }
          >
            <Trash2 size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Carousel Navigation & Photo Switcher */}
        {!isDraftPlaceholder &&
          activeSlot.urls &&
          activeSlot.urls.length > 0 && (
            <div className="flex flex-col gap-2 p-2.5 bg-soft-50/80 border border-soft-200/80 rounded-2xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={prevImage}
                  disabled={activeSlot.urls.length <= 1}
                  className={`px-3 py-1.5 bg-white border border-soft-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-xs ${
                    activeSlot.urls.length > 1
                      ? "hover:bg-soft-100 hover:text-foreground cursor-pointer text-foreground/80"
                      : "opacity-40 cursor-not-allowed text-foreground/40"
                  }`}
                  title="Previous Photo"
                >
                  <ChevronLeft size={14} strokeWidth={2.5} />
                  <span>Prev</span>
                </button>

                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground/80 tracking-tight">
                  {isVideoUrl(activeSlot.urls[activeSlot.currentUrlIndex || 0] ?? "") ? "Video" : "Photo"} {(activeSlot.currentUrlIndex || 0) + 1} of{" "}
                  {activeSlot.urls.length}
                  <button
                    onClick={() => {
                      const i = activeSlot.currentUrlIndex || 0;
                      downloadMedia(activeSlot.urls[i], `${activeSlot.text || "photo"}${activeSlot.urls.length > 1 ? ` ${i + 1}` : ""}`);
                    }}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-soft-100 cursor-pointer"
                    title="Download this photo"
                    aria-label="Download this photo"
                  >
                    <Download size={13} strokeWidth={2.4} />
                  </button>
                </span>

                <button
                  onClick={nextImage}
                  disabled={activeSlot.urls.length <= 1}
                  className={`px-3 py-1.5 bg-white border border-soft-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-xs ${
                    activeSlot.urls.length > 1
                      ? "hover:bg-soft-100 hover:text-foreground cursor-pointer text-foreground/80"
                      : "opacity-40 cursor-not-allowed text-foreground/40"
                  }`}
                  title="Next Photo"
                >
                  <span>Next</span>
                  <ChevronRight size={14} strokeWidth={2.5} />
                </button>
              </div>

              {/* Thumbnail Strip */}
              {activeSlot.urls.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  {activeSlot.urls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        updateSlot(activeSlot.id, { currentUrlIndex: idx })
                      }
                      className={`relative w-9 h-9 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                        idx === (activeSlot.currentUrlIndex || 0)
                          ? "border-slate-800 ring-2 ring-slate-400/40 scale-105"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      {isVideoUrl(url) ? (
                        <LocalMediaVideo src={url} muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <LocalMediaImage src={url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* A reel's cover */}
      {activeSlot.contentType === "Reel" && activeSlot.urls?.some(isVideoUrl) && (
        <div className="flex items-center gap-2.5 p-2.5 bg-soft-50/80 border border-soft-200/80 rounded-2xl">
          <div className="w-9 h-12 rounded-md overflow-hidden bg-zinc-200 shrink-0">
            {activeSlot.coverUrl && <LocalMediaImage src={activeSlot.coverUrl} alt="" className="w-full h-full object-cover" />}
          </div>
          <span className="text-xs font-semibold text-foreground/80">{activeSlot.coverUrl ? "Cover" : "No cover yet"}</span>
          <button
            onClick={() => setCoverFor(activeSlot.urls.find(isVideoUrl) ?? null)}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-soft-200 rounded-lg text-xs font-semibold hover:bg-soft-100 cursor-pointer"
          >
            <ImageIcon size={13} /> {activeSlot.coverUrl ? "Change cover" : "Choose cover"}
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
                onBlur={() => localText !== activeSlot.text && updateSlot(activeSlot.id, { text: localText })}
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
            {activeSlot.contentType === "Reel" && (
              <div className="flex items-center gap-3 bg-soft-50 border border-soft-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="hideFromGrid"
                  checked={activeSlot.isHiddenFromGrid || false}
                  onChange={(e) =>
                    updateSlot(activeSlot.id, {
                      isHiddenFromGrid: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-slate-800 focus:ring-slate-800/20 cursor-pointer"
                />
                <label
                  htmlFor="hideFromGrid"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  Hide from Profile Grid
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
                  updateSlot(activeSlot.id, { scheduledTime: e.target.value })
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
