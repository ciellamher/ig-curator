import { useRef, useState } from "react";
import { SlotItem } from "@/types";
import { ChevronLeft, Eye, ImagePlus, Plus, X } from "lucide-react";
import { StoryPreviewModal } from "./StoryPreviewModal";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";
import { Masonry } from "./Masonry";
import { droppedPhotos, isPhotoDrag } from "@/lib/photoDrag";
import { saveFilesLocally } from "@/lib/localUpload";

interface StoryFolderViewProps {
  folder: SlotItem;
  stories: SlotItem[];
  onBack: () => void;
  updateItems: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
  /** Inspo photos dropped in the folder become stories */
  onDropPhotos?: (folderId: string, urls: string[]) => void;
}

/** Data type for moving a story within its folder */
const STORY_DRAG_TYPE = "application/x-ig-curator-story";
const isVideo = (url: string) => url.includes("-video-") || url.startsWith("data:video");

/** Inside a story folder: a vision board of its stories. Add photos, tap one to edit it, drag to rearrange. */
export function StoryFolderView({ folder, stories, onBack, updateItems, updateItem, activeSlotId, setActiveSlotId, onDropPhotos }: StoryFolderViewProps) {
  const [dropping, setDropping] = useState(false);
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
      updateItems((curr) => [...curr, ...urls.map(storyFor)]);
    } finally {
      setUploading(false);
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
    <div className="w-full h-full flex flex-col bg-white">
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

      <div
        className={`flex-1 overflow-y-auto pb-20 px-3 ${dropping ? "ring-4 ring-inset ring-zinc-950" : ""}`}
        onDragOver={(e) => {
          if (!onDropPhotos || !isPhotoDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropping(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
        }}
        onDrop={(e) => {
          if (!onDropPhotos || !isPhotoDrag(e)) return;
          e.preventDefault();
          setDropping(false);
          const urls = droppedPhotos(e);
          if (urls.length) onDropPhotos(folder.id, urls);
        }}
      >
        {stories.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-14 px-6">
            <p className="text-sm font-semibold text-zinc-800">No stories yet</p>
            <p className="text-xs text-zinc-500">Add photos, or drag them in from your boards.</p>
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
                    e.dataTransfer.effectAllowed = "move";
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateItems((prev) => prev.filter((i) => i.id !== story.id));
                      if (activeSlotId === story.id) setActiveSlotId(null);
                    }}
                    aria-label="Remove story"
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            }}
          />
        )}
      </div>

      {isPreviewOpen && <StoryPreviewModal stories={stories} initialIndex={previewStartIndex} onClose={() => setIsPreviewOpen(false)} />}
    </div>
  );
}
