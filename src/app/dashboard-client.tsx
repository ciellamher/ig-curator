"use client"

import { useState } from "react"
import { Grid } from "@/components/grid/Grid"
import { EditorPanel } from "@/components/editor/EditorPanel"
import { SlotItem } from "@/types"

const initialItems: SlotItem[] = Array.from({ length: 9 }).map((_, index) => ({
  id: `slot-${index}`,
  type: "placeholder",
  urls: [],
  currentUrlIndex: 0,
  hexColor: index % 2 === 0 ? "var(--color-pastel-50)" : "var(--color-soft-50)",
  text: "",
}))

export function DashboardClient() {
  const [items, setItems] = useState<SlotItem[]>(initialItems)
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const activeSlot = items.find(item => item.id === activeSlotId) || null

  function updateItem(id: string, updates: Partial<SlotItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  async function handleSave() {
    if (!activeSlot) return
    
    setIsSaving(true)
    try {
      // In a real environment with auth working, this will save to DB.
      // We will catch errors if user is not logged in.
      const { saveGridSlot } = await import("@/app/actions/grid")
      await saveGridSlot(activeSlot)
      alert("Saved successfully!")
    } catch (error: any) {
      console.error(error)
      alert(error.message === "Unauthorized" ? "Please sign in to save data." : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start justify-center">
      {/* Left Side: Drag-and-Drop Grid */}
      <div className="flex-1 w-full flex justify-center lg:justify-end">
        <Grid 
          items={items} 
          setItems={setItems} 
          updateItem={updateItem}
          activeSlotId={activeSlotId}
          setActiveSlotId={setActiveSlotId}
        />
      </div>
      
      {/* Right Side: Editor & Timeline */}
      <div className="flex-1 w-full max-w-[500px] flex flex-col gap-6">
        <EditorPanel 
          activeSlot={activeSlot} 
          updateSlot={updateItem} 
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  )
}
