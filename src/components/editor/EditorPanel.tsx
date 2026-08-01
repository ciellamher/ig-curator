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
} from "lucide-react";

interface EditorPanelProps {
  activeSlot: SlotItem | null;
  updateSlot: (id: string, updates: Partial<SlotItem>) => void;
  onClose?: () => void;
  onDeleteSlot?: (id: string) => void;
}

export function EditorPanel({
  activeSlot,
  updateSlot,
  onClose,
  onDeleteSlot,
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "appearance">(
    "details",
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localText, setLocalText] = useState(activeSlot?.text || "");
  const [localHex, setLocalHex] = useState(activeSlot?.hexColor || "");

  useEffect(() => {
    if (activeSlot) {
      setLocalText(activeSlot.text || "");
      setLocalHex(activeSlot.hexColor || "");
    }
  }, [activeSlot?.id]);

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
      const newBase64Strings: string[] = [];
      
      for (const file of files) {
        let uploadedUrl: string | null = null;
        
        // First try to upload to cloud Blob storage
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.success && data.url) {
            uploadedUrl = data.url;
          }
        } catch (uploadError) {
          console.error("Cloud upload failed, falling back to base64", uploadError);
        }

        // Fallback to local Base64 canvas resize
        if (!uploadedUrl) {
          try {
            uploadedUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  const MAX_SIZE = 500;
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
                  resolve(canvas.toDataURL("image/jpeg", 0.6));
                };
                img.onerror = () => reject(new Error("Image unsupported"));
                img.src = e.target?.result as string;
              };
              reader.onerror = () => reject(new Error("File read error"));
              reader.readAsDataURL(file);
            });
          } catch (e) {
            console.error("Skipping unsupported or corrupted file:", e);
            continue; // Skip this file and proceed with the rest
          }
        }
        
        if (uploadedUrl) {
          newBase64Strings.push(uploadedUrl);
        }
      }

      const newUrls = [...(activeSlot.urls || []), ...newBase64Strings];

      updateSlot(activeSlot.id, {
        type: "image",
        urls: newUrls,
        currentUrlIndex: (activeSlot.urls || []).length,
      });
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
    activeSlot.folderId === "draft-pool" ||
    activeSlot.id.startsWith("slot-draft");

  return (
    <div className="p-4 flex flex-col gap-3.5 h-full max-h-[85vh] overflow-hidden text-foreground select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept="image/*"
        multiple
      />

      {/* Quick Action Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Add / Upload & Move to Drafts Buttons - Hidden for draft placeholders */}
          {!isDraftPlaceholder ? (
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 flex items-center justify-center p-2.5 bg-slate-900 text-white hover:bg-black rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                title={isUploading ? "Uploading..." : "Add / Upload Photo"}
              >
                <Upload size={18} strokeWidth={2.2} />
              </button>
              <button
                onClick={() => {
                  updateSlot(activeSlot.id, { folderId: "draft-pool" });
                }}
                className="flex-1 flex items-center justify-center p-2.5 bg-slate-200 text-slate-800 hover:bg-slate-300 rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Move back to Drafts"
              >
                <ArrowDownToLine size={18} strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1">
              Edit Draft Box
            </span>
          )}

          {/* Single Photo / Slot Trash Button */}
          <button
            onClick={handleDelete}
            className="p-2.5 bg-soft-100 border border-soft-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl active:scale-95 transition-all cursor-pointer shrink-0"
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

                <span className="text-xs font-bold text-foreground/80 tracking-tight">
                  Photo {(activeSlot.currentUrlIndex || 0) + 1} of{" "}
                  {activeSlot.urls.length}
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
                      <img
                        src={url}
                        alt={`Thumb ${idx}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

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
                  placeholder="#E5D3C8"
                  className="flex-1 p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs transition-all uppercase font-mono font-bold text-slate-800"
                />
                <input
                  type="color"
                  value={localHex || "#E5D3C8"}
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
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                onBlur={() => updateSlot(activeSlot.id, { text: localText })}
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

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">
                Caption & Hashtags
              </label>
              <textarea
                value={activeSlot.caption || ""}
                onChange={(e) =>
                  updateSlot(activeSlot.id, { caption: e.target.value })
                }
                placeholder="Write a caption..."
                className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-sm min-h-[120px] resize-none transition-all"
              />
            </div>

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
