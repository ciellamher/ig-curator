"use client"

import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Upload, Type } from "lucide-react";
import { uploadImage } from "@/app/actions/upload";

export type SlotItem = {
  id: string;
  type: "image" | "placeholder";
  urls: string[];
  currentUrlIndex: number;
  hexColor: string;
  text: string;
};

interface GridItemProps {
  item: SlotItem;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  isStoryMode: boolean;
}

export function GridItem({ item, updateItem, isStoryMode }: GridItemProps) {
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
  } = useSortable({ id: item.id });

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
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadImage(formData);
      
      const newUrls = [...item.urls, res.url];
      updateItem(item.id, {
        type: "image",
        urls: newUrls,
        currentUrlIndex: newUrls.length - 1,
      });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
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

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateItem(item.id, { hexColor: e.target.value });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateItem(item.id, { text: e.target.value });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative w-full rounded-2xl overflow-hidden shadow-diffused-sm cursor-grab active:cursor-grabbing transition-shadow group ${
        isStoryMode ? "aspect-[9/16]" : "aspect-square"
      } ${isDragging ? "shadow-diffused scale-105" : ""}`}
      onDoubleClick={() => setIsEditing(!isEditing)}
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
          className="w-full h-full flex flex-col items-center justify-center p-4 relative"
          style={{ backgroundColor: item.hexColor }}
        >
          {item.text ? (
            <span className="text-foreground text-center font-medium drop-shadow-sm text-sm truncate w-full">
              {item.text}
            </span>
          ) : (
            <div className="w-1/3 h-1/3 rounded-full bg-white/40 backdrop-blur-sm shadow-diffused-sm mb-2" />
          )}
        </div>
      )}

      {/* Hover/Edit Controls */}
      <div 
        className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="text-foreground hover:text-pastel-500 transition-colors"
          title="Upload Image"
        >
          <Upload size={14} />
        </button>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-foreground hover:text-pastel-500 transition-colors"
          title="Edit Placeholder"
        >
          <Type size={14} />
        </button>
      </div>

      {isUploading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pastel-500"></div>
        </div>
      )}

      {/* Editing Popover */}
      {isEditing && (
        <div 
          className="absolute inset-0 bg-white/95 p-4 flex flex-col gap-3 justify-center text-sm z-20 backdrop-blur-md"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/70">Hex Color</label>
            <input 
              type="text" 
              value={item.hexColor} 
              onChange={handleHexChange}
              placeholder="#fdfdfd"
              className="px-2 py-1 border border-soft-200 rounded outline-none focus:border-pastel-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/70">Text Overlay</label>
            <input 
              type="text" 
              value={item.text} 
              onChange={handleTextChange}
              placeholder="Moodboard text..."
              className="px-2 py-1 border border-soft-200 rounded outline-none focus:border-pastel-300"
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <button 
              onClick={() => {
                updateItem(item.id, { type: "placeholder" })
                setIsEditing(false)
              }}
              className="text-xs text-foreground/70 hover:text-foreground"
            >
              Clear Image
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 bg-pastel-500 text-white rounded hover:bg-pastel-400 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
