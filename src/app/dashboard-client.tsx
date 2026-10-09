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
import { listDeletedFeedSlots, syncFeedToContent } from "@/app/actions/content";
import { fetchGridFromCloud, syncGridToCloud } from "@/app/actions/grid";
import { deleteCloudMedia } from "@/app/actions/media";
import { useCloudMedia } from "@/hooks/useCloudMedia";
import { isCloudMediaUrl } from "@/lib/media/compress";
import {
  PLANNER_DELETED_EVENT,
  PLANNER_REFRESH_EVENT,
  PLANNER_SYNC_ERROR_EVENT,
  PLANNER_TITLE_EVENT,
  type FeedSlotSync,
} from "@/lib/planner/types";


// Old default/pastel placeholder colours → greys for the black & white theme (custom picks are left alone)
const LEGACY_PLACEHOLDER_COLORS: Record<string, string> = {
  "#e5d3c8": "#E4E4E7",
  "#f3e8ee": "#F4F4F5",
  "#e2ece9": "#D4D4D8",
  "#eae4e9": "#EDEDEE",
  "#fdfbfa": "#FAFAFA",
  "#d8e2dc": "#C9C9CE",
  "#ffe5d9": "#E9E9EB",
  "#f4acb7": "#A1A1AA",
};

function toMonochrome(items: SlotItem[]): SlotItem[] {
  return items.map((i) => {
    const grey = LEGACY_PLACEHOLDER_COLORS[i.hexColor?.toLowerCase() ?? ""];
    return grey ? { ...i, hexColor: grey } : i;
  });
}

// ---- Cloud backup bookkeeping (per user, in this browser) ----
type CloudMeta = { syncedAt: string | null; dirty: boolean; localChangedAt: string | null };
const cloudMetaKey = (userId: string) => `ig-curator-cloud:${userId}`;
function readCloudMeta(userId: string): CloudMeta {
  try {
    return { syncedAt: null, dirty: false, localChangedAt: null, ...JSON.parse(localStorage.getItem(cloudMetaKey(userId)) || "{}") };
  } catch {
    return { syncedAt: null, dirty: false, localChangedAt: null };
  }
}
function writeCloudMeta(userId: string, patch: Partial<CloudMeta>) {
  try {
    localStorage.setItem(cloudMetaKey(userId), JSON.stringify({ ...readCloudMeta(userId), ...patch }));
  } catch {}
}

/**
 * Projects everything added in the feed (posts, reels, drafts, story folders and stories, inspo boards and photos)
 * into the shape the content database syncs from.
 */
function toFeedSync(items: SlotItem[]): FeedSlotSync[] {
  const byId = new Map(items.map((i) => [i.id, i]));

  // Story folders and inspo boards become parent records. The database nests one level deep,
  // so anything inside a nested inspo board hangs off its top-level board.
  const topFolder = (folderId: string | undefined): SlotItem | undefined => {
    let folder = folderId ? byId.get(folderId) : undefined;
    const seen = new Set<string>();
    while (folder?.folderId && byId.get(folder.folderId)?.contentType?.endsWith("Folder") && !seen.has(folder.id)) {
      seen.add(folder.id);
      folder = byId.get(folder.folderId);
    }
    return folder?.contentType?.endsWith("Folder") ? folder : undefined;
  };

  return items.flatMap((item) => {
    const contentType = item.contentType ?? "Post";
    if (item.isLocked || contentType === "PlaceholderFolder") return [];
    // The starter grid's blank placeholders only count once they get a photo or text
    if (STARTER_SLOT_IDS.has(item.id) && item.urls.length === 0 && !item.text?.trim()) return [];

    const isFolder = contentType === "StoryFolder" || contentType === "InspoFolder";
    const parent = topFolder(item.folderId);
    const parentSlotId = parent && parent.id !== item.id ? parent.id : null;

    let location: FeedSlotSync["location"];
    if (item.folderId === "draft-pool") location = "drafts";
    else if (contentType.startsWith("Inspo") || parent?.contentType === "InspoFolder") location = "inspo";
    else if (contentType === "Story" || contentType === "StoryFolder" || parent?.contentType === "StoryFolder") location = "story";
    else location = "grid";

    return [{
      slotId: item.id,
      contentType: location === "story" && !isFolder ? "Story" : contentType,
      location,
      title: (item.text?.trim() || item.caption?.split("\n")[0]?.trim() || "").slice(0, 200),
      mediaUrls: item.urls ?? [],
      parentSlotId,
      isFolder,
    }];
  });
}

