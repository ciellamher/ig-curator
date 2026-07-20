"use client"

import { useState, useEffect, useRef } from "react"
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
import { PenTool, Calendar, Image as ImageIcon, Hash, Smartphone, Monitor, Grid3X3, Clapperboard, Circle, RefreshCw } from "lucide-react"

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
  const [activeTab, setActiveTab] = useState<"CREATE" | "CALENDAR">("CREATE")
  const [gridFilter, setGridFilter] = useState<"All" | "Reel" | "Story">("All")
  const [deviceView, setDeviceView] = useState<"phone" | "desktop">("phone")
  const [activeStoryFolderId, setActiveStoryFolderId] = useState<string | null>(null);

  // Floating modal drag state
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const modalDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<"Idle" | "Saving..." | "Saved" | "Error">("Idle")

  useEffect(() => {
    if (status === "unauthenticated") {
      localStorage.removeItem("ig-curator-items")
      setItems(initialItems)
      setIsLoaded(true)
      return
    }

    const saved = localStorage.getItem("ig-curator-items")
    if (saved) {
      try { setItems(JSON.parse(saved)) } catch (e) {}
    }

    async function loadCloud() {
      if (status === "authenticated") {
        try {
          const { fetchGridFromCloud } = await import("@/app/actions/grid")
          const res = await fetchGridFromCloud()
          if (res.success && res.data) {
            setItems(res.data.items)
            if (res.data.profile) {
              localStorage.setItem("ig-curator-profile", JSON.stringify(res.data.profile))
              window.dispatchEvent(new Event("storage"))
            }
          }
        } catch (e) {
          console.error("Failed to load cloud grid", e)
        }
      }
      setIsLoaded(true)
    }
    
    if (status !== "loading") {
      loadCloud()
    }
  }, [status])

  useEffect(() => {
    if (!isLoaded || status !== "authenticated") return;
    
    setSyncStatus("Saving...")
    const timer = setTimeout(async () => {
      try {
        const { syncGridToCloud } = await import("@/app/actions/grid")
        const profileStr = localStorage.getItem("ig-curator-profile")
        const profile = profileStr ? JSON.parse(profileStr) : undefined
        const res = await syncGridToCloud(items, profile)
        if (res.success) {
          setSyncStatus("Saved")
          setTimeout(() => setSyncStatus(prev => prev === "Saved" ? "Idle" : prev), 2000)
        } else {
          setSyncStatus("Error")
        }
      } catch (e) {
        console.error("Auto-sync failed", e)
        setSyncStatus("Error")
      }
    }, 2000);
    
    return () => clearTimeout(timer)
  }, [items, isLoaded, status])

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
      
      // Save to history and local storage if changed
      if (JSON.stringify(currentItems) !== JSON.stringify(nextItems)) {
        setHistory(prev => [...prev, currentItems].slice(-30));
        try {
          localStorage.setItem("ig-curator-items", JSON.stringify(nextItems));
        } catch (error) {
          console.error("Storage quota exceeded!", error);
          alert("Warning: Local storage is full! Your latest changes might not be saved after a refresh. Please delete some old photos to free up space.");
        }
      }
      return nextItems;
    });
  }

  function handleUndo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previousState = prev[prev.length - 1];
      setItems(previousState);
      try {
        localStorage.setItem("ig-curator-items", JSON.stringify(previousState));
      } catch (e) {
        // ignore
      }
      return prev.slice(0, -1);
    });
  }

  async function handleManualSync() {
    if (status !== "authenticated") return;
    setSyncStatus("Saving...")
    try {
      const { syncGridToCloud } = await import("@/app/actions/grid")
      const profileStr = localStorage.getItem("ig-curator-profile")
      const profile = profileStr ? JSON.parse(profileStr) : undefined
      const res = await syncGridToCloud(items, profile)
      if (res.success) {
        setSyncStatus("Saved")
        setTimeout(() => setSyncStatus(prev => prev === "Saved" ? "Idle" : prev), 2000)
      } else {
        setSyncStatus("Error")
      }
    } catch (e) {
      console.error("Manual sync failed", e)
      setSyncStatus("Error")
    }
  }

  function updateItem(id: string, updates: Partial<SlotItem>) {
    updateItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  const handleModalPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    modalDragRef.current = { 
      startX: e.clientX, 
      startY: e.clientY,
      initialX: modalPos.x,
      initialY: modalPos.y
    };
  };

  const handleModalPointerMove = (e: React.PointerEvent) => {
    if (!modalDragRef.current) return;
    const dx = e.clientX - modalDragRef.current.startX;
    const dy = e.clientY - modalDragRef.current.startY;
    setModalPos({
      x: modalDragRef.current.initialX + dx,
      y: modalDragRef.current.initialY + dy
    });
  };

  const handleModalPointerUp = (e: React.PointerEvent) => {
    if (!modalDragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    modalDragRef.current = null;
  };



  if (!isLoaded) return null;

  return (
    <div className="w-full flex flex-col min-h-screen bg-soft-50">
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Planner Workspace */}
        <div className="flex-1 bg-soft-50 flex flex-col h-full overflow-hidden">
          {/* View Toggle & Tabs */}
          <div className="flex justify-between items-center px-8 pt-6 pb-2">
            <div className="flex items-center gap-4">
              {status === "authenticated" && (
                <button 
                  onClick={handleManualSync}
                  disabled={syncStatus === "Saving..."}
                  className="text-sm font-medium px-4 py-2 rounded-full bg-white shadow-sm border border-soft-200 text-foreground/70 hover:text-foreground transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} className={syncStatus === "Saving..." ? "animate-spin" : ""} />
                  {syncStatus === "Saving..." ? "Syncing..." : syncStatus === "Error" ? "Sync Failed" : syncStatus === "Saved" ? "Saved" : "Sync to Cloud"}
                </button>
              )}
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
                    status={status}
                    liveMediaCount={items.filter(i => i.isLocked && !i.folderId && i.contentType !== "StoryFolder").length}
                    onAddRow={() => {
                      if (gridFilter === "Story" && !activeStoryFolderId) {
                        const newFolder: SlotItem = {
                          id: `folder-${Math.floor(Math.random() * 1000000000)}`,
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
                        const numItemsToAdd = 1;
                        const newRows = Array.from({ length: numItemsToAdd }).map((_, i) => ({
                          id: `slot-${Math.floor(Math.random() * 1000000000)}-${i}`,
                          type: "placeholder" as const,
                          urls: [],
                          currentUrlIndex: 0,
                          hexColor: "#E5D3C8",
                          text: "",
                          contentType: gridFilter === "All" ? "Post" : gridFilter as any,
                          folderId: gridFilter === "Story" ? (activeStoryFolderId || undefined) : undefined,
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
                    {status === "unauthenticated" ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-soft-100 rounded-full flex items-center justify-center mb-2">
                          <Grid3X3 className="text-soft-400" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Sign up first or login</h3>
                        <p className="text-foreground/60 max-w-xs text-sm">You need an account to arrange your grid and upload photos.</p>
                      </div>
                    ) : gridFilter === "Story" ? (
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
                          updateItem={updateItem}
                          onDeleteFolder={(id) => updateItems(prev => prev.filter(item => item.id !== id && item.folderId !== id))}
                        />
                      )
                    ) : (
                      <Grid 
                        items={gridFilter === "All" 
                          ? items.filter(i => i.contentType !== "StoryFolder" && !i.folderId && !i.isHiddenFromGrid) 
                          : items.filter(i => i.contentType === gridFilter && !i.folderId)} 
                        setItems={updateItems} 
                        updateItem={updateItem}
                        activeSlotId={activeSlotId}
                        setActiveSlotId={setActiveSlotId}
                        gridFilter={gridFilter}
                        onDoubleClickItem={(id) => setPreviewSlotId(id)}
                        onDeleteItem={(id) => {
                          updateItems(prev => prev.filter(item => item.id !== id));
                          if (activeSlotId === id) setActiveSlotId(null);
                          if (previewSlotId === id) setPreviewSlotId(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Optional Editor Panel Popup or Side-pane when slot is active */}
            {activeTab === "CREATE" && activeSlotId && (
              <div 
                className="absolute right-4 top-24 w-80 bg-white/95 backdrop-blur shadow-2xl border border-soft-200 rounded-2xl z-50 overflow-hidden flex flex-col"
                style={{ transform: `translate(${modalPos.x}px, ${modalPos.y}px)` }}
              >
                <div 
                  className="h-10 bg-soft-50 border-b border-soft-200 flex justify-between items-center px-4 cursor-move shrink-0 active:cursor-grabbing hover:bg-soft-100/50 transition-colors"
                  onPointerDown={handleModalPointerDown}
                  onPointerMove={handleModalPointerMove}
                  onPointerUp={handleModalPointerUp}
                  onPointerCancel={handleModalPointerUp}
                >
                  <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pointer-events-none">Drag to move</span>
                  <button 
                    onClick={() => setActiveSlotId(null)}
                    className="text-xs font-bold text-foreground/50 hover:text-foreground pointer-events-auto"
                  >
                    Close
                  </button>
                </div>
                <div className="pointer-events-auto">
                  <EditorPanel 
                    activeSlot={activeSlot} 
                    updateSlot={updateItem} 
                  />
                </div>
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
