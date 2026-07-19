"use client"

import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Upload, Type, Video, GalleryHorizontal, Clock, Camera } from "lucide-react";
import { uploadImage } from "@/app/actions/upload";
import { SlotItem } from "@/types";

interface GridItemProps {
  item: SlotItem;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  gridFilter: string;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

export function GridItem({ item, updateItem, gridFilter, isActive, onClick, onDoubleClick }: GridItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: item.isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const newUrls = [...item.urls, base64String];
        updateItem(item.id, {
          type: "image",
          urls: newUrls,
          currentUrlIndex: newUrls.length - 1,
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload failed", error);
      setIsUploading(false);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative w-full overflow-hidden cursor-grab active:cursor-grabbing transition-all group ${
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
      />

      {item.type === "image" && item.urls.length > 0 ? (
        <div className="w-full h-full relative">
          <img
            src={item.urls[item.currentUrlIndex]}
            alt={`Grid slot ${item.id}`}
            className="w-full h-full object-cover"
          />
          {item.urls.length > 1 && (
            <div className="absolute inset-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={prevImage} 
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 bg-white/70 rounded-full hover:bg-white text-foreground"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                onClick={nextImage} 
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 bg-white/70 rounded-full hover:bg-white text-foreground"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-2 relative"
          style={{ backgroundColor: item.hexColor }}
        >
          {item.text ? (
            <span className="text-white text-center font-extrabold text-lg drop-shadow-md leading-tight w-full break-words px-2">
              {item.text}
            </span>
          ) : (
            <span className="text-white/90 text-center font-extrabold text-lg drop-shadow-md leading-tight w-full break-words px-2">
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
      {!item.isLocked && (
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="text-foreground hover:text-pastel-500 transition-colors"
            title="Upload Image"
          >
            <Upload size={14} />
          </button>
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
