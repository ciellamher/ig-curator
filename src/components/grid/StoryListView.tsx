import { SlotItem } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";
import { draggedItemIds, droppedPhotos, isPhotoDrag, PHOTO_DRAG_TYPE } from "@/lib/photoDrag";
import { saveFilesLocally } from "@/lib/localUpload";

interface StoryListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  onDeleteFolder?: (folderId: string) => void;
  onAddFolder?: () => void;
  /** Inspo photos dropped on a folder become its stories */
  onDropPhotos?: (folderId: string, urls: string[], sourceIds?: string[]) => void;
  /** Posts and reels on the phone, shown under the folders whether or not they're also stories */
  posts?: SlotItem[];
  onPostClick?: (id: string) => void;
}

/** Up to three photos side by side, like a folder cover */
function PhotoStrip({ urls }: { urls: string[] }) {
  return (
    <>
      {[0, 1, 2].map((n) => {
        const url = urls[n];
        if (!url) return <div key={n} className={`flex-1 h-full ${urls.length ? "bg-zinc-50" : "bg-zinc-100"}`} />;
        const cls = "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500";
        return (
          <div key={n} className="flex-1 h-full overflow-hidden">
            {url.includes("-video-") || url.startsWith("data:video") ? (
              <LocalMediaVideo src={url} muted playsInline preload="metadata" className={cls} />
            ) : (
              <LocalMediaImage src={url} alt="" className={cls} />
            )}
          </div>
        );
      })}
    </>
  );
}

export function StoryListView({ folders, allItems, onFolderClick, updateItem, onDeleteFolder, onAddFolder, onDropPhotos, posts = [], onPostClick }: StoryListViewProps) {
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

  if (folders.length === 0 && posts.length === 0) {
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
      <div className="p-3 grid grid-cols-1 gap-3 empty:hidden">
        {folders.map(folder => {
          const storiesInFolder = allItems.filter(item => item.folderId === folder.id);
          const customCover = folder.urls?.[0];
          const rawPreviews = storiesInFolder.filter(s => s.type !== "placeholder").map(s => s.urls[s.currentUrlIndex] ?? s.urls[0]).filter(Boolean);
          const previewImages = customCover
            ? [customCover, ...rawPreviews.filter(u => u !== customCover)].slice(0, 3)
            : rawPreviews.slice(0, 3);
          
          return (
            <div 
              key={folder.id}
              data-slot-id={folder.id}
              data-no-outline
              draggable
              onDragStart={(e) => {
                const storiesInFolder = allItems.filter(item => item.folderId === folder.id);
                const urls = storiesInFolder.flatMap(s => s.urls).filter(Boolean);
                e.dataTransfer.setData(PHOTO_DRAG_TYPE, JSON.stringify(urls));
                e.dataTransfer.setData("application/folder-id", folder.id);
                e.dataTransfer.effectAllowed = "copyMove";
              }}
              onDragOver={(e) => {
                const types = Array.from(e.dataTransfer.types || []);
                const canDrop = types.includes("Files") || isPhotoDrag(e);
                if (!onDropPhotos || !canDrop) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropFolder(folder.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropFolder((f) => (f === folder.id ? null : f));
              }}
              onDrop={async (e) => {
                if (!onDropPhotos) return;
                e.preventDefault();
                setDropFolder(null);
                const files = Array.from(e.dataTransfer.files || []).filter(
                  (f) => f.type.startsWith("image/") || f.type.startsWith("video/") || !f.type
                );
                if (files.length > 0) {
                  const urls = await saveFilesLocally(files);
                  if (urls.length) onDropPhotos(folder.id, urls);
                  return;
                }
                const urls = droppedPhotos(e);
                if (urls.length) onDropPhotos(folder.id, urls, draggedItemIds(e));
              }}
              onClick={() => onFolderClick(folder.id)}
              className="flex flex-col group cursor-pointer"
            >
              <div className={`w-full aspect-[5/2] rounded-xl overflow-hidden flex gap-0.5 bg-zinc-100 relative shadow-sm ${dropFolder === folder.id ? "ring-4 ring-zinc-950" : ""}`}>
                {previewImages.length > 0 ? (
                  <>
                    <div className="flex-1 h-full overflow-hidden">
                      {previewImages[0].includes("-video-") ? <LocalMediaVideo src={previewImages[0]} muted playsInline preload="metadata" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <LocalMediaImage src={previewImages[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    </div>
                    {previewImages.length > 1 ? (
                      <div className="flex-1 h-full overflow-hidden">
                        {previewImages[1].includes("-video-") ? <LocalMediaVideo src={previewImages[1]} muted playsInline preload="metadata" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <LocalMediaImage src={previewImages[1]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                      </div>
                    ) : (
                      <div className="flex-1 h-full bg-zinc-50" />
                    )}
                    {previewImages.length > 2 ? (
                      <div className="flex-1 h-full overflow-hidden">
                        {previewImages[2].includes("-video-") ? <LocalMediaVideo src={previewImages[2]} muted playsInline preload="metadata" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <LocalMediaImage src={previewImages[2]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                      </div>
                    ) : (
                      <div className="flex-1 h-full bg-zinc-50" />
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex-1 h-full bg-zinc-100" />
                    <div className="flex-1 h-full bg-zinc-100" />
                    <div className="flex-1 h-full bg-zinc-100" />
                  </>
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
        })}
      </div>
      {posts.length > 0 && (
        <>
          <div className="px-4 pt-2">
            <h3 className="text-[13px] font-bold text-zinc-950">Posts &amp; reels</h3>
            <p className="text-[11px] text-zinc-500">Everything on your grid, to use as stories too</p>
          </div>
          <div className="p-3 grid grid-cols-1 gap-3">
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                data-slot-id={post.id}
                data-no-outline
                onClick={() => onPostClick?.(post.id)}
                className="flex flex-col group cursor-pointer text-left"
              >
                <div className="w-full aspect-[5/2] rounded-xl overflow-hidden flex gap-0.5 bg-zinc-100 relative shadow-sm">
                  <PhotoStrip urls={post.coverUrl ? [post.coverUrl, ...post.urls.filter((u) => u !== post.coverUrl)] : post.urls} />
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px] font-semibold">
                    {post.contentType === "Reel" ? "Reel" : "Post"}
                  </span>
                </div>
                <div className="mt-1.5 px-1">
                  <div className="font-bold text-zinc-950 text-[13px] tracking-tight truncate">
                    {post.text?.trim() || (post.contentType === "Reel" ? "Untitled reel" : "Untitled post")}
                  </div>
                  <div className="text-[11px] font-medium text-zinc-500">
                    {post.urls.length} {post.urls.length === 1 ? "photo" : "photos"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
