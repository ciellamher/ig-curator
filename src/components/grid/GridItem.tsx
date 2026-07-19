"use client"

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type SlotItem = {
  id: string;
  type: "image" | "placeholder";
  url?: string;
  hexColor?: string;
};

interface GridItemProps {
  item: SlotItem;
}

export function GridItem({ item }: GridItemProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative aspect-square w-full rounded-2xl overflow-hidden shadow-diffused-sm cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? "shadow-diffused scale-105" : ""
      }`}
    >
      {item.type === "image" && item.url ? (
        <img
          src={item.url}
          alt={`Grid slot ${item.id}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: item.hexColor || "var(--color-soft-50)" }}
        >
          {/* Aesthetic Placeholder inner styling */}
          <div className="w-1/3 h-1/3 rounded-full bg-white/40 backdrop-blur-sm shadow-diffused-sm" />
        </div>
      )}
    </div>
  );
}
