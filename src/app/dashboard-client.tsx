"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Grid } from "@/components/grid/Grid";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SlotItem } from "@/types";
import { getLiveGrid } from "@/app/actions/instagram";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ProfileHeader } from "@/components/grid/ProfileHeader";
import { StoryListView } from "@/components/grid/StoryListView";
import { StoryFolderView } from "@/components/grid/StoryFolderView";
import { PlaceholderPoolView } from "@/components/grid/PlaceholderPoolView";
import { InspoFolderListView } from "@/components/grid/InspoFolderListView";
import { InspoFolderView } from "@/components/grid/InspoFolderView";
import { GridSearchNav } from "@/components/grid/GridSearchNav";
import { InstagramPreviewModal } from "@/components/grid/InstagramPreviewModal";
import {
  Calendar,
  Image as ImageIcon,
  Hash,
  Smartphone,
  Monitor,
  Grid3X3,
  Clapperboard,
  Circle,
  RefreshCw,
  Sparkles,
  X,
  SquarePlus,
  FolderHeart,
  Film,
  Plus,
  Play,
  Settings,
  MoreHorizontal,
  ChevronLeft,
  PlusCircle,
  Check,
} from "lucide-react";
import { setItem, getItem, removeItem } from "@/lib/idb";
import { useConfirmModal, ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  isFileSystemSupported,
  getStoredHandle,
  pickFolder,
  verifyPermission,
  saveToFolder,
  loadFromFolder,
  storeHandle,
} from "@/lib/fileSystem";

const initialItems: SlotItem[] = Array.from({ length: 9 }).map((_, index) => ({
  id: `slot-${index + 1}`,
  type: "placeholder",
  urls: [],
  currentUrlIndex: 0,
  isLocked: false,
  hexColor: "#E5D3C8",
  text: "",
  contentType: "Post",
}));

