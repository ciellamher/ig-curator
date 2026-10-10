import { useRef, useState } from "react";
import { SlotItem } from "@/types";
import { ArrowUpRight, ChevronLeft, Eye, ImagePlus, Plus, X } from "lucide-react";
import { StoryPreviewModal } from "./StoryPreviewModal";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";
import { Masonry } from "./Masonry";
import { droppedPhotos, isPhotoDrag, PHOTO_DRAG_TYPE } from "@/lib/photoDrag";
import { saveFilesLocally } from "@/lib/localUpload";

interface StoryFolderViewProps {
  folder: SlotItem;
  stories: SlotItem[];
  allItems?: SlotItem[];
  onBack: () => void;
  updateItems: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
  /** Inspo photos dropped in the folder become stories */
  onDropPhotos?: (folderId: string, urls: string[]) => void;
  /** Transfer stories/photos from this folder to the active board */
  onTransferToBoard?: (urls: string[]) => void;
  activeBoardName?: string;
}

/** Data type for moving a story within its folder */
const STORY_DRAG_TYPE = "application/x-ig-curator-story";
const isVideo = (url: string) => url.includes("-video-") || url.startsWith("data:video");

/** Inside a story folder: a vision board of its stories. Add photos, tap one to edit it, drag to rearrange. */
export function StoryFolderView({
  folder,
  stories,
  allItems,
  onBack,
  updateItems,
  updateItem,
  activeSlotId,
  setActiveSlotId,
  onDropPhotos,
  onTransferToBoard,
  activeBoardName,
}: StoryFolderViewProps) {
  const [dropping, setDropping] = useState(false);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const storyFor = (url: string, n: number): SlotItem => ({
    id: `story-${Date.now().toString(36)}-${n}-${Math.random().toString(36).slice(2, 6)}`,
    type: isVideo(url) ? "video" : "image",
    urls: [url],
    currentUrlIndex: 0,
    hexColor: "#E4E4E7",
    text: "",
    contentType: "Story",
    folderId: folder.id,
  });

  const addPhotos = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await saveFilesLocally(files);
      if (onDropPhotos) {
        onDropPhotos(folder.id, urls);
      } else {
        updateItems((curr) => [...curr, ...urls.map(storyFor)]);
      }
    } finally {
      setUploading(false);
    }
  };

  const canAcceptDrop = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes(STORY_DRAG_TYPE)) return false; // Story reorder handled separately
    return (
      types.includes("Files") ||
      isPhotoDrag(e) ||
      types.includes("application/folder-ids") ||
      types.includes("application/folder-id") ||
      types.includes("text/uri-list") ||
      types.includes("text/plain")
    );
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!canAcceptDrop(e)) return;
    e.preventDefault();
    dragCounter.current++;
    setDropping(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canAcceptDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dropping) setDropping(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDropping(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes(STORY_DRAG_TYPE)) return; // Reordering within folder
    e.preventDefault();
    dragCounter.current = 0;
    setDropping(false);

    // 1. Files dragged from computer (Finder / desktop)
    const files = Array.from(e.dataTransfer.files || []).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/") || !f.type
    );
    if (files.length > 0) {
      await addPhotos(files);
      return;
    }

    // 2. Photos dragged from inspo boards
    const photoUrls = droppedPhotos(e);
    if (photoUrls.length > 0) {
      if (onDropPhotos) {
        onDropPhotos(folder.id, photoUrls);
      } else {
        updateItems((curr) => [...curr, ...photoUrls.map(storyFor)]);
      }
      return;
    }

    // 3. Inspo items or folders dragged by id
    const folderIdsJson = e.dataTransfer.getData("application/folder-ids");
    const singleFolderId = e.dataTransfer.getData("application/folder-id");
    let ids: string[] = [];
    if (folderIdsJson) {
      try {
        ids = JSON.parse(folderIdsJson);
      } catch {}
    } else if (singleFolderId) {
      ids = [singleFolderId];
    }
    if (ids.length > 0 && allItems) {
      const extractedUrls: string[] = [];
      for (const id of ids) {
        const item = allItems.find((i) => i.id === id);
        if (item?.urls?.length) {
          extractedUrls.push(...item.urls);
        } else {
          const children = allItems.filter((i) => i.folderId === id);
          for (const child of children) {
            if (child.urls?.length) extractedUrls.push(...child.urls);
          }
        }
      }
      if (extractedUrls.length > 0) {
        if (onDropPhotos) {
          onDropPhotos(folder.id, extractedUrls);
        } else {
          updateItems((curr) => [...curr, ...extractedUrls.map(storyFor)]);
        }
        return;
      }
    }

    // 4. URL string or web image
    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (
      uri &&
      (uri.startsWith("http://") ||
        uri.startsWith("https://") ||
        uri.startsWith("data:image/") ||
        uri.startsWith("local-media://") ||
        uri.startsWith("blob:"))
    ) {
      if (onDropPhotos) {
        onDropPhotos(folder.id, [uri]);
      } else {
        updateItems((curr) => [...curr, storyFor(uri, 0)]);
      }
    }
  };

  const handleAddEmpty = () => {
    const story: SlotItem = { ...storyFor("", 0), type: "placeholder", urls: [] };
    updateItems((curr) => [...curr, story]);
    setActiveSlotId(story.id); // straight to its editor
  };

  /** Moves a story to just before another one (order in the folder = order they play) */
  const moveStory = (id: string, beforeId: string) => {
    if (id === beforeId) return;
    updateItems((curr) => {
      const moving = curr.find((i) => i.id === id);
      if (!moving) return curr;
      const rest = curr.filter((i) => i.id !== id);
      const at = rest.findIndex((i) => i.id === beforeId);
      return at === -1 ? curr : [...rest.slice(0, at), moving, ...rest.slice(at)];
    });
  };

  const playable = stories.filter((s) => s.type !== "placeholder" && s.urls.length > 0);

  return (
    <div
      className={`w-full h-full flex flex-col bg-white relative transition-all ${
        dropping ? "ring-4 ring-inset ring-zinc-950" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-soft-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <button onClick={onBack} aria-label="Back to story folders" className="p-1 hover:bg-soft-50 rounded-full transition-colors text-foreground cursor-pointer">
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <input
          value={folder.text || folder.caption || ""}
          onChange={(e) => updateItem(folder.id, { text: e.target.value })}
          placeholder="New Folder"
          aria-label="Folder name"
          className="font-bold text-[18px] text-foreground tracking-tight text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-pastel-200 rounded px-2 w-[150px]"
        />
        <button
          onClick={() => {
            setPreviewStartIndex(0);
            setIsPreviewOpen(true);
          }}
          aria-label="Play stories"
          className="p-1 hover:bg-soft-50 rounded-full transition-colors text-foreground cursor-pointer"
        >
          <Eye size={24} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-zinc-950 text-white text-xs font-semibold hover:bg-black disabled:opacity-50 cursor-pointer"
        >
          <ImagePlus size={14} /> {uploading ? "Adding…" : "Add photos"}
        </button>
        <button
          onClick={handleAddEmpty}
          className="inline-flex items-center gap-1 px-3 h-8 rounded-full border border-zinc-300 text-zinc-800 text-xs font-semibold hover:border-zinc-950 cursor-pointer"
        >
          <Plus size={13} /> Empty story
        </button>
        {onTransferToBoard && activeBoardName && playable.length > 0 && (
          <button
            onClick={() => {
              const allUrls = playable.flatMap((s) => s.urls).filter(Boolean);
              if (allUrls.length) onTransferToBoard(allUrls);
            }}
            className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold cursor-pointer transition-colors"
            title={`Transfer stories to ${activeBoardName}`}
          >
            <ArrowUpRight size={13} /> To {activeBoardName}
          </button>
        )}
        <span className="ml-auto text-[11px] text-zinc-400">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            addPhotos(files);
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-3">
        {stories.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center text-center gap-2 py-16 px-6 mx-2 my-4 rounded-2xl border-2 transition-all ${
              dropping
                ? "border-dashed border-zinc-950 bg-zinc-50 scale-[1.02]"
                : "border-dashed border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-colors ${dropping ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600"}`}>
              <ImagePlus size={22} />
            </div>
            <p className="text-sm font-semibold text-zinc-800">
              {dropping ? "Drop photos here" : "No stories yet"}
            </p>
            <p className="text-xs text-zinc-500 max-w-[240px]">
              {dropping
                ? "Release to add photos to this story folder"
                : "Add photos, or drag them in from your boards or computer."}
            </p>
          </div>
        ) : (
          <Masonry
            items={stories}
            columnWidth={130}
            defaultRatio={16 / 9}
            renderItem={(story, onRatio) => {
              const url = story.urls[story.currentUrlIndex || 0] ?? story.urls[0];
              const empty = (
                <div className="w-full aspect-[9/16] flex items-center justify-center p-2" style={{ backgroundColor: story.hexColor || "#E4E4E7" }}>
                  <span className="text-white text-center text-xs font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]">{story.text || "Story"}</span>
                </div>
              );
              return (
                <div
                  data-slot-id={story.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(STORY_DRAG_TYPE, story.id);
                    e.dataTransfer.setData("application/x-ig-curator-story-id", story.id);
                    e.dataTransfer.setData(PHOTO_DRAG_TYPE, JSON.stringify(story.urls));
                    if (url) {
                      e.dataTransfer.setData("text/plain", url);
                      e.dataTransfer.setData("text/uri-list", url);
                    }
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  onDragOver={(e) => {
                    if (!Array.from(e.dataTransfer.types).includes(STORY_DRAG_TYPE)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(story.id);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === story.id ? null : d))}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData(STORY_DRAG_TYPE);
                    if (!id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(null);
                    moveStory(id, story.id);
                  }}
                  onClick={() => setActiveSlotId(activeSlotId === story.id ? null : story.id)}
                  onDoubleClick={() => {
                    const idx = playable.findIndex((s) => s.id === story.id);
                    if (idx !== -1) {
                      setPreviewStartIndex(idx);
                      setIsPreviewOpen(true);
                    }
                  }}
                  className={`group relative min-h-20 overflow-hidden rounded-xl bg-zinc-100 cursor-pointer transition-all ${
                    activeSlotId === story.id ? "ring-4 ring-inset ring-zinc-950" : ""
                  } ${dragOver === story.id ? "outline outline-2 outline-offset-2 outline-zinc-950" : ""}`}
                >
                  {!url || story.type === "placeholder" ? (
                    empty
                  ) : isVideo(url) ? (
                    <LocalMediaVideo
                      src={url}
                      fallback={empty}
                      muted
                      loop
                      autoPlay
                      playsInline
                      onLoadedMetadata={(e) => onRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
                      className="block w-full h-auto"
                    />
                  ) : (
                    <LocalMediaImage
                      src={url}
                      fallback={empty}
                      alt=""
                      onLoad={(e) => onRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                      className="block w-full h-auto"
                    />
                  )}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity z-10">
                    {onTransferToBoard && story.urls && story.urls.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTransferToBoard(story.urls);
                        }}
                        aria-label={`Transfer to ${activeBoardName || "board"}`}
                        title={`Transfer to ${activeBoardName || "board"}`}
                        className="p-1 rounded-full bg-black/45 hover:bg-black/75 text-white transition-colors cursor-pointer"
                      >
                        <ArrowUpRight size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItems((prev) => prev.filter((i) => i.id !== story.id));
                        if (activeSlotId === story.id) setActiveSlotId(null);
                      }}
                      aria-label="Remove story"
                      title="Remove story"
                      className="p-1 rounded-full bg-black/45 hover:bg-black/75 text-white transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {uploading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-zinc-800">Adding photos…</p>
        </div>
      )}

      {isPreviewOpen && <StoryPreviewModal stories={stories} initialIndex={previewStartIndex} onClose={() => setIsPreviewOpen(false)} />}
    </div>
  );
}
