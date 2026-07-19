"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { GridItem } from "./GridItem"
import { LayoutGrid, Smartphone } from "lucide-react"
import { SlotItem } from "@/types"

interface GridProps {
  items: SlotItem[];
  setItems: React.Dispatch<React.SetStateAction<SlotItem[]>>;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string) => void;
}

export function Grid({ items, setItems, updateItem, activeSlotId, setActiveSlotId }: GridProps) {
  const [isStoryMode, setIsStoryMode] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="max-w-[420px] mx-auto w-full p-6 bg-white rounded-[2rem] shadow-diffused border border-soft-100 flex flex-col gap-6">
      
      {/* Toggle Header */}
      <div className="flex items-center justify-center bg-soft-50 rounded-full p-1 self-center">
        <button
          onClick={() => setIsStoryMode(false)}
          className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors ${
            !isStoryMode ? "bg-white text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"
          }`}
        >
          <LayoutGrid size={16} /> Grid
        </button>
        <button
          onClick={() => setIsStoryMode(true)}
          className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors ${
            isStoryMode ? "bg-white text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"
          }`}
        >
          <Smartphone size={16} /> Story
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid ${isStoryMode ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-3'}`}>
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map((item) => (
              <GridItem 
                key={item.id} 
                item={item} 
                updateItem={updateItem}
                isStoryMode={isStoryMode}
                isActive={activeSlotId === item.id}
                onClick={() => setActiveSlotId(item.id)}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  )
}
