import { SlotItem } from "@/types";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface StoryListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  onDeleteFolder?: (folderId: string) => void;
  onAddFolder?: () => void;
}

export function StoryListView({ folders, allItems, onFolderClick, updateItem, onDeleteFolder, onAddFolder }: StoryListViewProps) {
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
      {folders.map(folder => {
        const storiesInFolder = allItems.filter(item => item.folderId === folder.id);
        const previewImages = storiesInFolder.filter(s => s.type === "image").map(s => s.urls[s.currentUrlIndex]).slice(0, 3);
        
        return (
          <div 
            key={folder.id}
            data-slot-id={folder.id}
            onClick={() => onFolderClick(folder.id)}
            className="w-full flex items-center justify-between p-4 border-b border-soft-100 cursor-pointer hover:bg-soft-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="relative w-[100px] h-[90px] flex-shrink-0 flex items-center">
                {previewImages.length > 0 ? (
                  previewImages.map((url, idx) => (
                    <div 
                      key={idx}
                      className="absolute top-0 bottom-0 my-auto w-[60px] h-[80px] rounded-md border-[2px] border-white overflow-hidden shadow-sm bg-pastel-100"
                      style={{ left: `${idx * 20}px`, zIndex: 10 - idx }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="absolute left-0 top-0 bottom-0 my-auto w-[60px] h-[80px] rounded-md border-[2px] border-white overflow-hidden shadow-sm bg-pastel-50 flex items-center justify-center">
                    <div className="w-1/2 h-1/2 bg-white/50 rounded-full" />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col">
                <input 
                  value={folder.text || folder.caption || ""}
                  onChange={(e) => updateItem(folder.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="New Folder"
                  className="font-bold text-foreground text-[18px] tracking-tight mb-0.5 bg-transparent border-none outline-none focus:ring-2 focus:ring-pastel-200 rounded px-1 -ml-1 w-full"
                />
                <span className="text-foreground/80 font-medium text-[15px]">
                  {storiesInFolder.length} items
                </span>
                {folder.scheduledTime && (
                  <span className="text-foreground font-medium text-[14px] mt-0.5">
                    Scheduled: {folder.scheduledTime}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onDeleteFolder && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(folder.id);
                  }}
                  className="p-2 text-foreground/30 hover:text-zinc-800 hover:bg-zinc-50 rounded-full transition-colors"
                  title="Delete Folder"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <ChevronRight size={20} className="text-foreground/30" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
