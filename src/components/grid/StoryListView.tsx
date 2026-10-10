import { SlotItem } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";
import { droppedPhotos, isPhotoDrag } from "@/lib/photoDrag";
import { Masonry } from "./Masonry";

interface StoryListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  onDeleteFolder?: (folderId: string) => void;
  onAddFolder?: () => void;
  /** Inspo photos dropped on a folder become its stories */
  onDropPhotos?: (folderId: string, urls: string[]) => void;
}

export function StoryListView({ folders, allItems, onFolderClick, updateItem, onDeleteFolder, onAddFolder, onDropPhotos }: StoryListViewProps) {
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const header = (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
      <div>
        <h2 className="text-base font-bold text-zinc-950 leading-tight">Story folders</h2>
        <p className="text-[11px] text-zinc-500">{folders.length} folder{folders.length === 1 ? "" : "s"}</p>
      </div>
      {onAddFolder && (
        <button
          onClick={onAddFolder}
          className="ml-auto inline-flex items-center gap-1 px-3 h-8 rounded-full bg-zinc-950 text-white text-xs font-semibold hover:bg-black cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.5} /> New story folder
        </button>
      )}
    </div>
  );

  if (folders.length === 0) {
    return (
      <div className="w-full flex flex-col bg-white">
        {header}
        <div className="flex flex-col items-center text-center gap-3 py-16 px-6">
          <p className="text-sm font-semibold text-zinc-800">No story folders yet</p>
          <p className="text-xs text-zinc-500">Make a folder for each set of stories (a trip, a launch, a day out), then add stories to it.</p>
          {onAddFolder && (
            <button onClick={onAddFolder} className="mt-1 inline-flex items-center gap-1 px-4 h-9 rounded-full bg-zinc-950 text-white text-xs font-semibold cursor-pointer">
              <Plus size={14} strokeWidth={2.5} /> Create your first story folder
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white h-full overflow-y-auto">
      {header}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete folder"
        message="Are you sure you want to delete this folder and all its stories?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteTarget && onDeleteFolder) onDeleteFolder(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
      {/* Vision board: each folder shows its first photo at its own shape */}
      <Masonry
        className="p-3"
        items={folders}
        columnWidth={140}
        defaultRatio={1.3}
        renderItem={(folder, onRatio) => {
          const storiesInFolder = allItems.filter((item) => item.folderId === folder.id);
          const media = storiesInFolder.filter((s) => s.type !== "placeholder").map((s) => s.urls[s.currentUrlIndex] ?? s.urls[0]).filter(Boolean);
          const cover = folder.urls?.[0] || media[0];
          const empty = <div className="w-full aspect-[3/4] bg-zinc-100" />;
          return (
            <div
              data-slot-id={folder.id}
              data-no-outline
              onDragOver={(e) => {
                if (!onDropPhotos || !isPhotoDrag(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropFolder(folder.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropFolder((f) => (f === folder.id ? null : f));
              }}
              onDrop={(e) => {
                if (!onDropPhotos || !isPhotoDrag(e)) return;
                e.preventDefault();
                setDropFolder(null);
                const urls = droppedPhotos(e);
                if (urls.length) onDropPhotos(folder.id, urls);
              }}
              onClick={() => onFolderClick(folder.id)}
              className="flex flex-col group cursor-pointer"
            >
              <div className={`relative w-full min-h-16 rounded-xl overflow-hidden bg-zinc-100 shadow-sm ${dropFolder === folder.id ? "ring-4 ring-zinc-950" : ""}`}>
                {!cover ? (
                  empty
                ) : cover.includes("-video-") ? (
                  <LocalMediaVideo src={cover} fallback={empty} muted playsInline preload="metadata" onLoadedMetadata={(e) => onRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight)} className="block w-full h-auto group-hover:brightness-95 transition" />
                ) : (
                  <LocalMediaImage src={cover} fallback={empty} alt="" onLoad={(e) => onRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} className="block w-full h-auto group-hover:brightness-95 transition" />
                )}
                {onDeleteFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(folder.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity hover:bg-black/60 cursor-pointer"
                    title="Delete Folder"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="mt-1.5 px-1">
                <input
                  value={folder.text || folder.caption || ""}
                  onChange={(e) => updateItem(folder.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="New Folder"
                  aria-label="Folder name"
                  className="font-bold text-zinc-950 text-[13px] tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-zinc-200 rounded px-1 -ml-1 w-full truncate cursor-text"
                />
                <div className="text-[11px] font-medium text-zinc-500">
                  {storiesInFolder.length} {storiesInFolder.length === 1 ? "story" : "stories"}
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
