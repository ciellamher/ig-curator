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
import { GridItem, SlotItem } from "./GridItem"

const initialItems: SlotItem[] = Array.from({ length: 9 }).map((_, index) => ({
  id: `slot-${index}`,
  type: "placeholder",
  hexColor: index % 2 === 0 ? "var(--color-pastel-50)" : "var(--color-soft-50)",
}))

export function Grid() {
  const [items, setItems] = useState<SlotItem[]>(initialItems)

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
    <div className="max-w-[400px] mx-auto w-full p-4 bg-white rounded-[2rem] shadow-diffused border border-soft-100">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-3">
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map((item) => (
              <GridItem key={item.id} item={item} />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  )
}
