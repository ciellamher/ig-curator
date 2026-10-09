import { SlotItem } from "@/types";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LocalMediaImage } from "./LocalMedia";
import { droppedPhotos, isPhotoDrag } from "@/lib/photoDrag";

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
      <div className="p-3 grid grid-cols-1 gap-3">
        {folders.map(folder => {
          const storiesInFolder = allItems.filter(item => item.folderId === folder.id);
          const previewImages = storiesInFolder.filter(s => s.type === "image").map(s => s.urls[s.currentUrlIndex] ?? s.urls[0]).filter(Boolean).slice(0, 3);
          
          return (
            <div 
              key={folder.id}
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
              <div className={`w-full aspect-[5/2] rounded-xl overflow-hidden flex gap-0.5 bg-zinc-100 relative shadow-sm ${dropFolder === folder.id ? "ring-4 ring-zinc-950" : ""}`}>
                {previewImages.length > 0 ? (
                  <>
                    <div className="flex-1 h-full overflow-hidden">
                      <LocalMediaImage src={previewImages[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    {previewImages.length > 1 ? (
                      <div className="flex-1 h-full overflow-hidden">
                        <LocalMediaImage src={previewImages[1]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="flex-1 h-full bg-zinc-50" />
                    )}
                    {previewImages.length > 2 ? (
                      <div className="flex-1 h-full overflow-hidden">
                        <LocalMediaImage src={previewImages[2]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                    className="absolute top-2 right-2 p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                    title="Delete Folder"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              
              <div className="mt-1.5 px-1">
                <input 
                  value={folder.text || folder.caption || ""}
                  onChange={(e) => updateItem(folder.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="New Folder"
                  className="font-bold text-zinc-950 text-sm tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-zinc-200 rounded px-1 -ml-1 w-full truncate cursor-text"
                />
                <div className="text-[11px] font-medium text-zinc-500 px-1">
                  {storiesInFolder.length} Pin{storiesInFolder.length !== 1 ? 's' : ''}
                  {folder.scheduledTime && ` • ${folder.scheduledTime}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
