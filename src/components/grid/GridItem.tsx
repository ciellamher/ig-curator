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
  onClick: () => void;
  onDoubleClick?: () => void;
  onDelete?: (id: string) => void;
}

export function GridItem({ item, updateItem, gridFilter, isActive, onClick, onDoubleClick, onDelete }: GridItemProps) {
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
            
            // Compress to JPEG to save massive amounts of storage
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));

      const newBase64Strings = await Promise.all(base64Promises);
      const newUrls = [...item.urls, ...newBase64Strings];
      
      updateItem(item.id, {
        type: "image",
        urls: newUrls,
        currentUrlIndex: item.urls.length, // point to the first new option
      });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      // Reset input so the same files can be selected again if needed
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
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        onClick();
        if (item.urls.length > 1) {
          nextImage(e);
        }
      }}
      onDoubleClick={onDoubleClick}
      className={`relative w-full overflow-visible ${isAdjusting ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'} transition-all group ${
        ["Reel", "Story", "TikTok"].includes(gridFilter) ? "aspect-[9/16]" : "aspect-[4/5]"
      } ${isDragging ? "shadow-2xl scale-105 z-50 rounded-xl" : ""} ${
        isActive ? "ring-2 ring-pastel-400 ring-offset-0 z-10" : ""
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
          {item.urls.length > 1 && (
            <>
              {/* Counter Indicator */}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 pointer-events-none">
                {item.currentUrlIndex! + 1} / {item.urls.length}
              </div>
              
              {!isAdjusting && (
                <>
                  <div className="absolute top-1/2 -translate-y-1/2 -left-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    <button 
                      onClick={prevImage} 
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-1 bg-white shadow-md rounded-full hover:bg-soft-50 text-foreground"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    <button 
                      onClick={nextImage} 
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-1 bg-white shadow-md rounded-full hover:bg-soft-50 text-foreground"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

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
                className="flex-1 accent-pastel-500"
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
            <span className="text-white text-center font-extrabold text-sm drop-shadow-md leading-tight w-full break-words px-2">
              {item.text}
            </span>
          ) : (
            <span className="text-white/90 text-center font-extrabold text-sm drop-shadow-md leading-tight w-full break-words px-2">
              Slot
            </span>
          )}
        </div>
      )}

      {/* Visual Badges */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
        {item.isLocked && (
          <div className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white p-1 rounded-full shadow-sm">
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
          <div className="bg-pastel-500 text-white p-1 rounded-full shadow-sm">
            <Clock size={12} />
          </div>
        )}
      </div>

      {/* Hover/Edit Controls (Hidden if locked) */}
      {!item.isLocked && item.urls.length > 0 && isAdjusting && (
        <div 
          className="absolute top-2 right-2 flex items-center gap-2 z-50 bg-pastel-500 text-white px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-pastel-600 transition-colors"
          onClick={saveAdjustment}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Check size={16} />
          <span className="text-xs font-bold">Done</span>
        </div>
      )}

      {!item.isLocked && !isAdjusting && (
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm z-40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setTempSettings(item.imageSettings?.[item.currentUrlIndex] || { scale: 1, x: 0, y: 0 });
              setIsAdjusting(true);
            }}
            className="text-foreground hover:text-pastel-500 transition-colors p-1"
            title="Adjust Image"
          >
            <Crop size={16} />
          </button>
          
          <div className="w-[1px] h-4 bg-soft-200 mx-1"></div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="text-foreground hover:text-pastel-500 transition-colors p-1"
            title="Upload Image"
          >
            <Upload size={16} />
          </button>
          
          {onDelete && (
            <>
              <div className="w-[1px] h-4 bg-soft-200 mx-1"></div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.urls.length > 1) {
                    const newUrls = item.urls.filter((_, i) => i !== item.currentUrlIndex);
                    updateItem(item.id, { 
                      urls: newUrls,
                      currentUrlIndex: Math.max(0, item.currentUrlIndex - 1)
                    });
                  } else {
                    onDelete(item.id);
                  }
                }}
                className="text-foreground hover:text-red-500 transition-colors p-1"
                title="Delete Box"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pastel-500"></div>
        </div>
      )}
    </div>
  );
}
