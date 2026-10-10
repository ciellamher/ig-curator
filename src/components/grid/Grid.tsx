"use client"

import { useState } from "react"
import { draggedItemIds, dropModeAt, droppedPhotos, isPhotoDrag, type PhotoDropMode } from "@/lib/photoDrag"
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
  setActiveSlotId: (id: string | null) => void;
  gridFilter?: string;
  onDoubleClickItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  isSearchActive?: boolean;
  searchResults?: string[];
  focusedMatchId?: string | null;
  /** Inspo photos dropped on a box (into it) or beside it (new boxes there); targetId null = the end */
  onDropPhotos?: (targetId: string | null, mode: PhotoDropMode, urls: string[], sourceIds?: string[]) => void;
}

export function Grid({ items, setItems, updateItem, activeSlotId, setActiveSlotId, gridFilter = "All", onDoubleClickItem, onDeleteItem, isSearchActive, searchResults = [], focusedMatchId, onDropPhotos }: GridProps) {
  const [dropAt, setDropAt] = useState<{ id: string; mode: PhotoDropMode } | null>(null)

  const dropProps = (id: string) =>
    onDropPhotos
      ? {
          onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
            if (!isPhotoDrag(e)) return
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = "copy"
            const mode = dropModeAt(e, e.currentTarget)
            setDropAt((d) => (d?.id === id && d.mode === mode ? d : { id, mode }))
          },
          onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt((d) => (d?.id === id ? null : d))
          },
          onDrop: (e: React.DragEvent<HTMLDivElement>) => {
            if (!isPhotoDrag(e)) return
            e.preventDefault()
            e.stopPropagation()
            const urls = droppedPhotos(e)
            const sourceIds = draggedItemIds(e)
            setDropAt(null)
            if (urls.length) onDropPhotos(id, dropModeAt(e, e.currentTarget), urls, sourceIds)
          },
        }
      : {}
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
    <div
      className="w-full h-full pb-20"
      // Dropped below the boxes: new boxes at the end
      onDragOver={(e) => {
        if (!onDropPhotos || !isPhotoDrag(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(e) => {
        if (!onDropPhotos || !isPhotoDrag(e)) return
        e.preventDefault()
        setDropAt(null)
        const urls = droppedPhotos(e)
        const sourceIds = draggedItemIds(e)
        if (urls.length) onDropPhotos(null, "after", urls, sourceIds)
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-[1px] bg-white">
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map((item) => (
              <div key={item.id} className="relative" {...dropProps(item.id)}>
              <GridItem 
                key={item.id} 
                item={item} 
                updateItem={updateItem}
                gridFilter={gridFilter}
                isActive={activeSlotId === item.id}
                isSearchActive={isSearchActive}
                isSearchResult={searchResults.includes(item.id)}
                isFocusedSearchMatch={focusedMatchId === item.id}
                onClick={() => setActiveSlotId(activeSlotId === item.id ? null : item.id)}
                onDoubleClick={() => onDoubleClickItem?.(item.id)}
                onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
              />
              {dropAt?.id === item.id && (
                dropAt.mode === "into" ? (
                  <div className="pointer-events-none absolute inset-0 z-30 ring-4 ring-inset ring-zinc-950 bg-white/25 flex items-center justify-center">
                    <span className="rounded-full bg-zinc-950 text-white text-[10px] font-semibold px-2 py-0.5">Add photos</span>
                  </div>
                ) : (
                  <div className={`pointer-events-none absolute inset-y-0 z-30 w-1 bg-zinc-950 rounded-full ${dropAt.mode === "before" ? "-left-0.5" : "-right-0.5"}`} />
                )
              )}
              </div>
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  )
}
