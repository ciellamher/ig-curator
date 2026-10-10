"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { Grid } from "@/components/grid/Grid";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SlotItem } from "@/types";
import { removeRepeatedPhotos } from "@/lib/feedRepair";
import { type PhotoDropMode } from "@/lib/photoDrag";
import { FacebookFeedView } from "@/components/grid/FacebookFeedView";
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
import { PhotoVault } from "@/components/grid/PhotoVault";
import { splitDrafts, splitInspo } from "@/lib/clearInspo";
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
  Archive,
  Newspaper,
} from "lucide-react";
import { setItem, getItem, removeItem, saveFeedBackup, deleteMediaBlob } from "@/lib/idb";
import { useConfirmModal, ConfirmModal } from "@/components/ui/ConfirmModal";
import { listDeletedFeedSlots, syncFeedToContent } from "@/app/actions/content";
import { fetchGridFromCloud, syncGridToCloud } from "@/app/actions/grid";
import {
  FEED_ADD_EVENT,
  FEED_ATTACH_EVENT,
  FEED_SELECT_EVENT,
  PLANNER_DELETED_EVENT,
  PLANNER_FOCUS_EVENT,
  PLANNER_OPEN_EVENT,
  PAGE_EDITOR_EVENT,
  PLANNER_SLOTS_EVENT,
  PLANNER_FACEBOOK_EVENT,
  type FacebookPage,
  FEED_REMOVE_PHOTOS_EVENT,
  type FeedRemovePhotos,
  type PageEditorHost,
  PLANNER_REFRESH_EVENT,
  PLANNER_SYNC_ERROR_EVENT,
  PLANNER_TITLE_EVENT,
  PLANNER_HIDDEN_EVENT,
  type FeedAttach,
  type FeedBox,
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

/** The side panel's tabs: Drafts, then the board collections. */
const LIBRARY_TABS = [
  ["drafts", "Drafts"],
  ["inspo", "Inspo"],
  ["fits", "Fits"],
  ["other", "Other content"],
  ["highlights", "Other highlights"],
] as const;
type LibraryTab = (typeof LIBRARY_TABS)[number][0];

function toMonochrome(items: SlotItem[]): SlotItem[] {
  return removeRepeatedPhotos(items).items.map((i) => {
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

const GRID_TYPES = new Set(["Post", "Reel", "Carousel"]);

/** Planner content: boxes in the Posts tab (the main grid), and story folders (one planner page per folder). */
function isPlannerBox(item: SlotItem): boolean {
  if (item.folderId || item.isLocked) return false;
  return item.contentType === "StoryFolder" || GRID_TYPES.has(item.contentType ?? "Post");
}

/** Projects the Posts-tab boxes into the shape the content database syncs from. */
function toFeedSync(items: SlotItem[]): FeedSlotSync[] {
  return items.flatMap((item) => {
    if (!isPlannerBox(item)) return [];
    // The starter grid's blank placeholders only count once they get a photo or text
    if (STARTER_SLOT_IDS.has(item.id) && item.urls.length === 0 && !item.text?.trim()) return [];
    const isStoryFolder = item.contentType === "StoryFolder";
    return [{
      slotId: item.id,
      contentType: item.contentType ?? "Post",
      location: isStoryFolder ? ("story" as const) : ("grid" as const),
      title: (item.text?.trim() || item.caption?.split("\n")[0]?.trim() || "").slice(0, 200),
      // A story folder's page shows the folder cover plus its stories' photos
      mediaUrls: isStoryFolder
        ? [...(item.urls ?? []), ...items.filter((s) => s.folderId === item.id).flatMap((s) => s.urls?.slice(0, 1) ?? [])].slice(0, 20)
        : item.urls ?? [],
      parentSlotId: null,
      isFolder: isStoryFolder,
      isHiddenFromGrid: item.isHiddenFromGrid,
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
  // An open planner page shows its box's Edit Slot tools inside the page instead of the floating panel
  const [pageEditor, setPageEditor] = useState<PageEditorHost>(null);
  // Boxes that belong to a planner page: they're edited in the page, never in the floating panel
  const [pageSlotIds, setPageSlotIds] = useState<Set<string>>(new Set());
  // Pages with the Facebook category, for the Facebook tab
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  useEffect(() => {
    const initial = (window as Window & { __plannerFacebook?: FacebookPage[] }).__plannerFacebook;
    if (initial) setFacebookPages(initial);
    const onPages = (e: Event) => setFacebookPages((e as CustomEvent<FacebookPage[]>).detail);
    window.addEventListener(PLANNER_FACEBOOK_EVENT, onPages);
    return () => window.removeEventListener(PLANNER_FACEBOOK_EVENT, onPages);
  }, []);
  useEffect(() => {
    const initial = (window as Window & { __plannerSlots?: string[] }).__plannerSlots;
    if (initial) setPageSlotIds(new Set(initial));
    const onSlots = (e: Event) => setPageSlotIds(new Set((e as CustomEvent<string[]>).detail));
    window.addEventListener(PLANNER_SLOTS_EVENT, onSlots);
    return () => window.removeEventListener(PLANNER_SLOTS_EVENT, onSlots);
  }, []);
  const pageEditorRef = useRef<PageEditorHost>(null);
  useEffect(() => {
    const onHost = (e: Event) => {
      const host = (e as CustomEvent<PageEditorHost>).detail;
      const closing = pageEditorRef.current;
      // Closing the page closes its box's editor too (it shouldn't pop up as a floating panel)
      if (!host && closing) setActiveSlotId((id) => (id === closing.slotId ? null : id));
      pageEditorRef.current = host;
      setPageEditor(host);
    };
    window.addEventListener(PAGE_EDITOR_EVENT, onHost);
    return () => window.removeEventListener(PAGE_EDITOR_EVENT, onHost);
  }, []);
  const [gridFilter, setGridFilter] = useState<
    "All" | "Reel" | "Story" | "Facebook" | "Placeholders" | "Inspo"
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
          : items.filter((i) => i.contentType === gridFilter && !i.folderId && !i.isHiddenFromGrid);

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
      // Wait for sign-in to resolve so the feed is loaded once, from the right source.
      if (status === "loading") return;
      try {
        const saved = await getItem<SlotItem[]>("ig-curator-items");
        const emergencyBackup = localStorage.getItem("ig-curator-items");
        const hasLocal = Boolean(emergencyBackup) || Boolean(saved && saved.length);

        // The cloud copy is only used on a device that has no feed of its own. A feed already in this
        // browser is never replaced automatically.
        if (userId && !hasLocal) {
          const cloud = await fetchGridFromCloud();
          if (cloud.success && cloud.data && cloud.data.items.length) {
            const adopted = toMonochrome(cloud.data.items);
            if (isMounted) {
              cloudPushedRef.current = adopted;
              setItems(adopted);
            }
            await setItem("ig-curator-items", adopted).catch(() => {});
            if (cloud.data.profile && !localStorage.getItem("ig-curator-profile")) {
              localStorage.setItem("ig-curator-profile", JSON.stringify(cloud.data.profile));
              window.dispatchEvent(new Event("ig-curator:profile"));
            }
            writeCloudMeta(userId, { syncedAt: cloud.data.updatedAt, dirty: false, localChangedAt: null });
            if (isMounted) setIsLoaded(true);
            return;
          }
        }

        if (emergencyBackup) {
          try {
            const parsed = JSON.parse(emergencyBackup);
            localStorage.removeItem("ig-curator-items");
            if (saved?.length) await saveFeedBackup(saved, "before restoring unsaved changes");
            if (isMounted) setItems(toMonochrome(parsed));
            await setItem("ig-curator-items", parsed).catch(() => {});
          } catch (e) {}
        } else if (saved && saved.length > 0) {
          const repaired = removeRepeatedPhotos(saved);
          if (repaired.changed) {
            await saveFeedBackup(saved, "before removing repeated photos");
            await setItem("ig-curator-items", repaired.items).catch(() => {});
          }
          const compressed = await compressIfNeeded(repaired.items);
          if (isMounted) setItems(toMonochrome(compressed));
          // Daily safety snapshot of the layout
          const last = Number(localStorage.getItem("ig-curator-last-backup") || 0);
          if (Date.now() - last > 12 * 3600_000) {
            await saveFeedBackup(saved, "daily");
            localStorage.setItem("ig-curator-last-backup", String(Date.now()));
          }
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

  // ---- Photos & backups: recover photos not in any box, restore layout snapshots, download a ZIP ----
  const [vaultOpen, setVaultOpen] = useState(false);

  // One-time clear-out of Inspo for the ciellamher account (requested Oct 9, to start Inspo fresh).
  // Posts, reels, stories and drafts are kept; photo files used only by Inspo are deleted from this browser.
  const inspoClearedRef = useRef(false);
  useEffect(() => {
    const CLEAR_FLAG = "ig-curator-inspo-cleared-2026-10-09";
    if (!isLoaded || userId !== "cmrsbownc0000l404vsncrtxr" || inspoClearedRef.current) return;
    inspoClearedRef.current = true;
    if (localStorage.getItem(CLEAR_FLAG)) return;
    (async () => {
      const { keep, removed, mediaToDelete } = splitInspo(itemsRef.current);
      if (removed.length) {
        setItems(keep);
        await setItem("ig-curator-items", keep).catch(() => {});
        for (const id of mediaToDelete) await deleteMediaBlob(id).catch(() => {});
        setActiveInspoFolderId(null);
      }
      // The older storage area only held the old Inspo boards
      try {
        indexedDB.deleteDatabase("ig-curator-db");
      } catch {}
      localStorage.setItem(CLEAR_FLAG, new Date().toISOString());
      localStorage.setItem("ig-curator-restored-2026-10-09", "skipped");
    })();
  }, [isLoaded, userId]);

  // One-time removal of all draft boxes for the ciellamher account (requested Oct 9). Posts, reels and stories are
  // kept; photo files used only by drafts are deleted, and their planner rows go with them.
  const draftsClearedRef = useRef(false);
  useEffect(() => {
    const CLEAR_FLAG = "ig-curator-drafts-cleared-2026-10-09";
    if (!isLoaded || userId !== "cmrsbownc0000l404vsncrtxr" || draftsClearedRef.current) return;
    draftsClearedRef.current = true;
    if (localStorage.getItem(CLEAR_FLAG)) return;
    (async () => {
      // Wait for the Inspo clear-out above to finish so the two don't overwrite each other
      for (let i = 0; i < 50 && !localStorage.getItem("ig-curator-inspo-cleared-2026-10-09"); i++) await new Promise((r) => setTimeout(r, 200));
      const { keep, removed, mediaToDelete } = splitDrafts(itemsRef.current);
      if (removed.length) {
        setItems(keep);
        await setItem("ig-curator-items", keep).catch(() => {});
        for (const id of mediaToDelete) await deleteMediaBlob(id).catch(() => {});
      }
      localStorage.setItem(CLEAR_FLAG, new Date().toISOString());
    })();
  }, [isLoaded, userId]);

  // ---- Planner → feed: highlight the box an opened planner item belongs to ----
  const [highlightSlotId, setHighlightSlotId] = useState<string | null>(null);
  useEffect(() => {
    const onFocus = (e: Event) => {
      const slotId = (e as CustomEvent<string>).detail;
      const all = itemsRef.current;
      const item = all.find((i) => i.id === slotId);
      if (!item) return;
      const folder = item.folderId ? all.find((i) => i.id === item.folderId) : undefined;
      if (item.folderId === "draft-pool") setGridFilter("Placeholders");
      else if (folder?.contentType === "StoryFolder") {
        setGridFilter("Story");
        setActiveStoryFolderId(folder.id);
      } else if (folder?.contentType === "InspoFolder") {
        setGridFilter("Inspo");
        setActiveInspoFolderId(folder.id);
      } else if (item.contentType === "StoryFolder" || item.contentType === "Story") {
        setGridFilter("Story");
        setActiveStoryFolderId(null);
      } else if (item.contentType?.startsWith("Inspo")) {
        setGridFilter("Inspo");
        setActiveInspoFolderId(null);
      } else setGridFilter("All");
      setHighlightSlotId(slotId);
    };
    // Opening a planner page also opens its box's editor (or its story folder)
    const onOpen = (e: Event) => {
      const slotId = (e as CustomEvent<string>).detail;
      const item = itemsRef.current.find((i) => i.id === slotId);
      if (!item) return;
      // Posts and reels: the page itself shows the Edit Slot tools
      if (item.contentType === "StoryFolder") setActiveStoryFolderId(item.id);
    };
    window.addEventListener(PLANNER_FOCUS_EVENT, onFocus);
    window.addEventListener(PLANNER_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(PLANNER_FOCUS_EVENT, onFocus);
      window.removeEventListener(PLANNER_OPEN_EVENT, onOpen);
    };
  }, []);
  useEffect(() => {
    // A style rule (rather than a class on the element) so the outline survives re-renders and view switches
    let style = document.getElementById("feed-highlight-style") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "feed-highlight-style";
      document.head.appendChild(style);
    }
    if (!highlightSlotId) {
      style.textContent = "";
      return;
    }
    const sel = `#grid-slot-${CSS.escape(highlightSlotId)}, [data-slot-id="${CSS.escape(highlightSlotId)}"]`;
    // Story folder cards are only scrolled to, not outlined
    const outlined = `#grid-slot-${CSS.escape(highlightSlotId)}, [data-slot-id="${CSS.escape(highlightSlotId)}"]:not([data-no-outline])`;
    style.textContent = `${outlined} { outline: 3px solid #09090b !important; outline-offset: -3px; position: relative; z-index: 5; }`;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const reveal = () => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) {
        if (tries++ < 20) timer = setTimeout(reveal, 100);
        return;
      }
      // Scroll inside the phone screen only, so the planner beside it doesn't move
      const box = el.closest<HTMLElement>("#main-scroll-container");
      if (box) {
        const b = box.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        box.scrollTo({ top: box.scrollTop + (r.top - b.top) - box.clientHeight / 2 + r.height / 2, behavior: "smooth" });
      }
    };
    reveal();
    return () => clearTimeout(timer);
  }, [highlightSlotId]);

  // Opening a story folder in the feed shows its planner page
  useEffect(() => {
    if (!activeStoryFolderId) return;
    setHighlightSlotId(activeStoryFolderId);
    window.dispatchEvent(new CustomEvent(FEED_SELECT_EVENT, { detail: activeStoryFolderId }));
  }, [activeStoryFolderId]);

  // Feed → planner: selecting a box shows its row in the planner
  useEffect(() => {
    if (!activeSlotId) return;
    setHighlightSlotId(activeSlotId);
    window.dispatchEvent(new CustomEvent(FEED_SELECT_EVENT, { detail: activeSlotId }));
  }, [activeSlotId]);


  // ---- Drafts & Inspo live beside the feed (in the right column), not inside the phone ----
  const [libraryEl, setLibraryEl] = useState<HTMLElement | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("drafts");
  const [libraryOpen, setLibraryOpen] = useState(true);
  useEffect(() => {
    setLibraryEl(document.getElementById("library-slot"));
    try {
      const saved = JSON.parse(localStorage.getItem("ig-curator-library") || "{}");
      if (LIBRARY_TABS.some(([id]) => id === saved.tab)) setLibraryTab(saved.tab);
      if (saved.open === false) setLibraryOpen(false);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("ig-curator-library", JSON.stringify({ tab: libraryTab, open: libraryOpen }));
    } catch {}
  }, [libraryTab, libraryOpen]);
  // Older saved views pointed the phone at Drafts/Inspo; those now live in the side panel
  useEffect(() => {
    if (gridFilter === "Placeholders" || gridFilter === "Inspo") {
      setLibraryTab(gridFilter === "Inspo" ? "inspo" : "drafts");
      setGridFilter("All");
    }
  }, [gridFilter]);
  const draftCount = items.filter((i) => i.folderId === "draft-pool").length;
  // Board collections beside the phone: Inspo, Other content, Fits, Other highlights
  const boardsIn = (tab: LibraryTab) =>
    items.filter((i) => i.contentType === "InspoFolder" && !i.folderId && (i.library ?? "inspo") === tab);

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
        // Never drop photos to make room — report it so nothing is silently lost.
        console.error("Saving the feed in this browser failed:", error);
        setSyncStatus("Error");
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
        excludedSlotIds: items.filter((i) => !isPlannerBox(i)).map((i) => i.id),
        presentSlotIds: items.map((i) => i.id),
      };
      const res = await syncFeedToContent(request);
      if (res.success) {
        lastFeedSyncRef.current = key;
        syncedTitlesRef.current = new Map(slots.map((s) => [s.slotId, s.title]));
        deletedSlotIds.forEach((id) => pendingDeletesRef.current.delete(id));
        restoredSlotIds.forEach((id) => pendingRestoresRef.current.delete(id));
        if (res.data.addToFeed.length) addFeedBoxes(res.data.addToFeed);
        if (res.data.removeFromFeed.length) removeSlotsRef.current(res.data.removeFromFeed);
        if (res.data.textForFeed.length) {
          const titles = new Map(res.data.textForFeed.map((t) => [t.slotId, t.title]));
          setItems((curr) => curr.map((i) => (titles.has(i.id) && !i.text?.trim() ? { ...i, text: titles.get(i.id)! } : i)));
        }
        if (res.data.created + res.data.updated + res.data.deleted + res.data.addToFeed.length > 0) window.dispatchEvent(new Event(PLANNER_REFRESH_EVENT));
      } else {
        console.error("Planner sync failed:", res.error);
        window.dispatchEvent(new CustomEvent(PLANNER_SYNC_ERROR_EVENT, { detail: res.error }));
      }
    }, 1200);
    return () => clearTimeout(timeoutId);
  }, [items, isLoaded, status]);

  // Planner → feed: content made in the planner gets a box at the top of the Posts grid
  const addFeedBoxes = (boxes: FeedBox[]) => {
    setItems((curr) => {
      const have = new Set(curr.map((i) => i.id));
      const fresh: SlotItem[] = boxes
        .filter((b) => !have.has(b.slotId))
        .map((b) => ({
          id: b.slotId,
          type: "placeholder",
          urls: [],
          currentUrlIndex: 0,
          hexColor: "#E4E4E7",
          text: b.contentType === "StoryFolder" ? (/^Untitled/.test(b.title) ? "New Folder" : b.title) : /^Untitled/.test(b.title) ? "" : b.title,
          contentType: b.contentType === "Reel" ? "Reel" : b.contentType === "StoryFolder" ? "StoryFolder" : "Post",
        }));
      return fresh.length ? [...fresh, ...curr] : curr;
    });
  };
  const addFeedBoxesRef = useRef(addFeedBoxes);
  addFeedBoxesRef.current = addFeedBoxes;
  useEffect(() => {
    const onAdd = (e: Event) => addFeedBoxesRef.current((e as CustomEvent<FeedBox[]>).detail ?? []);
    // Photos added to a planner page: add them to its box (or story folder), creating it if needed
    const onAttach = (e: Event) => {
      const { slotId, urls, title, contentType, ensure, hidden } = (e as CustomEvent<FeedAttach>).detail;
      // Boxes removed in this feed but not yet synced are not brought back
      if (ensure && pendingDeletesRef.current.has(slotId)) return;
      setItems((curr) => {
        const box = curr.find((i) => i.id === slotId);
        // Making sure a page has its box: never add its photos again to a box that's already there, but a post or
        // reel box belongs in the grid (not Drafts) and follows the page's "Hide from feed"
        if (ensure && box) {
          if (contentType === "StoryFolder") return curr;
          const inDrafts = box.folderId === "draft-pool";
          if (!inDrafts && Boolean(box.isHiddenFromGrid) === Boolean(hidden)) return curr;
          return curr.map((i) => (i.id === slotId ? { ...i, folderId: inDrafts ? undefined : i.folderId, isHiddenFromGrid: Boolean(hidden) } : i));
        }
        const text = /^Untitled/.test(title) ? "" : title;
        if (contentType === "StoryFolder") {
          const folder: SlotItem[] = box ? [] : [{ id: slotId, type: "placeholder", urls: [], currentUrlIndex: 0, hexColor: "#E4E4E7", text: title, contentType: "StoryFolder" }];
          const stories: SlotItem[] = urls.map((u, n) => ({
            id: `story-${Date.now()}-${n}`,
            type: u.includes("-video-") ? "video" : "image",
            urls: [u],
            currentUrlIndex: 0,
            hexColor: "#E4E4E7",
            text: "",
            contentType: "Story",
            folderId: slotId,
          }));
          return [...folder, ...curr, ...stories];
        }
        if (box) {
          const fresh = urls.filter((u) => !(box.urls ?? []).includes(u));
          return fresh.length ? curr.map((i) => (i.id === slotId ? { ...i, type: "image", urls: [...(i.urls ?? []), ...fresh] } : i)) : curr;
        }
        return [
          { id: slotId, type: urls.length ? "image" : "placeholder", urls, currentUrlIndex: 0, hexColor: "#E4E4E7", text, contentType: contentType === "Reel" ? "Reel" : contentType === "Carousel" ? "Carousel" : "Post", ...(hidden ? { isHiddenFromGrid: true } : {}) },
          ...curr,
        ];
      });
    };
    window.addEventListener(FEED_ADD_EVENT, onAdd);
    window.addEventListener(FEED_ATTACH_EVENT, onAttach);
    return () => {
      window.removeEventListener(FEED_ADD_EVENT, onAdd);
      window.removeEventListener(FEED_ATTACH_EVENT, onAttach);
    };
  }, []);

  // Database → feed: remove boxes deleted in the planner (or another browser), and follow planner renames.
  const removeSlots = (slotIds: string[]) => {
    if (!slotIds.length) return;
    const gone = new Set(slotIds);
    // A removed folder takes the boxes inside it along (as deleting it in the feed does)
    const removed = (i: SlotItem) => gone.has(i.id) || (!!i.folderId && gone.has(i.folderId));
    setItems((curr) => (curr.some(removed) ? curr.filter((i) => !removed(i)) : curr));
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
    const onHidden = (e: Event) => {
      const { slotId, hidden } = (e as CustomEvent<{ slotId: string; hidden: boolean }>).detail;
      setItems((curr) => curr.map((i) => (i.id === slotId && i.isHiddenFromGrid !== hidden ? { ...i, isHiddenFromGrid: hidden } : i)));
    };
    // Photos removed on a story page: its stories with those photos leave the folder
    const onRemovePhotos = (e: Event) => {
      const { folderId, urls } = (e as CustomEvent<FeedRemovePhotos>).detail;
      setItems((curr) => curr.filter((i) => !(i.folderId === folderId && i.urls?.length && urls.includes(i.urls[0]))));
    };
    window.addEventListener(FEED_REMOVE_PHOTOS_EVENT, onRemovePhotos);
    window.addEventListener(PLANNER_DELETED_EVENT, onDeleted);
    window.addEventListener(PLANNER_TITLE_EVENT, onTitle);
    window.addEventListener(PLANNER_HIDDEN_EVENT, onHidden);
    return () => {
      window.removeEventListener(FEED_REMOVE_PHOTOS_EVENT, onRemovePhotos);
      window.removeEventListener(PLANNER_DELETED_EVENT, onDeleted);
      window.removeEventListener(PLANNER_TITLE_EVENT, onTitle);
      window.removeEventListener(PLANNER_HIDDEN_EVENT, onHidden);
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
      ...(libraryTab !== "drafts" && libraryTab !== "inspo" ? { library: libraryTab } : {}),
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

  // ---- Inspo photos dropped onto the phone ----
  const photoBox = (url: string, contentType: "Post" | "Reel"): SlotItem => ({
    id: `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: url.includes("-video-") ? "video" : "image",
    urls: [url],
    currentUrlIndex: 0,
    hexColor: "#E4E4E7",
    text: "",
    contentType,
  });
  /** Onto a post or reel: added to its photos. Beside one: a new post (or reel) per photo, right there. */
  const dropPhotosOnGrid = (targetId: string | null, mode: PhotoDropMode, urls: string[]) => {
    const kind = gridFilter === "Reel" ? "Reel" : "Post";
    updateItems((curr) => {
      if (targetId && mode === "into") {
        return curr.map((i) => {
          if (i.id !== targetId) return i;
          const have = i.urls ?? [];
          const fresh = urls.filter((u) => !have.includes(u));
          return fresh.length ? { ...i, type: "image", urls: [...have, ...fresh], currentUrlIndex: have.length } : i;
        });
      }
      const boxes = urls.map((u) => photoBox(u, kind));
      const at = targetId ? curr.findIndex((i) => i.id === targetId) : -1;
      if (at === -1) return [...curr, ...boxes];
      const index = mode === "before" ? at : at + 1;
      return [...curr.slice(0, index), ...boxes, ...curr.slice(index)];
    });
  };
  /** Into a story folder: each photo becomes a story at the end. */
  const dropPhotosInFolder = (folderId: string, urls: string[]) => {
    updateItems((curr) => [
      ...curr,
      ...urls.map((u, n) => ({
        id: `story-${Date.now().toString(36)}-${n}-${Math.random().toString(36).slice(2, 6)}`,
        type: (u.includes("-video-") ? "video" : "image") as SlotItem["type"],
        urls: [u],
        currentUrlIndex: 0,
        hexColor: "#E4E4E7",
        text: "",
        contentType: "Story" as const,
        folderId,
      })),
    ]);
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
                title="Photos are saved in this browser. Your feed layout is also backed up to your account."
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
                      : cloudState === "saving"
                        ? "Backing up…"
                        : "Saved"}
                </span>
              </button>


              {userId && (
                <button
                  onClick={() => setVaultOpen(true)}
                  title="Photos & backups: download all photos, restore a layout backup"
                  className="shrink-0 h-9 w-9 justify-center rounded-full border flex items-center bg-white/80 border-soft-200 text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
                >
                  <Archive size={14} />
                </button>
              )}

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

                {/* Status-bar strip under the notch, so scrolled content never slides beneath it */}
                <div className="hidden sm:block h-10 shrink-0 bg-white" aria-hidden="true" />
                <div
                  id="main-scroll-container"
                  className="flex-1 overflow-y-auto no-scrollbar pb-6 relative"
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
                          ["Facebook", "Facebook", Newspaper],
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
                    ) : gridFilter === "Facebook" ? (
                      <FacebookFeedView
                        pages={facebookPages}
                        onOpen={(id) => window.dispatchEvent(new CustomEvent(FEED_SELECT_EVENT, { detail: id }))}
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
                          onDropPhotos={dropPhotosInFolder}
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
                          onDropPhotos={dropPhotosInFolder}
                          onAddFolder={() => {
                            const folder: SlotItem = {
                              id: `folder-${Math.floor(Math.random() * 1000000000)}`,
                              type: "placeholder",
                              urls: [],
                              currentUrlIndex: 0,
                              hexColor: "#E4E4E7",
                              text: "New Folder",
                              contentType: "StoryFolder",
                            };
                            updateItems((curr) => [folder, ...curr]);
                            setActiveStoryFolderId(folder.id);
                          }}
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
                                  i.contentType === gridFilter && !i.folderId && !i.isHiddenFromGrid,
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
                        onDropPhotos={dropPhotosOnGrid}
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
            {activeSlotId && activeSlot && !pageSlotIds.has(activeSlotId) && (
              <>
                {/* Backdrop for Mobile Bottom Sheet */}
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs lg:hidden z-[70] animate-in fade-in duration-200"
                  onClick={() => setActiveSlotId(null)}
                />

                <div
                  className={`max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[80] max-lg:max-h-[85dvh] max-lg:rounded-b-none max-lg:pb-safe sm:max-lg:inset-x-auto sm:max-lg:left-1/2 sm:max-lg:-translate-x-1/2 sm:max-lg:w-[440px] lg:fixed lg:left-[464px] xl:left-[504px] lg:top-24 lg:z-[65] lg:w-80 lg:max-h-[calc(100dvh-8rem)] bg-white shadow-2xl border border-soft-200 rounded-3xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300`}
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

            {pageEditor &&
              (() => {
                const slot = items.find((i) => i.id === pageEditor.slotId);
                return slot
                  ? createPortal(
                      <EditorPanel
                        pageOnly
                        activeSlot={slot}
                        updateSlot={updateItem}
                        onClose={() => {}}
                        onDeleteSlot={async (id) => {
                          const ok = await confirm({
                            title: "Delete Post",
                            message: "Delete this post from the feed? Its page in the database is deleted too. This cannot be undone.",
                            confirmLabel: "Delete",
                          });
                          if (ok) {
                            updateItems((prev) => prev.filter((i) => i.id !== id));
                            if (activeSlotId === id) setActiveSlotId(null);
                          }
                        }}
                      />,
                      pageEditor.el,
                    )
                  : createPortal(
                      <p className="p-4 text-xs text-zinc-500">Adding this post&apos;s box to the feed…</p>,
                      pageEditor.el,
                    );
              })()}

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
      {vaultOpen && (
        <PhotoVault items={items} onClose={() => setVaultOpen(false)} onRestoreLayout={(snapshot) => updateItems(toMonochrome(snapshot))} />
      )}
      {libraryEl && status === "authenticated" &&
        createPortal(
          <section aria-label="Drafts and boards" className="@container bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-100 overflow-x-auto no-scrollbar">
              {LIBRARY_TABS.map(([id, label]) => [id, label, id === "drafts" ? draftCount : boardsIn(id).length] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id !== libraryTab) setActiveInspoFolderId(null);
                    setLibraryTab(id);
                    setLibraryOpen(true);
                  }}
                  aria-pressed={libraryTab === id}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                    libraryTab === id && libraryOpen ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {label}
                  <span className="text-xs opacity-60 tabular-nums">{count}</span>
                </button>
              ))}
              <span className="ml-2 hidden @5xl:inline shrink-0 text-xs text-zinc-400">Transfer anything to put it in the phone&apos;s grid</span>
              <button
                onClick={() => setLibraryOpen((o) => !o)}
                className="ml-auto shrink-0 px-3 h-8 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                aria-expanded={libraryOpen}
              >
                {libraryOpen ? "Hide" : "Show"}
              </button>
            </div>
            {libraryOpen && (
              <div className="max-h-[70vh] overflow-y-auto">
                {libraryTab !== "drafts" ? (
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
                          name={LIBRARY_TABS.find(([id]) => id === libraryTab)?.[1] ?? "Inspo"}
                          folders={boardsIn(libraryTab)}
                          allItems={items}
                          onFolderClick={(folderId) =>
                            setActiveInspoFolderId(folderId)
                          }
                          onAddFolder={handleCreateInspoFolder}
                          onDeleteFolder={handleDeleteInspoFolder}
                          updateItem={updateItem}
                        />
                      )
                ) : (
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
                )}
              </div>
            )}
          </section>,
          libraryEl,
        )}
      <ConfirmModal {...modalProps} />
    </div>
  );
}
