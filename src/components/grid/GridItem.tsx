"use client"

import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Upload, Type, Video, GalleryHorizontal, Clock, Camera, Trash2, Crop, Check } from "lucide-react";
import { uploadImage } from "@/app/actions/upload";
import { SlotItem } from "@/types";

interface GridItemProps {
  item: SlotItem;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  gridFilter: string;
  isActive: boolean;
  isSearchActive?: boolean;
  isSearchResult?: boolean;
  isFocusedSearchMatch?: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onDelete?: (id: string) => void;
}

export function GridItem({ item, updateItem, gridFilter, isActive, isSearchActive, isSearchResult, isFocusedSearchMatch, onClick, onDoubleClick, onDelete }: GridItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [tempSettings, setTempSettings] = useState({ scale: 1, x: 0, y: 0 });
  const startDragRef = useRef<{ x: number, y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: item.isLocked || isAdjusting });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
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
          uploadedUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_SIZE = 500;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                  if (width > MAX_SIZE) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE; }
                } else {
                  if (height > MAX_SIZE) { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.6));
              };
              img.onerror = reject;
              img.src = ev.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        
        if (uploadedUrl) {
          newBase64Strings.push(uploadedUrl);
        }
      }

      const newUrls = [...item.urls, ...newBase64Strings];
      updateItem(item.id, {
        type: "image",
        urls: newUrls,
        currentUrlIndex: item.urls.length,
      });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.urls.length > 1) {
      updateItem(item.id, {
        currentUrlIndex: (item.currentUrlIndex + 1) % item.urls.length
      });
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.urls.length > 1) {
      updateItem(item.id, {
        currentUrlIndex: (item.currentUrlIndex - 1 + item.urls.length) % item.urls.length
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isAdjusting) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startDragRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isAdjusting || !startDragRef.current) return;
    const dx = e.clientX - startDragRef.current.x;
    const dy = e.clientY - startDragRef.current.y;
    startDragRef.current = { x: e.clientX, y: e.clientY };
    setTempSettings(s => ({ ...s, x: s.x + dx, y: s.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isAdjusting) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    startDragRef.current = null;
  };

  const saveAdjustment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdjusting(false);
    const newSettings = { ...(item.imageSettings || {}) };
    newSettings[item.currentUrlIndex] = tempSettings;
    updateItem(item.id, { imageSettings: newSettings });
  };

  const touchStartRef = useRef<{ x: number, y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAdjusting || item.urls.length <= 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isAdjusting || item.urls.length <= 1 || !touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    
    // Check if it's a horizontal swipe (dx > 30px, and mostly horizontal)
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        prevImage(e as any);
      } else {
        nextImage(e as any);
      }
    }
    touchStartRef.current = null;
  };

  const currentSettings = isAdjusting 
    ? tempSettings 
    : (item.imageSettings?.[item.currentUrlIndex] || { scale: 1, x: 0, y: 0 });

  return (
    <div
      id={`grid-slot-${item.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        onClick();
      }}
      onDoubleClick={onDoubleClick}
      className={`relative w-full overflow-hidden ${isAdjusting ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'} transition-all duration-200 group ${
        ["Reel", "Story", "TikTok"].includes(gridFilter) ? "aspect-[9/16]" : "aspect-[4/5]"
      } ${isDragging ? "shadow-2xl scale-105 z-50 rounded-xl" : ""} ${
        isSearchActive
          ? isSearchResult
            ? "ring-4 ring-slate-900 ring-offset-1 z-30 shadow-xl opacity-100 scale-[1.01]"
            : "opacity-40 grayscale-[40%]"
          : isActive 
          ? "ring-4 ring-slate-900 ring-inset z-20 shadow-md" 
          : "hover:ring-2 hover:ring-slate-300/60 hover:ring-inset"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept="image/*"
        multiple
      />

      {item.type === "image" && item.urls.length > 0 ? (
        <div 
          className="w-full h-full relative overflow-hidden bg-soft-100"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={item.urls[item.currentUrlIndex]}
            alt={`Grid slot ${item.id}`}
            style={{ 
              transform: `translate(${currentSettings.x}px, ${currentSettings.y}px) scale(${currentSettings.scale})`,
              transformOrigin: "center"
            }}
            className="w-full h-full object-cover transition-transform duration-75"
            draggable={false}
          />

          {isAdjusting && (
            <div 
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-11/12 bg-white/90 backdrop-blur-md rounded-xl p-2 shadow-lg flex items-center gap-2 z-50"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-bold text-foreground opacity-60">ZOOM</span>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.05" 
                value={tempSettings.scale}
                onChange={(e) => setTempSettings(s => ({ ...s, scale: parseFloat(e.target.value) }))}
                className="flex-1 accent-slate-800"
              />
            </div>
          )}
        </div>
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-2 relative"
          style={{ backgroundColor: item.hexColor }}
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
              Slot
            </span>
          )}
        </div>
      )}

      {/* Visual Badges */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
        {item.isLocked && (
          <div className="bg-gradient-to-tr from-slate-700 to-slate-900 text-white p-1 rounded-full shadow-sm">
            <Camera size={12} />
          </div>
        )}
        {item.contentType === "Reel" && (
          <div className="bg-white/80 backdrop-blur text-foreground p-1 rounded-full shadow-sm">
            <Video size={12} />
          </div>
        )}
        {item.contentType === "Carousel" && (
          <div className="bg-white/80 backdrop-blur text-foreground p-1 rounded-full shadow-sm">
            <GalleryHorizontal size={12} />
          </div>
        )}
        {item.scheduledTime && (
          <div className="bg-slate-900 text-white p-1 rounded-full shadow-sm">
            <Clock size={12} />
          </div>
        )}
      </div>

      {/* Done Button when Adjusting Image */}
      {!item.isLocked && item.urls.length > 0 && isAdjusting && (
        <div 
          className="absolute top-2 right-2 flex items-center gap-1.5 z-50 bg-slate-900 text-white px-3 py-1 rounded-full shadow-lg cursor-pointer hover:bg-black transition-colors"
          onClick={saveAdjustment}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Check size={14} />
          <span className="text-xs font-bold">Done</span>
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm pointer-events-none z-50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-800"></div>
        </div>
      )}
    </div>
  );
}
