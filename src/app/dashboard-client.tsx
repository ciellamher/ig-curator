"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Grid } from "@/components/grid/Grid"
import { EditorPanel } from "@/components/editor/EditorPanel"
import { SlotItem } from "@/types"
import { getLiveGrid } from "@/app/actions/instagram"
import { CalendarView } from "@/components/calendar/CalendarView"
import { ProfileHeader } from "@/components/grid/ProfileHeader"
import { StoryListView } from "@/components/grid/StoryListView"
import { StoryFolderView } from "@/components/grid/StoryFolderView"
import { InstagramPreviewModal } from "@/components/grid/InstagramPreviewModal"
import { PenTool, Calendar, Image as ImageIcon, Hash, Smartphone, Monitor, Grid3X3, Clapperboard, Circle } from "lucide-react"

const initialItems: SlotItem[] = Array.from({ length: 9 }).map((_, index) => ({
  id: `slot-${index + 1}`,
  type: "placeholder",
  urls: [],
  currentUrlIndex: 0,
  isLocked: false,
  hexColor: "#E5D3C8",
  text: "",
  contentType: "Post",
}))

export function DashboardClient() {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<SlotItem[]>(initialItems)
  const [history, setHistory] = useState<SlotItem[][]>([])
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"CREATE" | "CALENDAR">("CREATE")
  const [gridFilter, setGridFilter] = useState<"All" | "Reel" | "Story">("All")
  const [deviceView, setDeviceView] = useState<"phone" | "desktop">("phone")
  const [activeStoryFolderId, setActiveStoryFolderId] = useState<string | null>(null)
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null)

  useEffect(() => {
    async function loadLiveGrid() {
      // @ts-ignore
      if (status === "authenticated" && session?.instagramAccessToken) {
        const res = await getLiveGrid()
        if (res.success && res.liveItems) {
          setItems(current => {
            const newItems = [...current]
            // Place live posts in the last rows (bottom of the grid)
            const startIndex = Math.max(0, newItems.length - res.liveItems.length)
            res.liveItems.forEach((livePost: any, idx: number) => {
              const gridIndex = startIndex + idx
              if (gridIndex < newItems.length) {
                newItems[gridIndex] = {
                  ...newItems[gridIndex],
                  type: "image",
                  urls: [livePost.url],
                  currentUrlIndex: 0,
                  caption: livePost.caption || "",
                  contentType: livePost.contentType,
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

  function updateItems(newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) {
    setItems((currentItems) => {
      const nextItems = typeof newItemsOrUpdater === "function" 
        ? newItemsOrUpdater(currentItems) 
        : newItemsOrUpdater;
      
      // Save to history if changed
      if (JSON.stringify(currentItems) !== JSON.stringify(nextItems)) {
        setHistory(prev => [...prev, currentItems].slice(-30));
      }
      return nextItems;
    });
  }

  function handleUndo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previousState = prev[prev.length - 1];
      setItems(previousState);
      return prev.slice(0, -1);
    });
  }

  function updateItem(id: string, updates: Partial<SlotItem>) {
    updateItems((current) =>
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
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Planner Workspace */}
        <div className="flex-1 bg-soft-50 flex flex-col h-full overflow-hidden">
          {/* View Toggle & Tabs */}
          <div className="flex justify-between items-center px-8 pt-6 pb-2">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab("CREATE")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${activeTab === "CREATE" ? "bg-pastel-500 text-white shadow-md shadow-pastel-500/20" : "bg-white text-foreground/60 hover:bg-white/60"}`}
              >
                <PenTool size={16} /> Create
              </button>
              <button 
                onClick={() => setActiveTab("CALENDAR")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${activeTab === "CALENDAR" ? "bg-pastel-500 text-white shadow-md shadow-pastel-500/20" : "bg-white text-foreground/60 hover:bg-white/60"}`}
              >
                <Calendar size={16} /> Calendar
              </button>
            </div>
            
            <div className="flex items-center bg-white rounded-full p-1 shadow-sm">
              <button 
                onClick={() => setDeviceView("phone")}
                className={`p-2 rounded-full transition-colors ${deviceView === "phone" ? "bg-pastel-100 text-pastel-700" : "text-foreground/40 hover:text-foreground"}`}
                title="Phone View"
              >
                <Smartphone size={18} />
              </button>
              <button 
                onClick={() => setDeviceView("desktop")}
                className={`p-2 rounded-full transition-colors ${deviceView === "desktop" ? "bg-pastel-100 text-pastel-700" : "text-foreground/40 hover:text-foreground"}`}
                title="Desktop View"
              >
                <Monitor size={18} />
              </button>
            </div>
          </div>

          {/* Grid Workspace */}
          <div className="flex-1 overflow-y-auto p-8 relative flex justify-center">
            {activeTab === "CREATE" && (
              /* Dynamic View Container (Phone or Desktop) */
              <div className={`
                ${deviceView === "phone" 
                  ? "w-full max-w-[360px] border-[12px] border-slate-900 ring-[2px] ring-slate-800 rounded-[3.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative bg-white flex flex-col mx-auto h-[780px]" 
                  : "w-full max-w-4xl border border-soft-200 rounded-xl shadow-xl overflow-hidden relative bg-white flex flex-col mx-auto min-h-[800px]"
                } transition-all duration-300 ease-in-out
              `}>
                {deviceView === "phone" && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[26px] bg-black rounded-full z-50 shadow-inner flex items-center justify-between px-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800/80"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-900/40"></div>
                  </div>
                )}
                
                <div className={`flex-1 overflow-y-auto no-scrollbar pb-6 relative ${deviceView === "phone" ? "pt-1" : ""}`}>
                  <ProfileHeader 
                    session={session} 
                    liveMediaCount={items.filter(i => i.isLocked && !i.folderId && i.contentType !== "StoryFolder").length}
                    onAddRow={() => {
                      if (gridFilter === "Story" && !activeStoryFolderId) {
                        const newFolder: SlotItem = {
                          id: `folder-${Date.now()}`,
                          type: "placeholder",
                          urls: [],
                          currentUrlIndex: 0,
                          hexColor: "#E5D3C8",
                          text: "New Folder",
                          contentType: "StoryFolder",
                        };
                        updateItems([newFolder, ...items]);
                      } else {
                        const newId = items.length;
                        const numItemsToAdd = ["Reel", "Story"].includes(gridFilter) ? 1 : 3;
                        const newRows = Array.from({ length: numItemsToAdd }).map((_, i) => ({
                          id: `slot-${Date.now()}-${i}`,
                          type: "placeholder" as const,
                          urls: [],
                          currentUrlIndex: 0,
                          hexColor: "#E5D3C8",
                          text: "",
                          contentType: gridFilter === "All" ? "Post" : gridFilter as any,
                          folderId: gridFilter === "Story" ? activeStoryFolderId : undefined,
                        }));
                        updateItems([...newRows, ...items]);
                      }
                    }} 
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                  />
                  
                  {/* Grid Tabs */}
                  <div className="flex items-center justify-around border-t border-b border-soft-100 py-3 sticky top-0 bg-white/95 backdrop-blur-md z-40">
                    <button 
                      onClick={() => setGridFilter("All")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "All" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                    >
                      <Grid3X3 size={22} strokeWidth={gridFilter === "All" ? 2.5 : 2} />
                    </button>
                    <button 
                      onClick={() => setGridFilter("Reel")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "Reel" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                    >
                      <Clapperboard size={22} strokeWidth={gridFilter === "Reel" ? 2.5 : 2} />
                    </button>
                    <button 
                      onClick={() => setGridFilter("Story")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "Story" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                      title="Stories"
                    >
                      <Circle size={22} strokeWidth={gridFilter === "Story" ? 2.5 : 2} />
                    </button>
                  </div>

                  <div className="w-full flex-1 flex flex-col min-h-0">
                    {gridFilter === "Story" ? (
                      activeStoryFolderId ? (
                        <StoryFolderView 
                          folder={items.find(i => i.id === activeStoryFolderId)!}
                          stories={items.filter(i => i.folderId === activeStoryFolderId)}
                          onBack={() => setActiveStoryFolderId(null)}
                          updateItems={updateItems}
                          updateItem={updateItem}
                          activeSlotId={activeSlotId}
                          setActiveSlotId={setActiveSlotId}
                        />
                      ) : (
                        <StoryListView 
                          folders={items.filter(i => i.contentType === "StoryFolder")}
                          allItems={items}
                          onFolderClick={(id) => setActiveStoryFolderId(id)}
                        />
                      )
                    ) : (
                      <Grid 
                        items={gridFilter === "All" 
                          ? items.filter(i => i.contentType !== "StoryFolder" && !i.folderId) 
                          : items.filter(i => i.contentType === gridFilter && !i.folderId)} 
                        setItems={updateItems} 
                        updateItem={updateItem}
                        activeSlotId={activeSlotId}
                        setActiveSlotId={setActiveSlotId}
                        gridFilter={gridFilter}
                        onDoubleClickItem={(id) => setPreviewSlotId(id)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Optional Editor Panel Popup or Side-pane when slot is active */}
            {activeTab === "CREATE" && activeSlotId && (
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

            {/* Instagram Feed / Reel Preview Modal */}
            {activeTab === "CREATE" && previewSlotId && (
              <InstagramPreviewModal
                item={items.find(i => i.id === previewSlotId)!}
                onClose={() => setPreviewSlotId(null)}
              />
            )}

            {activeTab === "CALENDAR" && (
          <CalendarView items={items} />
        )}
      </div>
    </div>
  </div>
</div>
  )
}