export function DashboardClient() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<SlotItem[]>(initialItems);
  const [history, setHistory] = useState<SlotItem[][]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [gridFilter, setGridFilter] = useState<
    "All" | "Reel" | "Story" | "Placeholders" | "Inspo"
  >("All");
  const [deviceView, setDeviceView] = useState<"phone" | "desktop">("phone");
  const { confirm, modalProps } = useConfirmModal();
  const [activeStoryFolderId, setActiveStoryFolderId] = useState<string | null>(
    null,
  );
  const [activeInspoFolderId, setActiveInspoFolderId] = useState<string | null>(
    null,
  );

  // Restore UI State on mount
  useEffect(() => {
    // Request persistent storage to unlock more browser quota
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist();
    }
    try {
      const savedUI = localStorage.getItem("ig-curator-ui-state");
      if (savedUI) {
        const state = JSON.parse(savedUI);
        if (state.gridFilter) setGridFilter(state.gridFilter);
        if (state.deviceView) setDeviceView(state.deviceView);
        if (state.activeStoryFolderId !== undefined) setActiveStoryFolderId(state.activeStoryFolderId);
        if (state.activeInspoFolderId !== undefined) setActiveInspoFolderId(state.activeInspoFolderId);
      }
    } catch (e) {}
  }, []);

  // Persist UI State on change
  useEffect(() => {
    try {
      localStorage.setItem("ig-curator-ui-state", JSON.stringify({
        gridFilter,
        deviceView,
        activeStoryFolderId,
        activeInspoFolderId,
      }));
    } catch (e) {}
  }, [gridFilter, deviceView, activeStoryFolderId, activeInspoFolderId]);

  // Search & Match Navigation State
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const currentViewItems =
      (gridFilter as string) === "Placeholders"
        ? items.filter((i) => i.folderId === "draft-pool")
        : (gridFilter as string) === "All"
          ? items.filter(
              (i) =>
                i.contentType !== "StoryFolder" &&
                !i.folderId &&
                !i.isHiddenFromGrid,
            )
          : items.filter((i) => i.contentType === gridFilter && !i.folderId);

    return currentViewItems
      .filter((item) => {
        const textMatch = item.text?.toLowerCase().includes(q);
        const captionMatch = item.caption?.toLowerCase().includes(q);
        const typeMatch = item.contentType?.toLowerCase().includes(q);
        return Boolean(textMatch || captionMatch || typeMatch);
      })
      .map((item) => item.id);
  }, [items, searchQuery, gridFilter]);

  const focusedMatchId =
    searchMatches.length > 0
      ? searchMatches[Math.min(currentMatchIndex, searchMatches.length - 1)]
      : null;

  useEffect(() => {
    if (!focusedMatchId) return;
    const el = document.getElementById(`grid-slot-${focusedMatchId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedMatchId]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex(
      (prev) => (prev - 1 + searchMatches.length) % searchMatches.length,
    );
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentMatchIndex(0);
  };

  // Floating modal drag state
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const modalDragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "Idle" | "Saving..." | "Saved" | "Saved Locally" | "Error"
  >("Idle");

  const hasLocalItemsRef = useRef(false);
  const fsHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [hasFolderConnected, setHasFolderConnected] = useState(false);
  const [hasStoredFolder, setHasStoredFolder] = useState(false);

  const connectAndLoad = async (handle: FileSystemDirectoryHandle) => {
    fsHandleRef.current = handle;
    setHasFolderConnected(true);
    const folderData = await loadFromFolder(handle);
    if (folderData && (folderData as any[]).length > 0) {
      setItems(folderData as SlotItem[]);
    } else {
      await saveToFolder(handle, items);
    }
  };

  const [showReconnectOverlay, setShowReconnectOverlay] = useState(false);

  // Check if we have a stored folder handle
  useEffect(() => {
    if (!isFileSystemSupported()) return;
    getStoredHandle().then(async (handle) => {
      if (handle) {
        setHasStoredFolder(true);
        // Try silently reconnecting if permission was persisted (e.g. installed PWA)
        const opts = { mode: "readwrite" };
        if ((await (handle as any).queryPermission(opts)) === "granted") {
          fsHandleRef.current = handle;
          setHasFolderConnected(true);
        } else {
          // Requires user gesture to prompt
          setShowReconnectOverlay(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    // One-time auto-compression: shrinks all old large base64 images to free IDB space
    async function compressIfNeeded(loadedItems: SlotItem[]): Promise<SlotItem[]> {
      if (typeof window === "undefined") return loadedItems;
      const COMPRESSED_KEY = "ig-curator-compressed-v2";
      if (localStorage.getItem(COMPRESSED_KEY)) return loadedItems;

      let changed = false;
      const compressed = await Promise.all(
        loadedItems.map(async (item) => {
          const newUrls = await Promise.all(
            item.urls.map(async (url) => {
              if (!url.startsWith("data:")) return url;
              // Only compress if the base64 string is large (> 20KB)
              if (url.length < 20000) return url;
              try {
                return await new Promise<string>((resolve) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX = 400;
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
                    else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
                    changed = true;
                    resolve(canvas.toDataURL("image/jpeg", 0.5));
                  };
                  img.onerror = () => resolve(url); // keep original on error
                  img.src = url;
                });
              } catch {
                return url;
              }
            })
          );
          return { ...item, urls: newUrls };
        })
      );

      if (changed) {
        try {
          await setItem("ig-curator-items", compressed);
          console.log("✅ Auto-compressed images to free storage space");
        } catch (e) {
          console.error("Compression save failed:", e);
        }
      }
      localStorage.setItem(COMPRESSED_KEY, "true");
      return compressed;
    }

    async function init() {
      if (status === "unauthenticated") {
        // NEVER delete local data - just show it as-is
        try {
          const saved = await getItem<SlotItem[]>("ig-curator-items");
          if (saved && saved.length > 0 && isMounted) {
            const compressed = await compressIfNeeded(saved);
            setItems(compressed);
          }
        } catch (e) {}
        if (isMounted) setIsLoaded(true);
        return;
      }

      if (status === "loading") return;

      // 1. Try loading from local folder first (unlimited storage)
      let localItemsLoaded = false;
      if (fsHandleRef.current) {
        try {
          const folderItems = await loadFromFolder(fsHandleRef.current);
          if (folderItems && (folderItems as any[]).length > 0 && isMounted) {
            setItems(folderItems as SlotItem[]);
            localItemsLoaded = true;
          }
        } catch (err) {
          console.error("Folder load failed, falling back to IDB:", err);
        }
      }

      // 2. Fall back to IDB
      if (!localItemsLoaded) {
        try {
          const saved = await getItem<SlotItem[]>("ig-curator-items");
          const emergencyBackup = localStorage.getItem("ig-curator-items");
          
          if (emergencyBackup) {
            try {
              const parsed = JSON.parse(emergencyBackup);
              localStorage.removeItem("ig-curator-items");
              if (isMounted) setItems(parsed);
              await setItem("ig-curator-items", parsed).catch(() => {});
              if (parsed.length > 0) localItemsLoaded = true;
            } catch (e) {}
          } else if (saved && saved.length > 0) {
            const compressed = await compressIfNeeded(saved);
            if (isMounted) setItems(compressed);
            localItemsLoaded = true;
          }
        } catch (error) {
          console.error("Failed to load local grid", error);
        }
      }

      // 2. Only check cloud if local hasn't definitively overridden it, or to sync profile
      try {
        const { fetchGridFromCloud } = await import("@/app/actions/grid");
        const res = await fetchGridFromCloud();
        if (res.success && res.data) {
          if (!localItemsLoaded && isMounted) {
            setItems(res.data.items);
          }
          if (res.data.profile) {
            localStorage.setItem(
              "ig-curator-profile",
              JSON.stringify(res.data.profile)
            );
            window.dispatchEvent(new Event("storage"));
          }
        }
      } catch (e) {
        console.error("Failed to load cloud grid", e);
      }

      if (isMounted) setIsLoaded(true);
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [status]);


  useEffect(() => {
    if (!isLoaded || status !== "authenticated") return;

    setSyncStatus("Saving...");
    const timer = setTimeout(async () => {
      try {
        // Always save to IDB first
        try {
          await setItem("ig-curator-items", items);
        } catch (idbErr) {
          console.error("Failed to save to local IDB", idbErr);
        }

        let payloadString = "";
        try {
          payloadString = JSON.stringify(items);
        } catch (stringifyError) {
          console.warn("Payload too massive to stringify, skipping cloud sync.");
          setSyncStatus("Saved Locally");
          setTimeout(() => setSyncStatus((prev) => (prev === "Saved Locally" ? "Idle" : prev)), 2000);
          return;
        }

        if (payloadString.length > 4 * 1024 * 1024) {
          setSyncStatus("Saved Locally");
          setTimeout(
            () =>
              setSyncStatus((prev) =>
                prev === "Saved Locally" ? "Idle" : prev,
              ),
            2000,
          );
          return;
        }
        const profileStr = localStorage.getItem("ig-curator-profile");
        const profile = profileStr ? JSON.parse(profileStr) : undefined;
        
        const response = await fetch("/api/grid/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, profile }),
        });
        
        const res = await response.json();
        if (res.success) {
          setSyncStatus("Saved");
          setTimeout(() => setSyncStatus((prev) => (prev === "Saved" ? "Idle" : prev)), 2000);
        } else {
          console.error("Auto-sync failed:", res.error);
          setSyncStatus("Error");
          setTimeout(() => setSyncStatus((prev) => (prev === "Error" ? "Idle" : prev)), 2000);
        }
      } catch (e: any) {
        console.error("Auto-sync exception:", e);
        setSyncStatus("Error");
        setTimeout(() => setSyncStatus((prev) => (prev === "Error" ? "Idle" : prev)), 2000);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [items, isLoaded, status]);

  useEffect(() => {
    async function loadLiveGrid() {
      // @ts-ignore
      if (status === "authenticated" && session?.instagramAccessToken) {
        const res = await getLiveGrid();
        if (res.success && res.liveItems) {
          setItems((current) => {
            const newItems = [...current];
            // Place live posts in the last rows (bottom of the grid)
            const startIndex = Math.max(
              0,
              newItems.length - res.liveItems.length,
            );
            res.liveItems.forEach((livePost: any, idx: number) => {
              const gridIndex = startIndex + idx;
              if (gridIndex < newItems.length) {
                newItems[gridIndex] = {
                  ...newItems[gridIndex],
                  type: "image",
                  urls: [livePost.url],
                  currentUrlIndex: 0,
                  caption: livePost.caption || "",
                  contentType: livePost.contentType,
                  isLocked: true,
                };
              }
            });
            return newItems;
          });
        }
      }
    }
    loadLiveGrid();
  }, [status, session]);

  const activeSlot = items.find((item) => item.id === activeSlotId) || null;

  const lastSavedItemsRef = useRef<SlotItem[]>(items);

  useEffect(() => {
    if (!isLoaded) {
      lastSavedItemsRef.current = items;
      return;
    }

    if (items === lastSavedItemsRef.current) return;

    const timeoutId = setTimeout(async () => {
      setHistory((prev) => [...prev, lastSavedItemsRef.current].slice(-30));
      lastSavedItemsRef.current = items;

      // Primary: save to Mac folder if connected (unlimited space!)
      if (fsHandleRef.current) {
        try {
          await saveToFolder(fsHandleRef.current, items);
          return; // success - no need for IDB
        } catch (err) {
          console.error("Folder save failed, falling back to IDB:", err);
        }
      }

      // Fallback: IDB (has browser quota limits)
      try {
        await setItem("ig-curator-items", items);
      } catch (error: any) {
        console.error("IDB save failed, trying to free space:", error);
        try {
          const slim = items.map(item => ({
            ...item,
            urls: item.urls.length > 0 ? [item.urls[item.currentUrlIndex ?? 0] ?? item.urls[0]] : [],
          }));
          await setItem("ig-curator-items", slim);
          setItems(slim);
        } catch (e2) {
          console.error("Even slim save failed.", e2);
        }
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [items, isLoaded]);

  // Synchronous fail-safe save when user forcefully refreshes/closes the tab before debounce completes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (items !== lastSavedItemsRef.current) {
        try {
          localStorage.setItem("ig-curator-items", JSON.stringify(items));
        } catch (e) {
          console.error("Local storage fallback failed (quota exceeded).", e);
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [items]);

  function updateItems(
    newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[]),
  ) {
    setItems(newItemsOrUpdater);
  }

  function handleUndo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previousState = prev[prev.length - 1];
      setItems(previousState);
      setItem("ig-curator-items", previousState).catch(() => {});
      return prev.slice(0, -1);
    });
  }

  async function handleManualSync() {
    if (status !== "authenticated") return;
    setSyncStatus("Saving...");
    try {
      let payloadString = "";
      try {
        payloadString = JSON.stringify(items);
      } catch (stringifyError) {
        console.warn("Payload too massive to stringify, skipping cloud sync.");
        setSyncStatus("Saved Locally");
        setTimeout(() => setSyncStatus((prev) => (prev === "Saved Locally" ? "Idle" : prev)), 2000);
        return;
      }

      if (payloadString.length > 4 * 1024 * 1024) {
        setSyncStatus("Saved Locally");
        setTimeout(
          () =>
            setSyncStatus((prev) => (prev === "Saved Locally" ? "Idle" : prev)),
          2000,
        );
        return;
      }
      const profileStr = localStorage.getItem("ig-curator-profile");
      const profile = profileStr ? JSON.parse(profileStr) : undefined;
      
      const response = await fetch("/api/grid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, profile }),
      });
      
      const res = await response.json();
      if (res.success) {
        setSyncStatus("Saved");
        setTimeout(() => setSyncStatus((prev) => (prev === "Saved" ? "Idle" : prev)), 2000);
      } else {
        console.error("Manual sync failed:", res.error);
        setSyncStatus("Error");
        setTimeout(() => setSyncStatus((prev) => (prev === "Error" ? "Idle" : prev)), 2000);
      }
    } catch (e: any) {
      console.error("Manual sync exception:", e);
      setSyncStatus("Error");
      setTimeout(() => setSyncStatus((prev) => (prev === "Error" ? "Idle" : prev)), 2000);
    }
  }

  function updateItem(id: string, updates: Partial<SlotItem>) {
    updateItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveSlotId(null);
        setPreviewSlotId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!activeSlotId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`grid-slot-${activeSlotId}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const container = el.closest(".relative");
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const topOffset = Math.max(
            -10,
            Math.min(450, rect.top - containerRect.top - 15),
          );
          setModalPos({ x: 0, y: topOffset });
        }
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [activeSlotId]);

  const handleModalPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea")) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    modalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: modalPos.x,
      initialY: modalPos.y,
    };
  };

  const handleModalPointerMove = (e: React.PointerEvent) => {
    if (!modalDragRef.current) return;
    const dx = e.clientX - modalDragRef.current.startX;
    const dy = e.clientY - modalDragRef.current.startY;
    setModalPos({
      x: modalDragRef.current.initialX + dx,
      y: modalDragRef.current.initialY + dy,
    });
  };

  const handleModalPointerUp = (e: React.PointerEvent) => {
    if (!modalDragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    modalDragRef.current = null;
  };

  const handleTransferToMainGrid = (selectedSlotIds: string[]) => {
    updateItems((current) => {
      const selectedSet = new Set(selectedSlotIds);
      const transferredItems = current
        .filter((item) => selectedSet.has(item.id))
        .map((item) => ({ ...item, folderId: undefined }));

      const remainingItems = current.filter(
        (item) => !selectedSet.has(item.id),
      );
      return [...transferredItems, ...remainingItems];
    });
  };

  const handleCreateInspoFolder = (
    title: string,
    hexColor?: string,
    coverUrl?: string,
  ) => {
    const newFolder: SlotItem = {
      id: `folder-inspo-${Math.floor(Math.random() * 1000000000)}`,
      type: "placeholder",
      urls: coverUrl ? [coverUrl] : [],
      currentUrlIndex: 0,
      hexColor: hexColor || "#E5D3C8",
      text: title,
      contentType: "InspoFolder",
    };
    updateItems((curr) => [newFolder, ...curr]);
  };

  const handleDeleteInspoFolder = async (folderId: string) => {
    const ok = await confirm({
      title: "Delete Folder",
      message: "Are you sure you want to delete this folder and all its contents? This cannot be undone.",
      confirmLabel: "Delete Folder",
    });
    if (!ok) return;

    updateItems((curr) =>
      curr.filter((i) => i.id !== folderId && i.folderId !== folderId),
    );
    if (activeInspoFolderId === folderId) setActiveInspoFolderId(null);
    // If activeSlot was in this folder, clear it
    if (items.find((i) => i.id === activeSlotId)?.folderId === folderId) {
      setActiveSlotId(null);
    }
  };

  const handleCopyInspoToGrid = (
    inspoItem: SlotItem,
    targetType: "Post" | "Story",
  ) => {
    const copiedSlot: SlotItem = {
      id: `slot-${Math.floor(Math.random() * 1000000000)}`,
      type: "image",
      urls: [...(inspoItem.urls || [])],
      currentUrlIndex: 0,
      hexColor: inspoItem.hexColor || "#E5D3C8",
      text: inspoItem.text || "",
      contentType: targetType,
    };
    updateItems((curr) => [copiedSlot, ...curr]);
    alert(
      `Copied photo to your ${targetType === "Post" ? "Main Grid" : "Stories"}!`,
    );
  };

  if (!isLoaded) return null;

  return (
    <div className="w-full flex flex-col min-h-screen bg-soft-50">
      {showReconnectOverlay && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={async () => {
            const stored = await getStoredHandle();
            if (stored) {
              const ok = await verifyPermission(stored);
              if (ok) {
                await connectAndLoad(stored);
                setShowReconnectOverlay(false);
              } else {
                setShowReconnectOverlay(false);
              }
            } else {
              setShowReconnectOverlay(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderHeart size={32} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Reconnect to Mac</h2>
            <p className="text-slate-600 mb-6 text-sm">
              Click anywhere to automatically restore connection to your local save folder and load your latest changes.
            </p>
            <div className="text-xs text-slate-400">
              Browser security requires a click to restore folder access.
            </div>
          </div>
        </div>
      )}
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Planner Workspace */}
        <div className="flex-1 bg-soft-50 flex flex-col h-full overflow-hidden">
          {/* View Toggle & Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center px-4 sm:px-8 pt-4 sm:pt-6 pb-2 gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <button
                onClick={status === "authenticated" ? handleManualSync : undefined}
                disabled={syncStatus === "Saving..."}
                className={`text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm border transition-all flex items-center gap-2 ${
                  syncStatus === "Saving..."
                    ? "bg-amber-50 text-amber-600 border-amber-200 cursor-default"
                    : syncStatus === "Saved"
                      ? "bg-green-50 text-green-600 border-green-200 cursor-default"
                      : syncStatus === "Error"
                        ? "bg-red-50 text-red-600 border-red-200 cursor-pointer"
                        : "bg-white border-soft-200 text-foreground/70 hover:text-foreground cursor-pointer"
                } ${status !== "authenticated" ? "opacity-0 invisible pointer-events-none" : ""}`}
              >
                {syncStatus === "Saving..." ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : syncStatus === "Saved" ? (
                  <Check size={13} />
                ) : (
                  <RefreshCw size={13} />
                )}
                <span>
                  {syncStatus === "Saving..."
                    ? "Syncing..."
                    : syncStatus === "Saved"
                      ? "Saved to cloud"
                      : syncStatus === "Error"
                        ? "Sync Error"
                        : "Up to date"}
                </span>
              </button>



              {/* Connect Mac Folder for unlimited storage */}
              {isFileSystemSupported() && (
                <button
                  onClick={async () => {
                    if (hasFolderConnected) {
                      // Already connected — manual save
                      try {
                        await saveToFolder(fsHandleRef.current!, items);
                      } catch (e) {
                        console.error(e);
                      }
                      return;
                    }
                    // Try reconnecting stored handle (needs this click as user gesture)
                    const stored = await getStoredHandle();
                    if (stored) {
                      const ok = await verifyPermission(stored);
                      if (ok) {
                        await connectAndLoad(stored);
                        return;
                      }
                    }
                    // Pick new folder
                    const handle = await pickFolder();
                    if (handle) {
                      await connectAndLoad(handle);
                    }
                  }}
                  className={`text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm border transition-all flex items-center gap-2 ${
                    hasFolderConnected
                      ? "bg-green-50 text-green-600 border-green-200"
                      : hasStoredFolder
                        ? "bg-amber-50 text-amber-600 border-amber-200"
                        : "bg-white border-soft-200 text-foreground/70 hover:text-foreground"
                  } cursor-pointer`}
                >
                  <FolderHeart size={13} />
                  <span>{hasFolderConnected ? "Saved ✓" : hasStoredFolder ? "Reconnect Folder" : "Save to Mac"}</span>
                </button>
              )}

              {/* Grid Search Navigation Bar */}
              <GridSearchNav
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                matchCount={searchMatches.length}
                onClearSearch={handleClearSearch}
                placeholder="Search placeholders (e.g. selfie)..."
              />
            </div>

            <div className="flex items-center bg-white rounded-full p-1 shadow-sm border border-soft-200">
              <button
                onClick={() => setDeviceView("phone")}
                className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${deviceView === "phone" ? "bg-pastel-100 text-pastel-700 font-bold" : "text-foreground/40 hover:text-foreground"}`}
                title="Phone View"
              >
                <Smartphone size={16} />
              </button>
              <button
                onClick={() => setDeviceView("desktop")}
                className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${deviceView === "desktop" ? "bg-pastel-100 text-pastel-700 font-bold" : "text-foreground/40 hover:text-foreground"}`}
                title="Desktop View"
              >
                <Monitor size={16} />
              </button>
            </div>
          </div>

          {/* Grid Workspace */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-6 md:p-8 relative flex justify-center">
              {/* Dynamic View Container (Phone or Desktop) */}
              <div
                className={`
                ${
                  deviceView === "phone"
                    ? "w-full max-w-full sm:max-w-[360px] sm:border-[12px] sm:border-slate-900 sm:ring-[2px] sm:ring-slate-800 sm:rounded-[3.5rem] shadow-2xl overflow-hidden relative bg-white flex flex-col mx-auto min-h-[600px] sm:h-[780px]"
                    : "w-full max-w-4xl border border-soft-200 rounded-xl shadow-xl overflow-hidden relative bg-white flex flex-col mx-auto min-h-[700px]"
                } transition-all duration-300 ease-in-out
              `}
              >
                {deviceView === "phone" && (
                  <div className="hidden sm:flex absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[26px] bg-black rounded-full z-50 shadow-inner items-center justify-between px-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800/80"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-900/40"></div>
                  </div>
                )}

                <div
                  id="main-scroll-container"
                  className={`flex-1 overflow-y-auto no-scrollbar pb-6 relative ${deviceView === "phone" ? "sm:pt-1" : ""}`}
                >
                  <ProfileHeader
                    session={session}
                    status={status}
                    liveMediaCount={
                      items.filter(
                        (i) =>
                          !i.folderId &&
                          i.contentType !== "StoryFolder" &&
                          ((i.urls && i.urls.length > 0) || i.isLocked),
                      ).length
                    }
                    onAddRow={() => {
                      if (gridFilter === "Placeholders") {
                        const newBox: SlotItem = {
                          id: `slot-draft-${Math.floor(Math.random() * 1000000000)}`,
                          type: "placeholder",
                          urls: [],
                          currentUrlIndex: 0,
                          hexColor: "#E5D3C8",
                          text: "",
                          contentType: "Post",
                          folderId: "draft-pool",
                        };
                        updateItems([newBox, ...items]);
                      } else if (
                        gridFilter === "Story" &&
                        !activeStoryFolderId
                      ) {
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
                        const numItemsToAdd = 1;
                        const newRows = Array.from({
                          length: numItemsToAdd,
                        }).map((_, i) => ({
                          id: `slot-${Math.floor(Math.random() * 1000000000)}-${i}`,
                          type: "placeholder" as const,
                          urls: [],
                          currentUrlIndex: 0,
                          hexColor: "#E5D3C8",
                          text: "",
                          contentType:
                            (gridFilter as string) === "All" ||
                            (gridFilter as string) === "Placeholders"
                              ? "Post"
                              : (gridFilter as any),
                          folderId:
                            (gridFilter as string) === "Placeholders"
                              ? "draft-pool"
                              : gridFilter === "Story"
                                ? activeStoryFolderId || undefined
                                : undefined,
                        }));
                        updateItems([...newRows, ...items]);
                      }
                    }}
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                  />

                  {/* Grid Tabs */}
                  <div className="flex items-center justify-around border-t border-b border-soft-100 py-2.5 sticky top-0 bg-white/95 backdrop-blur-md z-40">
                    <button
                      onClick={() => setGridFilter("All")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "All" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                      title="Main Grid"
                    >
                      <Grid3X3
                        size={22}
                        strokeWidth={gridFilter === "All" ? 2.5 : 2}
                      />
                    </button>
                    <button
                      onClick={() => setGridFilter("Reel")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "Reel" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                      title="Reels"
                    >
                      <Clapperboard
                        size={22}
                        strokeWidth={gridFilter === "Reel" ? 2.5 : 2}
                      />
                    </button>
                    <button
                      onClick={() => setGridFilter("Story")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "Story" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                      title="Stories"
                    >
                      <Circle
                        size={22}
                        strokeWidth={gridFilter === "Story" ? 2.5 : 2}
                      />
                    </button>
                    <button
                      onClick={() => setGridFilter("Placeholders")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "Placeholders" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                      title="Draft Placeholders"
                    >
                      <SquarePlus
                        size={22}
                        strokeWidth={gridFilter === "Placeholders" ? 2.5 : 2}
                      />
                    </button>
                    <button
                      onClick={() => setGridFilter("Inspo")}
                      className={`flex-1 flex justify-center py-1 transition-all ${gridFilter === "Inspo" ? "text-foreground" : "text-foreground/30 hover:text-foreground/70"}`}
                      title="Inspo Collections"
                    >
                      <FolderHeart
                        size={22}
                        strokeWidth={gridFilter === "Inspo" ? 2.5 : 2}
                      />
                    </button>
                  </div>

                  <div className="w-full flex-1 flex flex-col min-h-0">
                    {status === "unauthenticated" ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-soft-100 rounded-full flex items-center justify-center mb-2">
                          <Grid3X3 className="text-soft-400" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">
                          Sign up first or login
                        </h3>
                        <p className="text-foreground/60 max-w-xs text-sm">
                          You need an account to arrange your grid and upload
                          photos.
                        </p>
                      </div>
                    ) : gridFilter === "Inspo" ? (
                      activeInspoFolderId && items.find((i) => i.id === activeInspoFolderId) ? (
                        <InspoFolderView
                          folder={items.find(
                            (i) => i.id === activeInspoFolderId,
                          )!}
                          itemsInFolder={items.filter(
                            (i) => i.folderId === activeInspoFolderId,
                          )}
                          allItems={items}
                          onBack={() => {
                            const currentFolder = items.find(
                              (i) => i.id === activeInspoFolderId,
                            );
                            if (currentFolder && currentFolder.folderId) {
                              setActiveInspoFolderId(currentFolder.folderId);
                            } else {
                              setActiveInspoFolderId(null);
                            }
                          }}
                          onFolderClick={(folderId) =>
                            setActiveInspoFolderId(folderId)
                          }
                          updateItems={updateItems}
                          updateItem={updateItem}
                          activeSlotId={activeSlotId}
                          setActiveSlotId={setActiveSlotId}
                          onCopyToMainGrid={handleCopyInspoToGrid}
                        />
                      ) : (
                        <InspoFolderListView
                          folders={items.filter(
                            (i) =>
                              i.contentType === "InspoFolder" && !i.folderId,
                          )}
                          allItems={items}
                          onFolderClick={(folderId) =>
                            setActiveInspoFolderId(folderId)
                          }
                          onAddFolder={handleCreateInspoFolder}
                          onDeleteFolder={handleDeleteInspoFolder}
                          updateItem={updateItem}
                        />
                      )
                    ) : gridFilter === "Placeholders" ? (
                      <PlaceholderPoolView
                        placeholders={items.filter(
                          (i) => i.folderId === "draft-pool",
                        )}
                        updateItems={updateItems}
                        updateItem={updateItem}
                        activeSlotId={activeSlotId}
                        setActiveSlotId={setActiveSlotId}
                        onTransferToMainGrid={handleTransferToMainGrid}
                        isSearchActive={searchQuery.trim() !== ""}
                        searchResults={searchMatches}
                      />
                    ) : gridFilter === "Story" ? (
                      activeStoryFolderId && items.find((i) => i.id === activeStoryFolderId) ? (
                        <StoryFolderView
                          folder={items.find(
                            (i) => i.id === activeStoryFolderId,
                          )!}
                          stories={items.filter(
                            (i) => i.folderId === activeStoryFolderId,
                          )}
                          onBack={() => setActiveStoryFolderId(null)}
                          updateItems={updateItems}
                          updateItem={updateItem}
                          activeSlotId={activeSlotId}
                          setActiveSlotId={setActiveSlotId}
                        />
                      ) : (
                        <StoryListView
                          folders={items.filter(
                            (i) => i.contentType === "StoryFolder",
                          )}
                          allItems={items}
                          onFolderClick={(id) => setActiveStoryFolderId(id)}
                          updateItem={updateItem}
                          onDeleteFolder={async (id) => {
                            const ok = await confirm({
                              title: "Delete Folder",
                              message: "Are you sure you want to delete this story folder and all its stories? This cannot be undone.",
                              confirmLabel: "Delete Folder",
                            });
                            if (!ok) return;

                            updateItems((prev) =>
                              prev.filter(
                                (item) =>
                                  item.id !== id && item.folderId !== id,
                              ),
                            );
                            if (items.find((i) => i.id === activeSlotId)?.folderId === id) {
                              setActiveSlotId(null);
                            }
                          }}
                        />
                      )
                    ) : (
                      <Grid
                        items={
                          gridFilter === "All"
                            ? items.filter(
                                (i) =>
                                  i.contentType !== "StoryFolder" &&
                                  i.contentType !== "PlaceholderFolder" &&
                                  i.contentType !== "InspoFolder" &&
                                  !i.folderId &&
                                  !i.isHiddenFromGrid,
                              )
                            : items.filter(
                                (i) =>
                                  i.contentType === gridFilter && !i.folderId,
                              )
                        }
                        setItems={updateItems}
                        updateItem={updateItem}
                        activeSlotId={activeSlotId}
                        setActiveSlotId={setActiveSlotId}
                        gridFilter={gridFilter}
                        isSearchActive={searchQuery.trim() !== ""}
                        searchResults={searchMatches}
                        onDoubleClickItem={(id) => setPreviewSlotId(id)}
                        onDeleteItem={async (id) => {
                          const ok = await confirm({
                            title: "Delete Post",
                            message: "Are you sure you want to delete this post? This cannot be undone.",
                            confirmLabel: "Delete",
                          });
                          if (ok) {
                            updateItems((prev) =>
                              prev.filter((item) => item.id !== id),
                            );
                            if (activeSlotId === id) setActiveSlotId(null);
                            if (previewSlotId === id) setPreviewSlotId(null);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            {/* Floating Editor Panel: Side-pane on Desktop, Native Bottom Sheet on Mobile */}
            {activeSlotId && activeSlot && (
              <>
                {/* Backdrop for Mobile Bottom Sheet */}
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs md:hidden z-40 animate-in fade-in duration-200"
                  onClick={() => setActiveSlotId(null)}
                />

                <div
                  className={`max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:z-50 md:absolute ${
                    deviceView === "phone"
                      ? "md:left-[calc(50%+195px)] md:top-20"
                      : "md:right-6 md:top-16"
                  } md:w-80 bg-white/95 backdrop-blur-2xl shadow-2xl border border-soft-200 rounded-3xl z-50 overflow-hidden flex flex-col transition-all duration-200 animate-in slide-in-from-bottom-4`}
                  style={{
                    transform:
                      typeof window !== "undefined" && window.innerWidth >= 768
                        ? `translate(${modalPos.x}px, ${modalPos.y}px)`
                        : "none",
                  }}
                >
                  <div
                    className="py-3 px-4 bg-white/90 backdrop-blur border-b border-soft-100 flex justify-between items-center cursor-move shrink-0 active:cursor-grabbing select-none"
                    onPointerDown={handleModalPointerDown}
                    onPointerMove={handleModalPointerMove}
                    onPointerUp={handleModalPointerUp}
                    onPointerCancel={handleModalPointerUp}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-slate-700" />
                      <h3 className="font-bold text-base text-foreground tracking-tight">
                        Edit Slot
                      </h3>
                    </div>

                    <div className="w-10 h-1 bg-soft-300 rounded-full md:hidden"></div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlotId(null);
                      }}
                      className="p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-soft-100 transition-colors pointer-events-auto cursor-pointer"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="pointer-events-auto">
                    <EditorPanel
                      activeSlot={activeSlot}
                      updateSlot={updateItem}
                      onClose={() => setActiveSlotId(null)}
                      onDeleteSlot={async (id) => {
                        const ok = await confirm({
                          title: "Delete Post",
                          message: "Are you sure you want to delete this post? This cannot be undone.",
                          confirmLabel: "Delete",
                        });
                        if (ok) {
                          updateItems((prev) => prev.filter((i) => i.id !== id));
                          setActiveSlotId(null);
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Instagram Feed / Reel Preview Modal */}
            {previewSlotId && (
              <InstagramPreviewModal
                item={items.find((i) => i.id === previewSlotId)!}
                onClose={() => setPreviewSlotId(null)}
              />
            )}
          </div>
        </div>
      </div>
      <ConfirmModal {...modalProps} />
    </div>
  );
}
