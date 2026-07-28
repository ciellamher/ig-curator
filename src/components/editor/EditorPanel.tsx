"use client"

import { useState, useRef } from "react"
import { SlotItem } from "@/types"
import { Upload, Trash2, X, Sparkles, ChevronLeft, ChevronRight } from "lucide-react"

interface EditorPanelProps {
  activeSlot: SlotItem | null;
  updateSlot: (id: string, updates: Partial<SlotItem>) => void;
  onClose?: () => void;
  onDeleteSlot?: (id: string) => void;
}

export function EditorPanel({ activeSlot, updateSlot, onClose, onDeleteSlot }: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "appearance">("details");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activeSlot) return null;

  const nextImage = () => {
    if (activeSlot.urls && activeSlot.urls.length > 1) {
      updateSlot(activeSlot.id, {
        currentUrlIndex: (activeSlot.currentUrlIndex + 1) % activeSlot.urls.length
      });
    }
  };

  const prevImage = () => {
    if (activeSlot.urls && activeSlot.urls.length > 1) {
      updateSlot(activeSlot.id, {
        currentUrlIndex: (activeSlot.currentUrlIndex - 1 + activeSlot.urls.length) % activeSlot.urls.length
      });
    }
  };

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
            const MAX_SIZE = 800;
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
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));

      const newBase64Strings = await Promise.all(base64Promises);
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
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="p-5 flex flex-col gap-4 h-full max-h-[85vh] overflow-hidden text-foreground">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept="image/*"
        multiple
      />

      {/* Header */}
      <div className="flex justify-between items-center pb-1">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-pastel-500" />
          <h3 className="font-bold text-lg text-foreground tracking-tight">Edit Slot</h3>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-soft-100 transition-colors"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Quick Action Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 p-2 bg-soft-50 border border-soft-200 rounded-xl">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-soft-200 hover:border-pastel-300 rounded-lg text-xs font-semibold text-foreground shadow-sm hover:text-pastel-600 transition-all cursor-pointer"
          >
            <Upload size={14} />
            <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
          </button>

          {onDeleteSlot && (
            <button
              onClick={() => onDeleteSlot(activeSlot.id)}
              className="flex items-center justify-center p-2 bg-white border border-soft-200 hover:border-red-300 rounded-lg text-foreground/60 hover:text-red-500 shadow-sm transition-all cursor-pointer"
              title="Delete Slot"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Carousel Navigation & Photo Switcher in Drag Panel */}
        {activeSlot.urls && activeSlot.urls.length > 0 && (
          <div className="flex flex-col gap-2 p-2.5 bg-pastel-50/80 border border-pastel-200 rounded-xl shadow-inner">
            <div className="flex items-center justify-between">
              <button 
                onClick={prevImage}
                disabled={activeSlot.urls.length <= 1}
                className={`px-3 py-1.5 bg-white border border-pastel-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                  activeSlot.urls.length > 1 
                    ? "hover:bg-pastel-500 hover:text-white hover:border-pastel-500 cursor-pointer text-foreground" 
                    : "opacity-40 cursor-not-allowed text-foreground/40"
                }`}
                title="Previous Photo"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
                <span>Left</span>
              </button>

              <div className="flex flex-col items-center">
                <span className="text-xs font-extrabold text-pastel-800 tracking-tight">
                  Photo {(activeSlot.currentUrlIndex || 0) + 1} of {activeSlot.urls.length}
                </span>
                <span className="text-[10px] text-pastel-600 font-medium">Carousel Navigation</span>
              </div>

              <button 
                onClick={nextImage}
                disabled={activeSlot.urls.length <= 1}
                className={`px-3 py-1.5 bg-white border border-pastel-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                  activeSlot.urls.length > 1 
                    ? "hover:bg-pastel-500 hover:text-white hover:border-pastel-500 cursor-pointer text-foreground" 
                    : "opacity-40 cursor-not-allowed text-foreground/40"
                }`}
                title="Next Photo"
              >
                <span>Right</span>
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Thumbnail Strip */}
            {activeSlot.urls.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {activeSlot.urls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => updateSlot(activeSlot.id, { currentUrlIndex: idx })}
                    className={`relative w-10 h-10 rounded-md overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      idx === (activeSlot.currentUrlIndex || 0)
                        ? "border-pastel-500 ring-2 ring-pastel-400 scale-105"
                        : "border-white opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-soft-100 pb-2">
        <button 
          onClick={() => setActiveTab("details")}
          className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer ${activeTab === "details" ? "bg-pastel-100 text-pastel-700 font-bold" : "text-foreground/50 hover:bg-soft-100"}`}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab("appearance")}
          className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer ${activeTab === "appearance" ? "bg-pastel-100 text-pastel-700 font-bold" : "text-foreground/50 hover:bg-soft-100"}`}
        >
          Placeholder / Filler
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4 py-1">
        {activeTab === "details" ? (
          <>
            {activeSlot.contentType === "Reel" && (
              <div className="flex items-center gap-3 bg-soft-50 border border-soft-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="hideFromGrid"
                  checked={activeSlot.isHiddenFromGrid || false}
                  onChange={(e) => updateSlot(activeSlot.id, { isHiddenFromGrid: e.target.checked })}
                  className="w-4 h-4 rounded text-pastel-500 focus:ring-pastel-500/20 cursor-pointer"
                />
                <label htmlFor="hideFromGrid" className="text-xs font-medium text-foreground cursor-pointer">
                  Hide from Profile Grid
                </label>
              </div>
            )}

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">Caption & Hashtags</label>
              <textarea
                value={activeSlot.caption || ""}
                onChange={(e) => updateSlot(activeSlot.id, { caption: e.target.value })}
                placeholder="Write a caption..."
                className="p-3 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-400 focus:bg-white text-sm min-h-[120px] resize-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">Schedule Time</label>
              <input
                type="datetime-local"
                value={activeSlot.scheduledTime || ""}
                onChange={(e) => updateSlot(activeSlot.id, { scheduledTime: e.target.value })}
                className="p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-400 focus:bg-white text-xs transition-all"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">Filler Color (Hex)</label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={activeSlot.hexColor || ""}
                  onChange={(e) => updateSlot(activeSlot.id, { hexColor: e.target.value })}
                  placeholder="#E5D3C8"
                  className="flex-1 p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-400 focus:bg-white text-xs transition-all uppercase font-mono"
                />
                <div 
                  className="w-10 h-10 rounded-xl border border-soft-200 shadow-sm shrink-0" 
                  style={{ backgroundColor: activeSlot.hexColor }} 
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">Placeholder Label / Text</label>
              <input
                type="text"
                value={activeSlot.text || ""}
                onChange={(e) => updateSlot(activeSlot.id, { text: e.target.value })}
                placeholder="e.g. Quote box, Product teaser..."
                className="p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-pastel-400 focus:bg-white text-xs transition-all"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
