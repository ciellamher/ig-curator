import { useState } from "react";
import { SlotItem } from "@/types";
import { ChevronLeft, Eye, Plus } from "lucide-react";
import { GridItem } from "./GridItem";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { StoryPreviewModal } from "./StoryPreviewModal";

interface StoryFolderViewProps {
  folder: SlotItem;
  stories: SlotItem[];
  onBack: () => void;
  updateItems: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  updateItem: (id: string, updates: Partial<SlotItem>) => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
}

export function StoryFolderView({ folder, stories, onBack, updateItems, updateItem, activeSlotId, setActiveSlotId }: StoryFolderViewProps) {
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);

  const handleAddStory = () => {
    const newStory: SlotItem = {
      id: `story-${Math.floor(Math.random() * 1000000)}`,
      type: "placeholder",
      urls: [],
      currentUrlIndex: 0,
      hexColor: "#E5D3C8",
      text: "",
      contentType: "Story",
      folderId: folder.id, // Linking to the current folder
    };
    updateItems(curr => [...curr, newStory]);
  };

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      updateItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Detail Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-soft-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <button onClick={onBack} className="p-1 hover:bg-soft-50 rounded-full transition-colors text-foreground">
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <span className="font-bold text-[18px] text-foreground tracking-tight">
          {folder.text || folder.caption || "Folder"}
        </span>
        <button onClick={() => { setPreviewStartIndex(0); setIsPreviewOpen(true); }} className="p-1 hover:bg-soft-50 rounded-full transition-colors text-foreground">
          <Eye size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-20 p-0.5">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-3 gap-[1px] bg-white">
            <SortableContext items={stories} strategy={rectSortingStrategy}>
              {stories.map(item => (
                <GridItem 
                  key={item.id} 
                  item={item} 
                  updateItem={updateItem}
                  gridFilter="Story" 
                  isActive={activeSlotId === item.id}
                  onClick={() => setActiveSlotId(item.id)}
                  onDoubleClick={() => {
                    // Only stories with images can be previewed
                    const validStories = stories.filter(s => s.type === "image" && s.urls.length > 0);
                    const idx = validStories.findIndex(s => s.id === item.id);
                    if (idx !== -1) {
                      setPreviewStartIndex(idx);
                      setIsPreviewOpen(true);
                    }
                  }}
                  onDelete={(id) => {
                    updateItems(prev => prev.filter(i => i.id !== id));
                    if (activeSlotId === id) setActiveSlotId(null);
                  }}
                />
              ))}
            </SortableContext>
            
            {/* The Big Add Button */}
            <div 
              onClick={handleAddStory}
              className="w-full aspect-[9/16] bg-white flex items-center justify-center cursor-pointer hover:bg-soft-50 transition-colors border border-soft-100"
            >
              <div className="w-16 h-16 rounded-full bg-foreground text-white flex items-center justify-center shadow-md">
                <Plus size={36} strokeWidth={2} />
              </div>
            </div>
          </div>
        </DndContext>
      </div>

      {/* Footer */}
      <div 
        className="w-full p-4 border-t border-soft-100 bg-white flex items-center justify-between sticky bottom-0 z-20 cursor-pointer hover:bg-soft-50 transition-colors"
        onClick={() => setActiveSlotId(folder.id)}
      >
        <span className="font-semibold text-[15px] text-foreground">Scheduled</span>
        <span className="font-medium text-[15px] text-foreground/60">
          {folder.scheduledTime || "Not scheduled yet"}
        </span>
      </div>

      {isPreviewOpen && (
        <StoryPreviewModal 
          stories={stories}
          initialIndex={previewStartIndex}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
