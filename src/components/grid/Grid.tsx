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
import { SlotItem } from "@/types"

interface GridProps {
  items: SlotItem[];
  setItems: React.Dispatch<React.SetStateAction<SlotItem[]>>;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string) => void;
  gridFilter?: string;
  onDoubleClickItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
}

export function Grid({ items, setItems, updateItem, activeSlotId, setActiveSlotId, gridFilter = "All", onDoubleClickItem, onDeleteItem }: GridProps) {
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
    <div className="w-full h-full pb-20">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-[1px] bg-white">
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map((item) => (
              <GridItem 
                key={item.id} 
                item={item} 
                updateItem={updateItem}
                gridFilter={gridFilter}
                isActive={activeSlotId === item.id}
                onClick={() => setActiveSlotId(item.id)}
                onDoubleClick={() => onDoubleClickItem?.(item.id)}
                onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  )
}
