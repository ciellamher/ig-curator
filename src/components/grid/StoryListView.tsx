import { SlotItem } from "@/types";
import { ChevronRight } from "lucide-react";

interface StoryListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
}

export function StoryListView({ folders, allItems, onFolderClick }: StoryListViewProps) {
  if (folders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center pt-20">
        <p className="text-foreground/50 font-medium text-lg">No story folders yet.</p>
        <p className="text-foreground/40 text-sm mt-1">Click + to create one.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white h-full overflow-y-auto">
      {folders.map(folder => {
        const storiesInFolder = allItems.filter(item => item.folderId === folder.id);
        const previewImages = storiesInFolder.filter(s => s.type === "image").map(s => s.urls[s.currentUrlIndex]).slice(0, 3);
        
        return (
          <div 
            key={folder.id}
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
                <span className="font-bold text-foreground text-[18px] tracking-tight mb-0.5">
                  {folder.text || folder.caption || "New Folder"}
                </span>
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
            <ChevronRight size={20} className="text-foreground/30" />
          </div>
        );
      })}
    </div>
  );
}