const initialItems: SlotItem[] = Array.from({ length: 9 }).map((_, index) => ({
  id: `slot-${index + 1}`,
  type: "placeholder",
  urls: [],
  currentUrlIndex: 0,
  isLocked: false,
  hexColor: "#E4E4E7",
  text: "",
  contentType: "Post",
}));

const STARTER_SLOT_IDS = new Set(initialItems.map((i) => i.id));

export function DashboardClient() {
  const { data: session, status } = useSession();
  // @ts-ignore - id is added in the session callback
  const userId: string | null = status === "authenticated" ? session?.user?.id ?? null : null;
  const [items, setItems] = useState<SlotItem[]>(initialItems);
  const [history, setHistory] = useState<SlotItem[][]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [gridFilter, setGridFilter] = useState<
    "All" | "Reel" | "Story" | "Placeholders" | "Inspo"
  >("All");
  const deviceView = "phone" as const;
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
        activeStoryFolderId,
        activeInspoFolderId,
      }));
    } catch (e) {}
  }, [gridFilter, activeStoryFolderId, activeInspoFolderId]);

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

  // Removed obsolete Local Folder API state variables

  const [showReconnectOverlay, setShowReconnectOverlay] = useState(false);

  // Removed obsolete reconnect overlay check

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
      try {
        const saved = await getItem<SlotItem[]>("ig-curator-items");
        const emergencyBackup = localStorage.getItem("ig-curator-items");

        // Cloud copy: use it on a new device, or when it was changed on another device more recently than here.
        if (userId) {
          const cloud = await fetchGridFromCloud();
          if (cloud.success && cloud.data && cloud.data.items.length) {
            const meta = readCloudMeta(userId);
            const hasLocal = Boolean(emergencyBackup) || Boolean(saved && saved.length);
            const changedElsewhere = !meta.syncedAt || cloud.data.updatedAt > meta.syncedAt;
            const localIsOlder = !meta.dirty || !meta.localChangedAt || cloud.data.updatedAt > meta.localChangedAt;
            if (!hasLocal || (changedElsewhere && localIsOlder)) {
              const adopted = toMonochrome(cloud.data.items);
              if (isMounted) {
                cloudPushedRef.current = adopted;
                setItems(adopted);
              }
              await setItem("ig-curator-items", adopted).catch(() => {});
              localStorage.removeItem("ig-curator-items");
              if (cloud.data.profile) {
                localStorage.setItem("ig-curator-profile", JSON.stringify(cloud.data.profile));
                window.dispatchEvent(new Event("ig-curator:profile"));
              }
              writeCloudMeta(userId, { syncedAt: cloud.data.updatedAt, dirty: false, localChangedAt: null });
              if (isMounted) setIsLoaded(true);
              return;
            }
          }
        }

        if (emergencyBackup) {
          try {
            const parsed = JSON.parse(emergencyBackup);
            localStorage.removeItem("ig-curator-items");
            if (isMounted) setItems(toMonochrome(parsed));
            await setItem("ig-curator-items", parsed).catch(() => {});
          } catch (e) {}
        } else if (saved && saved.length > 0) {
          const compressed = await compressIfNeeded(saved);
          if (isMounted) setItems(toMonochrome(compressed));
        }
      } catch (error) {
        console.error("Failed to load local grid", error);
      }
      
      if (isMounted) setIsLoaded(true);
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [status, userId]);

  // ---- Cloud backup of the feed ----
  const cloudPushedRef = useRef<SlotItem[] | null>(null);
  const [cloudState, setCloudState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (cloudPushedRef.current === null) {
      cloudPushedRef.current = items; // baseline after load
      if (!readCloudMeta(userId).dirty) return;
    }
    if (cloudPushedRef.current === items && !readCloudMeta(userId).dirty) return;
    if (cloudPushedRef.current !== items) writeCloudMeta(userId, { dirty: true, localChangedAt: new Date().toISOString() });

    const timeoutId = setTimeout(async () => {
      setCloudState("saving");
      let profile: unknown = null;
      try {
        profile = JSON.parse(localStorage.getItem("ig-curator-profile") || "null");
      } catch {}
      const res = await syncGridToCloud(items, profile);
      if (res.success) {
        cloudPushedRef.current = items;
        writeCloudMeta(userId, { syncedAt: res.data.updatedAt, dirty: false });
        setCloudState("saved");
      } else {
        console.error("Feed backup failed:", res.error);
        setCloudState("error");
      }
    }, 2500);
    return () => clearTimeout(timeoutId);
  }, [items, isLoaded, userId]);

  // Profile edits are backed up too
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (!userId) return;
    const onSaved = async () => {
      setCloudState("saving");
      const res = await syncGridToCloud(itemsRef.current, JSON.parse(localStorage.getItem("ig-curator-profile") || "null"));
      if (res.success) {
        writeCloudMeta(userId, { syncedAt: res.data.updatedAt, dirty: false });
        setCloudState("saved");
      } else setCloudState("error");
    };
    window.addEventListener("ig-curator:profile-saved", onSaved);
    return () => window.removeEventListener("ig-curator:profile-saved", onSaved);
  }, [userId]);

  // ---- Photos: upload to cloud storage, and clean up ones no longer used ----
  const cloudMedia = useCloudMedia(items, setItems, userId, isLoaded);
  const referencedCloudRef = useRef<Set<string> | null>(null);
  const pendingMediaDeletes = useRef<Set<string>>(new Set());


  // Removed cloud sync effect

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

  // A cloud photo is deleted once neither the feed nor the undo history uses it any more.
  useEffect(() => {
    if (!isLoaded || !userId) return;
    const referenced = new Set<string>();
    for (const state of [items, ...history]) for (const i of state) for (const u of i.urls ?? []) if (isCloudMediaUrl(u)) referenced.add(u);
    const prev = referencedCloudRef.current;
    referencedCloudRef.current = referenced;
    if (!prev) return;
    for (const u of prev) if (!referenced.has(u)) pendingMediaDeletes.current.add(u);
    for (const u of referenced) pendingMediaDeletes.current.delete(u);
    if (!pendingMediaDeletes.current.size) return;
    const timeoutId = setTimeout(async () => {
      const urls = [...pendingMediaDeletes.current];
      const res = await deleteCloudMedia(urls);
      if (res.success) urls.forEach((u) => pendingMediaDeletes.current.delete(u));
    }, 10_000);
    return () => clearTimeout(timeoutId);
  }, [items, history, isLoaded, userId]);

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

      setSyncStatus("Saving...");
      // Save directly to IDB natively
      try {
        await setItem("ig-curator-items", items);
        setSyncStatus("Saved Locally");
        setTimeout(() => setSyncStatus((prev) => (prev === "Saved Locally" ? "Idle" : prev)), 2000);
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

  // ---- Two-way sync with the content planner database ----

  // Boxes deleted or brought back (undo) since the last successful sync. Tracked from user changes only — never
  // inferred from a missing box — so a fresh browser with an empty feed can't wipe the database.
  const prevSlotIdsRef = useRef<Set<string> | null>(null);
  const pendingDeletesRef = useRef<Set<string>>(new Set());
  const pendingRestoresRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isLoaded) return;
    const ids = new Set(items.map((i) => i.id));
    const prev = prevSlotIdsRef.current;
    prevSlotIdsRef.current = ids;
    if (!prev) return; // first loaded state is the baseline
    for (const id of prev) {
      if (!ids.has(id)) {
        pendingDeletesRef.current.add(id);
        pendingRestoresRef.current.delete(id);
      }
    }
    for (const id of ids) {
      if (!prev.has(id)) {
        pendingRestoresRef.current.add(id);
        pendingDeletesRef.current.delete(id);
      }
    }
  }, [items, isLoaded]);

  // Mirror feed changes into the database
  const lastFeedSyncRef = useRef<string>("");
  const syncedTitlesRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!isLoaded || status !== "authenticated") return;
    const slots = toFeedSync(items);
    const key = JSON.stringify(slots);
    if (key === lastFeedSyncRef.current && pendingDeletesRef.current.size === 0) return;

    const timeoutId = setTimeout(async () => {
      const deletedSlotIds = [...pendingDeletesRef.current];
      const restoredSlotIds = [...pendingRestoresRef.current];
      // A box's text only overrides the planner title when it was edited in the feed since the last sync.
      const synced = syncedTitlesRef.current;
      const request = {
        slots: slots.map((s) => ({ ...s, titleChanged: synced !== null && synced.has(s.slotId) && synced.get(s.slotId) !== s.title })),
        deletedSlotIds,
        restoredSlotIds,
      };
      const res = await syncFeedToContent(request);
      if (res.success) {
        lastFeedSyncRef.current = key;
        syncedTitlesRef.current = new Map(slots.map((s) => [s.slotId, s.title]));
        deletedSlotIds.forEach((id) => pendingDeletesRef.current.delete(id));
        restoredSlotIds.forEach((id) => pendingRestoresRef.current.delete(id));
        if (res.data.created + res.data.updated + res.data.deleted > 0) window.dispatchEvent(new Event(PLANNER_REFRESH_EVENT));
      } else {
        console.error("Planner sync failed:", res.error);
        window.dispatchEvent(new CustomEvent(PLANNER_SYNC_ERROR_EVENT, { detail: res.error }));
      }
    }, 1200);
    return () => clearTimeout(timeoutId);
  }, [items, isLoaded, status]);

  // Database → feed: remove boxes deleted in the planner (or another browser), and follow planner renames.
  const removeSlots = (slotIds: string[]) => {
    if (!slotIds.length) return;
    const gone = new Set(slotIds);
    setItems((curr) => (curr.some((i) => gone.has(i.id)) ? curr.filter((i) => !gone.has(i.id)) : curr));
    if (activeSlotId && gone.has(activeSlotId)) setActiveSlotId(null);
    if (previewSlotId && gone.has(previewSlotId)) setPreviewSlotId(null);
  };
  const removeSlotsRef = useRef(removeSlots);
  removeSlotsRef.current = removeSlots;

  useEffect(() => {
    const onDeleted = (e: Event) => removeSlotsRef.current((e as CustomEvent<string[]>).detail ?? []);
    const onTitle = (e: Event) => {
      const { slotId, title } = (e as CustomEvent<{ slotId: string; title: string }>).detail;
      setItems((curr) => curr.map((i) => (i.id === slotId && i.text !== title ? { ...i, text: title } : i)));
    };
    window.addEventListener(PLANNER_DELETED_EVENT, onDeleted);
    window.addEventListener(PLANNER_TITLE_EVENT, onTitle);
    return () => {
      window.removeEventListener(PLANNER_DELETED_EVENT, onDeleted);
      window.removeEventListener(PLANNER_TITLE_EVENT, onTitle);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || status !== "authenticated") return;
    listDeletedFeedSlots().then((res) => {
      if (res.success) removeSlotsRef.current(res.data);
    });
  }, [isLoaded, status]);

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
    setSyncStatus("Saving...");
    try {
      await setItem("ig-curator-items", items);
      if (userId) {
        const res = await syncGridToCloud(items, JSON.parse(localStorage.getItem("ig-curator-profile") || "null"));
        if (!res.success) throw new Error(res.error);
        cloudPushedRef.current = items;
        writeCloudMeta(userId, { syncedAt: res.data.updatedAt, dirty: false });
        setCloudState("saved");
      }
      setSyncStatus("Saved");
      setTimeout(() => setSyncStatus((prev) => (prev === "Saved" ? "Idle" : prev)), 2000);
    } catch (e: any) {
      console.error("Manual save exception:", e);
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
        // The desktop panel is fixed at lg:top-24 (96px); shift it to line up with the clicked slot, staying on screen
        const baselineTop = 96;
        const maxOffset = Math.max(0, window.innerHeight - baselineTop - 560);
        const topOffset = Math.max(-40, Math.min(maxOffset, rect.top - baselineTop - 20));
        setModalPos({ x: 0, y: topOffset });
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
      hexColor: hexColor || "#E4E4E7",
      text: title,
      contentType: "InspoFolder",
    };
    updateItems((curr) => [newFolder, ...curr]);
    setActiveInspoFolderId(newFolder.id);
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
      hexColor: inspoItem.hexColor || "#E4E4E7",
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
    <div className="w-full flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)]">
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
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-gradient-to-tr from-pastel-100 to-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderHeart size={30} className="text-pastel-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 mb-2">Reconnect to Mac</h2>
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
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 sm:px-6 lg:px-5 pt-3 sm:pt-5 pb-1 sm:pb-2 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={status === "authenticated" ? handleManualSync : undefined}
                disabled={syncStatus === "Saving..."}
                title={
                  cloudMedia.enabled === false
                    ? "Your feed is backed up, but photos stay in this browser until cloud photo storage (Vercel Blob) is connected"
                    : "Back up now"
                }
                className={`shrink-0 text-xs sm:text-sm font-medium h-9 px-3 sm:px-4 rounded-full border transition-all flex items-center gap-2 ${
                  syncStatus === "Saving..."
                    ? "bg-zinc-50 text-zinc-900 border-zinc-200 cursor-default"
                    : (syncStatus === "Saved" || syncStatus === "Saved Locally")
                      ? "bg-zinc-50 text-zinc-900 border-zinc-200 cursor-default"
                      : syncStatus === "Error"
                        ? "bg-zinc-50 text-zinc-900 border-zinc-200 cursor-pointer"
                        : "bg-white/80 backdrop-blur border-soft-200 text-zinc-600 hover:text-zinc-900 hover:border-soft-300 cursor-pointer"
                } ${status !== "authenticated" ? "hidden" : ""}`}
              >
                {syncStatus === "Saving..." ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (syncStatus === "Saved" || syncStatus === "Saved Locally") ? (
                  <Check size={13} />
                ) : (
                  <RefreshCw size={13} />
                )}
                <span className="hidden sm:inline">
                  {syncStatus === "Saving..."
                    ? "Syncing..."
                    : syncStatus === "Error" || cloudState === "error"
                      ? "Backup failed — retry"
                      : cloudMedia.enabled && cloudMedia.pending > 0
                        ? `Uploading ${cloudMedia.pending} photo${cloudMedia.pending === 1 ? "" : "s"}…`
                        : cloudState === "saving"
                          ? "Backing up…"
                          : cloudMedia.enabled === false
                            ? "Photos on this device"
                            : "Backed up"}
                </span>
              </button>


              {/* Grid Search Navigation Bar */}
              <div className="min-w-0 flex-1 sm:flex-none">
              <GridSearchNav
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                matchCount={searchMatches.length}
                onClearSearch={handleClearSearch}
                placeholder="Search placeholders (e.g. selfie)..."
              />
              </div>
            </div>
          </div>

          {/* Grid Workspace */}
          <div id="grid-workspace" className="flex-1 overflow-y-auto px-0 pt-2 sm:p-6 lg:px-4 lg:py-4 relative flex justify-center">
              {/* Dynamic View Container (Phone or Desktop) */}
              <div
                className={`
                ${
                  deviceView === "phone"
                    ? "w-full max-w-full sm:max-w-[380px] sm:border-[10px] sm:border-zinc-900 sm:ring-1 sm:ring-zinc-700 sm:rounded-[3.25rem] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] overflow-hidden relative bg-white flex flex-col mx-auto h-full sm:h-[min(800px,100%)] sm:min-h-[640px]"
                    : "w-full max-w-4xl sm:border border-soft-200 sm:rounded-2xl sm:shadow-float overflow-hidden relative bg-white flex flex-col mx-auto h-full sm:min-h-[640px]"
                } transition-all duration-300 ease-in-out
              `}
              >
                {deviceView === "phone" && (
                  <div className="hidden sm:flex absolute top-2 left-1/2 -translate-x-1/2 w-[96px] h-[26px] bg-black rounded-full z-50 items-center justify-end px-3 pointer-events-none">
                    <div className="w-2 h-2 rounded-full bg-zinc-950 ring-1 ring-zinc-800"></div>
                  </div>
                )}

                <div
                  id="main-scroll-container"
                  className={`flex-1 overflow-y-auto no-scrollbar pb-6 relative ${deviceView === "phone" ? "sm:pt-3" : ""}`}
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
                          hexColor: "#E4E4E7",
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
                          hexColor: "#E4E4E7",
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
                          hexColor: "#E4E4E7",
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
                  <div className="@container sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-y border-soft-100 px-2 py-2">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {(
                        [
                          ["All", "Posts", Grid3X3],
                          ["Reel", "Reels", Clapperboard],
                          ["Story", "Stories", Circle],
                          ["Placeholders", "Drafts", SquarePlus],
                          ["Inspo", "Inspo", FolderHeart],
                        ] as const
                      ).map(([value, label, Icon]) => {
                        const isActive = gridFilter === value;
                        return (
                          <button
                            key={value}
                            onClick={() => setGridFilter(value)}
                            aria-pressed={isActive}
                            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-2.5 @md:px-3 h-8 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? "bg-zinc-900 text-white shadow-sm"
                                : "text-zinc-500 hover:text-zinc-900 hover:bg-soft-100"
                            }`}
                          >
                            <Icon size={13} strokeWidth={2.2} className="hidden @md:block" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-full flex-1 flex flex-col min-h-0">
                    {status === "unauthenticated" ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-soft-100 rounded-full flex items-center justify-center mb-2">
                          <Grid3X3 className="text-soft-400" size={32} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight text-zinc-900">
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
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs lg:hidden z-[70] animate-in fade-in duration-200"
                  onClick={() => setActiveSlotId(null)}
                />

                <div
                  className={`max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[80] max-lg:max-h-[85dvh] max-lg:rounded-b-none max-lg:pb-safe sm:max-lg:inset-x-auto sm:max-lg:left-1/2 sm:max-lg:-translate-x-1/2 sm:max-lg:w-[440px] lg:fixed lg:left-[464px] xl:left-[504px] lg:top-24 lg:z-[65] lg:w-80 lg:max-h-[calc(100dvh-8rem)] bg-white/95 backdrop-blur-2xl shadow-2xl border border-soft-200 rounded-3xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300`}
                  style={{
                    transform:
                      typeof window !== "undefined" && window.innerWidth >= 1024
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
                      <Sparkles size={16} className="text-pastel-500" />
                      <h3 className="font-semibold text-base text-zinc-900 tracking-tight">
                        Edit Slot
                      </h3>
                    </div>

                    <div className="w-10 h-1 bg-soft-300 rounded-full lg:hidden"></div>

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
                  <div className="pointer-events-auto flex-1 min-h-0 overflow-y-auto no-scrollbar">
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
