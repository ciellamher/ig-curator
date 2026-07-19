"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Grid } from "@/components/grid/Grid"
import { EditorPanel } from "@/components/editor/EditorPanel"
import { SlotItem } from "@/types"
import { getLiveGrid } from "@/app/actions/instagram"
import { CalendarView } from "@/components/calendar/CalendarView"
import { MediaLibrary } from "@/components/media/MediaLibrary"
import { PenTool, Calendar, Image as ImageIcon, Hash } from "lucide-react"

const initialItems: SlotItem[] = Array.from({ length: 60 }).map((_, index) => ({
  id: `slot-${index}`,
  type: "placeholder",
  urls: [],
  currentUrlIndex: 0,
  hexColor: index % 2 === 0 ? "var(--color-pastel-50)" : "var(--color-soft-50)",
  text: "",
}))

export function DashboardClient() {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<SlotItem[]>(initialItems)
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"CREATE" | "CALENDAR" | "MEDIA" | "HASHTAGS">("CREATE")

  useEffect(() => {
    async function loadLiveGrid() {
      // @ts-ignore
      if (status === "authenticated" && session?.instagramAccessToken) {
        const res = await getLiveGrid()
        if (res.success && res.liveItems) {
          setItems(current => {
            const newItems = [...current]
            res.liveItems.forEach((livePost: any, index: number) => {
              if (index < newItems.length) {
                newItems[index] = {
                  ...newItems[index],
                  type: "image",
                  urls: [livePost.url],
                  currentUrlIndex: 0,
                  caption: livePost.caption || "",
                  isLocked: true,
                }
              }
            })
            return newItems
          })
        }
      }
    }
    loadLiveGrid()
  }, [status, session])

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
    <div className="w-full flex flex-col min-h-screen bg-soft-50">
      {/* Sub-Navigation Tabs */}
      <div className="w-full bg-white border-b border-soft-100 px-6 py-4 flex gap-8 shadow-sm overflow-x-auto">
        <button 
          onClick={() => setActiveTab("CREATE")}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "CREATE" ? "text-pastel-600" : "text-foreground/60 hover:text-foreground"}`}
        >
          <PenTool size={16} /> CREATE
        </button>
        <button 
          onClick={() => setActiveTab("CALENDAR")}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "CALENDAR" ? "text-pastel-600" : "text-foreground/60 hover:text-foreground"}`}
        >
          <Calendar size={16} /> CALENDAR
        </button>
        <button 
          onClick={() => setActiveTab("MEDIA")}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "MEDIA" ? "text-pastel-600" : "text-foreground/60 hover:text-foreground"}`}
        >
          <ImageIcon size={16} /> MEDIA
        </button>
        <button 
          onClick={() => setActiveTab("HASHTAGS")}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "HASHTAGS" ? "text-pastel-600" : "text-foreground/60 hover:text-foreground"}`}
        >
          <Hash size={16} /> HASHTAGS
        </button>
      </div>

      <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8">
        {activeTab === "CREATE" && (
          <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)]">
            
            {/* Left Column: Media Library */}
            <div className="flex-1 min-w-[300px] bg-white rounded-2xl shadow-diffused border border-soft-100 overflow-hidden flex flex-col">
              <MediaLibrary />
            </div>

            {/* Right Column: Phone Mockup Grid */}
            <div className="w-full max-w-[400px] mx-auto lg:mx-0 flex flex-col">
              <div className="bg-white rounded-[3rem] p-4 shadow-xl border-[8px] border-soft-200 h-full max-h-[800px] overflow-hidden flex flex-col relative">
                {/* Phone Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-soft-200 rounded-b-2xl z-20"></div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar pt-6">
                  <Grid 
                    items={items} 
                    setItems={setItems} 
                    updateItem={updateItem}
                    activeSlotId={activeSlotId}
                    setActiveSlotId={setActiveSlotId}
                  />
                </div>
              </div>
            </div>

            {/* Optional Editor Panel Popup or Side-pane when slot is active */}
            {activeSlotId && (
              <div className="absolute right-4 top-24 w-80 bg-white/95 backdrop-blur shadow-2xl border border-soft-200 rounded-2xl z-50">
                <EditorPanel 
                  activeSlot={activeSlot} 
                  updateSlot={updateItem} 
                  onSave={handleSave}
                  isSaving={isSaving}
                />
                <button 
                  onClick={() => setActiveSlotId(null)}
                  className="absolute top-4 right-4 text-xs font-medium text-foreground/50 hover:text-foreground"
                >
                  Close
                </button>
              </div>
            )}
            
          </div>
        )}

        {activeTab === "CALENDAR" && (
          <CalendarView items={items} />
        )}
        
        {activeTab === "MEDIA" && (
          <div className="bg-white rounded-2xl shadow-diffused border border-soft-100 p-8 text-center text-foreground/50 h-64 flex items-center justify-center">
            Media Management coming soon...
          </div>
        )}

        {activeTab === "HASHTAGS" && (
          <div className="bg-white rounded-2xl shadow-diffused border border-soft-100 p-8 text-center text-foreground/50 h-64 flex items-center justify-center">
            Hashtag Collections coming soon...
          </div>
        )}
      </div>
    </div>
  )
}
